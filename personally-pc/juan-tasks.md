# Juan — tareas en paralelo

Lo que tenés que hacer vos mientras Claude genera el esqueleto del monorepo. Ordenado por urgencia.

---

## 🔴 Bloqueantes (sin esto no avanzamos)

### 1. Crear proyecto en Supabase
- Ir a [supabase.com](https://supabase.com) → New project.
- **Free tier** está bien para el piloto.
- Región: `us-east-1` o la más cercana a Colombia.
- Guardar las credenciales del panel **Settings → API**:
  - [ ] `SUPABASE_URL` (Project URL)
  - [ ] `SUPABASE_ANON_KEY` (anon public)
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` (service_role · **secret**)
  - [ ] `SUPABASE_JWT_SECRET` (Settings → API → JWT Settings)
- Pegarlos en este archivo o en un `.env` local para compartir.

### 2. Repo git
- [ ] Decidir: GitHub / GitLab / local por ahora.
- [ ] Si remoto: crear repo vacío (`personally` o el nombre que prefieras) y pasarme la URL.

### 3. Confirmar reutilización de datos del demo
- [ ] ¿Copio `project-demo/DB/rutina.csv` a `personally-pc/samples/rutina-demo-12-semanas.csv`? (default: sí)
- [ ] ¿Alguna config específica del demo que sepas que funciona y quieras que porte tal cual? (args de Puppeteer, tokens, etc.)

---

## 🟡 Necesarias pero pueden esperar 1-2 días

### 4. Número de WhatsApp dedicado para el agente
- [ ] Conseguir un chip nuevo o un número alternativo (**NO usar el personal del entrenador**).
- [ ] Registrar el número en WhatsApp normal (no Business).
- [ ] Tenerlo activo en un teléfono que se pueda dejar conectado para escanear el QR inicial.

### 5. VPS (o decisión de local primero)
- [ ] Decidir: DigitalOcean / Hetzner / probar local en tu máquina.
- [ ] Si VPS: crear droplet/server Ubuntu 22.04 mínimo (2 GB RAM).
- [ ] Guardar IP + acceso SSH.

### 6. OpenAI API key (opcional)
- [ ] Solo si querés traducir el catálogo de ejercicios automáticamente.
- [ ] Alternativa: Google Translate manual / mantener en inglés en MVP.

---

## 🟢 Decisiones de producto (antes del piloto, no del código)

### 7. Conversación con el amigo-piloto
- [ ] Agendar llamada / café.
- [ ] Pactar explícitamente: **honestidad brutal + fecha fin de 4 semanas + cobro simbólico $10k**.
- [ ] Preguntar: ¿a sus clientes les cierra el patrón "responder *siguiente* después de cada ejercicio" o es mucha fricción?
- [ ] Definir métricas de éxito por escrito antes de arrancar.

### 8. Entrevistas paralelas
- [ ] Agendar 3 entrevistas de 15 min con entrenadores del gimnasio.
- [ ] Seguir el guión de Validación Comercial.

### 9. Definiciones menores (se pueden decidir mientras desarrollo)
- [ ] Umbral "N días sin respuesta" para notificar al trainer (sugerido: **3**).
- [ ] Paleta de colores final (placeholder verde #10b981 hasta que decidas).
- [ ] Tipografía (default: Inter).
- [ ] Estructura final del Google Sheet del piloto (te propongo una y la iteramos).

---

## 📝 Dónde dejar las credenciales

### Archivo `.env` del monorepo (único source of truth)

Ruta exacta:
```
/Users/juanm/Documents/PERSONAL-PROJECTS/PERSONALLAY/Personallay1.0/personally-mvp/.env
```

Este archivo **está en `.gitignore`** (no se commitea). Existe una plantilla versionada en `personally-mvp/.env.example` que podés copiar:

```bash
cp personally-mvp/.env.example personally-mvp/.env
```

Después editás `personally-mvp/.env` y pegás los valores:

```env
# ─── Supabase (bloqueante) ─────────────────────────────
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
DATABASE_URL=                    # postgresql://... (de Supabase → Settings → Database)
DIRECT_URL=                      # igual a DATABASE_URL pero puerto 5432 (para migrations)

# ─── Repo ──────────────────────────────────────────────
GIT_REMOTE=                      # url del repo si es remoto

# ─── VPS (cuando esté) ─────────────────────────────────
VPS_IP=
VPS_USER=

# ─── Agent ─────────────────────────────────────────────
WHATSAPP_NUMBER=                 # número dedicado del bot
AGENT_TOKEN=                     # cualquier string largo aleatorio, lo genero yo si preferís

# ─── OpenAI (opcional) ─────────────────────────────────
OPENAI_API_KEY=
```

### Importante
- **No** pegues credenciales en este archivo (`juan-tasks.md` va al repo).
- **No** commitees `.env`. Verificá con `git status` antes de cada commit.
- Si el repo es público, regenerá las keys de Supabase si sospechás leak.

---

## ⏳ Estado

---

## ⏳ Estado

- [ ] Tareas 🔴 completas → avisame para arrancar desarrollo real.
- [ ] Tareas 🟡 completas → podemos probar agente en VPS.
- [ ] Tareas 🟢 completas → podemos arrancar piloto real.
