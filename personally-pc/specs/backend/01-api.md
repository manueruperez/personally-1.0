# Backend — API REST

Especificación del backend principal (`apps/api`). Express + TypeScript + Prisma sobre Supabase. Autenticación vía JWT emitido por Supabase Auth.

Referencias:
- [docs/02-arquitectura.md](../../docs/02-arquitectura.md)
- [specs/db/01-rutinas.md](../db/01-rutinas.md)

---

## 1. Principios

1. **API versionada**: `/api/v1/...` desde el inicio.
2. **Multi-tenant**: toda request autenticada resuelve `organization_id` desde el JWT.
3. **REST pragmático**: recursos claros, sub-recursos cuando la jerarquía lo justifica, no REST dogmático.
4. **Validación en el borde**: Zod en cada handler (input/output).
5. **Errores uniformes**: `{ code, message, details? }` con HTTP status coherente.
6. **Idempotencia** en endpoints sensibles (`Idempotency-Key` header en POSTs críticos post-MVP).

---

## 2. Autenticación y contexto

### Middleware `auth`
- Lee `Authorization: Bearer <jwt>`.
- Verifica firma contra JWKS de Supabase.
- Inyecta en `req.ctx`:
  ```ts
  {
    userId: string,          // auth.users.id
    trainerId: string,       // trainers.id
    organizationId: string,  // tenant
    role: 'trainer' | 'owner' | 'admin'
  }
  ```

### Middleware `requireRole(roles[])`
- MVP: todo cae en `trainer`. `owner/admin` reservado para gimnasio.

### Aislamiento de tenant
- Todo query a Prisma filtra por `organization_id = ctx.organizationId`.
- Complemento: RLS en Postgres como red de seguridad.

---

## 3. Endpoints MVP

### 3.1 Auth / perfil

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/me` | Retorna trainer + organization actual |
| PATCH | `/api/v1/me` | Actualiza nombre, foto, timezone del trainer |

### 3.2 Clientes

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/clients` | Lista clientes del trainer. Filtros: `?status=active` |
| POST | `/api/v1/clients` | Crea cliente (nombre, teléfono, timezone, hora preferida) |
| GET | `/api/v1/clients/:id` | Detalle + plan activo + últimas sesiones |
| PATCH | `/api/v1/clients/:id` | Actualiza datos y preferencias |
| DELETE | `/api/v1/clients/:id` | Soft delete (archivar) |

### 3.3 Planes y rutinas

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/clients/:clientId/plans` | Planes del cliente (activo + archivados) |
| POST | `/api/v1/clients/:clientId/plans` | Crea plan (body: metadata + estructura completa) |
| GET | `/api/v1/plans/:id` | Plan completo (weeks → days → items) |
| PATCH | `/api/v1/plans/:id` | Actualiza metadata (solo si `status = draft` o hacia adelante) |
| POST | `/api/v1/plans/:id/archive` | Archiva plan activo |
| PATCH | `/api/v1/plan-days/:id` | Edita día completo (reemplaza items). **Solo días futuros** |
| POST | `/api/v1/plans/:id/import-from-sheet` | Importa desde Google Sheet/Airtable (body: URL o datos) |

**Regla de oro:** no se permiten ediciones sobre `plan_days` cuyo `date < today`. El backend rechaza con `409 PLAN_DAY_PAST`.

### 3.4 Catálogo de ejercicios

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/exercises` | Búsqueda con filtros: `?q=`, `?muscle=`, `?equipment=`, `?level=` |
| GET | `/api/v1/exercises/:id` | Detalle |
| POST | `/api/v1/exercises` | Crea ejercicio custom (del trainer) |
| PATCH | `/api/v1/exercises/:id` | Solo ejercicios custom propios |
| DELETE | `/api/v1/exercises/:id` | Solo ejercicios custom propios |

### 3.5 Sesiones (ejecución)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/clients/:clientId/sessions` | Historial. Filtros: `?from=&to=&status=` |
| GET | `/api/v1/sessions/:id` | Detalle + logs de ejercicios |
| GET | `/api/v1/sessions/today?clientId=` | La sesión del día para un cliente |

**No hay POST manual**: las sesiones las crea el scheduler. El agente las avanza.

### 3.6 Eventos del agente (interno)

Endpoints que el agente WhatsApp llama al backend. Autenticación por `X-Agent-Token` (no JWT de usuario).

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/internal/sessions/:id/start` | Cliente dijo "iniciar" |
| POST | `/api/v1/internal/sessions/:id/advance` | Avanza al siguiente `plan_item` |
| POST | `/api/v1/internal/sessions/:id/skip` | Marca item como saltado |
| POST | `/api/v1/internal/sessions/:id/change-request` | Cliente pidió cambio → notifica al entrenador |
| POST | `/api/v1/internal/sessions/:id/finish` | Cierra sesión |
| POST | `/api/v1/internal/clients/:id/incoming-message` | Persiste mensaje entrante en `messages` (ver `specs/db/01-rutinas.md §5.3`). Retorna `{ sessionId?, intent?, triggeredAction? }` |
| POST | `/api/v1/internal/clients/:id/outgoing-message` | Persiste mensaje saliente ya enviado (external_id, template_key, agent_version) |
| POST | `/api/v1/internal/agent/heartbeat` | Heartbeat de sesión WhatsApp (estado, uptime) |

### 3.7 Notificaciones al entrenador

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/notifications` | Lista (unread / all) |
| POST | `/api/v1/notifications/:id/read` | Marca como leída |

Tipos: `change_request`, `no_response_n_days`, `pain_report`, `agent_offline`, `agent_reconnected`.

### 3.8 Métricas

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/metrics/overview` | Resumen del trainer: clientes activos, sesiones completadas semana, alertas |
| GET | `/api/v1/clients/:id/metrics` | Adherencia, sesiones completadas/no hechas, progreso |

---

## 4. Estructura de respuesta estándar

### Éxito
```json
{ "data": { ... } }
```
Listas:
```json
{ "data": [ ... ], "meta": { "total": 42, "page": 1, "pageSize": 20 } }
```

### Error
```json
{
  "error": {
    "code": "PLAN_DAY_PAST",
    "message": "No se puede editar un día ya ejecutado.",
    "details": { "planDayId": "..." }
  }
}
```

### Códigos de error comunes
- `AUTH_REQUIRED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `VALIDATION_ERROR` (422)
- `CONFLICT` (409) — p.ej. `PLAN_DAY_PAST`, `CLIENT_HAS_ACTIVE_PLAN`
- `RATE_LIMITED` (429)
- `INTERNAL` (500)

---

## 5. Validación

- **Zod schemas** compartidos en `libs/types/` para reutilizar en frontend.
- Toda request valida body + params + query.
- Las fechas viajan en ISO-8601 (`2026-04-18` para dates, `2026-04-18T14:30:00Z` para timestamps).

---

## 6. Seguridad

- **CORS**: whitelist del frontend oficial.
- **Rate limiting**: 60 req/min por usuario en endpoints públicos; 300 req/min en internos.
- **Helmet** y cookies httpOnly donde aplique.
- **Secretos** solo por env: `SUPABASE_JWT_SECRET`, `AGENT_TOKEN`, `OPENAI_API_KEY`.
- **Logs** sin PII (no loguear teléfonos ni nombres completos en producción).

---

## 7. Observabilidad (MVP ligero)

- Logger estructurado (pino) con `traceId` por request.
- Endpoint `/health` (DB + agent reachable).
- Métricas básicas: requests/min, latencia p95, errores 5xx.

---

## 8. Pendiente de decidir

- [ ] ¿Paginación cursor-based o offset? (sugerido: offset para MVP, cursor para `/sessions`).
- [ ] ¿Webhooks hacia el trainer (Slack/email)? Post-MVP.
- [ ] ¿GraphQL algún día? No en MVP.
