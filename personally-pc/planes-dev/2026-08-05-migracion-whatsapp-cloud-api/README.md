# Plan: migrar el canal de WhatsApp a la Cloud API oficial de Meta

*Creado: 2026-08-05. Actualizado: 2026-08-10.*

**Estado: pasos 1-3 implementados y testeados; 4-6 pendientes.** Los trámites de Meta (sección 2) siguen sin arrancar y son la ruta crítica. Corrección al plan original: los pasos 1-4 sí se pueden escribir sin credenciales (tests con `fetch` mockeado); lo que realmente depende de los trámites es el paso 5, la validación E2E y el deploy con `CHANNEL=cloud`.

| Paso | Estado | Dónde |
|---|---|---|
| 1. Cliente HTTP | ✅ 12 tests | `apps/agent/src/channels/cloud-api/client.ts` |
| 2. `CloudApiChannel` | ✅ 12 tests | `apps/agent/src/channels/cloud-api/channel.ts` |
| 3. Selección por env | ✅ 8 tests | `apps/agent/src/channels/factory.ts` |
| 4. Webhook de entrada | ⬜ | `apps/api` |
| 5. Plantilla del saludo | ⬜ bloqueado por Meta | — |
| 6. Docs y corte | ⬜ | — |

## 1. Por qué

`whatsapp-web.js` no es una API: automatiza WhatsApp Web dentro de un Chromium headless. No hay contrato ni compatibilidad garantizada, así que cada cambio en la web de Meta lo rompe. **En la semana del 2026-07-29 al 08-05 se rompió tres veces:**

| Rotura | Síntoma | Estado |
|---|---|---|
| `sendMessage()` devuelve `undefined` aunque entrega | Todo mensaje enviado se registraba como `failed-` | Parcheado (`unconfirmed-<uuid>`) |
| Evento `ready` dejó de emitirse (WA Web 2.3000.x) | Sesión autenticada pero el outbox nunca drenaba; 2 días sin saludos | Parcheado (fallback 45s) |
| Migración a **LID** | `msg.id._serialized` vacío → API 422; `from` como `<id>@lid` y `contact.number` devolviendo el LID → ningún cliente matcheaba. **El bot quedó mudo** | Parcheado (reconstruir id + `contact.id.user`) |

Los tres son bugs abiertos upstream ([#5768](https://github.com/wwebjs/whatsapp-web.js/issues/5768), [#127084](https://github.com/wwebjs/whatsapp-web.js/issues/127084)) sin solución oficial. Además, automatizar WhatsApp Web **viola los términos de servicio**: el número puede ser baneado sin aviso ni apelación — inaceptable con clientes reales de un entrenador que paga.

**Objetivo:** reemplazar el canal por la Cloud API oficial. Desaparecen Chromium, el QR, las sesiones caídas y el riesgo de ban.

## 2. Requisitos previos — trámites (los hace Juan, tardan más que el código)

**Nada de la sección 5 se ejecuta hasta tener esto resuelto.** Es la ruta crítica.

- [ ] **Cuenta de Meta Business** (business.facebook.com) con el negocio verificado. La verificación pide documentación del negocio y puede tardar días.
- [ ] **App de tipo Business** en developers.facebook.com con el producto *WhatsApp* agregado.
- [ ] **Número dedicado.** ⚠️ Un número que entra a Cloud API **deja de funcionar en la app normal de WhatsApp** y no se puede revertir fácilmente. NO usar el número personal de Juan (hoy el bot corre sobre un número que recibe mensajes de terceros — ver `08-despliegue.md`).
- [ ] **Plantilla del saludo diario aprobada** (categoría *utility*). Revisión de Meta: 1-2 días. Ver sección 4.
- [ ] **Token permanente** de System User (los tokens temporales del panel duran 24h y no sirven en producción).
- [ ] Anotar: `WABA_ID`, `PHONE_NUMBER_ID`, `ACCESS_TOKEN`, `APP_SECRET`, `WEBHOOK_VERIFY_TOKEN`.

## 3. Costo real

Modelo vigente desde 2025-07-01 (per-message, no por conversación):

- **Respuestas dentro de la ventana de 24h: gratis e ilimitadas.** Se abre cuando el cliente escribe.
- **Se cobra solo la plantilla que inicia la conversación** (el saludo de las 5 AM), a tarifa *utility* del país del destinatario.

Para el piloto: 3 clientes × ~30 días ≈ **90 plantillas/mes**. A tarifa utility Colombia (~USD 0.01-0.02) son **~USD 1-2/mes**. Todo el resto de la sesión (tarjetas de ejercicio, respuestas, cierre) cae dentro de la ventana → **$0**.

Verificar la tarifa vigente de Colombia en la [documentación de pricing de Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) antes de arrancar.

## 4. Decisiones de arquitectura (tomadas — no re-decidir al ejecutar)

1. **Cloud API directa, sin BSP intermediario** (Twilio/360dialog). Los BSP cobran markup por mensaje y agregan una dependencia más; nuestro volumen no justifica el costo ni la comodidad. Reconsiderar solo si la burocracia de Meta resulta impracticable.
2. **Se implementa un `CloudApiChannel` que cumple la interfaz `MessagingChannel` existente** (`libs/messaging/src/channel.ts`). El dispatcher, la state machine, el catálogo y el panel **no se tocan**. Esta abstracción ya existe y es lo que hace barata la migración.
3. **Entrada por webhook HTTP, no por polling.** Meta hace POST a un endpoint público nuestro. Caddy ya termina TLS en `app.personallay.com`, así que el webhook vive ahí.
4. **Convivencia temporal:** el canal se elige por env var (`CHANNEL=wwebjs|cloud`), con `wwebjs` como default hasta validar. Permite rollback inmediato sin redeploy de código.
5. **El agente deja de necesitar Chromium** en modo `cloud`, pero `apps/agent` se mantiene como proceso (corre el outbox worker). El Dockerfile del agente se aligera recién cuando `wwebjs` se elimine del todo.
6. **Un solo `templateKey` al inicio:** `daily_greeting`. El resto de los mensajes son de sesión (texto/imagen libres dentro de la ventana). `OutgoingMessage.templateKey` ya existe en la interfaz.

### Mapeo de conceptos

| Hoy (wwebjs) | Con Cloud API |
|---|---|
| QR + LocalAuth en volumen | Token permanente en `.env` |
| Estado de sesión (`online`/`qr_required`) | Siempre `online`; el panel muestra estado del número |
| `client.sendMessage()` | `POST /{PHONE_NUMBER_ID}/messages` |
| Evento `message` de Puppeteer | Webhook `POST /api/v1/webhooks/whatsapp` |
| `externalId` = id interno de WA | `messages[0].id` que devuelve la API (`wamid.*`) |
| Imagen por `MessageMedia.fromUrl` | `{type:"image", image:{link, caption}}` — Meta descarga la URL |

## 5. Pasos de implementación (ejecutar solo con la sección 2 completa)

### Paso 1 — Cliente HTTP de la Cloud API
`apps/agent/src/channels/cloud-api/client.ts`: funciones puras sobre `fetch` para `sendText`, `sendImage`, `sendTemplate`. Sin estado. Manejo explícito de rate limits (429) y errores de Meta (respuesta trae `error.code`/`error.message`).
**Tests:** mock de `fetch`; verificar payloads exactos por tipo, propagación de errores, y que un 429 se reporte como reintentable.

### Paso 2 — `CloudApiChannel` implementando `MessagingChannel`
`apps/agent/src/channels/cloud-api/channel.ts`. `start()`/`stop()` son no-ops (no hay sesión que mantener); `getSessionState()` siempre `online`; `getQrCode()` siempre `null`. `send()` enruta según `contentType` y `templateKey`.
**Tests:** cada contentType produce la llamada correcta; `templateKey` presente → envía plantilla; `SendResult.externalId` sale del `wamid` devuelto.

### Paso 3 — Selección de canal por env
`apps/agent/src/index.ts`: fábrica que instancia `wwebjs` o `cloud` según `CHANNEL`. Default `wwebjs`.
**Tests:** la fábrica devuelve la implementación correcta y falla con mensaje claro si faltan las env de Cloud API.

### Paso 4 — Webhook de entrada
Endpoint en el API: `GET /api/v1/webhooks/whatsapp` (verificación de Meta con `hub.challenge`) y `POST` (recepción). **Validar la firma `X-Hub-Signature-256` con `APP_SECRET`** — sin eso cualquiera puede inyectar mensajes falsos. Normalizar el payload de Meta al `IncomingMessage` que ya consume el dispatcher.
Caddy: agregar la ruta antes del handler genérico de `/api/*` (el orden importa, ver `Caddyfile`).
**Tests:** verificación del challenge; firma inválida → 401; payload real de Meta → `IncomingMessage` correcto; ignorar eventos de status (`delivered`/`read`) sin romper.

### Paso 5 — Plantilla del saludo diario
El dispatcher marca `templateKey: 'greeting'` (`dispatcher.ts:577`) — **no `daily_greeting`** como decía la primera versión de este plan. La plantilla en Meta debe registrarse con ese nombre, o cambiar el mapeo en `TEMPLATE_NAMES` (`cloud-api/channel.ts`). Mapear las variables del texto actual a los placeholders `{{1}}`, `{{2}}` de la plantilla aprobada.
**Tests:** el orden y cantidad de variables coincide con la plantilla registrada.

### Paso 6 — Documentación y corte
Actualizar `08-despliegue.md` (nueva arquitectura, sin Chromium), `.env.example`, y el runbook de `deploy/README.md`.

### Validación final
```bash
cd personally-mvp && pnpm vitest run && pnpm --filter @personally/api build && pnpm --filter @personally/agent build
```
Más un E2E real contra un número de prueba: saludo por plantilla → responder "iniciar" → recibir tarjeta con imagen → "siguiente" → cierre.

## 6. Riesgos y rollback

- **Rollback:** `CHANNEL=wwebjs` + restart del agente. El código viejo queda intacto hasta que la Cloud API esté validada en producción.
- **La ventana de 24h se cierra** si el cliente no responde en todo el día: el saludo del día siguiente igual funciona (es plantilla), pero un mensaje libre fuera de ventana sería rechazado por Meta. El flujo actual no manda mensajes espontáneos fuera del saludo, así que no aplica — **verificar que siga siendo cierto** si se agregan recordatorios.
- **Cambio de categoría de plantilla:** si Meta reclasifica `daily_greeting` como *marketing*, el costo por mensaje sube. Redactarla en tono utilitario (recordatorio del entrenamiento del día), no promocional.
- **Límite de números de prueba:** con el negocio sin verificar, Meta limita a pocos destinatarios y ~250 conversaciones/día. Suficiente para el piloto, insuficiente para escalar.

## 7. Fuera de alcance

- Eliminar `whatsapp-web.js` del repo (se hace en una limpieza posterior, tras validar Cloud API en producción).
- Aligerar el Dockerfile del agente quitando Chromium (idem).
- Botones interactivos / listas de la Cloud API — el MVP usa texto libre y el NLU por keywords.
- Migrar el histórico de mensajes: los `externalId` viejos conviven sin conflicto.
