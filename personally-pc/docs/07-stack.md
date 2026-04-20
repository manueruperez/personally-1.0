# 07 — Stack tecnológico

## Componentes principales

- **Backend:** Node.js, Express, TypeScript, Prisma.
- **Agente:** Node.js, `whatsapp-web.js` (beta) → **WhatsApp Cloud API** (post-beta).
- **Frontend:** React, Vite, TailwindCSS.
- **Scheduler:** `node-cron` o BullMQ + Redis.
- **Base de datos:** PostgreSQL en Supabase (**única fuente de verdad**).
- **Auth:** Supabase Auth (JWT estándar, incluido en Supabase).
- **Catálogo de ejercicios:** `free-exercise-db` (dominio público, carga local a Supabase).
- **NLU (intérprete de intención):** keywords en MVP → LLM (OpenAI/Claude) post-MVP.
- **IA (opcional, post-MVP):** Python + FastAPI + OpenAI API.
- **Infra:** Render / Railway, Vercel / Netlify, VPS en DigitalOcean o Hetzner.

---

## Decisiones tomadas

- [x] WhatsApp como canal primario durante beta (vía `whatsapp-web.js`).
- [x] Telegram documentado como canal secundario / Plan B.
- [x] Asumir explícitamente riesgos de baneo e inestabilidad durante beta.
- [x] Plan de migración a WhatsApp Cloud API post-beta.
- [x] **Eliminar MongoDB del stack** → sesión WhatsApp en filesystem (`LocalAuth`), el resto en Postgres + JSONB si hace falta.
- [x] **Eliminar Auth0 del stack** → usar Supabase Auth (single source of truth: identidad + datos de negocio en una sola DB).
- [x] Supabase como única plataforma de datos (Free tier para beta).

---

## Notas sobre migraciones futuras

> Si en el futuro se requieren features enterprise de identidad (SSO, SAML, directorio empresarial, compliance SOC2), considerar migrar **Supabase Auth → Auth0 o Clerk**. Como Supabase Auth emite JWT estándar, la migración implica solo cambiar el proveedor y el middleware de verificación, **sin tocar la lógica de negocio**.
