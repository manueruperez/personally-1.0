# Plan de pruebas E2E del dispatcher

Checklist ordenada para validar el ciclo completo cliente ↔ bot. Cada caso: qué mandar por WhatsApp, qué se espera, qué mirar en la DB/frontend.

## Estado de validación

| # | Caso | Estado | Fecha | Notas |
|---|------|--------|-------|-------|
| 1 | Happy path completo | ✅ | 2026-04-19 | Warmup → exercise → cooldown → finish ok |
| 2 | SKIP (defer semantics) | ✅ | 2026-04-19 | Fix: enum `deferred` faltaba en schema |
| 3 | CHANGE | ✅ | 2026-04-19 | Marca `changed`, notifica trainer, pide `siguiente` |
| 4 | PAIN | ✅ | 2026-04-19 | Cambió a auto-skip con nota de dolor (opción B) |
| 5 | FINISH a mitad | ✅ | 2026-04-19 | Cierra con `partial` + mensaje de cierre |
| 6 | UNKNOWN en sesión | ✅ | 2026-04-19 | Fallback "siguiente/saltar/cambiar" ok |
| 7 | Idempotencia / concurrencia | ✅ | 2026-04-19 | Fix: mutex por cliente en `routes.ts` |
| 8 | Día siguiente (TESTING_DOW) | ✅ | 2026-04-19 | TESTING_DOW=1→2, reset, greeting → planDay de Martes (9 items) correcto |

> **Setup previo:**
> - `TESTING_DOW=3` (miércoles) en `.env`. API reiniciada (no hot-reload para `.env`).
> - Cliente con plan `active` + CSV importado.
> - Agente `En línea`.
> - Frontend abierto en detalle del cliente (ves la conversación actualizándose).

---

## Caso 1 — Happy path completo

**Objetivo**: recorrer warmup → exercise → cooldown hasta "bien hecho".

| Paso | Acción (vos → bot) | Esperado (bot → vos) | Validación adicional |
|------|-------------------|---------------------|----------------------|
| 1 | Reset sesión en UI | — | Conversación vacía |
| 2 | `iniciar` | Primer item del bloque `warmup` con formato `1/N · 🔥 Calentamiento ...` | `sessions.status = in_progress`, 1 log en `presented` |
| 3 | `siguiente` | Siguiente item del warmup | log anterior `done`, nuevo en `presented` |
| 4 | Repetir `siguiente` hasta terminar warmup | Primer item del bloque `exercise` con `🏋️ Ejercicio` | Bloques cambian |
| 5 | Repetir hasta último item | `🧘 Cooldown` bloque final | |
| 6 | `siguiente` en el último | Mensaje de cierre `✅ Bien hecho...` con completionRate | `sessions.status = completed`, `itemsDone = itemsTotal` |

**Fallos esperables**:
- Si un bloque no tiene items, se salta y va al siguiente.
- Si el bloque actual termina, automáticamente pasa al siguiente sin extra mensaje.

---

## Caso 2 — SKIP (defer semantics)

SKIP difiere el item **1 slot hacia adelante** (no lo saca). Orden efectivo = `orderInSession + deferCount`. Max 3 defers → al 4to se marca `skipped` permanente.

| Paso | Acción | Esperado |
|------|--------|----------|
| 1 | Reset + `iniciar` | Item 1 (warmup) |
| 2 | `siguiente` → llega item 2, `saltar` | Item 2 queda `deferred`, `deferCount=1`, se presenta item 3 |
| 3 | `siguiente` en item 3 | Ahora aparece el item 2 diferido (no el 4) |
| 4 | Si seguís saltando el mismo item 3 veces | Al 4to SKIP se marca `skipped` permanente y no reaparece |
| 5 | Al final: contar | `itemsSkipped ≥ 1`, `itemsDone < itemsTotal`, `sessions.status = partial` |

---

## Caso 3 — CHANGE

| Paso | Acción | Esperado |
|------|--------|----------|
| 1 | Reset + `iniciar` | Primer item |
| 2 | `cambiar` (o `otro`, `alternativa`) | Respuesta: "Ok, aviso a tu entrenador..." |
| 3 | En DB `notifications` | 1 fila nueva tipo `change_request` con `metadata.exerciseLogId` |
| 4 | Mirar log del item | `status = changed` |
| 5 | `siguiente` | Debería presentar el **próximo** item (el changed queda atrás) |

---

## Caso 4 — PAIN (escape por dolor)

PAIN marca el ejercicio actual como `skipped` con nota de dolor, notifica al trainer, y **sigue** con el siguiente ejercicio. El reportado no reaparece en esta sesión.

| Paso | Acción | Esperado |
|------|--------|----------|
| 1 | Reset + `iniciar` → `siguiente` un par de veces | Estás en un ejercicio presentado |
| 2 | `me duele la rodilla` | "Recibido. Ya aviso a tu entrenador y saltamos ese ejercicio. Seguimos con el siguiente." |
| 3 | ~1-2s después | Llega la card del siguiente ejercicio automáticamente |
| 4 | Mirar log del ejercicio que reportaste | `status = skipped`, `notes = "dolor: me duele la rodilla"` |
| 5 | En DB `notifications` | 1 fila tipo `pain_report`, `metadata.exerciseLogId` apunta al log, `metadata.exerciseName` tiene el nombre |
| 6 | No debería reaparecer | Seguí la rutina hasta el final → el ejercicio reportado nunca vuelve |
| 7 | Edge case: decir `me duele` antes de `iniciar` | Solo notifica, no intenta avanzar (no rompe) |

---

## Caso 5 — FINISH a mitad

| Paso | Acción | Esperado |
|------|--------|----------|
| 1 | Reset + `iniciar` → `siguiente` un par de veces | Estás a mitad de sesión |
| 2 | `finalizar` (o `terminé`, `fin`) | Mensaje de cierre |
| 3 | `sessions.status` | `partial` (algunos done, otros pending) |

---

## Caso 6 — UNKNOWN por contexto

| Paso | Acción | Esperado |
|------|--------|----------|
| 1 | Reset + mandá `"hola"` **antes** de `iniciar` | Respuesta: "Responde *iniciar* cuando estes listo/a." |
| 2 | `iniciar` | Primer item |
| 3 | `"como estas"` (en medio de sesión) | "No te entendi. Responde *siguiente*, *saltar* o *cambiar*." |

---

## Caso 7 — Idempotencia / concurrencia

Mensajes casi simultáneos del mismo cliente se serializan por un mutex in-memory en `routes.ts` (`withClientLock`). Sin esto, dos "iniciar" en <1s presentan 2 ejercicios (calentamiento + primer ejercicio) por race condition.

| Paso | Acción | Esperado |
|------|--------|----------|
| 1 | Reset | Sesión en `greeted` |
| 2 | Mandar `iniciar` dos veces lo más rápido posible | Llega **solo 1 mensaje** (el calentamiento). El segundo dispatch ve el item ya `presented` y retorna `already_started` sin enviar nada |
| 3 | Repetir con `siguiente siguiente` mid-session | Solo avanza 1 item, no 2 |

> Esto verifica que si hay un item en estado `presented`, `iniciar`/`siguiente` no re-presenta.

---

## Caso 8 — Día siguiente (requiere reset + cambio de TESTING_DOW)

| Paso | Acción | Esperado |
|------|--------|----------|
| 1 | Completá caso 1 (sesión del miércoles) | `completed` |
| 2 | Cambiar `TESTING_DOW` a otro día (ej. 4 = jueves) + restart API | — |
| 3 | Sin tocar reset, mandá `iniciar` | **Debería crear una nueva sesión** con el plan_day del jueves |

> Esto valida que la sesión del día anterior no bloquea la del día siguiente.

---

## Qué mirar al terminar cada caso

### En el frontend (`/clients/<id>`)
- Card "Conversación": veas las burbujas en tiempo real con intent badges.
- Card "Enviar mensaje" → botón "Reset sesión" para reiniciar.

### En la DB (vía Prisma Studio o script)
```bash
cd libs/db && npx tsx src/scripts/inspect-today-session.ts
```
Muestra: status de la sesión, contadores, estado de cada log.

### En los logs del API
```bash
strings /tmp/api.log | grep -i 'testingDow\|dispatcher\|unknown_reply\|present_item' | tail -20
```

---

## Si falla algo

1. Copiar el input exacto que mandaste al bot.
2. `strings /tmp/api.log | tail -100` para ver el error en la API.
3. `strings /tmp/agent.log | tail -30` para ver error del agente.
4. Verificar con `inspect-today-session.ts` qué quedó persistido.

---

## Cerrar el test (volver a producción)

1. Sacar `TESTING_DOW=` del `.env` (dejar vacío).
2. Reiniciar API (`pkill -f tsx.*api`, `pnpm api:dev`).
3. Reset sesión del cliente usado para test.
