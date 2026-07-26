# Deploy — Personally en un VPS

Stack completo (Postgres + GoTrue + API + agente WhatsApp + Caddy) en Docker Compose.
Contexto y decisiones: `personally-pc/docs/08-despliegue.md`.

## Requisitos

- VPS con 4GB+ RAM (ref: Hetzner CX32), Ubuntu 22.04+/Debian 12, Docker + compose plugin.
- Dominio con **A record** apuntando a la IP del VPS (Caddy emite TLS solo si el DNS resuelve).
- Número de WhatsApp **dedicado** para el bot (no personal).

## Pasos

```bash
# 0. En el VPS: firewall mínimo
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable

# 1. Clonar el repo y entrar al deploy
git clone <repo> && cd Personallay1.0/personally-mvp/deploy

# 2. Config
cp .env.example .env
node scripts/generate-keys.mjs >> .env
# editar .env: DOMAIN=<tu dominio>, borrar las líneas vacías duplicadas

# 3. Build + up (primer build ~5-10 min)
docker compose build
docker compose up -d postgres gotrue api caddy   # agente después del bootstrap

# 4. Schema de negocio (Prisma) — dentro del contenedor api
docker compose exec api pnpm --filter @personally/db push

# 5. Catálogo de ejercicios (872 + traducciones)
docker compose exec api pnpm --filter @personally/db load:exercises
docker compose exec api pnpm --filter @personally/db exec tsx src/scripts/translate-catalog.ts

# 6. Primer trainer (imprime el UUID → va a AGENT_TRAINER_ID en .env)
docker compose exec \
  -e BOOTSTRAP_EMAIL=trainer@... -e BOOTSTRAP_NAME="Nombre" \
  -e BOOTSTRAP_PASSWORD=... -e BOOTSTRAP_ORG_NAME="..." \
  api pnpm --filter @personally/db bootstrap:trainer

# 7. Agente (con AGENT_TRAINER_ID ya en .env)
docker compose up -d agent
# → abrir https://DOMINIO/agent y escanear el QR con el WhatsApp del bot.
#   La sesión persiste en el volumen wwebjs_auth (reinicios no piden QR).

# 8. Smoke test
./smoke.sh <dominio>
```

## Operación

```bash
docker compose ps                        # estado
docker compose logs -f agent             # logs del agente
docker compose restart agent             # equivalente al botón "Reconectar" a la fuerza
docker compose exec postgres pg_dump -U postgres personally > backup-$(date +%F).sql
```

- **Respawn del agente:** lo maneja Docker (`restart: unless-stopped`). El entrypoint
  limpia los Singleton locks del volumen antes de cada arranque.
- **Backups:** cron diario del `pg_dump` de arriba + copia semanal fuera del VPS.
- **Monitoreo:** UptimeRobot (free) contra `https://DOMINIO/health`.

## Validación local (sin VPS ni dominio)

Para probar el stack completo en tu máquina antes de contratar nada:

```bash
cd deploy
cp .env.example .env && node scripts/generate-keys.mjs >> .env
# DOMAIN puede quedar en cualquier valor — el override local sirve por :80 sin TLS

docker compose -f docker-compose.yml -f docker-compose.local.yml build
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d postgres gotrue api caddy

docker compose exec api pnpm --filter @personally/db push     # schema
curl http://localhost/health                                   # → {"status":"ok"}
curl http://localhost/auth/v1/health                           # → GoTrue

# Bootstrap + login end-to-end (valida el swap Supabase→GoTrue):
docker compose exec -e SUPABASE_URL=http://caddy \
  -e BOOTSTRAP_EMAIL=test@test.com -e BOOTSTRAP_NAME=Test -e BOOTSTRAP_PASSWORD=Secreta123 \
  api pnpm --filter @personally/db bootstrap:trainer
curl -X POST 'http://localhost/auth/v1/token?grant_type=password' \
  -H 'content-type: application/json' \
  -d '{"email":"test@test.com","password":"Secreta123"}'
# → access_token; usarlo contra /api/v1/me debe devolver el trainer
```

El agente puede levantarse igual (`up -d agent`) pero pedirá QR — solo escanearlo en el deploy real.

## Gotchas

- `TESTING_DOW` NO debe estar seteado en producción (fuerza el día de semana del dispatcher).
- El rebuild del frontend requiere `docker compose build caddy` (las VITE_* se hornean al build).
- Postgres no está expuesto a internet: administrar con `docker compose exec postgres psql -U postgres personally`.
- Si cambia `DOMAIN`: rebuild de `caddy` (frontend horneado) y `docker compose up -d`.
