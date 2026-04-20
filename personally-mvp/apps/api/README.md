# @personally/api

Backend principal — Express + TypeScript. Ver `personally-pc/specs/backend/01-api.md`.

## Dev

```bash
pnpm api:dev
# http://localhost:3000/health
```

## Env requeridas

- `API_PORT` (default 3000)
- `CORS_ORIGINS` (csv de origins permitidos)
- `DATABASE_URL`, `DIRECT_URL`
- `SUPABASE_URL`, `SUPABASE_JWT_SECRET`
- `AGENT_TOKEN` (≥16 chars)
