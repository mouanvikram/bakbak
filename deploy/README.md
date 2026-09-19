# Production deployment

The API runs under **systemd via Bun** on a single EC2 host. Everything else is
managed: Neon (Postgres), Upstash (Redis), Cloudflare R2 (object storage),
Resend (email), Vercel (web). `infra/` is the local development stack and is
not used here.

nginx terminates TLS and proxies to the API on `127.0.0.1:3000`; coturn runs on
the same host for WebRTC relaying.

## One-time host setup

```bash
# 1. Bun (the systemd unit expects /home/ubuntu/.bun/bin/bun)
curl -fsSL https://bun.sh/install | bash

# 2. Swap. The box has 908MB of RAM and no swap; `bun install` needs the full
#    dependency tree (the Prisma CLI is a devDependency) and will OOM without it.
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 3. Repo
git clone https://github.com/mouanvikram/bakbak.git ~/bakbak

# 4. Environment — .env.prod is gitignored, so copy it from your machine:
#      scp .env.prod bakbak-ec2:~/bakbak/.env.prod
chmod 600 ~/bakbak/.env.prod

# 5. First install + client generation. Migrations need Neon's direct
#    (unpooled) connection: the pooled endpoint refuses Prisma Migrate's
#    advisory locks (P1002). PRODUCTION_DB_DIRECT_URL is the direct string from
#    the Neon dashboard ("Connection details" → Direct connection).
cd ~/bakbak && bun install --frozen-lockfile
cd packages/db
export NODE_ENV=production
export PRODUCTION_DB_DIRECT_URL="$(grep -E '^PRODUCTION_DB_DIRECT_URL=' ~/bakbak/.env.prod | cut -d= -f2-)"
bunx prisma generate && bunx prisma migrate deploy

# 6. systemd unit
sudo cp ~/bakbak/deploy/bakbak-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now bakbak-api

# 7. Let the deploy user restart the service without a password prompt.
echo 'ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl restart bakbak-api, /bin/systemctl is-active bakbak-api' \
  | sudo tee /etc/sudoers.d/bakbak-deploy
sudo chmod 440 /etc/sudoers.d/bakbak-deploy

# 8. nginx
sudo cp ~/bakbak/deploy/nginx-api.conf /etc/nginx/sites-available/api.bakbak.mouan.in
sudo nginx -t && sudo systemctl reload nginx
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

| Port        | Protocol  | Source      | Purpose                                      |
| ----------- | --------- | ----------- | -------------------------------------------- |
| 22          | TCP       | your IP     | SSH (or drop it and use SSM Session Manager) |
| 80          | TCP       | `0.0.0.0/0` | HTTP→HTTPS redirect and ACME renewal         |
| 443         | TCP       | `0.0.0.0/0` | the API                                      |
| 3478        | TCP + UDP | `0.0.0.0/0` | STUN/TURN                                    |
| 49160-49200 | UDP       | `0.0.0.0/0` | TURN relay allocations                       |

Port 3000 must **not** be open. `httpServer.listen(env.PORT)` binds `0.0.0.0`,
so the security group is the only thing keeping the API off the public internet
without TLS.

## Operating

```bash
sudo systemctl status bakbak-api
journalctl -u bakbak-api -f
journalctl -u coturn -n 50
curl -s https://api.bakbak.mouan.in/readyz
```

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
