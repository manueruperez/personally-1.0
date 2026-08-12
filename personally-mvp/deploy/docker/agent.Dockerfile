# syntax=docker/dockerfile:1
# Agente WhatsApp — node:20 pelado.
# Desde la migración a la Cloud API el agente es un cliente HTTP sin estado:
# no hay Chromium, ni sesión en disco, ni volumen que montar. El respawn ante
# crash lo maneja `restart: unless-stopped` del compose.

FROM node:20-bookworm-slim AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# openssl ANTES del install: engines de Prisma correctos (openssl-3.0.x)
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
RUN pnpm --filter @personally/db generate \
  && pnpm -r --filter "./libs/*" build \
  && pnpm --filter @personally/agent build \
  && test -f apps/agent/dist/index.js

FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      dumb-init \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app/apps/agent
COPY --from=build /app /app
# dumb-init como PID 1 para que `docker stop` propague SIGTERM al node.
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
