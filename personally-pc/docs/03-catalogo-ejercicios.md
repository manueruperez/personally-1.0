# 03 — Catálogo de ejercicios

## Fuente elegida: `free-exercise-db`

- GitHub: `yuhonas/free-exercise-db`
- **Dominio público** (uso comercial sin restricciones).
- +800 ejercicios con estructura JSON: nombre, nivel, mecánica, equipamiento, músculos primarios/secundarios, instrucciones paso a paso, imágenes.
- Imágenes hospedadas en el propio repo.
- No requiere API ni auth. Se clona y se carga a Supabase.

## Por qué esta fuente

- Se vuelve **nuestra desde el día uno** (sin dependencia de API externa).
- Cero costos operativos, cero rate limits, cero mantenimiento.
- Licencia limpia para SaaS comercial.

---

## Flujo de integración (piloto)

1. Clonar repo y cargar el JSON a la tabla `exercises` en Supabase.
2. Script de traducción al español:
   - OpenAI / Google Translate para la masa.
   - Revisión manual de los ~50 más comunes.
3. Permitir al entrenador marcar favoritos y agregar ejercicios custom.
4. Post-piloto: complementar con ExerciseDB para GIFs animados si se justifica.

---

## Schema propuesto

```sql
exercises
  id                uuid PK
  source            enum (free-exercise-db | custom | exercisedb)
  source_ref        text            -- id externo si aplica
  name_es           text
  name_en           text
  muscle_primary    text[]
  muscle_secondary  text[]
  equipment         text[]
  instructions      text
  image_url         text
  video_url         text            -- nullable
  created_by        uuid            -- nullable, si es custom de un trainer
  organization_id   uuid            -- nullable, si es privado a una org
```
