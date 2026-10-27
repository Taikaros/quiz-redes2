# Quiz & Leaderboard — Comunicaciones y Redes II (FCEQyN - UNaM)

Aplicación web colaborativa de cuestionario y tabla de posiciones (**Leaderboard**) para preparar el **1er Parcial de Práctica de Comunicaciones y Redes II**, construida siguiendo la arquitectura de [`taller-jcsa-2026`](https://github.com/Taikaros/taller-jcsa-2026).

## Qué incluye

1. **Banco completo de 36 preguntas oficiales** de los **TP 01 al TP 06** y **Laboratorios 01 al 04**:
   - **TP 01 / Lab 01:** Dispositivos por Capa OSI, dominios de colisión/broadcast, tiempo de transferencia, capacidad de Backplane (*Wire-Speed Full-Duplex*) y sobresuscripción de Uplink (20:1).
   - **Lab 02:** Cableado Estructurado ANSI/TIA/EIA-568, límite de 100 m (90 m fijo + 10 m patch cords) y normas T568A / T568B.
   - **TP 03 / Lab 03:** Trama IEEE 802.3, etiqueta VLAN IEEE 802.1Q (4 bytes), STP (802.1D) vs. RSTP (802.1w), elección de Root Bridge, costos de ruta, PoE (802.3af/at/bt) y comandos Cisco IOS.
   - **TP 04 / Lab 04:** Fibra Monomodo (SMF 9/125 µm) vs. Multimodo (MMF 50 o 62,5/125 µm), GPON ITU-T G.984 (WDM 1490/1310 nm, Broadcast + TDMA/Ranging, DBA y T-CONTs), curvaturas, fusión, OTDR (EDZ/ADZ) y ORL.
   - **TP 05:** Regulación de 6 GHz en Argentina (Res. ENACOM 756/2023), canales 1-6-11 en 2,4 GHz (ACI vs. CCI), DFS en 5 GHz y VoWiFi, cálculo de APs por alta densidad (CWNP), presupuesto PoE++, analizador de espectro vs. analizador Wi-Fi y arquitecturas Meraki vs. Catalyst vs. UniFi.
   - **TP 06:** Servicio IPv4 (*Connectionless / Best-Effort*), encapsulamiento jerárquico VoIP/RTP/UDP, campos de cabecera IPv4 (`IHL`, `ToS/DSCP`, `Total Length`, `Flags`, `Fragment Offset`, `TTL`, `Protocol`, `Header Checksum`), proceso de ruteo (*Longest Prefix Match*), `ICMP Time Exceeded` y filtros/fragmentación en **Wireshark**.
2. **Login de participantes (`/api/auth/register` y `/api/auth/login` + soporte opcional para Clerk)**:
   - Cada compañero crea su usuario (Nombre/Alias, Usuario y Contraseña) en segundos sin depender de cuentas externas, o bien podés activar **Clerk** configurando `VITE_CLERK_PUBLISHABLE_KEY`.
3. **Estadísticas por opción en tiempo real (`%`)**:
   - Al responder cada pregunta, cada opción (`A, B, C, D`) muestra una barra horizontal con el **porcentaje exacto (`%`) y cantidad de personas que seleccionaron esa opción**, además del porcentaje global de acierto de la clase en esa pregunta y la fundamentación técnica de la cátedra.
4. **Leaderboard en vivo (`/leaderboard`)**:
   - Podio Top 3 + tabla general con puntaje (`10 pts` por respuesta correcta), cantidad de aciertos, porcentaje de precisión y estado de aprobación (`≥ 60%`).

---

## Opción 1: Levantar en tu Red Local (Wi-Fi / LAN) para tus compañeros

Los servidores escuchan en `0.0.0.0`, por lo que cualquier compañero conectado a la misma red puede entrar desde su celular o notebook:

```bash
# Terminal 1: Backend API (puerto 8787)
cd backend
cp .dev.vars.example .dev.vars
uv run pywrangler dev --ip 0.0.0.0 --port 8787
```

```bash
# Terminal 2: Frontend React (puerto 5173)
cd frontend
npm run dev
```

- **En tu máquina:** `http://localhost:5173`
- **Para tus compañeros en la misma red:** `http://192.168.0.192:5173` *(el frontend detecta automáticamente la IP de la red y se conecta al backend en el puerto `8787`)*.

---

## Opción 2: Desplegar en Internet gratis (Cloudflare Workers + Neon Postgres)

Sigue exactamente los mismos pasos del taller `taller-jcsa-2026`:

### 1. Base de datos en Neon (PostgreSQL serverless)
1. El proyecto está vinculado a Neon mediante `neon.ts`; ejecutá `npx neon deploy` desde la raíz para provisionar PostgreSQL y actualizar `.env.local`.
2. Aplicá el esquema desde la raíz con `npx neon psql production -- -f backend/schema.sql` (crea `quiz_users` y `quiz_responses` usando la conexión directa).
3. La aplicación usa la URL agrupada `DATABASE_URL` en el backend. Conservá `.env.local` como archivo privado; no uses `DATABASE_URL_UNPOOLED` para las consultas de la app.

### 2. Desplegar el Backend (`quiz-redes2-api`)
```bash
cd backend
uv run pywrangler secret put DATABASE_URL
uv run pywrangler deploy
```
Tu API quedará publicada en `https://quiz-redes2-api.<tu-subdominio>.workers.dev`.
Para desarrollo local, copiá `DATABASE_URL` de `.env.local` a `backend/.dev.vars`.

### 3. Desplegar el Frontend (`quiz-redes2-frontend`)
En Cloudflare (*Workers & Pages → Create → Import a repository*) o directamente por CLI:
```bash
cd frontend
VITE_API_URL=https://quiz-redes2-api.<tu-subdominio>.workers.dev npm run build
npx wrangler deploy
```
