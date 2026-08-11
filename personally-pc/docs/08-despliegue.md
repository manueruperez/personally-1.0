# 08 — Despliegue

*Creado: 2026-07-25. Actualizado: 2026-07-28 — infra real contratada (dominios + VPS).*

---

## Infra contratada (2026-07-28)

### Dominios (Dynadot, cuenta de Juan)

| Dominio | Rol | Renovación | Auto-renew |
|---------|-----|-----------|------------|
| `personallay.com` | **Canónico.** Raíz reservada para landing futura; el producto vive en `app.personallay.com` | $10.88/año | ✅ ON |
| `personallay.app` | Defensivo, sin DNS | $14.50/año | ✅ ON |

- **DNS del producto:** registro A `app.personallay.com` → `46.225.79.211` (Dynadot DNS, TTL 5 min). El stack completo (frontend + `/api/*` + `/auth/v1/*`) es same-origin bajo ese único hostname — no hay más subdominios.
- ⚠️ Pendientes en Dynadot: verificar que quedó **método de pago guardado** (sin él, el auto-renew falla silenciosamente; balance de cuenta $0), completar security questions + backup email.

### VPS (Hetzner Cloud)

| Ítem | Valor |
|------|-------|
| Proyecto / server | `personally` / `personallay-vps` |
| Tipo | **CX33** (4 vCPU x86 / 8 GB / 80 GB) — sucesor del CX32 del plan |
| Ubicación | Nuremberg (eu-central) |
| SO | Ubuntu 26.04 LTS |
| IP pública | `46.225.79.211` |
| Backups Hetzner | ✅ diarios (+20%) |
| Costo | ~$11.39/mes (server $8.99 + IPv4 $0.60 + backups $1.80) — crédito prepago inicial $25 |

### Acceso

- **SSH:** `ssh -i ~/.ssh/personallay_vps_ed25519 root@46.225.79.211` — llave ed25519 dedicada, generada 2026-07-28 en la Mac de Juan. La privada no sale de esa máquina.
- Auth por llave únicamente (sin password login). ⚠️ Pendiente en Hetzner: activar 2FA de la cuenta.

### Provisionado base (2026-07-28)

- Docker 29.6.2 + Compose plugin v5.3.1 (script oficial `get.docker.com`).
- UFW activo: solo OpenSSH, 80/tcp, 443/tcp (v4 y v6). Postgres jamás expuesto.
- Código en `/opt/personally/personally-mvp` — subido por **rsync desde la Mac** (excluye `node_modules`, `.git`, `.env`, `.wwebjs_auth`).
  ⚠️ El remote de GitHub (`manueruperez/personally-1.0`) está 2 commits atrás y **no tiene la infra de deploy** — hasta hacer push, la Mac es la fuente de verdad y los redeploys van por rsync.

**Contexto de la demo:** un entrenador de una universidad va a probar el producto de forma remota durante días/semanas. La demo NO puede depender de las PCs de Juan → todo en un VPS.

---

## Situación actual (2026-07-25)

- **El proyecto Supabase original ya no existe.** Fue pausado por inactividad (free tier pausa tras ~7 días) y borrado (~90 días pausado). El dominio `yajvuepzuscybnogcjtw.supabase.co` da NXDOMAIN.
- En la **otra PC** (Linux) hay un **Postgres pelado local** con la data migrada. Ojo: sin Supabase Auth, el login del panel no funciona contra ese Postgres — el frontend autentica vía SDK de Supabase y el API verifica JWT HS256.
- Los `.env` están gitignorados: la config de DB local de la otra PC **no viaja por git**. Cualquier deploy define sus propios `.env`.
- **Decisión tomada:** self-hostear DB + Auth en el VPS (independencia total de Supabase-nube). Presupuesto aceptado: **hasta USD 15/mes**.

### Restricciones técnicas que mandan

| Componente | Restricción | Consecuencia |
|------------|-------------|--------------|
| `apps/agent` | Chromium + Puppeteer, sesión en disco (`.wwebjs_auth/`), QR inicial, ~0.5-1GB RAM | Máquina persistente con disco. No serverless, no PaaS free |
| `apps/api` | Stateful: outbox in-memory, SSE al agente, mutex, cron interno | Single instance, proceso 24/7, junto al agente (misma máquina/red docker) |
| Auth | Frontend usa SDK Supabase (`/auth/v1/*`) + API verifica JWT HS256 con `SUPABASE_JWT_SECRET`; bootstrap usa admin API con service role | Self-host = correr **GoTrue** (el Auth de Supabase), no solo Postgres |
| `apps/frontend` | Estático (Vite). `VITE_API_BASE_URL` horneada al build | Se sirve desde el mismo VPS (Caddy) o Vercel free |

---

## Arquitectura de la demo (todo en un VPS)

```
                        ┌─────────────────── VPS (Docker Compose) ───────────────────┐
Cliente final ←WhatsApp→│  agent ──http://api:3000──→ api ──→ postgres (volumen)     │
                        │                              │           ↑                 │
                        │                              └── JWT ────┤                 │
Entrenador (browser) ──→│  Caddy :443 ─→ /            → frontend estático           │
                        │              ─→ api.dominio → api:3000                     │
                        │              ─→ auth.dominio → gotrue (Supabase Auth)      │
                        └────────────────────────────────────────────────────────────┘
```

### Stack en el VPS (Docker Compose)

| Servicio | Imagen | Notas |
|----------|--------|-------|
| `postgres` | `postgres:15` (o imagen supabase/postgres) | Volumen persistente. **No expuesto a internet** (solo red docker) |
| `gotrue` | `supabase/gotrue` | Auth de Supabase standalone. `GOTRUE_JWT_SECRET` = `SUPABASE_JWT_SECRET`. Reemplaza el auth de la nube **sin tocar código** |
| `api` | Dockerfile propio (node:20) | `DATABASE_URL` directo a postgres (sin pgbouncer — single instance) |
| `agent` | Dockerfile propio (node:20 + Chromium) | Volumen para `.wwebjs_auth/`. `API_BASE_URL=http://api:3000` |
| `caddy` | `caddy:2` | TLS automático (Let's Encrypt), reverse proxy + sirve el build del frontend |

**Por qué GoTrue standalone y no el compose oficial completo de Supabase:** la app solo usa Auth + Postgres directo (Prisma). Kong, PostgREST, Storage, Realtime y Studio sobran — el stack mínimo corre en <1GB y cabe en un VPS de 4GB junto al agente.

**Alternativa si GoTrue standalone da fricción:** compose oficial de Supabase (`supabase/docker`) recortando storage/realtime/analytics → necesita VPS de 8GB.

### VPS y costos (precios verificados 2026-07-25)

| Opción | Specs | Costo/mes | Trade-off |
|--------|-------|-----------|-----------|
| **Hetzner CX32 (Alemania)** ← recomendado | 4 vCPU / 8GB / 80GB | €6.80 (~USD 7.5) | Latencia ~170ms a Colombia — solo afecta el panel, no WhatsApp |
| Contabo (NY, US) | 4 vCPU / 8GB | ~USD 5.3-6.6 | Mejor latencia (~90ms) pero overprovisioning/calidad variable |
| Hostinger KVM 2 (Brasil) | 2 vCPU / 8GB | USD 7-10 | Mejor latencia LATAM, pero prepago 12-24 meses + renovación ~2x |
| Oracle Always Free (plan B $0) | 2 OCPU ARM / 12GB | $0 | Reclaman instancia si está idle, fricción de registro, capacidad regional, ARM |

**Descartados con precios verificados:** Hetzner US (CPX21 subió a ~USD 37 en jun-2026), DigitalOcean/Vultr/Linode (USD 24 por 4GB), AWS Lightsail/EC2 y Azure (USD 24-45+ por el mismo hardware + egress USD 0.09/GB + complejidad que este stack no usa — recién tienen sentido post-validación).

- Dominio barato: ~USD 10-12/**año** (necesario para TLS; se reusa en producción).
- **Total: ~USD 7.5/mes + dominio.** Dentro del presupuesto (≤15) con margen.
- La latencia NO afecta el flujo WhatsApp (agente ↔ servidores de WhatsApp, no ↔ Colombia).

### Datos

1. **Rescate (si aplica):** `pg_dump` del Postgres de la otra PC → restore en el VPS. Solo vale la pena si hay planes/clientes cargados que duela repetir.
2. **Reconstrucción (plan B, ~30 min):** `db:push` → `load:exercises` (872) → `translate-catalog` → `bootstrap:trainer` → importar `rutina-demo-12-semanas.csv`.
3. **Usuarios de auth:** se recrean con `bootstrap:trainer` contra GoTrue (usa la misma admin API).
4. **Backups en demo:** cron nocturno `pg_dump` a disco del VPS + copia semanal fuera (rclone/scp). Con GoTrue self-hosted, los usuarios viven en el mismo Postgres → un solo backup cubre todo.

### Seguridad mínima

- UFW: solo 22 (SSH con key), 80, 443. Postgres jamás expuesto (admin vía SSH tunnel o `db:push` corrido dentro del VPS).
- `AGENT_TOKEN` nuevo y largo. Secrets solo en `.env` del VPS.
- SSH por llave, sin password login.

### Trabajo de código/infra para poder desplegar (estado 2026-07-25)

- [x] `deploy/docker/*.Dockerfile` (api, agent con Chromium+entrypoint limpia-locks, web = frontend+Caddy).
- [x] `deploy/docker-compose.yml` + `deploy/Caddyfile` + `deploy/.env.example` + `generate-keys.mjs` + `smoke.sh` + runbook (`deploy/README.md`).
- [x] **Fix build de producción del frontend** (TS2742 ×2) — `vite build` pasa.
- [x] **Fix build de producción de la API** — nunca se había corrido `tsc` completo; destapó y se corrigieron **bugs reales**: relaciones Prisma con nombre equivocado en `addPlanItem`/`updatePlanItem`/`deletePlanItem` (`planWeek/planDay` → `week/day`, crasheaban en runtime; los mocks de los tests codificaban el bug) y `Prisma` exportado como type-only en `libs/db` (rompía `new Prisma.Decimal` del dispatcher).
- [x] Puppeteer con `executablePath` configurable por env (`PUPPETEER_EXECUTABLE_PATH`) para Chromium del sistema en Docker.
- [x] **Tests del deploy**: 52 nuevos (compose contract, Caddyfile order, Dockerfiles, generate-keys JWT, puppeteer-config). Suite total 219/219.
- [x] **Validación local completa del stack** (2026-07-25, Docker en la Mac):
  - 3 imágenes buildean (con guards `test -f` de emisión + fix tsbuildinfo + fix openssl para engines de Prisma).
  - Stack arriba: `/health` 200, GoTrue vía `/auth/v1/health` 200, SPA 200, `/api/v1/internal/*` 403 en edge, API sin token 401.
  - `db push` (13 tablas) + catálogo 873 ejercicios cargado dentro del contenedor.
  - `bootstrap:trainer` contra GoTrue standalone ✅ → login password grant → JWT → `/api/v1/me` devuelve el trainer. **Swap Supabase→GoTrue validado sin tocar código.**
  - Agente arranca Chromium en contenedor, genera QR (`qr_required`) y su heartbeat llega a la API.
- [x] **Deploy real ejecutado (2026-07-28/29):** stack completo arriba en `https://app.personallay.com` — TLS emitido por Caddy, `./smoke.sh app.personallay.com` **6/6 OK**, schema (13 tablas) + catálogo (873) + traducciones cargados.
- [x] Bootstrap del trainer en el VPS (2026-07-29, mismas credenciales que el entorno local): `trainerId fc574b0e-e55d-46ab-81b3-ff4db136e5c3` → `AGENT_TRAINER_ID` en `.env` → agente arriba pidiendo QR, SSE conectado.
- [x] Segundo trainer (2026-07-29): **Luis Avirama** · `lavirama@unicauca.edu.co` · org propia · `trainerId f1bd4a68-b566-4fd1-8527-397d8d133f7b`. Solo panel: el bot sigue atado al trainer de Juan — para la demo real, poner su trainerId en `AGENT_TRAINER_ID` y `docker compose up -d agent`. Pedirle que cambie la password inicial.
- [x] Login E2E validado contra el dominio real: password grant → JWT → `/api/v1/me` devuelve el trainer.
- [ ] Escanear QR con el número dedicado en `https://app.personallay.com/agent`.

### Checklist pre-entrega al entrenador

- [ ] Smoke E2E completo desde la URL pública: login → crear/ver cliente → activar plan → `iniciar` desde un celular → `siguiente` → cierre.
- [ ] Agente online (bombillito verde) y sesión WhatsApp persistida (reinicio del contenedor no pide QR).
- [ ] Número de WhatsApp **dedicado** (no personal — riesgo de ban).
- [ ] UptimeRobot (free) contra `/health` y `/api/v1/agent/status` con alerta a tu correo.
- [ ] Credenciales del panel para el entrenador + mini-guía de uso (1 página).
- [ ] Plan demo cargado con `plan_day` para los días en que va a probar.
- [ ] Nota: el CSV ya **no** es obligatorio — el trainer puede cargar la rutina 100% desde la UI (agregar/eliminar días y ejercicios desde el editor del plan, con el plan en `draft`).

---

## Futuro — si el producto valida

**Trigger:** primer trainer pagando $30k/mes sin negociación (métrica del piloto, ver [04-piloto.md](04-piloto.md)) y/o >3 trainers activos.

La base ya queda bien parada (VPS + Docker + dominio + backups). Lo que falta para producción:

1. **WhatsApp Cloud API oficial** — elimina Puppeteer/Chromium y el riesgo de ban. Costo por conversación (~USD 0.01-0.03) → ajustar pricing ([06-modelo-negocio.md](06-modelo-negocio.md)).
2. **Outbox a Redis/BullMQ** — sobrevive reinicios del API, habilita réplicas.
3. **CI/CD** (GitHub Actions → build imágenes → deploy al VPS).
4. Rate limiting + observability estructurada + alertas.
5. Backups verificados con restore-test mensual.
6. Pasarela de pagos (Wompi/MercadoPago).
7. Escalar VPS verticalmente (8→16GB) antes de pensar en multi-nodo; el diseño single-instance del API lo permite hasta decenas de trainers.
8. Onboarding self-service de trainers (hoy `bootstrap:trainer` manual).

| Etapa | Infra | Costo/mes |
|-------|-------|-----------|
| **Demo (ya)** | VPS 4GB + Docker (postgres+gotrue+api+agent+caddy) + dominio | ~USD 10 |
| Producción | VPS 8GB + Cloud API + Redis + CI/CD | ~USD 25-50 + costo por conversación |

---

## Qué NO hacer (trampas conocidas)

- **Supabase free para algo que queda solo días:** pausa a los ~7 días de inactividad y **borra a los 90** — así se perdió el proyecto original.
- **Render/Railway free tier para el API** → duerme el proceso → mata cron + SSE.
- **Serverless para API o agente** → procesos persistentes con estado.
- **Separar agente y API en máquinas distintas** → el canal SSE/outbox está pensado para localhost/red docker local.
- **Exponer Postgres a internet** → solo red interna docker + SSH tunnel.
- **Demo con número personal de WhatsApp** → si hay ban, es tu número.
- **ngrok free** → interstitial rompe los fetch del frontend.
