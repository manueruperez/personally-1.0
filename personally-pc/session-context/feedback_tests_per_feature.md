---
name: Tests per feature policy
description: Every new dev must ship with tests; user confirmed this explicitly 2026-04-20
type: feedback
originSessionId: dc6d9cf9-4bed-4c83-bc3e-1a65e8699221
---
**Regla:** Cada feature que implemento debe llevar sus tests correspondientes en la misma entrega. No dejo tests "para después".

**Why:** El usuario pidió explícitamente "solo no t olvides de ir generando los test por cada desarrollo que hagas" el 2026-04-20 al dar autorización para trabajar en autonomía sobre las 6 features nuevas (imágenes, swap, notas/cues, add/remove, traducción, tests de componentes). Antes habíamos ido sin tests por modo "ship + validar", y él confirmó que ya no quiere eso.

**How to apply:**
- Feature de backend (endpoint nuevo, lógica de service) → test con prisma mock en `*.test.ts` al lado.
- Feature de frontend con fetching → mockear el hook específico con `vi.mock(...)`, test con RTL + `renderWithProviders`.
- Componente puro (atom) → test con RTL + userEvent.
- Script de DB → test mínimo del data/map si es estático.
- Si un test es de muy bajo ROI (componentes de layout sin lógica), lo listo explícitamente como "sin tests" en el resumen final para ser transparente.

**Target:** 100% de las nuevas entregas incluyen tests. Si por timing algo no se puede testear, lo reporto en el cierre con razón (ej. mutex de concurrencia, keepalive del agente).
