# Aprendizajes — Auditoría del `project-demo`

Inventario y evaluación del **demo previo** ubicado en `../../project-demo/`. El objetivo es aprovechar lo que ya funciona y entender por qué reemplazar lo que no.

## TL;DR

| Área | Qué hay | Reutilizable | Acción |
|------|---------|--------------|--------|
| **Backend** | Express + TS + **MongoDB/Mongoose**, MVC modular (users, routines, daily-routines, items) | Alto — estructura y modelos | Portar a Prisma + Supabase, conservar módulos |
| **Frontend** | React 19 + Vite + Tailwind 4, sin auth ni shadcn | Medio — `api.client`, estructura, tokens | Rehacer con shadcn/ui + Supabase Auth, mantener patrón |
| **WA Bot Worker** | `whatsapp-web.js` JS vanilla, LocalAuth, `node-cron` 5am, handler por keywords | Alto — patrón completo | Portar a TypeScript, añadir heartbeat + manejo de errores |
| **DB** | Scripts Node que parsean CSV → MongoDB, `rutina.csv` 12 semanas, schema con RPE/cues/logs | Alto — el CSV y el schema de ejercicio | Migrar a Prisma seed + Postgres |

## Índice

| Doc | Contenido |
|-----|-----------|
| [01-backend.md](01-backend.md) | Stack, módulos, qué sirve y qué rehacer |
| [02-frontend.md](02-frontend.md) | Stack, estructura, activos rescatables |
| [03-wa-bot.md](03-wa-bot.md) | Arquitectura del bot, handler, cron, qué portar |
| [04-db.md](04-db.md) | Schema del plan, CSV, estrategia de carga |
| [05-plan-migracion.md](05-plan-migracion.md) | **Plan concreto** de qué copiar, qué portar, qué reescribir |

## Cómo usar esta carpeta

1. Antes de escribir un módulo nuevo en `personally-pc/`, revisá si ya existe equivalente en el demo.
2. Si existe y funciona → portarlo al nuevo stack con los cambios documentados en [05-plan-migracion.md](05-plan-migracion.md).
3. Si existe pero está mal conceptualizado → reescribir, pero leer el código viejo para **no repetir el mismo error**.
