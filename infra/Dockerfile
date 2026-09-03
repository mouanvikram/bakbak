# Runs the API integration test suite. Build context is the repo root.
# Match the host bun that wrote bun.lock (1.3); slim/Debian avoids the
# musl tarball-integrity quirks seen on the alpine image.
FROM oven/bun:1.3-slim

WORKDIR /app

# Install workspace dependencies against the lockfile first, so edits to
# source don't bust the dependency layer.
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/db/package.json ./packages/db/
RUN bun install --frozen-lockfile

# Source.
COPY . .

# Generate the client, migrate the test database, then run the suite. This
# runs at container start (not build) so the DB env vars are available.
ENTRYPOINT ["/bin/sh", "-c", "bun --cwd packages/db generate && bun --cwd packages/db migrate:deploy && bun --cwd apps/api test"]
