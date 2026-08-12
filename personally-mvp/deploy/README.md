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

# 7. Agente (con AGENT_TRAINER_ID y las credenciales de Cloud API ya en .env).
docker compose up -d agent
# No hay nada que vincular: si las credenciales están, el agente arranca online;
# si faltan, muere en el arranque con el nombre de la variable que falta.
# Verificar en https://DOMINIO/agent → "En línea".

# 8. Smoke test
./smoke.sh <dominio>
```

## Canal de WhatsApp

Hay un solo canal: la **Cloud API oficial de Meta**. No hay variable `CHANNEL` ni
canal alternativo — `whatsapp-web.js` se eliminó del repo el 2026-08-12.

- **Salida:** el agente hace HTTP contra Graph. Sin navegador, sin QR, sin sesión
  en disco. Credencial: token permanente en el `.env`.
- **Entrada:** webhook `POST /api/v1/webhooks/whatsapp`, con firma
  `X-Hub-Signature-256` verificada. El agente ni se entera.
- **Costo:** solo la plantilla que abre la conversación (~USD 0.01-0.02). Todo lo
  que pasa dentro de la ventana de 24h que abre la respuesta del cliente es
  gratis.

### Alta / rotación de credenciales

Requisitos previos (los hace Juan en el panel de Meta, ver
`personally-pc/planes-dev/2026-08-05-migracion-whatsapp-cloud-api/`):

1. Número dedicado registrado en la WhatsApp Business Account.
2. Plantilla `greeting` **aprobada**, categoría *utility*, idioma `es`.
3. App **publicada**. Sin publicar, Meta solo entrega webhooks de prueba del
   panel: el bot puede mandar mensajes pero nunca se entera de las respuestas.
4. Método de pago cargado en la WABA (requisito para mensajes iniciados por la
   empresa, aunque el consumo termine en $0).
5. Webhook dado de alta con la URL de arriba **y suscripto al campo `messages`**.
   Dar de alta el endpoint no suscribe: son dos pasos y el segundo se olvida.

Después, en el `.env` del deploy:

```bash
WHATSAPP_PHONE_NUMBER_ID=...      # panel de WhatsApp → Configuración de la API
WHATSAPP_ACCESS_TOKEN=...         # token permanente, no el temporal de 24h
WHATSAPP_APP_SECRET=...           # Configuración de la app → Básica
WHATSAPP_WEBHOOK_VERIFY_TOKEN=... # lo inventás vos: openssl rand -hex 32

docker compose up -d --force-recreate agent api
```

### Rollback

Ya no existe rollback por variable de entorno: el canal viejo no está en el
código. Volver atrás es `git revert` de los commits de limpieza + rebuild, y
recuperar un canal que estaba roto upstream. Ese costo se aceptó a conciencia al
migrar; el rollback real ante un problema con Meta es rotar el token o el número,
no cambiar de canal.

### Verificar el webhook sin esperar a Meta

```bash
# Challenge de alta: debe devolver el challenge en texto plano
curl "https://DOMINIO/api/v1/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=$TOKEN&hub.challenge=OK123"

# Token incorrecto: debe dar 403 y NO devolver el challenge
curl "https://DOMINIO/api/v1/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=malo&hub.challenge=OK123"

# POST sin firma válida: debe dar 401
curl -X POST -H 'Content-Type: application/json' -d '{}' https://DOMINIO/api/v1/webhooks/whatsapp
```

Si los POST de Meta dan 401 en los logs del api, falta `WHATSAPP_APP_SECRET`.
Meta reintenta un rato y después **desactiva la suscripción sola**.

## Operación

```bash
docker compose ps                        # estado
docker compose logs -f agent             # logs del agente
docker compose restart agent             # única forma de reiniciar el bot (el panel no lo hace)
docker compose exec postgres pg_dump -U postgres personally > backup-$(date +%F).sql
```

- **Respawn del agente:** lo maneja Docker (`restart: unless-stopped`). El agente
  no guarda estado local, así que un reinicio no pierde nada: el outbox vive en la
  API y se drena al volver.
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

El agente puede levantarse igual (`up -d agent`) y va a enviar de verdad si las
credenciales de Cloud API son las reales. Lo que no funciona en local es la
entrada: Meta necesita una URL pública para el webhook.

## Gotchas

- `TESTING_DOW` NO debe estar seteado en producción (fuerza el día de semana del dispatcher).
- El rebuild del frontend requiere `docker compose build caddy` (las VITE_* se hornean al build).
- Postgres no está expuesto a internet: administrar con `docker compose exec postgres psql -U postgres personally`.
- Si cambia `DOMAIN`: rebuild de `caddy` (frontend horneado) y `docker compose up -d`.
- Cambios de schema (ej. valores nuevos de enum) necesitan
  `docker compose exec api pnpm --filter @personally/db push` **después** del
  build, para que el push corra con el schema nuevo y no con el de la imagen vieja.
- Las credenciales de Cloud API nunca van al build de `caddy`: el frontend se
  sirve al público y hornearlas ahí las expondría. Hay un test que lo verifica
  (`deploy/tests/compose.test.ts`).
