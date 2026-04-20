# Personally MVP

Monorepo de la primera iteracion real del proyecto **Personally**: un asistente de ejecucion de planes de entrenamiento que convierte la rutina del entrenador en una guia diaria interactiva por WhatsApp.

Documentacion conceptual y specs: `../personally-pc/`.

---

## Estructura

```
personally-mvp/
├── apps/
│   ├── api/          Express + TS (backend principal)
│   ├── agent/        whatsapp-web.js (agente WhatsApp)
│   ├── scheduler/    node-cron (jobs programados)
│   └── frontend/     React + Vite + shadcn/ui (panel del entrenador)
├── libs/
│   ├── core/         Entidades de dominio puras
│   ├── db/           Prisma schema + cliente
│   ├── types/        Schemas Zod compartidos
│   ├── nlu/          Intent classifier (keywords → LLM)
│   ├── messaging/    Abstraccion de canal (WhatsApp, Telegram)
│   ├── engine/       Maquina de estados de la sesion
│   └── exercises/    Acceso al catalogo
├── samples/          Datos de ejemplo (rutina.csv, etc.)
└── scripts/          Utilidades
```

---

## Requisitos

- Node.js 20+
- pnpm 9+
- Cuenta en Supabase (Free tier OK)

---

## Setup inicial

```bash
# 1. Instalar dependencias
pnpm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales (ver juan-tasks.md en personally-pc)

# 3. Generar cliente Prisma y aplicar schema
pnpm db:generate
pnpm db:push

# 4. Seed del catalogo de ejercicios (opcional)
pnpm db:seed
```

---

## Comandos

| Comando | Que hace |
|---------|----------|
| `pnpm dev` | Corre todas las apps en paralelo |
| `pnpm api:dev` | Solo la API |
| `pnpm agent:dev` | Solo el agente |
| `pnpm scheduler:dev` | Solo el scheduler |
| `pnpm frontend:dev` | Solo el frontend |
| `pnpm build` | Build de todas las libs y apps |
| `pnpm lint` | Lint en todo el monorepo |
| `pnpm typecheck` | Type check sin emitir |
| `pnpm db:generate` | Genera Prisma client |
| `pnpm db:push` | Sincroniza schema a la DB (dev) |
| `pnpm db:migrate` | Crea migration (producción) |
| `pnpm db:studio` | Abre Prisma Studio |
| `pnpm db:seed` | Carga datos iniciales |

---

## Convenciones

- **TypeScript strict** en todo el monorepo.
- **Sin colores hardcoded** en frontend — todo via CSS variables en `apps/frontend/src/styles/theme.css`.
- **Multi-tenancy** desde el schema: `organizationId` en todas las queries de negocio.
- **API versionada**: `/api/v1/...`.
- **Mensajes inbound/outbound** siempre persistidos en `messages` (ver specs/db/01-rutinas.md §5.3).

---

## Estado del proyecto

Ver `../personally-pc/TAREAS.md` y `../personally-pc/aprendizajes/05-plan-migracion.md`.
