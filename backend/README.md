# Taller API: lista de tareas con login

FastAPI en Cloudflare Python Workers + Neon (Postgres) + Clerk (login) + Resend (mail).

## Rutas

| Método | Ruta | Auth | Qué hace |
|---|---|---|---|
| GET | `/health` | no | Chequeo de vida (lo usa el check de Grafana) |
| GET | `/api/me` | sí | Devuelve el id del usuario del token |
| GET | `/api/tasks` | sí | Lista las tareas del usuario |
| POST | `/api/tasks` | sí | Crea una tarea `{"title": "..."}` |
| PATCH | `/api/tasks/{id}` | sí | Marca/desmarca como hecha |
| DELETE | `/api/tasks/{id}` | sí | Borra la tarea |
| POST | `/api/welcome` | sí | Envía mail de bienvenida `{"email": "..."}` |

## Desarrollo local (sin cuentas)

Requiere **uv ≥ 0.12.3** (`uv self update`) y Node.js (pywrangler usa `npx wrangler`).

```bash
cp .dev.vars.example .dev.vars   # trae MODO_LOCAL=1 y todo vacío
uv sync
uv run pywrangler dev            # http://localhost:8787
```

Con `MODO_LOCAL=1`, cada servicio cuya variable esté vacía se simula:

| Variable vacía | Qué pasa |
|---|---|
| `DATABASE_URL` | Tareas en memoria (se pierden al reiniciar) |
| `CLERK_JWKS_URL` | Acepta cualquier token; usuario `usuario-local` |
| `RESEND_API_KEY` | El mail se imprime en la consola |

Probar:
```bash
curl http://localhost:8787/health
curl -H "Authorization: Bearer demo" http://localhost:8787/api/tasks
```
El front con solo `VITE_API_URL=http://localhost:8787` (sin clave de Clerk) ya usa esta API.

`MODO_LOCAL` vive solo en `.dev.vars`: en el Worker desplegado no existe, así que nunca se simula nada.

## Conectar los servicios reales (de a uno, en `.dev.vars`)

1. **Neon:** configurar `DATABASE_URL` en `.dev.vars` para desarrollo local o como secreto del Worker para producción. La app conserva compatibilidad con el nombre anterior `NEON_CONNECTION_STRING`.
2. **Clerk:** crear una app y copiar la *Frontend API URL*. Completar `CLERK_ISSUER` y `CLERK_JWKS_URL`
   en `.dev.vars` y también en `wrangler.jsonc` (para el deploy). En el front, cargar `VITE_CLERK_PUBLISHABLE_KEY`.
   Para obtener un token de prueba, desde el front logueado, en la consola del navegador:
   `await window.Clerk.session.getToken()`
3. **Resend:** crear una API key y pegarla en `RESEND_API_KEY`.

## Deploy

```bash
uv run pywrangler secret put DATABASE_URL
uv run pywrangler secret put RESEND_API_KEY
uv run pywrangler deploy
```

- La primera vez, `secret put` pregunta si crear el Worker `taller-api`: responder que sí.
- El `name` de `wrangler.jsonc` tiene que ser distinto del Worker del front, o el deploy lo pisa.
- Si falta un secreto, la API responde `500` con el mensaje `Falta el secreto …`.
- Logs en vivo del Worker desplegado: `npx wrangler tail taller-api`. Cada pedido deja una línea JSON con método, ruta, status y duración.
