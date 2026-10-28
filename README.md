# Quiz & Leaderboard — Comunicaciones y Redes II (FCEQyN - UNaM)

Aplicación web de cuestionario interactivo y **Leaderboard** en tiempo real para preparar el **1er Parcial de Práctica de Comunicaciones y Redes II**, siguiendo la misma arquitectura de [`taller-jcsa-2026`](https://github.com/Taikaros/taller-jcsa-2026):

```
Navegador ── React + TanStack + Clerk ──► Cloudflare Workers (quiz-redes2-frontend)
    │
    └─► API FastAPI (Python) ──────────► Cloudflare Workers (quiz-redes2-api)
              ├─► Neon (Postgres serverless)
              └─► Clerk (verifica el login JWT)
```

---

## Despliegue 100% en la nube desde GitHub (Cloudflare Workers Builds)

No necesitás dejar tu PC encendida ni construir desde tu equipo: Cloudflare construye y despliega tanto el **Frontend** como la **API Backend** automáticamente desde este repositorio de GitHub.

### Paso 1 · Base de datos en Neon (PostgreSQL)
1. En [Neon](https://neon.tech), creá un proyecto, abrí el **SQL Editor** y ejecutá el contenido de [`backend/schema.sql`](./backend/schema.sql) (crea las tablas `quiz_users` y `quiz_responses`).
2. Copiá tu `NEON_CONNECTION_STRING` (`postgresql://...`).

### Paso 2 · Login en Clerk
1. En [Clerk](https://clerk.com), copiá tu **Publishable Key** (`pk_test_...`) y tu **Frontend API URL** (`https://xxxx.clerk.accounts.dev`).
2. En [`backend/wrangler.jsonc`](./backend/wrangler.jsonc) verificá que `CLERK_ISSUER` y `CLERK_JWKS_URL` tengan tu Frontend API URL (ya está preconfigurado `https://suitable-halibut-4341.clerk.accounts.dev`).

### Paso 3 · Desplegar el Backend (`quiz-redes2-api`) en Cloudflare
Podés conectarlo directo a tu repo en Cloudflare (*Workers & Pages → Create → Import a repository → `Taikaros/quiz-redes2`*):
- **Project name:** `quiz-redes2-api`
- **Root directory (Path):** `backend`
- **Build command:** *(dejar vacío)*
- **Deploy command:** `uv run pywrangler deploy`
- En **Settings → Variables and Secrets** del Worker `quiz-redes2-api`, agregá el secreto **`NEON_CONNECTION_STRING`**.

### Paso 4 · Desplegar el Frontend (`quiz-redes2-frontend`) en Cloudflare
En Cloudflare (*Workers & Pages → Create → Import a repository → `Taikaros/quiz-redes2`*):
- **Project name:** `quiz-redes2-frontend`
- **Root directory (Path):** `frontend`
- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`
- **Non-production branch deploy command:** `npx wrangler versions upload`
- En **Settings → Build → Variables and secrets**, agregá las dos variables:
  - `VITE_CLERK_PUBLISHABLE_KEY` = `pk_test_...`
  - `VITE_API_URL` = `https://quiz-redes2-api.<tu-subdominio>.workers.dev` *(sin `/` al final)*

---

## Desarrollo local (opcional, sin cuentas)

Igual que en `taller-jcsa-2026`, con `MODO_LOCAL=1` en `backend/.dev.vars` todo se simula en memoria si no configurás Neon o Clerk:

```bash
# Terminal 1: API en http://localhost:8787
cd backend
cp .dev.vars.example .dev.vars
uv sync
uv run pywrangler dev
```

```bash
# Terminal 2: Front en http://localhost:5173
cd frontend
cp .env.example .env
npm install
npm run dev
```
