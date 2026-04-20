# Plan de migración desde `project-demo`

Cómo convertir los activos del demo en el nuevo monorepo `personally/`.

---

## 1. Matriz de decisión

| Origen (demo) | Destino (personally 1.0) | Acción | Esfuerzo |
|---------------|--------------------------|--------|----------|
| `back/src/modules/users` | `apps/api/src/modules/trainers` + `clients` | **Portar** Mongoose → Prisma, añadir auth | S |
| `back/src/modules/routines` | `apps/api/src/modules/plans` + `libs/plan` | **Portar** + normalizar a `plans / plan_weeks / plan_days / plan_items` | M |
| `back/src/modules/daily-routines` | `apps/api/src/modules/sessions` | **Portar** — el concepto encaja con `sessions` | S |
| `back/src/modules/items` | `libs/exercises` + `apps/api/src/modules/exercises` | **Reemplazar catálogo** por `free-exercise-db`, conservar estructura de endpoints | S |
| `back/src/config/database.ts` | `libs/db/prisma.ts` | **Reescribir** (Prisma singleton) | XS |
| `back/src/routes.ts` | `apps/api/src/routes/index.ts` | **Portar** + añadir `/api/v1` prefix | XS |
| `front/src/services/api.client.ts` | `apps/frontend/src/lib/api.ts` | **Portar casi literal** + interceptor JWT | XS |
| `front/src/services/item.service.ts` | `apps/frontend/src/features/exercises/service.ts` | **Portar** + React Query wrappers | XS |
| `front/tailwind.config.js` | `apps/frontend/src/styles/theme.css` | **Extraer tokens**, reescribir con CSS vars | S |
| `front/src/desygn-system/*` | `apps/frontend/src/components/*` (atoms/molecules/...) | **Reorganizar** a Atomic Design | M |
| `wa-bot-worker/services/*` | `apps/agent/src/*` | **Portar a TS** + abstracción `MessagingChannel` + heartbeat | L |
| `wa-bot-worker/services/daily-routine/cron-services.js` | `apps/scheduler/src/jobs/*` | **Portar a TS** + jobs nuevos | M |
| `DB/rutina.csv` | `personally-pc/samples/rutina-demo-12-semanas.csv` | **Copiar tal cual** | XS |
| `DB/add-routine-plan.js` | `libs/db/seeds/plan-from-csv.ts` | **Portar a TS + Prisma** | S |
| `DB/add-items-data-to-db.js` | `libs/db/seeds/exercises-from-free-db.ts` | **Reescribir** (fuente nueva) | S |

Tallas: XS (<2h) · S (2-8h) · M (1-2 días) · L (3+ días).

---

## 2. Orden sugerido de ejecución

### Bloque 1 — Fundaciones (antes de cualquier feature nueva)
1. Copiar `rutina.csv` a `personally-pc/samples/`.
2. Enriquecer `specs/db/01-rutinas.md` con `rpe_target` y `cues` aprendidos del demo.
3. Montar el nuevo monorepo (workspaces, TS, ESLint, Prettier).
4. Crear `libs/db/` con Prisma schema completo (`specs/db/01-rutinas.md`).
5. Crear proyecto Supabase y correr primera migration.

### Bloque 2 — Backend core
6. Portar `users / routines / daily-routines / items` al módulo nuevo (Prisma + Supabase Auth).
7. Implementar middleware de auth + multi-tenancy.
8. Añadir Zod validators en todos los handlers.
9. Seed del catálogo con `free-exercise-db`.
10. Seed del plan desde `rutina.csv`.

### Bloque 3 — Agente WhatsApp
11. Crear `apps/agent/` con TS.
12. Portar `LocalAuth`, Puppeteer config y filtro de grupos.
13. Implementar `MessagingChannel` + `WhatsAppWebJsChannel`.
14. Portar handler `onMessage` + integrar `libs/nlu` (keywords).
15. Implementar heartbeat + estados de sesión.
16. Conectar al backend vía `/api/v1/internal/*`.

### Bloque 4 — Scheduler
17. Crear `apps/scheduler/` con `node-cron`.
18. Portar el cron de 5am (reforzándolo: múltiples timezones, jobs de la spec).

### Bloque 5 — Frontend
19. Setup shadcn/ui + theme.css.
20. Portar `api.client.ts` con interceptor de Supabase JWT.
21. Auth flow (login/logout con Supabase Auth).
22. Vistas MVP por orden de prioridad: `/clients` → `/clients/:id` → `/plans/:id` → `/notifications` → `/agent` → `/settings`.

---

## 3. Qué NO llevarnos

- **Nada de MongoDB**: drivers, schemas Mongoose, `config/database.ts`.
- **Sin auth del demo**: no hay, todo es nuevo con Supabase.
- **Sin tests del demo**: los que hay son mínimos y no cubren nada relevante.
- **Nombres con typos** (`recive-messages`, `desygn-system`): renombrar al portar.

---

## 4. Riesgos identificados al portar

- **Modelado del plan**: en el demo todo vive como array anidado en Mongo. En Postgres hay que normalizar a 4 tablas (`plans`, `plan_weeks`, `plan_days`, `plan_items`). Es el paso más delicado.
- **Estado en memoria del bot**: `Map<phoneNumber, ...>` se pierde al reiniciar. Hay que asegurarse de que toda decisión del bot consulte a la API.
- **Lock-in con el CSV específico**: el formato de `rutina.csv` no necesariamente es el mismo que querrá el entrenador-piloto. Definir el Sheet definitivo antes de automatizar el importador.

---

## 5. Checklist de kickoff

- [ ] Copiar `rutina.csv` a `personally-pc/samples/`.
- [ ] Auditar las columnas del CSV y actualizar `specs/db/01-rutinas.md`.
- [ ] Listar los endpoints del demo y mapearlos 1:1 a `specs/backend/01-api.md`.
- [ ] Revisar config exacta de Puppeteer/LocalAuth del bot (args de launch, cache path).
- [ ] Identificar bugs conocidos del demo (preguntárselos al autor antes de reescribir).
