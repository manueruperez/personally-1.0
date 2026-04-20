# 06 — Modelo de negocio

## Tipo
SaaS mensual escalado por uso (clientes activos + mensajes/mes).

## Planes (ref. original)

| Plan | Precio (COP) | Clientes | Mensajes/mes |
|------|--------------|----------|--------------|
| Básico | $30.000 | 10 | 500 |
| Gimnasio | $200.000+ | 100+ | 8.000 |

- Costos operativos estimados: **$100.000 – $300.000 COP/mes**.
- Punto de equilibrio: **~6 entrenadores pagos**.
- Margen estimado: ~85% desde 10 entrenadores pagos.
- Pasarelas previstas: MercadoPago, Wompi o Stripe.

> ⚠️ **Pricing actual asume infra con `whatsapp-web.js`.** Al migrar a WhatsApp Cloud API habrá costo marginal por conversación (~USD 0.01–0.03) que deberá reflejarse en los planes.

---

## Análisis de viabilidad (sin filtros)

### Conclusión
La idea es **construible técnicamente** y el problema del entrenador existe. Como negocio solo en Popayán **no alcanza**; funciona como mercado de prueba con expansión a Cali y Eje Cafetero.

### Números del mercado local (Popayán)
- ~320.000 habitantes.
- Entrenadores independientes estimados: ~150.
- Conversión realista a SaaS pago (10%): ~15 clientes techo.
- Ingreso mensual techo: **~$750.000 COP/mes**.

Es ingreso extra modesto, no empresa viable solo con Popayán. **Popayán es test, no mercado final.**

### Señal de alarma
9 meses con stack claro y documentación completa sin un solo piloto pagando. El cuello de botella nunca fue técnico — fue la parte comercial.

---

## Apuesta estratégica: B2B al entrenador (gimnasios post-piloto)

### Probabilidades estimadas

| Escenario | Probabilidad de validar |
|-----------|------------------------|
| B2B entrenador | *la apuesta elegida* |
| B2C cliente final paga | ≈15% |
| Cero compromisos | ≈25% |

### Plan Gimnasio (no antes de Semana 7-8)

Cuando el piloto con 3 entrenadores independientes del mismo gimnasio valide el producto, se abre venta institucional al dueño del gimnasio:

- Precio propuesto: **$500k-$800k COP/mes** (15-25 entrenadores).
- Features: dashboard admin, branding del gimnasio, reportes agregados.
- Condición de venta: **mínimo 3 entrenadores internos** ya usándolo como referencia.

**El gimnasio es la recompensa del piloto bien ejecutado, no el objetivo inicial.**
