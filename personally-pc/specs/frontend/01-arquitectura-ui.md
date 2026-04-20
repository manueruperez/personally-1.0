# Frontend — Arquitectura UI

Especificación de `apps/frontend`. React + Vite + TypeScript + **TailwindCSS** + **shadcn/ui**, siguiendo **Atomic Design** y con **theming centralizado desde un archivo maestro**.

---

## 1. Principios

1. **Atomic Design** para organizar componentes (átomos → moléculas → organismos → templates → páginas).
2. **Librería de componentes base**: **shadcn/ui** (Radix UI primitives + Tailwind).
3. **Theming desde un único archivo maestro**: `src/styles/theme.css` con CSS variables. Cambiar colores, radios, sombras y tipografías **sin tocar componentes**.
4. **Tipado estricto**: TypeScript en `strict` mode, Zod para validación de formularios (compartido con backend vía `libs/types`).
5. **Accesibilidad por defecto**: shadcn/ui ya usa Radix (ARIA, teclado, focus), no romperlo.
6. **Mobile-first**: el entrenador usará el panel frecuentemente desde el teléfono.

---

## 2. Por qué shadcn/ui (decisión)

| Criterio | shadcn/ui | Element Plus | MUI | Mantine |
|----------|-----------|--------------|-----|---------|
| Stack React | ✅ | ❌ (Vue) | ✅ | ✅ |
| Tailwind nativo | ✅ | ❌ | ❌ | ⚠️ |
| Theming desde CSS vars | ✅ nativo | ⚠️ | ⚠️ | ⚠️ |
| Ownership del código | ✅ copy-paste | ❌ npm dep | ❌ | ❌ |
| A11y (Radix) | ✅ | ⚠️ | ✅ | ✅ |
| Tamaño bundle | ✅ solo lo que usas | ❌ grande | ❌ grande | ⚠️ |

**Conclusión:** shadcn/ui es la única que cumple simultáneamente Tailwind-first + theming por CSS variables + ownership total. Perfecta para el requisito "archivo maestro que controla todo el look".

---

## 3. Stack completo

- **Framework:** React 18 + Vite 5.
- **Lenguaje:** TypeScript (strict).
- **Styling:** TailwindCSS v3 + `tailwind-merge` + `clsx` + `tailwindcss-animate`.
- **Librería base:** shadcn/ui (instalada componente a componente via CLI).
- **Iconos:** `lucide-react` (por defecto en shadcn).
- **Formularios:** `react-hook-form` + `zod` + `@hookform/resolvers`.
- **Data fetching:** `@tanstack/react-query` (cache + revalidación).
- **Rutas:** `react-router-dom` v6.
- **Estado global (mínimo):** Zustand para auth/session, React Query para server state.
- **Fechas:** `date-fns` + `date-fns-tz` (respeta timezone del cliente).
- **Charts (métricas):** `recharts`.
- **Animaciones micro:** `tailwindcss-animate` + `framer-motion` puntual.

---

## 4. Theming: archivo maestro

### 4.1 `src/styles/theme.css` — única fuente de verdad visual

```css
@layer base {
  :root {
    /* ===== Paleta semántica ===== */
    --background: 0 0% 100%;
    --foreground: 222 47% 11%;

    --card: 0 0% 100%;
    --card-foreground: 222 47% 11%;

    --primary: 160 84% 39%;          /* verde Personally */
    --primary-foreground: 0 0% 100%;

    --secondary: 210 40% 96%;
    --secondary-foreground: 222 47% 11%;

    --muted: 210 40% 96%;
    --muted-foreground: 215 16% 47%;

    --accent: 24 95% 53%;            /* naranja para CTAs secundarios */
    --accent-foreground: 0 0% 100%;

    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;

    --border: 214 32% 91%;
    --input: 214 32% 91%;
    --ring: 160 84% 39%;

    /* ===== Radios ===== */
    --radius-sm: 0.375rem;
    --radius-md: 0.5rem;
    --radius-lg: 0.75rem;

    /* ===== Sombras ===== */
    --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.05);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);

    /* ===== Tipografía ===== */
    --font-sans: "Inter", system-ui, sans-serif;
    --font-heading: "Inter", system-ui, sans-serif;
  }

  .dark {
    --background: 222 47% 6%;
    --foreground: 210 40% 98%;
    --card: 222 47% 9%;
    --card-foreground: 210 40% 98%;
    --primary: 160 84% 45%;
    /* ...etc */
  }
}
```

**Regla:** ningún componente usa colores hardcoded. Todo pasa por `bg-primary`, `text-foreground`, etc. Cambiar `theme.css` = cambiar la app entera.

### 4.2 `tailwind.config.ts`

Extiende Tailwind para que lea las CSS variables:

```ts
colors: {
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",
  primary: {
    DEFAULT: "hsl(var(--primary))",
    foreground: "hsl(var(--primary-foreground))",
  },
  // ...
},
borderRadius: {
  lg: "var(--radius-lg)",
  md: "var(--radius-md)",
  sm: "var(--radius-sm)",
},
fontFamily: {
  sans: ["var(--font-sans)"],
  heading: ["var(--font-heading)"],
},
```

### 4.3 Branding por organización (post-MVP)

Para el plan Gimnasio: cargar un CSS dinámico al `<html>` con las variables override según `organization.branding`. Cero refactor, solo variables nuevas.

---

## 5. Estructura del proyecto (Atomic Design)

```
apps/frontend/
├── public/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes/                 ← rutas por página (React Router)
│   ├── styles/
│   │   ├── theme.css           ← 🎯 archivo maestro
│   │   └── globals.css
│   ├── components/
│   │   ├── atoms/              ← botones, inputs, badges, avatars
│   │   ├── molecules/          ← form-field, search-bar, stat-card
│   │   ├── organisms/          ← client-list, plan-editor, notification-panel
│   │   ├── templates/          ← dashboard-layout, auth-layout
│   │   └── ui/                 ← 📦 shadcn/ui (auto-generado, no tocar salvo theming)
│   ├── features/               ← lógica por dominio (verticales)
│   │   ├── auth/
│   │   ├── clients/
│   │   ├── plans/
│   │   ├── sessions/
│   │   ├── exercises/
│   │   └── notifications/
│   ├── hooks/                  ← hooks compartidos
│   ├── lib/
│   │   ├── api.ts              ← cliente HTTP (fetch + react-query)
│   │   ├── supabase.ts         ← SDK cliente de Supabase Auth
│   │   ├── utils.ts            ← cn(), formatDate(), etc.
│   │   └── validators.ts       ← schemas Zod compartidos con libs/types
│   ├── stores/                 ← Zustand stores
│   └── types/
└── tailwind.config.ts
```

### Mapping Atomic Design → shadcn/ui

- **Atoms**: wrappers delgados de shadcn `Button`, `Input`, `Badge`, `Avatar`. Aplican nuestra convención de props antes de exponerlo al resto.
- **Molecules**: compuestos simples (`FormField` = `Label` + `Input` + `ErrorMessage`, `StatCard` = `Card` + métrica).
- **Organisms**: vistas completas de un dominio (`ClientList`, `PlanEditor`, `NotificationPanel`).
- **Templates**: layouts con slots (`DashboardLayout`, `AuthLayout`).
- **Pages**: rutas que componen templates + organisms con data de React Query.

### Regla de dependencia

```
pages → templates → organisms → molecules → atoms → ui (shadcn) → theme.css
```

Nunca al revés. Los átomos no saben de páginas.

---

## 6. Configuración inicial de shadcn/ui

```bash
# En apps/frontend
pnpm dlx shadcn@latest init

# Elegir:
# - Style: New York
# - Base color: Zinc (luego se pisa con theme.css)
# - CSS variables: Yes
# - Tailwind config: tailwind.config.ts
# - Import alias: @/
```

### Componentes base a instalar en MVP

```bash
pnpm dlx shadcn@latest add button input label textarea select
pnpm dlx shadcn@latest add card badge avatar separator
pnpm dlx shadcn@latest add dialog sheet dropdown-menu popover tooltip
pnpm dlx shadcn@latest add form table tabs toast alert
pnpm dlx shadcn@latest add skeleton progress
```

Se agregan solo los necesarios. **No instalar todo de golpe.**

---

## 7. Vistas MVP del entrenador

| Vista | Ruta | Organisms principales |
|-------|------|----------------------|
| Login | `/login` | `LoginForm` |
| Dashboard | `/` | `OverviewStats`, `NotificationPanel`, `TodaySessions` |
| Clientes (lista) | `/clients` | `ClientList`, `ClientFilters`, `NewClientDialog` |
| Cliente (detalle) | `/clients/:id` | `ClientProfile`, `ActivePlanView`, `SessionHistory`, `MetricsChart` |
| Plan (editor) | `/clients/:id/plans/:planId` | `PlanEditor`, `WeekTabs`, `DayEditor`, `ExercisePicker` |
| Catálogo de ejercicios | `/exercises` | `ExerciseSearch`, `ExerciseGrid`, `CustomExerciseForm` |
| Notificaciones | `/notifications` | `NotificationList` con filtros por tipo |
| Estado del agente | `/agent` | `SessionQRCard`, `AgentHealthPanel` |
| Perfil / ajustes | `/settings` | `ProfileForm`, `OrganizationSettings`, `ThemeToggle` |

---

## 8. Estado: server vs cliente

- **Server state** (DB, API) → React Query. Invalidación por mutación. Polling cada 30s para notificaciones y agent status.
- **Auth/session** → Zustand + Supabase SDK.
- **UI state local** → `useState` / `useReducer` en el componente.
- **NO usar Redux**. No lo necesitamos.

---

## 9. Convenciones de código

- Componentes: `PascalCase.tsx`. Un componente exportado por archivo (excepciones: subcomponentes privados).
- Hooks: `useXxx.ts` en `hooks/` o `features/*/hooks/`.
- Imports absolutos con `@/`.
- Tests (post-MVP): Vitest + Testing Library en `*.test.tsx` colocalizados.

---

## 10. Responsive + dark mode

- Breakpoints Tailwind por defecto: `sm 640`, `md 768`, `lg 1024`, `xl 1280`.
- Diseño mobile-first. El panel debe ser usable en 375px de ancho.
- Dark mode vía clase `.dark` en `<html>`. Toggle en `/settings`. Persistencia en `localStorage`.

---

## 11. Pendiente

- [ ] Paleta definitiva de Personally (tomar decisión final sobre `--primary`, `--accent`).
- [ ] Tipografía: ¿Inter está bien o se quiere algo más carácter (Geist, Plus Jakarta)?
- [ ] Set de iconos específicos de fitness (considerar `@phosphor-icons/react` complementario a `lucide`).
- [ ] Sistema de `Toast` global y patrón de error handling uniforme.
- [ ] Estrategia de lazy loading de rutas (sugerido: `React.lazy` por página).
- [ ] i18n (post-MVP, español-only en MVP).
