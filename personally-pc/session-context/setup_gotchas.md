---
name: Setup gotchas (fresh machine)
description: Cosas que el CLAUDE.md no dice pero hay que hacer al levantar el repo en una máquina nueva
type: project
originSessionId: 2026-04-20-bootup
---
**CLAUDE.md tiene "Setup inicial en una máquina nueva" pero le faltan 2 pasos que salieron al levantar esta máquina el 2026-04-20:**

1. **`corepack enable && corepack prepare pnpm@9.12.0 --activate`** si `pnpm` no está en PATH.
   Node 20+/22 trae `corepack`. El repo pinea `pnpm@9.12.0` en `package.json` via `packageManager`, así que corepack lo baja solo.

2. **`pnpm -r build` ANTES de `pnpm api:dev`** (o al menos `pnpm --filter @personally/db build`).
   La API importa `@personally/db/dist/index.js` → sin `dist/` compilado, `tsx watch src/index.ts` crashea con `ERR_MODULE_NOT_FOUND`. `pnpm db:generate` solo genera el Prisma client, NO compila el lib.

**Gotcha del frontend build — RESUELTO 2026-07-25:**
- Los 2 errores TS2742 (`src/routes/index.tsx`, `src/test/render.tsx`) se arreglaron con anotaciones explícitas de tipo. `pnpm --filter @personally/frontend build` pasa.
- Ese mismo día se arregló el build de producción de la API (`tsc` nunca se había corrido completo): relaciones Prisma mal nombradas en plans/service (bugs de runtime reales), export type de `Prisma` en libs/db, `SendResult` sin re-exportar en messaging, y `req.params` bajo `noUncheckedIndexedAccess`. La API buildea con `tsconfig.build.json` (excluye `*.test.ts`).

**Why:** queremos que futuras sesiones que levanten el repo en otra máquina no pierdan tiempo diagnosticando esto.

**How to apply:** al clonar el repo y ver que falta `node_modules` o que la API muere en arranque, revisar primero estos 2 pasos antes de debuggear el código.

**TODO pendiente:** actualizar `CLAUDE.md` sección "Setup inicial en una máquina nueva" con estos pasos cuando Juan apruebe.
