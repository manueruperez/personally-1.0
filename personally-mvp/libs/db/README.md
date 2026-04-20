# @personally/db

Prisma schema + cliente singleton. Fuente de verdad: `personally-pc/specs/db/01-rutinas.md`.

## Comandos

```bash
pnpm --filter @personally/db generate   # genera el cliente Prisma
pnpm --filter @personally/db push       # aplica schema a la DB (dev)
pnpm --filter @personally/db migrate    # crea una migration (produccion)
pnpm --filter @personally/db studio     # UI para explorar la DB
pnpm --filter @personally/db seed       # carga datos iniciales
```

Desde la raiz del monorepo, los mismos comandos estan como `pnpm db:*`.

## Uso

```ts
import { prisma } from '@personally/db';

const trainers = await prisma.trainer.findMany();
```

## Variables de entorno requeridas

- `DATABASE_URL`: connection string con pooling (pgbouncer port 6543 en Supabase).
- `DIRECT_URL`: connection string directa (port 5432) usada por `prisma migrate`.
