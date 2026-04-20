# @personally/scheduler

Cron jobs. Ver `personally-pc/specs/backend/02-jobs.md`.

## Dev

```bash
pnpm scheduler:dev
```

## Env

- `SCHEDULER_TIMEZONE` (default `America/Bogota`)
- `DATABASE_URL`, `DIRECT_URL`

## Jobs

| Job | Schedule | Proposito |
|-----|----------|-----------|
| daily-session-bootstrap | cada hora | Crea sesiones del dia |
| no-response-watcher | 22:00 | Marca `missed` + notifica |
| agent-heartbeat-monitor | cada 2 min | Detecta agentes caidos |
| metrics-rollup | 00:10 | Agrega metricas |
| plan-expiry-reminder | 08:00 | Avisa planes por vencer |
