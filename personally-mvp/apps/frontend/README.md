# @personally/frontend

Panel del entrenador. React + Vite + TS + TailwindCSS con theming via CSS variables.

## Dev

```bash
pnpm frontend:dev
# http://localhost:5173
```

## Estructura (Atomic Design)

```
src/
├── components/
│   ├── atoms/      Button, Input, Card, Label (shadcn-compatibles)
│   ├── molecules/  composiciones simples
│   ├── organisms/  componentes de dominio
│   ├── templates/  DashboardLayout, AuthLayout
│   └── ui/         shadcn/ui (proximo init)
├── features/       auth, clients, plans, exercises, sessions, notifications, agent
├── pages/
├── routes/
├── stores/         Zustand (auth)
├── lib/            api, supabase, utils
└── styles/         theme.css (unica fuente de verdad visual) + globals.css
```

## Theming

Todas las variables visuales (paleta, radios, tipografia) estan en `src/styles/theme.css`.
**Nunca** uses colores hardcoded. Usa `bg-primary`, `text-foreground`, etc.

## shadcn/ui

Aun no inicializado. Comandos:

```bash
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input label card dialog dropdown-menu toast
```

Los atoms actuales (`Button`, `Input`, `Card`, `Label`) son equivalentes
minimales pre-shadcn. Al correr `shadcn init` se pueden migrar a `components/ui/`
sin cambios estructurales.

## Env requeridas

- `VITE_API_BASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
