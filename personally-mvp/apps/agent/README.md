# @personally/agent

Agente WhatsApp. `whatsapp-web.js` + `LocalAuth`, persiste sesion en `.wwebjs_auth/`.

## Dev

```bash
pnpm agent:dev
```

Al primer arranque imprime un QR en la terminal. Escanealo con el WhatsApp del numero dedicado del bot (NO el personal del entrenador).

## Env requeridas

- `API_BASE_URL` (default http://localhost:3000)
- `AGENT_TOKEN` (≥16 chars, mismo que en la API)
- `AGENT_TRAINER_ID` (uuid del trainer que opera el numero)

## Notas

- La sesion WhatsApp vive en `.wwebjs_auth/` (en el VPS del agente). No commitear.
- El agente no tiene DB propia. Toda decision consulta a la API.
- Filtro de grupos activo: ignora mensajes de chats `@g.us`.
- Espaciado 500-1500ms entre envios consecutivos para mitigar baneo.
