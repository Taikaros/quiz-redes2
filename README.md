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
1. El proyecto está vinculado a Neon. Desde la raíz, ejecutá `npx neon deploy` y `npx neon psql production -- -f backend/schema.sql`.
2. La API usa `DATABASE_URL`; mantené el archivo generado `.env.local` privado.

### Paso 2 · Login en Clerk
1. La app ya está vinculada a la aplicación Clerk seleccionada. Desde `frontend/`, `npx -y clerk@latest env pull` restaura las claves de desarrollo en `.env.local`.
2. El backend verifica los tokens con `CLERK_ISSUER` y `CLERK_JWKS_URL` de la instancia de desarrollo seleccionada, configurados en [`backend/wrangler.jsonc`](./backend/wrangler.jsonc).
3. Las cuentas anteriores pueden iniciar sesión con Clerk y visitar `/migrate` para vincular su usuario y conservar el historial. La contraseña anterior solo verifica titularidad y se elimina del registro al completar la vinculación.
4. No uses las claves de desarrollo en un despliegue de producción. Configurá las claves e issuer de producción solo después de preparar la instancia de producción en Clerk.

### Paso 3 · Desplegar el Backend (`quiz-redes2-api`) en Cloudflare
Podés conectarlo directo a tu repo en Cloudflare (*Workers & Pages → Create → Import a repository → `Taikaros/quiz-redes2`*):
- **Project name:** `quiz-redes2-api`
- **Root directory (Path):** `backend`
- **Build command:** *(dejar vacío)*
- **Deploy command:** `uv run pywrangler deploy`
- En **Settings → Variables and Secrets** del Worker `quiz-redes2-api`, agregá el secreto **`DATABASE_URL`** y las variables de instancia de Clerk de producción.

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
