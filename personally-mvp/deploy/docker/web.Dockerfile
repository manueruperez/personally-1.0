# syntax=docker/dockerfile:1
# Frontend estático + Caddy (TLS automático + reverse proxy del stack).
# Las VITE_* se hornean al build: vienen como build args desde docker-compose.

FROM node:20-bookworm-slim AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# openssl: consistencia con api/agent (prisma generate elige engines por el ssl presente)
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/agent/package.json apps/agent/
COPY apps/frontend/package.json apps/frontend/
COPY apps/scheduler/package.json apps/scheduler/
COPY libs/core/package.json libs/core/
COPY libs/db/package.json libs/db/
COPY libs/engine/package.json libs/engine/
COPY libs/exercises/package.json libs/exercises/
COPY libs/messaging/package.json libs/messaging/
COPY libs/nlu/package.json libs/nlu/
COPY libs/types/package.json libs/types/
RUN pnpm install --frozen-lockfile

COPY . .

# VITE_API_BASE_URL vacío = same-origin (Caddy sirve frontend y API en el mismo dominio)
ARG VITE_API_BASE_URL=""
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}

RUN pnpm --filter @personally/db generate \
  && pnpm -r --filter "./libs/*" build \
  && pnpm --filter @personally/frontend build \
  && test -f apps/frontend/dist/index.html

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/frontend/dist /srv
