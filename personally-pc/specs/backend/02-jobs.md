# Backend — Jobs y scheduler

Especificación de tareas programadas (`apps/scheduler`). `node-cron` en MVP, migración a BullMQ + Redis cuando haya carga.

---

## 1. Jobs

### 1.1 `daily-session-bootstrap`
- **Cuándo:** cada hora (0 * * * *).
- **Qué hace:**
  - Para cada cliente cuya `preferred_start_time` cae en la próxima hora (según su timezone):
    - Crea `sessions` con `status=scheduled` y `scheduled_date = today (cliente tz)`.
    - Encola tarea para que el agente envíe saludo + preview.

### 1.2 `no-response-watcher`
- **Cuándo:** cada día a las 22:00 (por timezone).
- **Qué hace:**
  - Marca sesiones del día con `status=missed` si no tuvieron `started_at`.
  - Por cada cliente con **N=3 días seguidos** sin responder → crea notificación `no_response_n_days` al trainer.

### 1.3 `agent-heartbeat-monitor`
- **Cuándo:** cada 2 minutos.
- **Qué hace:**
  - Si un agente no ha hecho heartbeat en >5 min → notificación `agent_offline` al trainer.
  - Cuando vuelve → notificación `agent_reconnected`.

### 1.4 `metrics-rollup`
- **Cuándo:** diario a las 00:10 (UTC).
- **Qué hace:**
  - Agrega métricas del día anterior a tabla `daily_metrics` por cliente y por trainer.

### 1.5 `plan-expiry-reminder`
- **Cuándo:** diario a las 08:00.
- **Qué hace:**
  - Si `plan.end_date` está a ≤14 días → notificación al trainer "plan por vencer".

---

## 2. Reglas transversales

- **Idempotencia**: cada job usa locks (Postgres advisory locks o llave en Redis).
- **Zonas horarias**: todas las decisiones se evalúan en la tz del cliente, no del servidor.
- **Reintentos**: backoff exponencial (1m, 5m, 30m). Tras 3 fallos → notificación interna.
- **Observabilidad**: cada ejecución loguea `jobName, durationMs, itemsProcessed, errors`.

---

## 3. Pendiente

- [ ] Definir si `daily-session-bootstrap` debe enviar saludo de inmediato o dejar al agente hacerlo (sugerido: scheduler crea sesión, agente envía).
- [ ] Umbral exacto de "N días sin responder" (3 es la sugerencia).
- [ ] Migración a BullMQ cuando haya >20 clientes activos.
