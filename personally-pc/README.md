# Personally 1.0 — Workspace del piloto

Carpeta de trabajo operativa del proyecto **Personally**. Aquí vive la documentación viva (markdown) que guía la construcción de la primera iteración real.

> Fuente original en Notion:
> - [🧪 Personally 1.0](https://www.notion.so/346469095c1181d8971fd37e8c02eb15)
> - [📚 Documentación del Proyecto](https://www.notion.so/346469095c1181ddb6f1dd2d04b2eb00)

---

## Qué es Personally (pitch corto)

> Un asistente de ejecución de planes de entrenamiento que convierte la rutina del entrenador en una guía diaria interactiva por WhatsApp, manteniendo al entrenador como el dueño de todas las decisiones.

- **Entrenador** = cerebro. Diseña el plan trimestral, intensidades, progresión.
- **Agente** = guía. Ejecuta lo que el entrenador diseñó, día a día.
- **Cliente final** siente que tiene entrenador todos los días, sin costo 1-a-1.

No promete IA inteligente. No reemplaza al entrenador. No inventa rutinas. Ejecuta con consistencia. Esa es la promesa.

---

## Índice de documentación

| Doc | Contenido |
|-----|-----------|
| [docs/01-producto.md](docs/01-producto.md) | Modelo del producto: plan trimestral, flujo diario, comandos, casos límite |
| [docs/02-arquitectura.md](docs/02-arquitectura.md) | Capas desacopladas, decisiones estructurales, estructura del monorepo |
| [docs/03-catalogo-ejercicios.md](docs/03-catalogo-ejercicios.md) | Fuente `free-exercise-db`, schema, flujo de integración |
| [docs/04-piloto.md](docs/04-piloto.md) | Fases del piloto, reglas, métricas de éxito |
| [docs/05-restricciones-beta.md](docs/05-restricciones-beta.md) | Alcance beta, riesgos asumidos, plan de migración |
| [docs/06-modelo-negocio.md](docs/06-modelo-negocio.md) | Planes, costos, apuesta estratégica B2B |
| [docs/07-stack.md](docs/07-stack.md) | Stack técnico, hosting, decisiones confirmadas |
| [TAREAS.md](TAREAS.md) | **Lista accionable**: qué hay que hacer y en qué orden |
| [specs/](specs/README.md) | **Especificaciones técnicas** por área (db, backend, frontend, bots) |
| [aprendizajes/](aprendizajes/README.md) | **Auditoría del demo previo** y plan de migración |
| [AVANCE.md](AVANCE.md) | **📸 Estado actual del MVP**: qué funciona end-to-end, pendientes y gotchas |
| [PRUEBAS-E2E.md](PRUEBAS-E2E.md) | **🧪 Checklist de pruebas E2E** del dispatcher (8 casos guiados) |

---

## Por dónde empezar

1. Leer [docs/01-producto.md](docs/01-producto.md) para entender **qué construimos**.
2. Leer [docs/04-piloto.md](docs/04-piloto.md) para entender **para quién y con qué reglas**.
3. Ir a [TAREAS.md](TAREAS.md) para ver **qué sigue**.
