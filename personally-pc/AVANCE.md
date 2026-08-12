# Avance del MVP — Personally 1.0

*Última actualización: 2026-08-12 (limpieza: `whatsapp-web.js` fuera del repo)*

Estado del monorepo `personally-mvp/` construido sobre las specs de esta carpeta.

> **Lo más reciente (2026-08-12):** `whatsapp-web.js` se eliminó del repo. Queda
> un solo canal — la Cloud API oficial de Meta — así que se fueron Puppeteer,
> Chromium, el supervisor, el QR y el botón "Reconectar" del panel. El rollback
> dejó de ser una variable de entorno y pasó a ser un `git revert`.
> Detalle y pendientes en `planes-dev/2026-08-12-limpieza-wwebjs/`,
> `planes-dev/2026-08-05-migracion-whatsapp-cloud-api/` y en
> `docs/08-despliegue.md` → "Canal de WhatsApp".

---

## ✅ Funciona end-to-end

**Flujo validado manualmente:**

1. Trainer se loguea en `/login` con Supabase Auth.
2. Crea un cliente con teléfono E.164.
3. Crea un plan draft (12 semanas vacías por default, configurable hasta 52).
4. Importa `samples/rutina-demo-12-semanas.csv` → 12 semanas pobladas con ~450 items + ejercicios custom creados en el catálogo.
5. Agrega/elimina semanas del plan con renumeración automática.
6. Activa el plan → **mensaje de bienvenida automático** encolado al outbox.
7. Agente WhatsApp hace polling cada 3s, toma el mensaje y lo envía por WhatsApp al número del cliente.
8. El cliente lo recibe en su teléfono.
9. Cuando el cliente responde, el agente captura el mensaje → POST a la API → se persiste en `messages` con intent detectado y confianza.
10. **Dispatcher** corre automáticamente post-incoming: resuelve el `plan_day` de hoy (según `startDate + dow`), crea `sessions` + `exercise_logs` en estado `pending`, y responde con el primer ejercicio cuando el cliente manda `"iniciar"`.
11. **Loop de ejecución**: `"siguiente"` marca el item actual como `done` y presenta el siguiente. Al terminar todos, envía mensaje de cierre con `completionRate`.
12. El trainer puede mandar mensajes custom desde el card "Enviar mensaje" en el detalle del cliente.
13. **Vista de conversación** tipo chat en detalle del cliente con burbujas inbound/outbound, intent badges y refresh cada 5s.
14. Catálogo de ejercicios con **877 ejercicios** (872 del `free-exercise-db` público + 5 seed + los custom del CSV).

---

## 🧱 Stack y arquitectura final

### Monorepo
- **pnpm 9** workspaces (activado via `corepack enable pnpm`).
- **TypeScript strict**, ESM nativo.
- `tsx watch` para dev con hot-reload en todas las apps.

### Base de datos
- **Supabase** (Postgres + Auth) — single source of truth.
- **Prisma 5.22** con 13 tablas: organizations, trainers, clients, client_preferences, plans, plan_weeks, plan_days, plan_items, exercises, sessions, exercise_logs, messages, notifications.
- Pooler en modo **session** (puerto 5432 del pooler, no el endpoint directo IPv6-only) con `?pgbouncer=true&connection_limit=1` para Prisma.
- Multi-tenancy con `organization_id` en todas las queries.

### Auth
- **Supabase Auth** con JWT HS256.
- Middleware en API verifica con `SUPABASE_JWT_SECRET` (fallback a JWKS).
- Mapeo `auth.users.id` → `trainers.user_id` (single source of truth).

### Canal WhatsApp
- **WhatsApp Cloud API** oficial de Meta, detrás de `MessagingChannel`
  (`libs/messaging`). Única implementación: `CloudApiChannel`.
- Salida: HTTP contra Graph con token permanente. Entrada: webhook al API con
  firma `X-Hub-Signature-256` verificada.
- Solo el saludo diario sale como plantilla aprobada; el resto viaja dentro de la
  ventana de 24h que abre la respuesta del cliente.
- Heartbeat cada 60s + en cada cambio de estado.
- Sin navegador, sin QR, sin sesión en disco (desde 2026-08-12).
- Espaciado aleatorio 500-1500ms entre envíos (mitigación de baneo).

### Outbox
- **In-memory** en la API (`Map<trainerId, OutboxMessage[]>`), polling desde el agente cada 3s.
- Migrable a Redis/BullMQ cuando haya múltiples replicas.

---

## 📦 Módulos por capa

### `libs/`

| Módulo | Estado | Qué hace |
|--------|--------|----------|
| `db` | ✅ | Prisma schema + cliente singleton + seeds + script bootstrap-trainer + loader free-exercise-db |
| `types` | ✅ | Zod schemas compartidos: clients, plans, exercises, sessions, messages, intents, notifications |
| `core` | ✅ | DomainError, constantes (MIN_PLAN_DURATION_DAYS, ACTIVE_HOURS, etc.) |
| `nlu` | ✅ | IntentClassifier con keywords ES (START, NEXT, SKIP, CHANGE, PAIN, FINISH) + normalize |
| `messaging` | ✅ | Interfaz MessagingChannel |
| `engine` | ✅ | SessionStateMachine pura (sin side-effects) |
| `exercises` | ✅ | Servicio search/find/createCustom del catálogo |

### `apps/api`

**Funciona:**
- Auth middleware Supabase (HS256)
- `/api/v1/me`
- `/api/v1/clients` — CRUD + filtro status + soft delete + `/send-test-message` + `/:id/messages` (conversación)
- `/api/v1/plans` — draft/full create, activate/revert/archive, delete/add week con renumeración, import-csv
- `/api/v1/exercises` — search paginado + create custom
- `/api/v1/agent/status` — estado del bot para el panel (`online`/`offline`/`unknown`)
- `/api/v1/internal/*` — rutas para el agente (heartbeat, incoming/outgoing messages, outbox polling + SSE)
- **Dispatcher** en `modules/internal/dispatcher.ts`: resuelve plan_day → sessions → exercise_logs → templates → outbox. Maneja START/NEXT/SKIP/CHANGE/PAIN/FINISH/UNKNOWN.
- **Templates** en `modules/internal/templates.ts`: exercise card, daily greeting, finish message, respuestas por estado.

**Pendiente:**
- Endpoints de sessions (listar/ver/logs) para debugging fuera del dispatcher.
- Reset manual de sesión del día (para re-testear o si el cliente lo necesita).
- Rate limiting + observability estructurada.

### `apps/agent`

**Funciona:**
- Envío por Cloud API (texto, imagen con caption, plantillas con parámetros).
- Validación de credenciales al arrancar: sin `WHATSAPP_PHONE_NUMBER_ID` /
  `WHATSAPP_ACCESS_TOKEN` muere ruidosamente en vez de drenar el outbox contra 401.
- **Outbox por SSE** (push, <50ms) con polling como red de seguridad cada 15s, más
  un drenado al arrancar para lo que se acumuló mientras estuvo caído.
- Heartbeat cada 60s + en cada cambio de estado.

**Pendiente:**
- Dispatcher de acciones recibidas de la API (hoy el agent no consume triggeredAction; solo ejecuta el outbox).

**Ya no aplica** (murió con `whatsapp-web.js` el 2026-08-12): supervisor con
respawn, self-heal de detached frames, comandos `reinit` por SSE. El proceso no
tiene estado local, así que revivirlo es trabajo de Docker
(`restart: unless-stopped`), no del código.

### `apps/scheduler`

**Funciona:**
- Estructura con 5 jobs registrados.

**Pendiente:**
- Implementar `daily-session-bootstrap` real (crea sessions del día + saludo matutino).
- Implementar `no-response-watcher` real (marca missed + notificación N días).

### `apps/frontend`

**Funciona:**
- React 18 + Vite + Tailwind + theme.css con CSS variables.
- Atomic Design (Button, Input, Card, Label, Dialog, Table, Badge, **AgentStatusDot**).
- React Query para server state, Zustand para auth.
- Login con Supabase SDK.
- Dashboard (placeholders, sin datos reales aún).
- **Clientes**: lista con filtros, detalle, crear/editar/archivar, quick-send inline, vista de conversación tipo chat con refresh 5s + **auto-scroll al fondo** + botón "ir al final" cuando no estás pegado.
- **Planes**: lista por cliente, editor con tabs de semanas, + / 🗑 para semanas, activar/draft/archivar, import CSV con resumen.
- **Ejercicios**: catálogo con búsqueda y paginación, crear custom.
- **Bot** (`/agent`): estado con polling 5s y uptime. Escrito para el trainer: dice si el bot está enviando mensajes o no, y cuando está caído explica que los mensajes quedan en cola y vuelven solos. Sin QR ni botón "Reconectar" — no había acción del trainer que levantara el bot.
- **Bombillito de estado del bot** en navbar (verde/amarillo/rojo/gris) con el estado en tiempo real.
- **Input de mensaje deshabilitado** cuando el agente no está online, con banner de advertencia y link a /agent.
- **Settings/Notifications**: stubs.

**Pendiente:**
- Dashboard con métricas reales.
- Render de imágenes de ejercicios en ExerciseList y PlanWeekView.
- Traducción ES del catálogo.
- Edición inline de items del plan (sets/reps/RPE/cues).

---

## 🐛 Problemas resueltos en el camino

| Problema | Fix |
|----------|-----|
| pnpm no instalado | `corepack enable pnpm` + `prepare pnpm@9.12 --activate` |
| Prisma no encontraba `.env` | Symlinks `libs/db/.env → ../../.env` y análogos |
| Password con `#` rompía DATABASE_URL | URL-encode a `%23` |
| DIRECT_URL a host directo (IPv6-only) fallaba | Cambiar al pooler puerto 5432 (session mode) |
| `prepared statement already exists` | `?pgbouncer=true&connection_limit=1` |
| Libs no compilaban antes de correr apps | `pnpm -r --filter "./libs/*" build` inicial |
| Supabase `auth.admin.createUser` devolvía HTML | `SUPABASE_URL` apuntaba a supabase.com en lugar de `https://PROJECT-REF.supabase.co` |
| JWT verify fallaba con JWKS | Usar HS256 con `SUPABASE_JWT_SECRET` |
| Import CSV timeout 60s | Batch inserts (1 exercise fetch + 1 exercise createMany + 1 planDay createMany + 1 planItem createMany) |
| Eliminar semana dejaba huecos | `updateMany` con `decrement: 1` en la misma transacción |
| pino-pretty missing | Agregar como devDependency |
| Agent zombies bloqueaban LocalAuth (era `wwebjs`) | `pkill -9 Chromium/tsx`, `rm -rf .wwebjs_auth` |
| `AGENT_TRAINER_ID` concatenado al append | newline explícito en `.env` |
| setState handler se sobrescribía | Arrays de handlers en vez de single ref |
| "Detached frame" en send (era `wwebjs`) | Retry con backoff 1.5s/3s/4.5s |
| SUPABASE_URL sin prefix HTTPS (supabase.com) | Detectar project-ref y reconstruir |
| DAY_MAP mapeaba `sábado` (con tilde) a 7 en vez de 6 | Fix al mapping → re-importar CSV |
| Dispatcher crasheaba con `Prisma is not defined` al recomputar stats | Importar `Prisma` namespace (no solo `type Prisma`) |

---

## 🧪 Estado de validación del ciclo E2E

### ✅ Probado manualmente con WhatsApp real
- `"iniciar"` → primer ejercicio del día llega al cliente.
- `"siguiente"` → marca actual como done + presenta el siguiente.
- Cierre de sesión con mensaje "bien hecho" cuando todos los items están done.
- Mensajes inbound y outbound aparecen en la conversación del frontend en ≤5s.
- Intent `UNKNOWN` cuando cliente manda texto irrelevante fuera de sesión.

### ✅ Validado con WhatsApp real (adicional)
- **Día con múltiples ejercicios** (warmup → exercise → cooldown, 8 items).
- **`SKIP`** con defer semantics: difiere 1 slot (max 3), al 4to SKIP marca `skipped` permanente.
- **`PAIN`**: marca actual como `skipped` con `notes: "dolor: ..."`, notifica trainer, presenta siguiente automáticamente. El ejercicio reportado no reaparece.
- **`CHANGE`**: marca actual como `changed`, notifica trainer, pide al cliente `siguiente` para continuar.
- **`FINISH`** a mitad: cierra la sesión con `status = partial` + mensaje de cierre.
- **`UNKNOWN`** dentro de sesión activa: responde "No te entendí. Responde siguiente, saltar o cambiar".
- **Idempotencia / concurrencia**: 2× `iniciar` en <1s → solo presenta 1 item (fix con mutex por cliente en `routes.ts`).
- **Día siguiente** (`TESTING_DOW`): reset sesión + cambio env + greeting → sesión nueva con el `planDay` correcto del día configurado.

### 🆕 Panel del trainer completo (segunda tanda)
- **Imágenes de ejercicios** en UI (TodaySessionCard, PlanWeekView) y en WhatsApp (cards con `contentType: image` + caption cuando hay `imageUrl`, fallback a texto si falla).
- **Swap de ejercicio inline**: click en el nombre del ejercicio en `PlanWeekView` → dialog con buscador del catálogo → `PATCH /plans/items/:id { exerciseId }` valida ownership + que el nuevo ejercicio sea accesible.
- **Notas + cues expandibles** por item: chevron para abrir/cerrar, textareas con autocommit on blur.
- **Add/remove ejercicios** en un día: botón "+ Agregar" por bloque abre el picker, X al final de cada fila borra con confirmación.
- **Add/remove días desde la UI (sin CSV)**: `POST /plans/weeks/:weekId/days` y `DELETE /plans/days/:dayId`, ambos solo sobre planes `draft` y con ownership vía `week.plan { organizationId, trainerId }`. En `PlanWeekView` el empty state ofrece CSV **o** "Agregar día", hay botón al final de la semana mientras queden días libres (<7) y un trash por día con confirmación (cascade a items). El dialog pide día de la semana (los ya usados quedan deshabilitados), focus opcional y checkbox de descanso. Con esto el trainer arma una rutina 100% desde el panel — antes los `plan_days` solo nacían del import CSV.
- **Traducción del catálogo top 50+**: script `libs/db/src/scripts/translate-catalog.ts` con 90 términos mapeados. Ejecutado en DB → 24 ejercicios traducidos del free-exercise-db.

### 🧩 Features de panel construidos
- **Dashboard** (`/`): summary del día (total clientes, sesiones creadas, en curso, completadas, alertas sin leer con subtexto de mensajes fallidos 24h) + lista de clientes con su estado de hoy y link al detalle. Poll cada 10s.
- **TodaySessionCard** en detalle del cliente: status de la sesión + barra de progreso + lista de items con icono por status (○ pending, ▶ presented, ✓ done, ⏭ skipped, ↻ changed, ⏳ deferred), sets/reps y badge de defers.
- **Notifications panel** (`/notifications`): tabs "Sin leer / Todas", card por notificación con tipo (pain_report rojo, change_request ámbar), link al cliente, botones "Responder" (textarea inline → envía al cliente por WhatsApp + marca leída) y "Descartar". Badge con count en navbar, poll cada 30s.
- **Plan editor con edición inline**: en `PlanWeekView`, click sobre cualquier celda de `sets / reps / rest / RPE` abre un input. Enter para commit, Esc para cancelar. Valor vacío guarda `null`. Deshabilitado si el plan está `archived`.
- **Sesión eager en greeting**: al mandar saludo diario, la `Session` se crea con `status: greeted` + `ExerciseLog` pending. Antes solo se creaba cuando el cliente respondía.
- **Startup sanity**: al arrancar el API, se cierran sesiones zombie en `in_progress` de días anteriores (pasan a `abandoned`) y se loguea un snapshot con counts de sesiones de hoy + errores outbound 24h.

### 🔧 Estabilización del agente
Todo este bloque existía para sostener un Chromium: keepalive cada 2 min, warmup
delay de 15s antes de drenar, retry ante detached frames, supervisor matando
zombies y liberando Singleton locks. Se eliminó con `whatsapp-web.js` el
2026-08-12. Hoy el agente es un cliente HTTP sin estado: drena el outbox al
arrancar y Docker lo revive si muere.

### ⚠️ No validado todavía (gaps)
- **Mitad de flujo** cuando el agente/API reinicia (recuperación).

### 🔒 Bloqueantes para re-testear
- Una sesión `completed` del día actual hace que cualquier intent caiga en "bien hecho" de nuevo (reset disponible en frontend + script `reset-today-session.ts`).

---

## 📋 Pendientes priorizados

### 🔴 Core del producto (antes de piloto real)
1. ✅ **Dispatcher** — 8/8 E2E casos validados con WhatsApp real.
2. ✅ **Vista de conversación** + TodaySessionCard + Dashboard + Notifications.
3. ✅ **Scheduler daily-session-bootstrap** — cron en API cada 5min, crea session eager + envía saludo.
4. ✅ **TESTING_DOW** override.
5. ✅ **Reset sesión** (botón frontend + script).
6. ✅ **Acciones sobre notificaciones** — botón "Responder" con textarea inline + "Descartar".
7. ✅ **Edición inline de plan items** — sets/reps/rest/RPE + swap de ejercicio + notas/cues + add/remove.
8. ✅ **Recuperación mid-session básica** — startup-sanity cierra sesiones zombie + contador de mensajes fallidos en dashboard.
9. ✅ **Imágenes** de ejercicios en UI + WhatsApp.
10. ✅ **Traducción catálogo top 50+**.

### 📋 Pendiente antes de piloto real
9. ✅ **Tests** — 360/360 pasando al 2026-08-12 (api 119, agent 42, libs 83, deploy 53, frontend 63). Cubren: dispatcher + defer semantics + PAIN auto-skip + exercise image routing, dashboard service, today-session, notifications/reply + list + markRead, plans/items PATCH + add + delete + swap, startup-sanity, EditableCell, TRANSLATIONS map, TodaySessionCard (7), DashboardPage (6), NotificationsPage (6).
10. ✅ **Imágenes** ejercicios UI + WhatsApp.
11. ✅ **Traducción catálogo top 50+** (90 términos).
12. **Revisar copy de templates con el trainer** (trabajo editorial, no dev — compartir con el amigo).
13. **Onboarding manual del trainer piloto** (protocolo, no código).

### 📋 Hand-off al trainer (no código)
- **Revisar copy de templates** con el trainer (greeting, exercise_card, finish, unknown, pain_ack, change_ack, stop_ack). Trabajo editorial, 30 min de su tiempo + 30 min tuyos.
  ⚠️ El copy de `greeting` ahora está **congelado en Meta**: cambiarlo exige mandar
  la plantilla a revisión de nuevo (24-48h). Revisarlo con el trainer **antes** de
  aprobarla, no después. Hacerlo editable desde el panel no es posible para ese
  mensaje — ver [aprendizajes/06-copy-configurable.md](aprendizajes/06-copy-configurable.md).
- **Revisar el texto de `/privacy`** — es un borrador de trabajo, no asesoría legal.
  Compromete a Personallay frente a los clientes finales.
- **Onboarding presencial**: sentarte 1h con él para cargar sus 2-3 clientes + CSVs de planes + setear timezone y hora preferida de cada cliente.
- **Acceso al panel**: darle URL + credencial Supabase.

### 📦 Pendiente post-piloto (producción)
- Dockerización + deploy (Render/Railway API, VPS agente).
- ~~Migración a WhatsApp Cloud API oficial~~ — hecha (2026-08-10, limpieza el 2026-08-12).
- Onboarding de nuevos trainers (hoy es manual vía `bootstrap:trainer`).
- Pasarela de pagos (Wompi/MercadoPago).
- Persistencia del outbox (Redis/BullMQ) para sobrevivir reinicios del API.
- Métricas del trainer (semanal / mensual).
- Reordenar ejercicios dentro de un día (drag & drop).
- Duplicar semana en el editor (hoy CSV copy-paste lo cubre).

### 🟡 Calidad de vida
8. Dashboard con métricas reales.
9. Edición inline de items del plan (sets/reps/RPE/cues).
10. Traducción ES del catálogo (OpenAI o manual top 50).
11. Notificaciones del trainer en el frontend (hoy se crean en DB pero no se muestran).

### 🟢 Endurecer para producción
12. ~~**Re-init / self-heal del agente**~~ — sin objeto: no hay Chromium ni sesión que reinicializar. El respawn lo hace Docker.
13. Rate limiting en la API.
14. Mover outbox a Redis/BullMQ.
15. ~~Migrar a WhatsApp Cloud API oficial~~ — hecho.
16. Tests end-to-end automatizados.

---

## 🛠️ Comandos útiles

```bash
# Bootstrap
pnpm install
cp .env.example .env  # y rellenar
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm load:exercises   # carga free-exercise-db (872 ejercicios)
pnpm bootstrap:trainer  # con BOOTSTRAP_EMAIL/NAME/PASSWORD en .env

# Debug
cd libs/db && npx tsx src/scripts/inspect-today-session.ts   # ver estado de sesión del día (PHONE=+573...)

# Dev
pnpm api:dev          # backend en :3000
pnpm frontend:dev     # panel en :5173
pnpm agent:dev        # agente WhatsApp
pnpm scheduler:dev    # cron jobs

# Troubleshooting
pnpm -r --filter "./libs/*" build   # recompilar libs si fallan imports
pnpm db:studio        # UI para ver la DB
```

---

## 🔑 Variables de entorno clave (`.env` raíz)

- `DATABASE_URL` + `DIRECT_URL` → ambas al **pooler** de Supabase, password URL-encoded.
- `SUPABASE_URL` → `https://PROJECT-REF.supabase.co` (NO supabase.com).
- `SUPABASE_JWT_SECRET` → lo usa el middleware de API.
- `SUPABASE_SERVICE_ROLE_KEY` → para el bootstrap script.
- `AGENT_TOKEN` → ≥16 chars, compartido entre API y agente.
- `AGENT_TRAINER_ID` → uuid del trainer dueño del número de WhatsApp.
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` → para el frontend.
