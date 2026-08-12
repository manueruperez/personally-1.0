# Plan: eliminar whatsapp-web.js del proyecto

*Creado: 2026-08-12. Estado: **EJECUTADO Y CERRADO** el 2026-08-12 — ver sección 7.*

## 1. Condición de arranque (bloqueante)

**No ejecutar hasta que el E2E completo por Cloud API haya pasado en producción.**

A la fecha de escribir esto, `CHANNEL=cloud` está activo pero **no se envió ni un
solo mensaje exitoso**: el único intento de saludo falló (`#132001`, plantilla
todavía en revisión) y la imagen del API está 43 horas atrasada.

Mientras eso siga así, `whatsapp-web.js` es la única red de seguridad del
proyecto: `CHANNEL=wwebjs` + restart devuelve el bot a un canal que sabemos que
funciona. Borrarlo antes de validar deja el piloto sin rollback.

Checklist previo:

- [ ] Rebuild del API con el copy alineado.
- [ ] Saludo forzado que llega al teléfono como plantilla.
- [ ] `iniciar` → tarjeta con imagen → `siguiente` → cierre, todo por Cloud API.
- [ ] Al menos un día de cron a las 5 AM sin errores en `messages.error`.

Recomendado además: **una semana de piloto real** antes de quemar las naves. El
costo de esperar es un `if` en una fábrica; el de apurarse, quedarse sin canal.

## 2. Qué se elimina

### apps/agent
- `src/channels/whatsapp-webjs.ts` + `.test.ts` (~330 líneas)
- `src/puppeteer-config.ts` + `.test.ts`
- `src/channels/factory.ts` — deja de tener sentido con un solo canal; el
  `index.ts` instancia `CloudApiChannel` directamente. **Se conserva la
  validación de env**, que es lo valioso de la fábrica.
- deps: `whatsapp-web.js`, `qrcode-terminal`, `@types/qrcode-terminal`
- `src/supervisor.ts`: **revisar, no borrar a ciegas.** Existe para respawnear
  ante crashes de Chromium, pero `restart: unless-stopped` de Docker ya cubre el
  caso general. Sin Chromium el proceso es un cliente HTTP: evaluar si aporta.

### deploy
- `agent.Dockerfile`: sacar Chromium y las env de Puppeteer. **Es la ganancia
  más grande**: la imagen baja del orden de ~500 MB.
- `docker-compose.yml`: sacar `PUPPETEER_EXECUTABLE_PATH`, el volumen
  `wwebjs_auth` y la variable `CHANNEL`.
- Ajustar `tests/dockerfiles.test.ts` y `tests/compose.test.ts`, que hoy
  **afirman** que Chromium está presente.

⚠️ **No borrar el volumen `wwebjs_auth` del VPS en el mismo paso.** Quitarlo del
compose basta para dejar de montarlo; borrar los datos es irreversible y sin
valor. Dejarlo huérfano un mes y después `docker volume rm`.

### QR y estado de sesión
- `libs/messaging`: `SessionState` pierde `qr_required`, `authenticating`,
  `reconnecting` — con Cloud API el canal solo puede estar `online` u `offline`.
  Esto **toca el schema de heartbeat del API** (`z.enum`) y el frontend.
- `apps/api`: campo `qr` en `store.ts` y en el body del heartbeat.
- `apps/frontend`: `AgentPage` (bloque del QR), `AgentStatusDot`,
  `features/agent/api.ts`, dep `qrcode.react`.
- Comando `reinit` (`agent/routes.ts`, `events.ts`, `sse-client.ts`): existía
  para forzar un respawn de Chromium. Sin sesión que reiniciar, **evaluar si el
  botón "Reconectar" del panel sigue teniendo sentido** o pasa a ser un no-op
  confuso para el trainer.

## 3. Qué NO se elimina

- El campo `templateKey` y la abstracción `MessagingChannel`. La interfaz es lo
  que hizo barata esta migración; sacarla para "simplificar" es tirar la lección.
  Un canal futuro (Telegram, otro BSP) vuelve a colgarse de ahí.
- Los tests del canal Cloud API, obviamente.
- El historial de mensajes con `externalId` viejos de wwebjs: conviven sin
  conflicto con los `wamid.*`.

## 4. Orden de ejecución

Cada paso deja el repo compilando y con tests en verde; se commitea por separado.

1. **Agente sin wwebjs** — borrar canal viejo, puppeteer-config, colapsar la
   fábrica, sacar deps. Tests del agente en verde.
2. **Docker más liviano** — Dockerfile sin Chromium, compose sin volumen ni env.
   Actualizar los tests de deploy que afirman lo contrario. Medir y anotar el
   tamaño de imagen antes/después.
3. **Estado de sesión** — podar `SessionState`, el heartbeat del API y el QR del
   frontend. Es el paso que más superficie toca; va solo.
4. **Docs** — `CLAUDE.md`, `08-despliegue.md`, `deploy/README.md` (sección
   "Canal de WhatsApp" pierde la tabla comparativa y el rollback).

## 5. Validación

```bash
cd personally-mvp
pnpm --filter @personally/api build
pnpm --filter @personally/agent build
pnpm --filter @personally/frontend build
# por proyecto: correr los 5 juntos aborta con SIGABRT en la Mac de Juan
for p in api agent libs deploy; do pnpm vitest run --project $p; done
pnpm --filter @personally/frontend exec vitest run
```

Y en el VPS, tras el deploy: saludo forzado + `iniciar` → `siguiente` → cierre.

## 6. Rollback

A partir de este trabajo **el rollback deja de ser una variable de entorno** y
pasa a ser un `git revert`. Ese es exactamente el costo que se está aceptando, y
la razón de la condición de la sección 1.

---

## 7. Cierre (2026-08-12)

Ejecutado completo, un commit por paso:

| Paso | Commit | Qué quedó |
|---|---|---|
| 1. Agente sin wwebjs | `3785f56` | Canal viejo, `puppeteer-config` y supervisor borrados. La fábrica pasó a `create-channel.ts` conservando la validación de credenciales. El outbox worker drena al arrancar en vez de colgar de `onSessionStateChange('online')`, que con la Cloud API nunca dispara. |
| 2. Docker más liviano | `5e3c58c` | Imagen del agente sin Chromium ni fuentes, sin volumen `wwebjs_auth`, sin `agent-entrypoint.sh`. De ~1 GB a ~400 MB (estimado). Los tests de deploy ahora **afirman la ausencia** de Chromium para que la limpieza no se deshaga sola. |
| 3. Estado de sesión | `5c11152` | `SessionState` = `initializing / online / offline`. Fuera el QR de punta a punta y el botón "Reconectar". |
| 4. Docs | este commit | `CLAUDE.md`, `deploy/README.md`, `apps/agent/README.md`, `docs/08-despliegue.md`, `AVANCE.md`, `specs/bots/01-agente-whatsapp.md` §2 y los comentarios stale del dispatcher. |

### Decisiones que el plan dejaba abiertas

**Botón "Reconectar" → eliminado** (junto con `POST /agent/reconnect`, el comando
`reinit` y todo el canal de comandos por SSE). El comando viajaba por SSE, así
que necesitaba al agente vivo para llegarle: si estaba vivo no había sesión que
reiniciar, y si estaba muerto no llegaba. Un botón que solo se puede apretar
cuando no sirve es peor que ninguno. La alternativa —dejarlo como "reiniciar
proceso"— se descartó: en prod el respawn ya lo hace `restart: unless-stopped`,
y en dev el botón mataría al agente sin nadie que lo levante.

**Compatibilidad del heartbeat.** Agente y API son procesos separados: durante un
deploy hay una ventana con agente viejo mandando `state: "qr_required"` a un API
nuevo. El `z.enum` sigue aceptando los tres estados viejos y
`normalizeAgentState` los colapsa a `offline`; el `qr` sobrante lo descarta zod
solo. Se puede endurecer —borrar `LEGACY_STATES` de `agent/store.ts`— cuando no
queden agentes de esa era corriendo.

**`initializing` se conserva** en `SessionState`: no es parte del mundo del QR,
es donde arranca cualquier canal futuro con handshake real, y `MessagingChannel`
existe justamente para eso.

### Hallazgos fuera del plan

- `getAgentStatus` degradaba a `offline` **solo** si el último estado era
  `online`. Un agente que murió reportando otra cosa quedaba congelado en ese
  estado para siempre. Ahora cualquier estado rancio (>2 min) pasa a `offline`.
- Estaban stale también `apps/agent/README.md` (describía LocalAuth y el QR de
  terminal) y `specs/bots/01-agente-whatsapp.md` §2 (diagrama de estados con
  `QRRequired`/`Reconnecting`). Los dos se reescribieron.
- `personally-pc/session-context/in_progress_bootup.md` menciona
  `pnpm agent:supervised`, pero es un snapshot fechado del 2026-04-20 que dice de
  sí mismo que hay que borrarlo: se dejó como está.

### Pendiente (no bloquea nada)

- `docker volume rm` del `wwebjs_auth` huérfano en el VPS, dentro de un mes.
- Borrar `LEGACY_STATES` del heartbeat.
- `.dockerignore` conserva `.wwebjs_auth` a propósito: ya no lo genera nadie,
  pero sigue existiendo en las máquinas que corrieron el canal viejo y son
  cientos de MB de contexto de build.

### Validación final

api 119 · agent 42 · libs 83 · deploy 53 · frontend 63 = **360**. Builds de api,
agent y frontend en verde.
