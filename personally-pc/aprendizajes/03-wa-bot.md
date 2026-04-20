# Demo — WA Bot Worker (`project-demo/wa-bot-worker/`)

## Stack detectado

- **`whatsapp-web.js`** (fork custom timothydillan)
- **`node-cron` 4.2**
- **`qrcode-terminal`**
- **JavaScript vanilla** (sin TypeScript)
- **Puppeteer** (sandbox deshabilitado)

## Estructura

```
wa-bot-worker/services/
├── index.js                       bootstrap de servicios
├── message/
│   ├── send-messages.js
│   └── recive-messages.js         (sic: typo "recive")
└── daily-routine/
    ├── index.js                   DailyRoutineService (singleton)
    ├── cron-services.js           cron 5am
    └── backend-services.js        comunicación con back
```

## Features implementadas

- Cliente WhatsApp con **`LocalAuth`** (persistencia de sesión en `.wwebjs_auth`).
- Message handler: `{ body, from, isGroup }` con filtro de grupos.
- `handleCommand()` por `phoneNumber` (matching por keywords).
- `DailyRoutineService` con `Map<phoneNumber, {user, routine}>` en memoria.
- **Cron diario 5am** que dispara envío de rutina.
- `backendServices.getCurrentRoutine()` → consume la API del backend.

## Lo que sirve (reutilizable) — **valor alto**

Este es el módulo con **mayor densidad de aprendizaje**. Todo el flujo end-to-end (cron → backend → WhatsApp → handler) ya funciona a grandes rasgos.

- **Patrón de servicios singleton** (`DailyRoutineService`): migrable a TypeScript tal cual.
- **Message handler `onMessage`**: el esqueleto del intérprete está hecho.
- **Flujo cron diario**: portar a `apps/scheduler/` según `specs/backend/02-jobs.md`.
- **`LocalAuth` + Puppeteer setup**: config funcional (sandbox off, cache paths). Copiar las opciones y documentarlas.
- **Cliente HTTP hacia backend**: patrón de comunicación agent ↔ API.
- **Filtro de grupos**: mantener (`isGroup === true → ignorar`).

## Lo que hay que cambiar

- **JS → TypeScript**: convertir todo el módulo. Tipado estricto en mensajes y estados.
- **Renombrar** `recive-messages.js` → `receive-messages.js`. Obvio.
- **Sin manejo de errores**: agregar try/catch con logging estructurado.
- **Map en memoria**: estado frágil. Pasar a consultas a la API por sesión (`/api/v1/sessions/today`).
- **Sin heartbeat**: implementar heartbeat a la API cada 60s (ver `specs/bots/01-agente-whatsapp.md`).
- **Sin rate limiting / espaciado**: agregar delay aleatorio 500-1500ms entre mensajes (mitigación de baneo).
- **Sin auth con backend**: agregar `X-Agent-Token` en las llamadas internas.
- **Sin máquina de estados de sesión de entrenamiento**: implementarla según `specs/bots/01-agente-whatsapp.md §3`.
- **Keywords hardcodeadas**: mover a `libs/nlu/` con `IntentClassifier`.
- **Canal acoplado**: abstraer detrás de `MessagingChannel` de `libs/messaging/`.

## Archivos específicos a mirar antes de portar

- `services/daily-routine/index.js` — extraer el singleton.
- `services/message/recive-messages.js` — la lógica del handler. Lo más valioso.
- `services/daily-routine/cron-services.js` — cron pattern.
- `services/daily-routine/backend-services.js` — cliente HTTP al back.
- Config de Puppeteer/LocalAuth (suele estar en `index.js` del cliente).

## Veredicto

**Portar sí o sí.** 9 meses de aprendizaje sobre cómo `whatsapp-web.js` se comporta en la práctica viven acá. El código JS no se reutiliza literal, pero las **decisiones** (sandbox off, LocalAuth, filtro de grupos, cron 5am) sí. Convertir a TS y enriquecer con heartbeat, manejo de errores, rate limiting y máquina de estados.
