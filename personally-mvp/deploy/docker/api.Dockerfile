# syntax=docker/dockerfile:1
# API de Personally — build del monorepo pnpm, runtime node:20 slim.
# Contexto de build: la raíz de personally-mvp (ver docker-compose.yml).

FROM node:20-bookworm-slim AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# openssl ANTES del install: sin él, Prisma baja engines openssl-1.1.x que no
# cargan en bookworm (libssl3)
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
WORKDIR /app

# Manifests primero: cachea la capa de install mientras no cambien deps
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
  && pnpm --filter @personally/api build \
  && test -f apps/api/dist/index.js

FROM node:20-bookworm-slim
ENV NODE_ENV=production COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# openssl: requerido por los engines de Prisma en runtime.
# corepack: para poder correr scripts pnpm (db push, bootstrap) dentro del contenedor.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
WORKDIR /app
COPY --from=build /app /app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/index.js"]
