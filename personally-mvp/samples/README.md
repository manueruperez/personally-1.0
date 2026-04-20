# Samples

Datos de ejemplo reutilizables para desarrollo y tests.

## `rutina-demo-12-semanas.csv`

Plan real de 12 semanas copiado del demo previo (`project-demo/DB/rutina.csv`).
Util para:
- Validar el schema de `plan_items` contra datos reales.
- Seed inicial durante desarrollo.
- Plantilla de referencia del formato que puede llenar el entrenador piloto.

**Columnas esperadas** (mismas del CSV original): week, day, session, exercise, prescription, rpe_target, cues.

Para importarlo a la DB se necesita escribir `scripts/import-plan-csv.ts` que mapea
cada fila a un `plan_item`. Pendiente.
