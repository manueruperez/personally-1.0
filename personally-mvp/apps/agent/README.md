# @personally/agent

Proceso de salida del bot. Drena el outbox de la API y envia los mensajes por la
**WhatsApp Cloud API** oficial de Meta. Es un cliente HTTP y nada mas: no hay
navegador, ni QR, ni sesion en disco.

Los mensajes **entrantes** no pasan por aca: Meta los entrega al webhook de la
API (`POST /api/v1/webhooks/whatsapp`).

## Dev

```bash
pnpm agent:dev
```

Arranca y queda escuchando el SSE de la API. Si faltan las credenciales de la
Cloud API falla en el arranque a proposito: es preferible a drenar el outbox
contra un 401 en silencio.

## Env requeridas

- `API_BASE_URL` (default http://localhost:3000)
- `AGENT_TOKEN` (≥16 chars, mismo que en la API)
- `AGENT_TRAINER_ID` (uuid del trainer que opera el numero)
- `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_ACCESS_TOKEN` (token permanente, no el
  temporal de 24h del panel de Meta)
- `WHATSAPP_TEMPLATE_LANGUAGE` (opcional, default `es`)

## Notas

- El agente no tiene DB propia ni estado local. Toda decision la consulta a la API.
- Solo el saludo diario sale como plantilla aprobada; el resto de la sesion viaja
  dentro de la ventana de 24h que abre la respuesta del cliente.
- Heartbeat cada 60s (y en cada cambio de estado) para que el panel sepa si el
  bot esta arriba.
- Si el proceso muere, en produccion lo revive `restart: unless-stopped` del
  compose. Mientras esta caido el outbox se acumula en la API y se drena al
  volver.
