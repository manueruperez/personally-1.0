#!/bin/sh
# Entrypoint del agente: limpia locks de Chromium que un crash anterior pudo
# dejar en el volumen de LocalAuth (mismo rol que killStaleChromium() del
# supervisor.ts en dev) y arranca el agente compilado.
set -eu

find .wwebjs_auth -maxdepth 3 -name 'Singleton*' -exec rm -f {} + 2>/dev/null || true

exec node dist/index.js
