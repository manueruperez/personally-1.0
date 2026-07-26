# syntax=docker/dockerfile:1
# Agente WhatsApp — node:20 + Chromium del sistema (Debian).
# La sesión LocalAuth vive en un volumen montado en /app/apps/agent/.wwebjs_auth.
# El respawn ante crash lo maneja `restart: unless-stopped` del compose
# (equivalente al supervisor.ts de dev); el entrypoint limpia los Singleton
# locks que un crash anterior pudo dejar en el volumen.

FROM node:20-bookworm-slim AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
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
      chromium \
      fonts-liberation \
      fonts-noto-color-emoji \
      ca-certificates \
      dumb-init \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
WORKDIR /app/apps/agent
COPY --from=build /app /app
COPY deploy/docker/agent-entrypoint.sh /usr/local/bin/agent-entrypoint.sh
RUN chmod +x /usr/local/bin/agent-entrypoint.sh
ENTRYPOINT ["dumb-init", "--", "agent-entrypoint.sh"]
