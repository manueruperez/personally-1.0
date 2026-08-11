# Personally 1.0

SaaS de automatización de rutinas de entrenamiento por WhatsApp. Trainer diseña plan trimestral, el bot ejecuta día a día con el cliente final.

## Cómo leer este repo

- **`personally-mvp/`** — código del MVP (monorepo pnpm + TypeScript).
  - `apps/api` — Express + Prisma (:3000). Cron interno `daily-bootstrap`.
  - `apps/agent` — canal de WhatsApp elegido por `CHANNEL`: `wwebjs` (whatsapp-web.js + LocalAuth + supervisor con respawn, default) o `cloud` (Cloud API oficial, sin Chromium ni QR).
  - `apps/frontend` — React + Vite (:5173).
  - `apps/scheduler` — stub, la cron real vive en el API.
  - `libs/` — core rules, nlu (keywords), db (Prisma), messaging (abstracción de canal), engine (state machine), exercises (catálogo).
  - Webhook de entrada de la Cloud API: `apps/api/src/modules/webhooks/`.

- **`personally-pc/`** — documentación del proyecto.
  - `AVANCE.md` — estado actual del MVP (fuente operativa).
  - `PRUEBAS-E2E.md` — checklist de casos E2E (8/8 validados a 2026-04-20).
  - `specs/` — specs del bot, DB, frontend, backend.
  - `aprendizajes/` — decisiones y hallazgos.
  - `session-context/` — memoria transferible entre sesiones de Claude Code (ver `MEMORY.md` adentro).

- **`project-demo/`** — demo vieja pre-MVP, no activa. Gitignored (no se commitea).

## Comandos rápidos

```bash
cd personally-mvp
pnpm install                    # deps

pnpm api:dev                    # API :3000
pnpm agent:supervised           # agente WhatsApp con auto-respawn
pnpm frontend:dev               # frontend :5173

pnpm vitest run                 # tests (358/358 al 2026-08-10)
# Ojo: correr los 5 proyectos juntos aborta con SIGABRT en la Mac de Juan (bug
# de entorno, previo a la migracion). Por proyecto anda: pnpm vitest run --project api

# DB
pnpm db:generate                # Prisma client
pnpm db:push                    # sync schema a Supabase
pnpm --filter @personally/db exec tsx src/scripts/inspect-today-session.ts
pnpm --filter @personally/db exec tsx src/scripts/translate-catalog.ts
```

## Setup inicial en una máquina nueva

1. Instalar: Node 20+, pnpm 9+, Supabase CLI (opcional).
2. `cp personally-mvp/.env.example personally-mvp/.env` y rellenar:
   - Supabase URL + anon key + service role + JWT secret.
   - `DATABASE_URL` (pooler session mode con `?pgbouncer=true&connection_limit=1`).
   - `DIRECT_URL` (puerto 5432 para migrations).
   - `AGENT_TOKEN` (cualquier string aleatorio largo, igual en API y agent).
   - `AGENT_TRAINER_ID` (UUID del trainer bootstrap).
   - `TESTING_DOW` (opcional, 1..7 para forzar dayOfWeek en tests).
3. `cd personally-mvp && pnpm install`.
4. `pnpm db:generate && pnpm db:push`.
5. `pnpm bootstrap:trainer` (crea primer trainer según BOOTSTRAP_* del .env).
6. Correr api + agent + frontend (3 terminales).
7. Primera vez: escanear QR en el agente para autenticar WhatsApp (sesión persiste en `.wwebjs_auth/`, no se commitea).

## Principios de desarrollo

- **Tests con cada feature**: no se mergea código sin tests asociados. Backend → service + prisma mock. Frontend con fetching → mock del hook.
- **Prefijo `@personally/*`** para todos los paquetes internos.
- **Multi-tenancy desde el schema**: `organizationId` + `trainerId` en todo where clause que toque datos de negocio.
- **ESM estricto**: imports con `.js` aunque el archivo sea `.ts`.

## Estado del piloto

**Target:** amigo-entrenador + 2-3 clientes × 4 semanas. Piloto NO empezó todavía — producto listo para arrancar cuando Juan diga.

**Lo pendiente para piloto es hand-off (no código):**
- Revisar copy de templates de WhatsApp con el trainer.
- Onboarding presencial 1h para cargar clientes + CSVs.

Ver `personally-pc/AVANCE.md` para detalle completo del estado.

## Contexto para futuras sesiones de Claude Code

Si sos una sesión fresca, leé `personally-pc/session-context/` — tiene el perfil del usuario, estado del proyecto y políticas de trabajo (tests, etc.).
