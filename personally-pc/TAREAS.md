# TAREAS — Qué necesitamos hacer

Lista accionable ordenada por momento y tipo. Se actualiza a medida que avanzamos.

---

## 🔥 AHORA — Antes de escribir código (Fase 0)

### Producto
- [ ] Validar con el amigo-entrenador si la interacción "cliente responde *siguiente* después de cada ejercicio" le funciona a sus clientes o es demasiada fricción.
- [ ] Definir umbral exacto de "N días sin respuesta" para notificar al entrenador *(sugerido: 3)*.
- [ ] Definir **estructura exacta** del Google Sheet / Airtable que llenará el entrenador en el piloto.

### Comercial
- [ ] Conversación de expectativas con el amigo-piloto: **honestidad brutal + fecha fin + métricas**.
- [ ] Agendar **3 entrevistas de validación** esta semana con entrenadores del gimnasio.

### Técnico (preparación)
- [ ] **Auditar código de la demo previa**: qué es reutilizable, qué se tira.
- [ ] Definir entregable concreto al final de las 4 semanas del piloto.
- [ ] Calcular horas reales disponibles en las próximas 4 semanas.

---

## 🏗️ IMPLEMENTACIÓN — Setup inicial del repo

### Monorepo
- [ ] Estructura `apps/` + `libs/` según [docs/02-arquitectura.md](docs/02-arquitectura.md).
- [ ] Tooling: TypeScript, ESLint, Prettier, workspaces (npm/pnpm).
- [ ] `.env.example`, Docker para desarrollo local.

### Base de datos (Supabase)
- [ ] Crear proyecto en Supabase Free tier.
- [ ] Schema con **multi-tenancy desde día uno**: `organization_id` en todas las tablas principales.
- [ ] Tablas: `organizations`, `trainers`, `clients`, `plans`, `routines`, `exercises`, `exercise_logs`, `sessions`, `messages`.
- [ ] `trainers.user_id` → FK a `auth.users.id`.
- [ ] Roles `trainer / owner / admin` modelados (aunque solo se use `trainer` en MVP).
- [ ] Campo `timezone` por cliente (aunque todos sean Popayán en MVP).
- [ ] Row Level Security por `organization_id`.
- [ ] Prisma schema en `libs/db/`.

### Catálogo de ejercicios
- [ ] Clonar `yuhonas/free-exercise-db`.
- [ ] Script de carga del JSON a la tabla `exercises`.
- [ ] Script de traducción masiva al español (OpenAI/Google Translate).
- [ ] **Revisión manual** de los ~50 ejercicios más comunes.
- [ ] Soporte para ejercicios custom del entrenador (`source = custom`, `created_by`, `organization_id`).

---

## 🧠 LIBS (núcleo reutilizable)

### `libs/core`
- [ ] Entidades del dominio: Trainer, Client, Plan, Routine, Exercise, Session, Message.
- [ ] Reglas de negocio puras (sin IO).

### `libs/plan`
- [ ] Modelo del plan trimestral (12 semanas, `warmup[] + exercises[] + cooldown[]` por día).
- [ ] Validaciones: carga/descarga, días por semana, ejercicios válidos.
- [ ] Importador desde Google Sheet / Airtable (Fase 1 del piloto).

### `libs/engine`
- [ ] Máquina de estados de ejecución diaria.
- [ ] Estados: `idle → greeted → in_warmup → in_exercise → in_cooldown → finished`.
- [ ] Logs inmutables de progreso.
- [ ] Manejo de `siguiente / saltar / cambiar / finalizar`.
- [ ] Timeout de sesión inactiva.

### `libs/nlu`
- [ ] Interfaz `IntentClassifier`.
- [ ] V1: clasificador por keywords según tabla en [docs/01-producto.md](docs/01-producto.md).
- [ ] V2 (post-MVP): adapter para LLM externo.

### `libs/messaging`
- [ ] Interfaz `MessagingChannel` (send, receive, session lifecycle).
- [ ] Implementación `WhatsAppWebJsChannel` (beta).
- [ ] Scaffold de `TelegramChannel` (Plan B).
- [ ] Futura `WhatsAppCloudApiChannel`.

### `libs/exercises`
- [ ] Módulo de acceso al catálogo.
- [ ] Búsqueda por músculo, equipamiento, nivel.
- [ ] Favoritos y customs por trainer.

---

## 🚀 APPS

### `apps/api` (Express + TS)
- [ ] Bootstrap con Express + TS + Prisma.
- [ ] Middleware de verificación JWT de Supabase.
- [ ] Rutas versionadas `/api/v1/...`.
- [ ] CRUD: `trainers`, `clients`, `plans`, `routines`.
- [ ] Endpoints para importar plan desde Sheet.
- [ ] Endpoints de notificaciones (cambio de ejercicio, N días sin responder, dolor/lesión).

### `apps/agent` (whatsapp-web.js)
- [ ] Sesión por entrenador con `LocalAuth`.
- [ ] Heartbeat hacia API.
- [ ] Manejo de estados de sesión (conectar, reconectar, caída).
- [ ] Alertas proactivas al entrenador antes de que note la caída.
- [ ] Envío con espaciado aleatorio y volúmenes bajos (mitigar baneo).

### `apps/scheduler` (node-cron / BullMQ)
- [ ] Job diario por cliente a su hora configurada (respetando timezone).
- [ ] Job de detección de "N días sin responder".
- [ ] Reset mensual de métricas de uso.

### `apps/frontend` (React + Vite)
- [ ] Login con SDK de Supabase.
- [ ] Vista de clientes del entrenador.
- [ ] Vista de plan (lectura en MVP; Kanban post-piloto).
- [ ] Vista de notificaciones.
- [ ] Gestión de sesión WhatsApp (QR, estado de conexión, últimos errores).

---

## 📈 PILOTO — Ejecución (4 semanas)

### Semana 1–2: Fase 1
- [ ] Onboarding del amigo-entrenador (contrato simbólico $10k, métricas definidas por escrito).
- [ ] Cargar plan de 3 meses desde Sheet.
- [ ] 2–3 clientes suyos activos.
- [ ] Tracker semanal: mensajes enviados, estabilidad de sesión, horas ahorradas reportadas.

### Semana 3–4: Fase 2
- [ ] Segundo entrenador del gimnasio (no el más prominente, sugerido por el amigo).
- [ ] Si acepta pagar **$30k/mes** después de 2 semanas → **primera validación comercial real**.

### Cierre de piloto — Evaluar métricas
- [ ] ≥2 clientes del amigo usando el sistema 3+ semanas.
- [ ] Reporte de ahorro de tiempo cuantificable.
- [ ] Aceptación de $30k/mes sin negociación.

### Semana 5+: Fase 3 (solo si Fases 1 y 2 cerraron OK)
- [ ] Entrenadora con redes sociales. Caso de estudio + trato preferencial.

### Siempre en paralelo
- [ ] **3 entrevistas de 15 min** con entrenadores del gimnasio (guion de Validación Comercial).

---

## 🔮 POST-MVP / LARGO PLAZO

- [ ] Migrar intérprete de keywords → LLM (soporte de lenguaje natural completo).
- [ ] Construir vista **Kanban** para gestión de rutinas (reemplaza el Sheet).
- [ ] Agregar **alternativas automáticas** de ejercicios (catálogo enriquecido).
- [ ] Abordar **Plan Gimnasio** con dueño del gym cuando haya ≥3 entrenadores internos activos.
- [ ] Migrar a **WhatsApp Cloud API oficial** al alcanzar X pagos activos (sugerido: 10).
- [ ] Ajustar pricing para absorber costo por conversación (~USD 0.01–0.03).
- [ ] Elegir pasarela de pagos (MercadoPago / Wompi / Stripe) e integrarla.
- [ ] Recuperación limitada de rutinas saltadas (gap policy, post-MVP).
- [ ] Evaluar microservicio NLP en Python + FastAPI si se justifica.
