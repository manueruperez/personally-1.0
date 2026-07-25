---
name: In-progress — levantando el proyecto + instalando chrome-devtools MCP
description: Estado transitorio del 2026-04-20 durante el bootup en máquina nueva. Borrar cuando se haya completado la verificación visual.
type: project
originSessionId: 2026-04-20-bootup
---
**Contexto:** Juan está levantando el repo en una máquina donde nunca corrió. Ya se hizo el setup completo (ver `setup_gotchas.md`) y los 3 servicios están corriendo en gnome-terminals separadas.

**Servicios arriba al momento de guardar esto:**
- **API** en http://localhost:3000 — `/health` devuelve `{"status":"ok"}` ✅
- **Frontend** en http://localhost:5173 — HTTP 200 ✅ (pero no verificado visualmente aún — solo curl)
- **Agent WhatsApp** — terminal abierta con `pnpm agent:supervised`. No confirmado si ya reconectó sesión vieja o si pidió QR nuevo.

**Cambio de infraestructura en esta sesión:**
- Instalé **`chrome-devtools` MCP a scope user** (`claude mcp add -s user chrome-devtools -- npx chrome-devtools-mcp@latest`). Queda disponible global en `~/.claude.json`.
- Chrome 147 detectado en `/usr/bin/google-chrome` → el MCP puede usarlo.

**Próximo paso inmediato (al reanudar después del restart de Claude Code):**
1. Usar chrome-devtools MCP para navegar a http://localhost:5173 y confirmar que el panel renderiza sin errores de consola.
2. Confirmar con Juan el estado del agent (si pidió QR, escanear; si ya está "ready", seguir).
3. Si todo OK, borrar este archivo `in_progress_bootup.md` y actualizar `MEMORY.md`.

**Gotcha activo (también en project_personally.md, corregido acá):**
- `TESTING_DOW=2` está en `personally-mvp/.env` (root, NO en `apps/api/.env` como decía la memoria vieja). Sigue forzando martes.

**Why:** Juan pidió explícitamente guardar el estado porque íbamos a reiniciar Claude Code para que la nueva sesión pudiera usar chrome-devtools, y no quería perder contexto.
