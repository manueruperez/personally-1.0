# Plan: Agregar/eliminar días de plan desde la UI (sin CSV)

*Creado: 2026-07-29. Estado: listo para ejecutar. Origen: Juan chocó con el empty state "Importa el CSV" al crear el plan "resistencia Q3 Q4 2026" en producción.*

## Contexto

Hoy los `plan_days` **solo** nacen del import CSV (`apps/api/src/modules/plans/import-csv.ts:238`). La edición manual existe únicamente a nivel item dentro de días ya creados (`addPlanItem`). Esta feature agrega el eslabón que falta: crear y eliminar **días** desde el editor de planes.

**Gap exacto:**
- No hay endpoint `POST` para crear un `plan_day` ni `DELETE` para borrarlo.
- `PlanWeekView.tsx:49-55` muestra empty state que solo ofrece CSV.

## Decisiones ya tomadas (NO re-decidir)

1. **Solo planes `draft`** pueden agregar/eliminar días — misma regla que `addPlanWeek`/`deletePlanWeek` (`service.ts:400-453`). Si el plan está activo, el trainer usa "revert to draft" primero (ya existe).
2. **Rutas** (siguen el patrón de `/plans/days/:dayId/items`):
   - `POST /api/v1/plans/weeks/:weekId/days` — crea día.
   - `DELETE /api/v1/plans/days/:dayId` — elimina día (cascade a items via FK).
3. **Ownership** siempre via `week.plan { organizationId, trainerId }` del `ctx` (multi-tenancy obligatorio).
4. `dayOfWeek` 1..7 (1=lunes). Constraint único `@@unique([planWeekId, dayOfWeek])` ya existe en schema (`schema.prisma:237`) → chequear duplicado ANTES de crear y devolver `CONFLICT` legible.
5. **Sin cambios de schema Prisma ni migrations** — el modelo `PlanDay` ya tiene todo (`schema.prisma:224-239`).
6. UI en `PlanWeekView`: el empty state ofrece ambos caminos (CSV **y** "Agregar día"); cuando hay días pero < 7, botón "Agregar día" al final de la semana. Delete de día = ícono trash en el header del día con `window.confirm` (mismo patrón que quitar item, `PlanWeekView.tsx:304-307`).
7. El dialog de creación pide: **día de la semana** (solo los no usados de esa semana), **focus** (texto opcional), **checkbox "Día de descanso"**. Nada más (duración/notas se editan después si hace falta — no sobre-diseñar).

## Archivos a tocar

| Archivo | Qué |
|---------|-----|
| `apps/api/src/modules/plans/service.ts` | `addPlanDay`, `deletePlanDay` |
| `apps/api/src/modules/plans/routes.ts` | 2 rutas nuevas con zod inline |
| `apps/api/src/modules/plans/service.test.ts` | tests de ambos services |
| `apps/frontend/src/features/plans/api.ts` | `AddPlanDayPayload`, `plansApi.addDay`, `plansApi.deleteDay` |
| `apps/frontend/src/features/plans/hooks.ts` | `useAddPlanDay(planId)`, `useDeletePlanDay(planId)` |
| `apps/frontend/src/components/organisms/AddPlanDayDialog.tsx` | dialog nuevo |
| `apps/frontend/src/components/organisms/PlanWeekView.tsx` | empty state, botón, trash de día, prop nueva |
| `apps/frontend/src/pages/PlanEditorPage.tsx` | pasar `canEditDays` |
| `apps/frontend/src/components/organisms/PlanWeekView.test.tsx` | tests nuevos |

## Pasos atómicos (un commit por paso)

### Paso 1 — API service + tests

En `service.ts`, después de `deletePlanWeek` (línea ~453):

```ts
export interface AddPlanDayInput {
  dayOfWeek: number; // 1..7, validado en route
  focus?: string | null;
  isRestDay?: boolean;
}

export async function addPlanDay(weekId: string, input: AddPlanDayInput, ctx: AuthContext) {
  const week = await prisma.planWeek.findFirst({
    where: {
      id: weekId,
      plan: { organizationId: ctx.organizationId, trainerId: ctx.trainerId },
    },
    include: { plan: true },
  });
  if (!week) throw new DomainError('NOT_FOUND', 'Semana no encontrada');
  if (week.plan.status !== 'draft') {
    throw new DomainError('CONFLICT', 'Solo se pueden agregar dias a planes en estado draft');
  }
  const existing = await prisma.planDay.findFirst({
    where: { planWeekId: weekId, dayOfWeek: input.dayOfWeek },
  });
  if (existing) {
    throw new DomainError('CONFLICT', 'Ya existe un dia para ese dia de la semana');
  }
  return prisma.planDay.create({
    data: {
      planWeekId: weekId,
      dayOfWeek: input.dayOfWeek,
      focus: input.focus ?? null,
      isRestDay: input.isRestDay ?? false,
    },
  });
}

export async function deletePlanDay(dayId: string, ctx: AuthContext) {
  const day = await prisma.planDay.findFirst({
    where: {
      id: dayId,
      week: { plan: { organizationId: ctx.organizationId, trainerId: ctx.trainerId } },
    },
    include: { week: { include: { plan: true } } },
  });
  if (!day) throw new DomainError('NOT_FOUND', 'Dia de plan no encontrado');
  if (day.week.plan.status !== 'draft') {
    throw new DomainError('CONFLICT', 'Solo se pueden eliminar dias de planes en estado draft');
  }
  await prisma.planDay.delete({ where: { id: dayId } }); // cascade borra items
  return { deleted: true as const };
}
```

Tests en `service.test.ts` (seguir el patrón existente: `prismaMock`, `ctx`, `DomainError` por `code`):
- Ampliar `prismaMock`: `planWeek: { findFirst: vi.fn() }`, y en `planDay` sumar `create` y `delete`.
- `describe('addPlanDay')`: crea con defaults (`isRestDay: false`, `focus: null`) y pasa `planWeekId`/`dayOfWeek` correctos al create · NOT_FOUND si la semana no es del trainer (findFirst → null) · CONFLICT si `plan.status !== 'draft'` · CONFLICT si ya existe día con ese `dayOfWeek`.
- `describe('deletePlanDay')`: borra y devuelve `{deleted:true}` · NOT_FOUND · CONFLICT si no-draft.

**Validar:** `pnpm --filter @personally/api exec vitest run src/modules/plans` en verde.

### Paso 2 — API routes

En `routes.ts`, junto a las rutas de weeks/items:

```ts
plansRouter.post(
  '/weeks/:weekId/days',
  validate({
    params: z.object({ weekId: z.string().uuid() }),
    body: z.object({
      dayOfWeek: z.number().int().min(1).max(7),
      focus: z.string().max(200).nullable().optional(),
      isRestDay: z.boolean().optional(),
    }),
  }),
  // handler idéntico en forma a los existentes: ctx guard + service.addPlanDay + 201
);

plansRouter.delete(
  '/days/:dayId',
  validate({ params: z.object({ dayId: z.string().uuid() }) }),
  // ctx guard + service.deletePlanDay + res.json({ data })
);
```

⚠️ Orden de rutas: `POST /weeks/:weekId/days` no colisiona con `POST /:id/weeks` (Express distingue), pero registrarla DESPUÉS de `/:id/weeks` para mantener legibilidad. `DELETE /days/:dayId` va junto a `POST /days/:dayId/items`.

**Validar:** `pnpm --filter @personally/api build` (tsc) en verde.

### Paso 3 — Frontend: api client + hooks

`features/plans/api.ts`:
```ts
export interface AddPlanDayPayload {
  dayOfWeek: number;
  focus?: string | null;
  isRestDay?: boolean;
}
// en plansApi:
addDay: (weekId: string, body: AddPlanDayPayload) =>
  http.post<PlanDayDto>(`/plans/weeks/${weekId}/days`, body),
deleteDay: (dayId: string) => http.del(`/plans/days/${dayId}`),
```
(usar los mismos helpers `http.*` que `addItem`/`deleteItem` — revisar nombres exactos en el archivo).

`features/plans/hooks.ts` (mismo patrón que `useAddPlanItem`, invalidando `[...KEY, planId]`):
```ts
export function useAddPlanDay(planId: string) { /* mutationFn: ({weekId, body}) => plansApi.addDay(weekId, body) */ }
export function useDeletePlanDay(planId: string) { /* mutationFn: (dayId) => plansApi.deleteDay(dayId) */ }
```

**Validar:** `pnpm --filter @personally/frontend build` en verde.

### Paso 4 — Frontend: UI

1. **`AddPlanDayDialog.tsx`** (organism nuevo — copiar estructura de dialog de `NewPlanDialog.tsx`):
   - Props: `open`, `onOpenChange`, `usedDays: number[]`, `onSubmit(payload: AddPlanDayPayload)`, `submitting`.
   - Radio/botones con `DAY_NAMES` (Lun..Dom) deshabilitando los de `usedDays`; input texto "Focus (opcional)"; checkbox "Día de descanso".
2. **`PlanWeekView.tsx`**:
   - Prop nueva `canEditDays?: boolean`.
   - Empty state (líneas 49-55): mantener CSV como opción pero agregar botón primario "Agregar día" cuando `canEditDays`. Texto: `"Importá el CSV o agregá días manualmente."`
   - Cuando `week.days.length > 0 && week.days.length < 7 && canEditDays`: botón "Agregar día" (variant outline, ícono Plus) al final de la lista de días.
   - Header de cada día: si `canEditDays`, botón trash con `window.confirm('Eliminar el día ... y todos sus ejercicios?')` → `useDeletePlanDay`.
   - `usedDays = week.days.map(d => d.dayOfWeek)`.
3. **`PlanEditorPage.tsx`**: pasar `canEditDays={plan.status === 'draft'}` al `PlanWeekView` (junto a `editable`/`canDelete` existentes, línea ~136).

**Validar:** build de frontend + revisión visual en dev local si hay entorno; si no, confiar en tests del paso 5.

### Paso 5 — Frontend: tests

`PlanWeekView.test.tsx` nuevo (patrón de `ClientList.test.tsx`: `vi.mock` de `@/features/plans/hooks`):
- Semana vacía + `canEditDays` → renderiza botón "Agregar día" y el texto ya NO exige CSV como única vía.
- Semana vacía sin `canEditDays` (plan activo/archivado) → no hay botón.
- Click "Agregar día" → abre dialog; elegir "Mar" + submit → `useAddPlanDay().mutateAsync` llamado con `{ weekId: week.id, body: { dayOfWeek: 2, ... } }`.
- Días usados aparecen deshabilitados en el dialog.
- Trash de día con confirm aceptado → `useDeletePlanDay().mutateAsync` con `day.id`.

**Validar:** `pnpm vitest run` — **toda** la suite en verde (base 219 + nuevos, cero regresiones).

### Paso 6 — Docs + cierre

- `personally-pc/AVANCE.md`: entrada breve de la feature.
- `personally-pc/docs/08-despliegue.md`: en checklist pre-entrega, nota de que el trainer ya puede cargar rutinas 100% desde la UI.
- Correr `pnpm vitest run` final y anotar el conteo en el commit.

## Validación final del plan completo

```bash
cd personally-mvp
pnpm vitest run                          # todo verde
pnpm --filter @personally/api build      # tsc api
pnpm --filter @personally/frontend build # tsc + vite
```

## Deploy (manual, lo hace Juan/Claude después de mergear — NO el worker)

```bash
rsync -az --delete --exclude node_modules --exclude .git --exclude '.env' --exclude .wwebjs_auth \
  -e "ssh -i ~/.ssh/personallay_vps_ed25519" \
  personally-mvp root@46.225.79.211:/opt/personally/
ssh -i ~/.ssh/personallay_vps_ed25519 root@46.225.79.211 \
  "cd /opt/personally/personally-mvp/deploy && docker compose build api caddy && docker compose up -d api caddy"
```
(caddy = frontend horneado; el agente no se toca.)

## Fuera de alcance (NO hacer)

- Editar `focus`/`estimatedDurationMin`/`notes` del día ya creado (edición inline de día) — otra iteración.
- Permitir días en planes `active` sin pasar por draft.
- Reordenar días o semanas.
- Cambios al import CSV.
