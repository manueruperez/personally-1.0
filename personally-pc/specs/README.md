# Specs — Especificaciones técnicas

Carpeta con el **"cómo"** detallado de cada área del sistema. Complementa `docs/` (que contiene el "qué y por qué").

```
specs/
├── db/          ← modelo de datos, schemas, relaciones, índices
├── backend/     ← endpoints REST, reglas, jobs, validaciones
├── frontend/    ← vistas, componentes, flujos UI, estados
└── bots/        ← agente WhatsApp: comandos, máquina de estados, plantillas de mensajes
```

## Índice

### 🗄️ Base de datos
- [db/01-rutinas.md](db/01-rutinas.md) — Modelo de datos de planes, rutinas y ejercicios

### 🔌 Backend
- [backend/01-api.md](backend/01-api.md) — Endpoints REST, auth, errores, seguridad
- [backend/02-jobs.md](backend/02-jobs.md) — Scheduler y tareas programadas

### 🖥️ Frontend
- [frontend/01-arquitectura-ui.md](frontend/01-arquitectura-ui.md) — Atomic Design, shadcn/ui, Tailwind, theming desde archivo maestro

### 🤖 Bots
- [bots/01-agente-whatsapp.md](bots/01-agente-whatsapp.md) — Agente, ciclo de vida de sesión, máquina de estados, plantillas
