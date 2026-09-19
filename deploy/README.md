# Production deployment

A single EC2 host (t3.small, `ap-south-1`, Ubuntu 26.04) runs the API under
**systemd via Bun**, plus PostgreSQL 18, Redis 8 and coturn. nginx terminates
TLS and proxies to the API on `127.0.0.1:3000`.

Only three dependencies are external: Cloudflare R2 (uploads), Resend (email)
and Vercel (web). `infra/` is the local development stack and is not used here.

Postgres and Redis are co-located with the API on purpose: every request takes
a Redis token-bucket and most touch Postgres several times, so a managed
database in another region added tens of milliseconds to every endpoint. The
trade is that this host owns its data and has no managed backups — an accepted
non-goal for this project.

## One-time host setup

```bash
# 1. Bun (the systemd unit expects /home/ubuntu/.bun/bin/bun)
curl -fsSL https://bun.sh/install | bash

# 2. Swap. `bun install` pulls the full dependency tree (the Prisma CLI is a
#    devDependency) and will OOM on a small instance without it.
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-bakbak-swap.conf

# 3. PostgreSQL 18 — matches infra/docker-compose.yml and CI.
sudo apt-get install -y postgresql postgresql-contrib
sudo -u postgres createuser --pwprompt bakbak      # note the password
sudo -u postgres createdb -O bakbak bakbak
# citext backs the case-insensitive email/username columns in the schema.
sudo -u postgres psql -d bakbak -c 'CREATE EXTENSION IF NOT EXISTS citext;'
# Tuning for a 2GiB box shared with the API, Redis, coturn and nginx:
sudo tee /etc/postgresql/18/main/conf.d/bakbak.conf >/dev/null <<'CONF'
shared_buffers = 256MB
effective_cache_size = 768MB
work_mem = 8MB
maintenance_work_mem = 64MB
max_connections = 50
random_page_cost = 1.1
effective_io_concurrency = 200
CONF
sudo systemctl restart postgresql

# 4. Redis 8. maxmemory-policy is noeviction on purpose: presence leases and
#    rate-limit buckets are correctness state, not a cache — evicting them
#    silently would stop rate limiting and corrupt presence.
sudo apt-get install -y redis-server
sudo tee -a /etc/redis/redis.conf >/dev/null <<'CONF'
bind 127.0.0.1 -::1
maxmemory 256mb
maxmemory-policy noeviction
CONF
sudo systemctl enable --now redis-server

# 5. Repo. Private, so the box needs its own read-only GitHub deploy key:
#    ssh-keygen -t ed25519 -f ~/.ssh/github-deploy -N ""
#    then add ~/.ssh/github-deploy.pub under Settings → Deploy keys.
git clone git@github.com:mouanvikram/bakbak.git ~/bakbak

# 6. Environment — .env.prod is gitignored, so copy it from your machine:
#      scp .env.prod bakbak-ec2:~/bakbak/.env.prod
chmod 600 ~/bakbak/.env.prod

# 7. First install + client generation + schema.
cd ~/bakbak && bun install --frozen-lockfile
cd packages/db
export NODE_ENV=production
export PRODUCTION_DB_URL="$(grep -E '^PRODUCTION_DB_URL=' ~/bakbak/.env.prod | cut -d= -f2-)"
bunx prisma generate && bunx prisma migrate deploy

# 8. systemd unit
sudo cp ~/bakbak/deploy/bakbak-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now bakbak-api

# 9. Let the deploy workflow restart the service without a password prompt.
#    Use the real path — `which systemctl` is /usr/bin on Ubuntu, and sudoers
#    matches the literal string, so /bin/systemctl would silently not apply.
echo 'ubuntu ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart bakbak-api, /usr/bin/systemctl is-active bakbak-api' \
  | sudo tee /etc/sudoers.d/bakbak-deploy
sudo chmod 440 /etc/sudoers.d/bakbak-deploy

# 10. nginx + TLS
sudo cp ~/bakbak/deploy/nginx-api.conf /etc/nginx/sites-available/api.bakbak.mouan.in
sudo ln -sf /etc/nginx/sites-available/api.bakbak.mouan.in /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 11. coturn (native, not Docker — TURN needs a wide UDP range and the host's
#     real address). Config in /etc/turnserver.conf; Ubuntu ships it disabled,
#     so TURNSERVER_ENABLED=1 in /etc/default/coturn is required or the unit
#     starts and does nothing.
sudo apt-get install -y coturn
```

## GitHub secrets

| Secret        | Value                                                                             |
| ------------- | --------------------------------------------------------------------------------- |
| `EC2_HOST`    | the Elastic IP, or `api.bakbak.mouan.in`                                          |
| `EC2_USER`    | `ubuntu`                                                                          |
| `EC2_SSH_KEY` | private key with access to the host (the full PEM, including header/footer lines) |
| `API_DOMAIN`  | `api.bakbak.mouan.in` — used by the post-deploy smoke test                        |

## Security group

`sg-0e31b787aa25c22ca` inbound:

| Port        | Protocol  | Source      | Purpose                                                                                                                                                     |
| ----------- | --------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 22          | TCP       | `0.0.0.0/0` | SSH — GitHub Actions runners have rotating IPs, so the deploy cannot connect through an IP-scoped rule. The host is key-only (`PasswordAuthentication no`). |
| 80          | TCP       | `0.0.0.0/0` | HTTP→HTTPS redirect and ACME renewal                                                                                                                        |
| 443         | TCP       | `0.0.0.0/0` | the API                                                                                                                                                     |
| 3478        | TCP + UDP | `0.0.0.0/0` | STUN/TURN                                                                                                                                                   |
| 49160-49200 | UDP       | `0.0.0.0/0` | TURN relay allocations                                                                                                                                      |

Port 3000 must **not** be open. `httpServer.listen(env.PORT)` binds `0.0.0.0`,
so the security group is the only thing keeping the API off the public internet
without TLS.

## Operating

```bash
sudo systemctl status bakbak-api
journalctl -u bakbak-api -f
journalctl -u coturn -n 50
curl -s https://api.bakbak.mouan.in/readyz

# psql, without handling the password:
psql "$(grep -E '^PRODUCTION_DB_URL=' ~/bakbak/.env.prod | cut -d= -f2-)"
redis-cli ping
```

`/readyz` reports each dependency separately (`database`, `redis`, `storage`,
`email`), so a failure names the culprit rather than just going red.

## Rollback

There is no image to roll back to, so redeploy a known-good commit:

```bash
cd ~/bakbak
git reset --hard <good-sha>
bun install --frozen-lockfile
cd packages/db && bunx prisma generate && cd ..
sudo systemctl restart bakbak-api
```

Migrations are **not** reversed by this. A destructive migration needs an
expand/contract rollout rather than a rollback.

## Backups

There are none, deliberately — see the scope note in the root README. Postgres
and Redis both live on this instance, so losing it loses the data. The
portfolio-scale answer is a seed script that rebuilds a presentable demo state,
not a backup regime.
