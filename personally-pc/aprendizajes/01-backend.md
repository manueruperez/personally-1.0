# Demo — Backend (`project-demo/back/`)

## Stack detectado

- **Express 4.18** + **TypeScript 5.3**
- **MongoDB** con **Mongoose 7.6**
- `cors`, `dotenv`, `nodemon`
- Arquitectura MVC modular: `model / service / controller / routes` por módulo.

## Estructura

```
back/src/
├── modules/
│   ├── users/            CRUD básico
│   ├── routines/         planes trimestrales (12 semanas)
│   ├── daily-routines/   distribución diaria de ejercicios
│   └── items/            catálogo de ejercicios
├── config/database.ts    conexión Mongo
├── routes.ts             enrutador raíz
└── index.ts              bootstrap Express
```

## Features implementadas

- CRUD de usuarios, rutinas, items, daily-routines (endpoints `/api/*`).
- Schema Mongoose del plan con validaciones.
- `DailyRoutine` entrega respuesta agrupada `{ user, routine }`.
- Carga inicial del plan desde CSV.

## Lo que sirve (reutilizable)

- **Patrón de módulos MVC**: separación limpia `model / service / controller / routes`. Trasladable tal cual a `apps/api/src/modules/`.
- **Modelado `DailyRoutine`** como agregación `user + routine`: buen punto de partida para la tabla `sessions` de la nueva DB.
- **Ruteador central** (`routes.ts` importando sub-routers): mismo patrón aplica con Express.
- **Separación `service` vs `controller`**: los controllers manejan HTTP, los services la lógica. Útil mantenerlo.

## Lo que hay que cambiar

- **MongoDB → PostgreSQL (Supabase)**: cambia la capa de persistencia completa. Mongoose schemas → modelos Prisma.
- **Sin autenticación**: agregar middleware de Supabase Auth (JWT) desde el inicio. No es opcional.
- **Error handling pobre**: introducir tipado de errores, códigos (`PLAN_DAY_PAST`, etc.) y estructura uniforme (ver `specs/backend/01-api.md`).
- **Sin multi-tenancy**: agregar `organization_id` en todas las queries (no existe en el demo).
- **Versionado API**: mover endpoints a `/api/v1/...`.
- **Sin validación de input**: agregar Zod en cada handler.

## Archivos específicos a mirar antes de portar

- `src/modules/daily-routines/*` — lógica útil para `sessions`.
- `src/modules/routines/*` — modelo del plan, ver cómo estructuraron días/semanas.
- `src/modules/items/*` — embrion de catálogo; reemplazar con `free-exercise-db`.
- `src/config/database.ts` — sustituir por `PrismaClient` singleton.

## Veredicto

**Portar, no reescribir.** La estructura modular es correcta. El 80% del valor está en los nombres/límites de módulos y la separación de capas. El trabajo de migración es cambiar ORM (Mongoose → Prisma) + DB (Mongo → Postgres) + añadir auth y multi-tenancy.
