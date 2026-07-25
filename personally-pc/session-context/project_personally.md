---
name: Personally 1.0 project context
description: WhatsApp bot SaaS for fitness trainers; piloto with his friend trainer + 2-3 clients; current MVP state as of 2026-04-20
type: project
originSessionId: dc6d9cf9-4bed-4c83-bc3e-1a65e8699221
---
**Qué es:** Personally 1.0 — SaaS que automatiza el seguimiento de rutinas por WhatsApp. El trainer diseña un plan trimestral y el bot ejecuta día a día con el cliente final.

**Piloto:** su **amigo entrenador personal** (gimnasio de 200-300 personas en Popayán), con cobro simbólico de $10k COP por 4 semanas + 2-3 clientes reales. Arranca cuando Juan considere que el producto está listo.

**Stack actual:**
- Monorepo pnpm + TypeScript.
- Supabase (Postgres pooler session mode + Auth).
- Express + Prisma en `apps/api`.
- whatsapp-web.js + LocalAuth + supervisor en `apps/agent`.
- React + Vite en `apps/frontend`.
- In-memory outbox con SSE push API → Agent.
- Keyword classifier en `libs/nlu` (no LLM en MVP).

**Estado MVP (2026-04-20):** 8/8 casos del dispatcher validados. Panel completo: Dashboard, TodaySessionCard, Notifications (con Responder + Descartar), Plan editor con swap de ejercicio + edición inline + add/remove + imágenes. 167/167 tests pasando. Imágenes del free-exercise-db llegan en cards de WhatsApp.

**Why:** el cuello de botella del piloto fue siempre comercial (9 meses sin primer pago), no técnico. El objetivo ahora es tener producto sólido para que cuando arranque con el amigo-trainer, no se caiga y genere feedback real.

**How to apply:** priorizar features que afecten directamente la experiencia del trainer + cliente durante las 4 semanas del piloto. No obsesionarse con producción (deploy formal, pagos, multi-tenant) hasta validar.

**Notion page root:** https://www.notion.so/346469095c1181d8971fd37e8c02eb15 (🧪 Personally 1.0)

**Comandos de arranque:**
- `pnpm api:dev` — API en :3000
- `pnpm agent:supervised` — agente con auto-respawn
- `pnpm frontend:dev` — frontend en :5173

**Gotcha activo:** `personally-mvp/.env` (root, NO `apps/api/.env`) tiene `TESTING_DOW=2` (Martes) dejado del Caso 8. Ajustar o borrar al retomar.
