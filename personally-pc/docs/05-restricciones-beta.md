# 05 — Restricciones del MVP (Beta)

El proyecto está en **fase beta con alcance limitado**, no producción escalada. Estas restricciones son explícitas y deben comunicarse a los entrenadores piloto.

---

## Alcance del beta

- Entrenadores simultáneos: **por definir** (sugerido 3–5).
- Canal único inicial: **WhatsApp vía `whatsapp-web.js`** (no oficial).
- Sin pasarela de pagos automática (cobro manual durante beta).
- Sin SLA formal, uso bajo responsabilidad compartida.

---

## Riesgos conocidos y asumidos

### Riesgo de baneo del número
WhatsApp-web.js va contra los ToS de WhatsApp.
**Mitigación:**
- Volúmenes bajos.
- Sin envíos masivos simultáneos.
- Mensajes personalizados.
- Espaciado aleatorio entre mensajes.

### Inestabilidad del ciclo de vida de sesión
- Observación: la sesión, una vez activa, se mantiene estable. El problema **no es operación sino el ciclo de vida** (conectar, reconectar, detectar caídas).
- **Mitigación:**
  - Heartbeat del Agent hacia la API.
  - Estados de sesión claros.
  - Alertas proactivas al entrenador antes de que note la caída.

### Mercado pequeño e interconectado (Popayán)
- Un entrenador con número baneado = reputación local destruida.
- **`whatsapp-web.js` en este contexto es riesgo reputacional alto**, no deuda técnica aceptable.
- **Competencia gratuita**: WhatsApp Business ya cubre ~60% de la funcionalidad sin costo.

---

## Compromiso con entrenadores piloto

- Transparencia total: es una versión de prueba, no producción.
- Soporte directo y rápido ante cualquier incidencia.
- Posible cambio de canal o arquitectura sin costo adicional para ellos.
- No usar el número personal principal del entrenador si tiene un número alternativo.

---

## Plan de migración post-beta

Al alcanzar **X entrenadores pagos activos** (criterio a definir, sugerido: 10), migrar a:
- **WhatsApp Cloud API oficial** de Meta.
- Requiere: verificación de negocio, número dedicado, templates pre-aprobados.
- Implica ajuste de pricing para absorber costo por conversación (~USD 0.01–0.03).
- Elimina baneo y problemas de sesión en un solo cambio.

## Canal secundario (Plan B): Telegram

Documentado como alternativa activable si:
- Aumentan los problemas de estabilidad con WhatsApp en beta.
- Un entrenador piloto lo prefiere.
- Se necesita canal de respaldo durante incidentes.

**Ventajas técnicas:** Bot API oficial y gratuita, sin QR, sin Puppeteer, webhooks estables, sin riesgo de baneo.
**Desventaja:** menor penetración en el segmento objetivo.
