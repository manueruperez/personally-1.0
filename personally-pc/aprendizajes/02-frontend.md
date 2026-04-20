# Demo — Frontend (`project-demo/front/`)

## Stack detectado

- **React 19** + **Vite** (rolldown-vite 7.2.5) + **TypeScript**
- **TailwindCSS 4.1** + postcss
- **react-router-dom 7**
- **Jest** + `@testing-library/react`
- **ESLint 9**

## Estructura

```
front/src/
├── desygn-system/        (sic: typo)
│   ├── pages/            home, items, not-found
│   └── molecules/        itemCard
├── services/
│   ├── api.client.ts     cliente HTTP tipado
│   └── item.service.ts
├── routes.tsx            React Router config
├── App.tsx               shell con nav y footer
└── main.tsx              entry
```

## Features implementadas

- Layout básico con navegación (Home, Items).
- `ItemCard` component.
- `api.client.ts` tipado con `IItem`.
- Tailwind config con paleta custom (`bg-base #0b1224`, `primary #6366f1`), sombra `glow`, transiciones.
- Tests mínimos con Jest.

## Lo que sirve (reutilizable)

- **`services/api.client.ts`**: patrón de cliente HTTP tipado. Se adapta directo al nuevo front; solo hay que añadir interceptor de JWT de Supabase.
- **`tailwind.config`**: paleta dark funcional, algunos tokens rescatables. Servirá como **referencia estética**, no como config final (el nuevo `theme.css` con CSS variables reemplaza esto — ver `specs/frontend/01-arquitectura-ui.md`).
- **Estructura `molecules / pages`**: alineada con Atomic Design. Se puede continuar la nomenclatura (corrigiendo el typo `desygn-system` → `design-system`).
- **React Router setup**: reutilizable para las nuevas rutas.

## Lo que hay que cambiar

- **Sin shadcn/ui**: instalar desde cero (`pnpm dlx shadcn@latest init`).
- **Sin auth**: agregar Supabase Auth SDK + guards de ruta.
- **Sin estado global**: agregar Zustand (auth) + React Query (server state).
- **Sin sistema de tema centralizado**: reemplazar `tailwind.config` con `theme.css` + CSS variables (ver spec).
- **Testing mínimo**: ampliar cobertura en flujos críticos (auth, creación de plan, ejecución del agente).
- **Typo** `desygn-system` → `design-system`. Aprovechar la reorganización para seguir Atomic Design completo (atoms/molecules/organisms/templates/pages).

## Archivos específicos a mirar antes de portar

- `src/services/api.client.ts` — portar casi literal.
- `src/services/item.service.ts` — patrón de servicio por dominio.
- `tailwind.config.js` — extraer tokens de color para el nuevo `theme.css`.

## Veredicto

**Rescatar selectivo, no portar entero.** La estructura base está bien pero la mayor parte del trabajo en frontend es nuevo (shadcn/ui, theming, auth, 9 vistas del entrenador). Lo reutilizable concreto es el cliente HTTP y los tokens de color.
