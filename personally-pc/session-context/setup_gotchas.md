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

**Gotcha del frontend build (pre-existente, no bloqueante):**
- `pnpm --filter @personally/frontend build` falla con 2 errores TS2742:
  - `src/routes/index.tsx:15` — `router` type reference portability
  - `src/test/render.tsx:14` — `renderWithProviders` type reference portability
- **No afecta `pnpm frontend:dev`** (Vite no corre tsc en dev). Si se quiere build de producción, hay que anotar los tipos a mano.

**Why:** queremos que futuras sesiones que levanten el repo en otra máquina no pierdan tiempo diagnosticando esto.

**How to apply:** al clonar el repo y ver que falta `node_modules` o que la API muere en arranque, revisar primero estos 2 pasos antes de debuggear el código.

**TODO pendiente:** actualizar `CLAUDE.md` sección "Setup inicial en una máquina nueva" con estos pasos cuando Juan apruebe.
