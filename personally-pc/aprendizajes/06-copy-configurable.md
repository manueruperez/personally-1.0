# Copy configurable: qué se puede y qué no con la Cloud API

*2026-08-10. Decisión: postergar hasta después del piloto.*

## La pregunta

¿El copy del saludo diario debería ser editable por el trainer, con uno por
defecto y la opción de cambiarlo por cliente?

## La restricción que manda

Con la Cloud API, **el saludo diario es el único mensaje que sale fuera de la
ventana de 24h** — a las 5 AM el cliente todavía no escribió nada. Y fuera de
la ventana Meta solo acepta **plantillas pre-aprobadas**: texto arbitrario se
rechaza.

Consecuencia: el cuerpo fijo de `greeting` está congelado hasta mandar una
revisión nueva (24-48h). Exponerlo como campo editable en el panel sería
mentirle al trainer — escribiría un texto que el bot no puede mandar.

Lo único libre en una plantilla son sus variables (`{{1}}`, `{{2}}`, `{{3}}`),
que hoy se llenan solas desde el plan.

## Lo que sí es configurable

**Todo el resto del bot.** Tarjeta de ejercicio, cierre, confirmaciones,
"no te entendí": van dentro de la ventana, como texto libre, sin aprobación de
Meta. Ahí el copy puede ser 100% editable cuando se quiera construir.

## La jugada que queda pendiente: saludo híbrido

La ventana de 24h **se reinicia con cada mensaje del cliente**. Si el cliente
entrenó ayer y respondió, cuando el bot le escriba hoy a las 5 AM la ventana
sigue abierta → el saludo puede salir como **texto libre, personalizable y
gratis**.

La plantilla quedaría solo como fallback para cuando el cliente se saltea un día.
Para alguien que entrena a diario, el trainer controlaría el copy la mayoría de
los días y además baja el costo.

Se decide mirando el timestamp del último mensaje entrante del cliente.

## Por qué se posterga

- El piloto son 3 clientes y **no empezó**. Construir antes de saber si el
  trainer realmente quiere editar el copy es adivinar.
- Bloquear la migración por esto retrasa el piloto, y la revisión de la
  plantilla en Meta (24-48h) corre en paralelo sin costo.
- Si se hace, **por trainer, no por cliente**: el trainer va a escribir un copy
  y usarlo para todos. Por cliente se agrega después si el piloto lo pide; el
  schema no se opone (`ClientPreference` ya existe).

## Qué mirar después del piloto

Si el trainer pidió cambiar el copy más de una vez, o si pidió tonos distintos
por cliente, entonces vale construirlo. Empezar por el híbrido: da más control
que un campo editable y encima ahorra plata.
