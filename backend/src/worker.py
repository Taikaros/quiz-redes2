"""API de Cuestionario y Leaderboard — Comunicaciones y Redes II (FCEQyN - UNaM).

Basado en la arquitectura de taller-jcsa-2026:
- FastAPI sobre Cloudflare Python Workers (`WorkerEntrypoint` + `asgi`)
- Base de datos serverless Neon (PostgreSQL vía HTTP `/sql`) o simulación en memoria (`MODO_LOCAL=1`)
- Autenticación dual: soporta Login propio de participantes (usuario + contraseña con JWT HS256)
  y también tokens RS256 de Clerk si se configura `CLERK_JWKS_URL`.
"""
import hashlib
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import httpx
import jwt
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

try:
    from workers import WorkerEntrypoint

    class Default(WorkerEntrypoint):
        async def fetch(self, request):
            import asgi

            return await asgi.fetch(app, request.js_object, self.env)
except ImportError:
    pass


class _LocalEnv:
    """Fallback de variables de entorno cuando se corre con uvicorn o npx wrangler."""

    def __init__(self):
        self.MODO_LOCAL = "1"
        self.DATABASE_URL = ""
        self.NEON_CONNECTION_STRING = ""
        self.CLERK_ISSUER = ""
        self.CLERK_JWKS_URL = ""
        self.JWT_SECRET = "quiz-redes2-fceqyn-secret-2026-key-32bytes!"
        dev_vars = Path(__file__).resolve().parent.parent / ".dev.vars"
        if dev_vars.exists():
            for line in dev_vars.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                setattr(self, k.strip(), v.strip())
        for k in ("MODO_LOCAL", "DATABASE_URL", "NEON_CONNECTION_STRING", "CLERK_ISSUER", "CLERK_JWKS_URL", "JWT_SECRET"):
            if k in os.environ:
                setattr(self, k, os.environ[k])


_local_env = _LocalEnv()


def get_env(request: Request):
    return request.scope.get("env") or _local_env


app = FastAPI(title="Quiz Comunicaciones y Redes II API")


@app.middleware("http")
async def registrar_pedido(request: Request, call_next):
    inicio = time.monotonic()
    try:
        response = await call_next(request)
    except Exception as e:
        print(f"Error no manejado en {request.url.path}: {e!r}")
        response = JSONResponse({"detail": f"Error interno: {type(e).__name__}: {e}"}, status_code=500)
    ruta = getattr(request.scope.get("route"), "path", request.url.path)
    print(json.dumps({
        "evento": "pedido",
        "metodo": request.method,
        "ruta": ruta,
        "status": response.status_code,
        "ms": round((time.monotonic() - inicio) * 1000),
    }))
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------- Banco de Preguntas Oficial (TP 01 al TP 06 + Labs 01 al 04)
QUESTIONS: list[dict] = [
    # TP 01 y Lab 01
    {
        "id": "tp1-1",
        "unit": "TP 01 / Lab 01: Dispositivos y Dimensionamiento",
        "question": "Un switch Capa 2 de 24 puertos tiene todos sus puertos asignados a la VLAN por defecto (VLAN 1) y conectados a distintas PCs. ¿Cuántos dominios de colisión y cuántos dominios de broadcast existen en ese switch?",
        "options": [
            "1 dominio de colisión y 24 dominios de broadcast.",
            "24 dominios de colisión independientes y 1 único dominio de broadcast.",
            "1 único dominio de colisión y 1 único dominio de broadcast.",
            "24 dominios de colisión y 24 dominios de broadcast.",
        ],
        "correct": 1,
        "explanation": "Un Switch L2 microsegmenta la red creando 1 dominio de colisión independiente por cada puerto. Sin embargo, las tramas Broadcast (FF:FF:FF:FF:FF:FF) se inundan por todos los puertos de la misma VLAN, formando 1 único dominio de broadcast.",
    },
    {
        "id": "tp1-2",
        "unit": "TP 01 / Lab 01: Dispositivos y Dimensionamiento",
        "question": "¿Qué acción toma un Switch Capa 2 cuando recibe una trama cuya dirección MAC de destino NO se encuentra aún en su tabla CAM (MAC Address Table)?",
        "options": [
            "Descarta la trama inmediatamente y envía un mensaje ICMP al origen.",
            "Consulta al router puerta de enlace predeterminada mediante ARP.",
            "Aprende la MAC de origen asociándola al puerto de entrada e inunda (flooding) la trama por todos los demás puertos activos de esa VLAN.",
            "Reenvía la trama únicamente por el puerto troncal (Uplink).",
        ],
        "correct": 2,
        "explanation": "El switch construye su tabla CAM inspeccionando siempre la MAC Origen de cada trama entrante. Si la MAC Destino es desconocida (Unicast desconocido) o Broadcast, aplica inundación (flooding) por todos los puertos de esa misma VLAN excepto por el de ingreso.",
    },
    {
        "id": "tp1-3",
        "unit": "TP 01 / Lab 01: Dispositivos y Dimensionamiento",
        "question": "Se desea transferir un archivo de 150 MB entre dos estaciones a través de un enlace FastEthernet (100 Mbps). ¿Cuál es el tiempo teórico mínimo de transferencia y por qué el tiempo real será mayor?",
        "options": [
            "1,5 segundos; en la práctica tarda más solo si el cable UTP supera los 50 metros.",
            "12 segundos teóricos (150 MB × 8 = 1200 Mbits / 100 Mbps); en la práctica es mayor por el overhead de cabeceras (Ethernet/IP/TCP), Interframe Gap, ACKs y contienda.",
            "15 segundos teóricos; porque FastEthernet reserva 20% del canal para tramas BPDU.",
            "120 segundos teóricos; porque cada Byte lleva 8 bits de paridad en Ethernet.",
        ],
        "correct": 1,
        "explanation": "Cálculo del TP 01: 150 MB × 8 bits/Byte = 1200 Mbits. Dividiendo por el ancho de banda nominal: 1200 Mbps / 100 Mbps = 12 segundos teóricos. En la práctica es mayor por cabeceras L2/L3/L4, IFG y confirmaciones.",
    },
    {
        "id": "tp1-4",
        "unit": "TP 01 / Lab 01: Dispositivos y Dimensionamiento",
        "question": "Necesitás adquirir un Switch de acceso GigabitEthernet de 48 puertos que garantice conmutación Wire-Speed (Non-Blocking) en modo Full-Duplex. ¿Cuál debe ser la capacidad mínima de su matriz de conmutación (Backplane)?",
        "options": [
            "48 Gbps",
            "96 Gbps",
            "24 Gbps",
            "192 Gbps",
        ],
        "correct": 1,
        "explanation": "Fórmula Backplane Non-Blocking Full-Duplex: N° Puertos × Velocidad × 2. Para 48 puertos de 1 Gbps que transmiten y reciben simultáneamente: 48 × 1 Gbps × 2 = 96 Gbps (y para 24 puertos GbE es 48 Gbps).",
    },
    {
        "id": "tp1-5",
        "unit": "TP 01 / Lab 01: Dispositivos y Dimensionamiento",
        "question": "Un switch de capa de acceso posee 48 puertos de 1 Gbps para puestos de trabajo y se diseña aplicando una relación de sobresuscripción (oversubscription) estándar de 20:1 hacia distribución. ¿Qué ancho de banda de Uplink requiere como mínimo?",
        "options": [
            "48 Gbps (sin sobresuscripción)",
            "2,4 Gbps (cubierto con un enlace de 2.5G o 10GBASE)",
            "0,5 Gbps (cubierto con FastEthernet)",
            "20 Gbps (dos enlaces de 10G)",
        ],
        "correct": 1,
        "explanation": "Capacidad total de acceso = 48 × 1 Gbps = 48 Gbps. Con relación de sobresuscripción 20:1: 48 Gbps / 20 = 2,4 Gbps (cubierto con un uplink 2.5G o 10G SFP+).",
    },
    {
        "id": "tp1-6",
        "unit": "TP 01 / Lab 01: Dispositivos y Dimensionamiento",
        "question": "¿En qué capa del modelo OSI opera un Router (o Switch Capa 3) y cuál es su diferencia clave frente a un Switch Capa 2 respecto a los dominios?",
        "options": [
            "Opera en Capa 1; une todos los dominios de colisión.",
            "Opera en Capa 3 (Red); además de separar dominios de colisión por interfaz, separa los dominios de Broadcast y enruta paquetes usando la Dirección IP Destino.",
            "Opera en Capa 2; inunda los paquetes ARP hacia internet.",
            "Opera en Capa 4; filtra únicamente por dirección MAC origen.",
        ],
        "correct": 1,
        "explanation": "Un Router o Switch L3 desencapsula la trama de enlace, no propaga tramas broadcast L2 hacia otras redes y toma decisiones de encaminamiento consultando su tabla de rutas por IP Destino.",
    },

    # Lab 02
    {
        "id": "lab2-1",
        "unit": "Lab 02: Cableado Estructurado TIA/EIA-568",
        "question": "Según la norma ANSI/TIA/EIA-568, ¿cuál es la longitud máxima permitida para el Canal Horizontal completo y cómo se distribuye entre el cable fijo y los patch cords?",
        "options": [
            "100 metros totales: hasta 90 metros de Enlace Permanente (cable sólido fijo) y hasta 10 metros combinados para patch cords (área de trabajo + gabinete).",
            "90 metros totales: 85 metros de cable fijo y 5 metros de patch cords.",
            "100 metros de enlace fijo más 20 metros adicionales de patch cords (120 m en total).",
            "300 metros utilizando cable UTP Categoría 6.",
        ],
        "correct": 0,
        "explanation": "El canal horizontal completo no debe superar los 100 m: máximo 90 m para el enlace permanente (desde el patch panel hasta la roseta RJ-45 de pared) y máximo 10 m combinados para los patch cords flexibles.",
    },
    {
        "id": "lab2-2",
        "unit": "Lab 02: Cableado Estructurado TIA/EIA-568",
        "question": "Al armar una ficha RJ-45 bajo la norma T568B, ¿qué colores van ubicados en los pines 1, 2, 3 y 6 respectivamente?",
        "options": [
            "1: Blanco/Verde, 2: Verde, 3: Blanco/Naranja, 6: Naranja",
            "1: Blanco/Naranja, 2: Naranja, 3: Blanco/Verde, 6: Verde",
            "1: Blanco/Naranja, 2: Naranja, 3: Blanco/Azul, 6: Azul",
            "1: Blanco/Verde, 2: Verde, 3: Blanco/Marrón, 6: Marrón",
        ],
        "correct": 1,
        "explanation": "Secuencia T568B (pines 1 al 8): 1-Blanco/Naranja, 2-Naranja, 3-Blanco/Verde, 4-Azul, 5-Blanco/Azul, 6-Verde, 7-Blanco/Marrón, 8-Marrón. (T568A intercambia los pares Verde y Naranja).",
    },
    {
        "id": "lab2-3",
        "unit": "Lab 02: Cableado Estructurado TIA/EIA-568",
        "question": "¿Qué topología física y lógica especifica la norma TIA/EIA-568 para el subsistema horizontal y qué tipo de cable se emplea para unir una PC a la roseta o el Patch Panel al Switch?",
        "options": [
            "Topología física en Bus y lógica en Estrella; requiere cable cruzado (568A-568B).",
            "Topología física en Estrella y lógica en Estrella; requiere cable directo/recto (misma norma en ambos extremos, ej. 568B-568B).",
            "Topología física en Anillo y lógica en Estrella; requiere cable Rollover de consola.",
            "Topología malla completa; requiere cable cruzado en el rack y directo en el puesto.",
        ],
        "correct": 1,
        "explanation": "El subsistema horizontal se diseña en Estrella física y lógica. Para interconectar equipos de distinta naturaleza (PC a Switch) se utiliza cable directo manteniendo la misma norma en ambos extremos.",
    },

    # TP 03 y Lab 03
    {
        "id": "tp3-1",
        "unit": "TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP",
        "question": "Cuando una trama Ethernet atraviesa un enlace Troncal (Trunk) bajo el estándar IEEE 802.1Q, ¿dónde se inserta la etiqueta de VLAN, cuántos bytes mide y cómo afecta al tamaño máximo de trama y al FCS?",
        "options": [
            "Se inserta al final de la trama después del FCS; mide 2 bytes y no altera el FCS original.",
            "Se inserta entre la MAC Origen y el campo Tipo/Longitud; mide 4 bytes (TPID 0x8100 de 2B + TCI de 2B), eleva la trama máxima de 1518 a 1522 bytes y obliga a recalcular el FCS (CRC).",
            "Se inserta delante del Preámbulo; mide 8 bytes y mantiene el límite de 1500 bytes.",
            "Reemplaza la dirección MAC Origen por el ID de VLAN; mide 6 bytes.",
        ],
        "correct": 1,
        "explanation": "La etiqueta IEEE 802.1Q de 4 bytes se inserta entre MAC Origen y EtherType/Longitud. Está formada por TPID (0x8100) y TCI (PCP 3b + DEI 1b + VID 12b), sube la trama máxima a 1522 bytes y exige recalcular el FCS.",
    },
    {
        "id": "tp3-2",
        "unit": "TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP",
        "question": "Dentro de la etiqueta IEEE 802.1Q, el subcampo VID (VLAN Identifier) tiene 12 bits. ¿Cuántas VLANs utilizables permite direccionar y por qué?",
        "options": [
            "4096 VLANs utilizables (de la 0 a la 4095).",
            "4094 VLANs utilizables (de la 1 a la 4094), porque los valores 0 y 4095 (0xFFF) están reservados por el estándar.",
            "1024 VLANs utilizables, porque 2 bits se usan para Spanning Tree.",
            "65.535 VLANs utilizables.",
        ],
        "correct": 1,
        "explanation": "Con 12 bits existen 2^12 = 4096 combinaciones (0 a 4095). Como las VLANs 0 y 4095 están reservadas, quedan 4094 VLANs válidas (1 a 4094).",
    },
    {
        "id": "tp3-3",
        "unit": "TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP",
        "question": "En una topología de tres switches (S1, S2 y S3) con configuración de fábrica (prioridad STP por defecto = 32768 + VLAN 1 = 32769), ¿qué criterio utiliza Spanning Tree (802.1D) para elegir al Root Bridge y qué riesgo operativo implica?",
        "options": [
            "Elige al switch con mayor cantidad de puertos Gigabit; no implica ningún riesgo.",
            "Ante empate de prioridad, elige al switch con la dirección MAC numéricamente MÁS BAJA, lo cual suele hacer que el switch más antiguo y lento de la red quede como Root Bridge.",
            "Elige al switch con la dirección MAC más alta.",
            "Elige al switch que se encendió primero.",
        ],
        "correct": 1,
        "explanation": "Gana el menor Bridge ID = Prioridad + MAC. Si el administrador deja la prioridad por defecto en todos los switches, desempata la menor dirección MAC en hexadecimal, que suele corresponder al switch más viejo.",
    },
    {
        "id": "tp3-4",
        "unit": "TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP",
        "question": "Caso del Lab 03: S1 es el Root Bridge y se conecta a S2 y S3 mediante enlaces FastEthernet (100 Mbps, costo 19). A su vez, S2 y S3 están unidos entre sí por un enlace GigabitEthernet (1 Gbps, costo 4). ¿Por qué STP bloquea un extremo del enlace Gigabit entre S2 y S3?",
        "options": [
            "Porque STP no soporta enlaces GigabitEthernet y los desactiva por incompatibilidad.",
            "Porque cada switch no-raíz elige su Root Port evaluando el costo acumulado hacia el Root Bridge (S1): ir directo a S1 por FastEthernet cuesta 19, mientras que ir vía el otro switch por el enlace Gigabit costaría 4 + 19 = 23 > 19. Así el segmento Gigabit queda como camino redundante y se bloquea.",
            "Porque en STP los enlaces con menor costo siempre se bloquean por seguridad.",
            "Porque los puertos Gigabit tienen mayor prioridad física.",
        ],
        "correct": 1,
        "explanation": "STP elige Root Ports mirando el costo acumulado hacia el Root Bridge (S1). Como desde S2 y S3 hacia S1 el camino directo por FastEthernet cuesta 19 (menor que 4 + 19 = 23), el enlace Gigabit entre S2 y S3 queda como redundante y se bloquea en un extremo.",
    },
    {
        "id": "tp3-5",
        "unit": "TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP",
        "question": "Si dos switches se conectan entre sí mediante dos cables FastEthernet en paralelo (Fa0/1 con Fa0/1 y Fa0/2 con Fa0/2), ¿cuál de los dos puertos se bloqueará en el switch no designado y por qué?",
        "options": [
            "Se bloquea Fa0/1 porque STP reserva el primer puerto para gestión.",
            "Se bloquea Fa0/2 (Port ID 128.2) porque ante empate de Bridge ID y de costo de ruta, gana como Root Port el que recibe el menor Port ID (128.1 < 128.2).",
            "Se bloquean ambos puertos hasta que se configure LACP.",
            "Se eligen al azar en cada reinicio.",
        ],
        "correct": 1,
        "explanation": "Ante empate de Bridge ID y costo de ruta en enlaces paralelos, desempata el menor Port ID (Prioridad de puerto 128 + N° de puerto). Gana Fa0/1 (128.1) y se bloquea Fa0/2 (128.2).",
    },
    {
        "id": "tp3-6",
        "unit": "TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP",
        "question": "¿Cuál es la diferencia fundamental en tiempos y estados de convergencia entre STP clásico (IEEE 802.1D) y RSTP (IEEE 802.1w)?",
        "options": [
            "STP converge en 1 segundo y RSTP tarda 50 segundos porque verifica VLAN por VLAN.",
            "STP (802.1D) tarda 30 a 50 segundos pasando pasivamente por Blocking → Listening (15 s) → Learning (15 s) → Forwarding; RSTP (802.1w) unifica en Discarding → Learning → Forwarding y usa negociación activa Proposal/Agreement para converger en menos de 1 a 2 segundos.",
            "Ambos tardan 30 segundos pero RSTP solo funciona en fibra óptica.",
            "RSTP elimina el concepto de Root Bridge.",
        ],
        "correct": 1,
        "explanation": "STP clásico espera temporizadores pasivos (30 a 50 s). RSTP (802.1w) introduce los estados Discarding/Learning/Forwarding, el rol Alternate y sincronización activa Proposal/Agreement para converger en < 1 a 2 segundos.",
    },
    {
        "id": "tp3-7",
        "unit": "TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP",
        "question": "¿Qué comando de Cisco IOS en modo de configuración global fuerza a un switch para convertirse en el Puente Raíz (Root Bridge) primario de la VLAN 1?",
        "options": [
            "Switch(config)# spanning-tree vlan 1 root primary",
            "Switch(config)# switchport trunk root vlan 1",
            "Switch(config)# vlan 1 root-bridge enable",
            "Switch(config)# spanning-tree portfast default",
        ],
        "correct": 0,
        "explanation": "El comando 'spanning-tree vlan 1 root primary' (o 'spanning-tree vlan 1 priority 4096') reduce la prioridad BID del switch para garantizar que gane la elección de Root Bridge.",
    },
    {
        "id": "tp3-8",
        "unit": "TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP",
        "question": "¿Qué secuencia de comandos Cisco IOS configura correctamente la interfaz GigabitEthernet 0/1 como enlace Troncal (Trunk) con la VLAN 99 como nativa?",
        "options": [
            "interface g0/1 -> switchport mode access -> switchport access vlan 99",
            "interface g0/1 -> switchport mode trunk -> switchport trunk native vlan 99",
            "interface g0/1 -> trunk enable -> native vlan 99",
            "vlan 99 -> interface g0/1 trunk",
        ],
        "correct": 1,
        "explanation": "En Cisco IOS se ingresa a la interfaz ('interface g0/1'), se define el modo troncal ('switchport mode trunk') y se especifica la VLAN sin etiquetar ('switchport trunk native vlan 99').",
    },

    # TP 04 y Lab 04
    {
        "id": "tp4-1",
        "unit": "TP 04 / Lab 04: Fibra Óptica, OTDR y GPON",
        "question": "¿Cuáles son los diámetros de núcleo y revestimiento de la fibra Monomodo (SMF) frente a la Multimodo (MMF), y por qué la fibra Monomodo alcanza decenas de kilómetros?",
        "options": [
            "SMF tiene núcleo de 50 µm y MMF de 9 µm; SMF usa LED.",
            "Ambas tienen revestimiento de 125 µm; la SMF tiene núcleo de 9 µm y propaga un único modo axial con fuente Láser eliminando la dispersión modal, mientras que la MMF tiene núcleo de 50 o 62,5 µm y sufre dispersión modal.",
            "La SMF no tiene revestimiento (cladding) y por eso no tiene atenuación.",
            "La MMF alcanza 80 km y la SMF solo 300 metros.",
        ],
        "correct": 1,
        "explanation": "El revestimiento es de 125 µm en ambas. La Monomodo (9/125 µm) guía un único modo axial con luz láser sin dispersión modal (>20–80 km). La Multimodo (50/125 o 62,5/125 µm) sufre dispersión modal que limita su alcance a 300–550 m.",
    },
    {
        "id": "tp4-2",
        "unit": "TP 04 / Lab 04: Fibra Óptica, OTDR y GPON",
        "question": "En una red GPON (ITU-T G.984), ¿qué longitudes de onda, velocidades nominales y métodos de acceso al medio se utilizan en Bajada (Downstream) y en Subida (Upstream) sobre el mismo pelo de fibra?",
        "options": [
            "Bajada en 850 nm por CSMA/CD y Subida en 1300 nm por Token Ring.",
            "Bajada (OLT → ONTs) en 1490 nm a 2,488 Gbps en modo Broadcast cifrado con AES; Subida (ONTs → OLT) en 1310 nm a 1,244 Gbps usando TDMA con proceso de Ranging.",
            "Bajada en 1310 nm a 1 Gbps y Subida en 1490 nm a 10 Gbps.",
            "Usa dos fibras separadas: una para bajada y otra para subida en 1550 nm.",
        ],
        "correct": 1,
        "explanation": "Mediante WDM sobre un solo pelo de fibra: Bajada en 1490 nm (2,48832 Gbps) en modo Broadcast con cifrado AES-128; Subida en 1310 nm (1,24416 Gbps) mediante TDMA y ecualización de retardo (Ranging).",
    },
    {
        "id": "tp4-3",
        "unit": "TP 04 / Lab 04: Fibra Óptica, OTDR y GPON",
        "question": "Si un puerto GPON estándar (2,48832 Gbps de bajada / 1,24416 Gbps de subida) alimenta un splitter 1:64 con los 64 abonados descargando simultáneamente, ¿cuál es el ancho de banda promedio por abonado y qué T-CONT usarías para VoIP vs. Internet?",
        "options": [
            "38,88 Mbps de bajada y 19,44 Mbps de subida; T-CONT Tipo 1 (ancho de banda fijo garantizado) para VoIP y T-CONT Tipo 4 (Best-Effort, mínimo = 0) para Internet residencial.",
            "100 Mbps simétricos; T-CONT Tipo 4 para VoIP y Tipo 1 para descargas web.",
            "300 Mbps de bajada y 150 Mbps de subida fijos para cada uno de los 64 clientes.",
            "15,5 Mbps de bajada y 7,7 Mbps de subida.",
        ],
        "correct": 0,
        "explanation": "Bajada promedio = 2488,32 / 64 = 38,88 Mbps; Subida promedio = 1244,16 / 64 = 19,44 Mbps. Con DBA se asigna T-CONT Tipo 1 (Fixed) para tráfico sensible al retardo (VoIP) y T-CONT Tipo 4 (Best-Effort) para internet residencial.",
    },
    {
        "id": "tp4-4",
        "unit": "TP 04 / Lab 04: Fibra Óptica, OTDR y GPON",
        "question": "En el Taller de Fibra Óptica (Lab 04), ¿cuál es la diferencia física entre una Macrocurvatura y una Microcurvatura, y cómo se identifica una macrocurvatura con un OTDR?",
        "options": [
            "Son exactamente lo mismo y afectan más a la longitud de onda de 850 nm.",
            "La macrocurvatura es un doblez visible (mm/cm) que rompe el ángulo crítico de reflexión interna total y produce mucha más atenuación en 1550/1625 nm que en 1310 nm; la microcurvatura es una deformación microscópica (µm) por aplastamiento o precintos apretados.",
            "La macrocurvatura genera un pico reflectivo de Fresnel alto y la microcurvatura corta la fibra.",
            "La macrocurvatura solo ocurre en fibras multimodo.",
        ],
        "correct": 1,
        "explanation": "En una macrocurvatura el radio de giro cae por debajo del mínimo y la luz se escapa al revestimiento. Al medir con OTDR en 1310 nm y 1550 nm, una pérdida mucho mayor en 1550 nm confirma una macrocurvatura.",
    },
    {
        "id": "tp4-5",
        "unit": "TP 04 / Lab 04: Fibra Óptica, OTDR y GPON",
        "question": "Durante el empalme por fusión de fibra óptica, ¿por qué es obligatorio limpiar la fibra pelada con alcohol isopropílico ≥ 99% y cómo realiza el corte la cortadora de precisión (cleaver)?",
        "options": [
            "Para lubricar la fibra; el cleaver la corta aplastándola como un alicate común.",
            "Porque el alcohol común contiene agua y residuos que al aplicar el arco eléctrico (~2000 °C) se vaporizan explosivamente creando burbujas en la fusión; el cleaver hace una micro-muesca con diamante (scoring) y tracciona la fibra logrando una fractura espejo a 90° (< 1° de error).",
            "Para quitar el núcleo de vidrio y dejar solo el acrilato.",
            "Para enfriar el manguito termocontraíble antes del horneado.",
        ],
        "correct": 1,
        "explanation": "La humedad o restos de acrilato hierven en el arco eléctrico generando burbujas que arruinan el empalme. El cleaver marca apenas el vidrio con diamante y lo tracciona longitudinalmente para lograr una cara perpendicular a 90°.",
    },
    {
        "id": "tp4-6",
        "unit": "TP 04 / Lab 04: Fibra Óptica, OTDR y GPON",
        "question": "En una medición con OTDR, ¿qué son la Zona Muerta de Evento (EDZ) y la Zona Muerta de Atenuación (ADZ), y qué indica un valor de ORL (Optical Return Loss) de 60 dB frente a uno de 45 dB?",
        "options": [
            "Son tramos de fibra sin luz; un ORL de 45 dB es mejor porque refleja más luz.",
            "Son las distancias en que el fotodiodo queda saturado tras una reflexión de Fresnel: EDZ es la distancia mínima para distinguir dos eventos reflectivos separados y ADZ la distancia para volver a medir la atenuación; en ORL, cuanto MÁS ALTO el valor en dB (60 dB con conectores verdes SC/APC), MEJOR porque regresa menos potencia reflejada hacia el láser.",
            "EDZ mide la longitud total del enlace y ADZ la potencia del láser.",
            "ORL solo se mide en cables de cobre UTP.",
        ],
        "correct": 1,
        "explanation": "Las zonas muertas se reducen con pulsos cortos y bobina de lanzamiento. En ORL (medido en dB positivos), cuanto más alto el número en dB, menor es la luz reflejada hacia la fuente láser (por eso GPON exige conectores verdes SC/APC angulados a 8°).",
    },

    # TP 05 (Wi-Fi)
    {
        "id": "tp5-1",
        "unit": "TP 05: Redes Inalámbricas IEEE 802.11 (Wi-Fi)",
        "question": "Según la Resolución ENACOM 756/2023 en Argentina para la banda de 6 GHz (5925–7125 MHz, Wi-Fi 6E y Wi-Fi 7), ¿dónde está permitido su uso, con qué límites de potencia PIRE y por qué está prohibido en exteriores?",
        "options": [
            "Permitido en exteriores a 4 Watts para enlaces rurales punto a punto.",
            "Uso EXCLUSIVO EN INTERIORES (Indoor), con PIRE máxima de 30 dBm (1 W) para APs y 24 dBm (250 mW) para clientes. Está prohibido en exteriores porque la banda de 6 GHz aloja radioenlaces fijos terrestres de microondas licenciados (servicios primarios) y enlaces satelitales.",
            "Prohibido en todo el territorio nacional.",
            "Permitido en exteriores solo en canales 1, 6 y 11.",
        ],
        "correct": 1,
        "explanation": "La Res. ENACOM 756/2023 habilita los 1200 MHz de la banda de 6 GHz exclusivamente para interiores (modo LPI: 30 dBm AP / 24 dBm cliente) para no interferir los radioenlaces licenciados de microondas que operan como servicio primario.",
    },
    {
        "id": "tp5-2",
        "unit": "TP 05: Redes Inalámbricas IEEE 802.11 (Wi-Fi)",
        "question": "En la banda de 2,4 GHz, un técnico configura 5 APs cercanos en los canales 1, 3, 6, 9 y 11. ¿Por qué es un grave error técnico y por qué la interferencia generada es peor que poner dos APs en el mismo canal?",
        "options": [
            "Porque los canales 3 y 9 están reservados para radares meteorológicos DFS.",
            "Porque en 2,4 GHz los centros de canal están separados solo por 5 MHz pero cada canal ocupa 20–22 MHz; usar los canales 3 y 9 provoca Interferencia de Canal Adyacente (ACI / solapamiento parcial), que es peor que la Co-Canal (CCI) porque las tramas no pueden decodificarse para arbitrar turnos CSMA/CA y chocan como ruido físico incorregible.",
            "Porque en 2,4 GHz solo existe el canal 1.",
            "Porque los clientes móviles no soportan canales impares.",
        ],
        "correct": 1,
        "explanation": "En 2,4 GHz solo deben usarse los canales 1, 6 y 11. En CCI los equipos en el mismo canal negocian turnos con CSMA/CA; en ACI las señales desplazadas en frecuencia destruyen las tramas como ruido físico y hunden el SNR.",
    },
    {
        "id": "tp5-3",
        "unit": "TP 05: Redes Inalámbricas IEEE 802.11 (Wi-Fi)",
        "question": "¿Qué ocurre en una red de telefonía inalámbrica corporativa (VoWiFi) si se configuran los APs de 5 GHz en canales DFS (U-NII-2, canales 52 al 144) cercanos a un aeropuerto o radar meteorológico?",
        "options": [
            "Los teléfonos ganan el doble de alcance gracias al radar.",
            "Al detectar pulsos de radar, el AP debe abandonar el canal inmediatamente, bloquearlo por 30 minutos y si salta a otro canal DFS debe escuchar en silencio durante 60 segundos (CAC - Channel Availability Check) antes de transmitir, provocando el corte total de las llamadas VoWiFi activas.",
            "El AP cambia automáticamente a 2,4 GHz sin que los clientes pierdan ni un paquete.",
            "DFS encripta las llamadas de voz con WPA3.",
        ],
        "correct": 1,
        "explanation": "La obligación regulatoria de realizar un CAC de 60 segundos (o 10 minutos en radares TDWR) en silencio antes de levantar otro canal DFS provoca desconexiones inaceptables para llamadas VoWiFi en tiempo real.",
    },
    {
        "id": "tp5-4",
        "unit": "TP 05: Redes Inalámbricas IEEE 802.11 (Wi-Fi)",
        "question": "Caso Aula Magna (CWNP): Asisten 180 usuarios concurrentes. El 80% se conecta en 5 GHz (144 clientes) y cada uno requiere 4 Mbps. Si cada radio de 5 GHz soporta máximo 30 clientes asociados y entrega 100 Mbps de caudal efectivo, ¿cuántos APs se necesitan como mínimo y por qué?",
        "options": [
            "5 APs, porque 144 / 30 = 4,8 redondeado hacia arriba.",
            "6 APs, porque se calcula por clientes (⌈144/30⌉ = 5 APs) y por caudal agregado (144 × 4 Mbps = 576 Mbps → ⌈576/100⌉ = 6 APs), y según la regla CWNP siempre se adopta el MÁXIMO entre ambos criterios (nunca el promedio).",
            "5,5 APs (se instalan 5 APs y un repetidor).",
            "3 APs usando canales de 160 MHz.",
        ],
        "correct": 1,
        "explanation": "Por asociación: ⌈144/30⌉ = 5 APs. Por throughput: ⌈576 Mbps / 100 Mbps⌉ = 6 APs. Siempre se toma el máximo (6 APs) para satisfacer el requerimiento más restrictivo.",
    },
    {
        "id": "tp5-5",
        "unit": "TP 05: Redes Inalámbricas IEEE 802.11 (Wi-Fi)",
        "question": "Se van a instalar 12 APs Wi-Fi 7 tri-banda que consumen hasta 39 W cada uno en un único Switch de acceso cuyo PoE Budget total es de 370 W. ¿Qué estándar PoE requiere cada puerto y qué ocurrirá al conectar los 12 APs a ese switch?",
        "options": [
            "Alcanza con IEEE 802.3af (15,4 W) y el switch de 370 W alimenta los 12 APs sin problema.",
            "Cada puerto requiere IEEE 802.3bt (PoE++ Tipo 3, hasta 60 W en puerto / 51 W en PD). Además, 12 × 39 W = 468 W > 370 W, por lo que el switch NO alcanza (solo puede alimentar ⌊370/39⌋ = 9 APs a plena carga).",
            "Requiere IEEE 802.3at (PoE+ de 30 W) y el switch entregará los 98 W faltantes por el cable de consola.",
            "Los APs Wi-Fi 7 no soportan alimentación PoE.",
        ],
        "correct": 1,
        "explanation": "39 W supera los 30 W de 802.3at, exigiendo IEEE 802.3bt (PoE++ Tipo 3). Además, los 12 APs demandan 468 W, superando el presupuesto PoE de 370 W del switch.",
    },
    {
        "id": "tp5-6",
        "unit": "TP 05: Redes Inalámbricas IEEE 802.11 (Wi-Fi)",
        "question": "Al mediodía, el Wi-Fi en 2,4 GHz cerca del comedor universitario se vuelve inutilizable. El Analizador Wi-Fi muestra apenas 15% de ocupación del canal, pero el Analizador de Espectro RF muestra un Duty Cycle del 85%. ¿Cuál es el diagnóstico y la solución?",
        "options": [
            "Hay un ataque de denegación de servicio con tramas de deautenticación 802.11.",
            "El analizador Wi-Fi solo lee tramas de Capa 2 (802.11), mientras que el analizador de espectro mide la energía física de Capa 1: hay un 70% de interferencia no-Wi-Fi causada por hornos microondas (~2450 MHz con alto Duty Cycle) y Bluetooth, lo que bloquea el CCA de CSMA/CA. Solución: migrar a la banda de 5 GHz.",
            "La fibra óptica del switch principal tiene una macrocurvatura.",
            "Falta configurar Spanning Tree en los APs.",
        ],
        "correct": 1,
        "explanation": "Los hornos microondas irradian energía no-802.11 en ~2450 MHz con 50–80% de Duty Cycle, saturando el CCA de CSMA/CA sin aparecer en un analizador Wi-Fi de Capa 2. Se resuelve migrando a 5 GHz.",
    },
    {
        "id": "tp5-7",
        "unit": "TP 05: Redes Inalámbricas IEEE 802.11 (Wi-Fi)",
        "question": "¿Por qué configurar 8 o 10 SSIDs distintos en los mismos APs degrada severamente el rendimiento, cómo se resuelve usando un único SSID y qué diferencia crítica de licenciamiento tiene Cisco Meraki frente a Ubiquiti UniFi?",
        "options": [
            "Porque cada SSID envía tramas Beacon cada 102,4 ms a la tasa básica más baja (1 Mbps), consumiendo del 30% al 50% del tiempo de aire (Airtime) en gestión; se resuelve con 1 SSID + 802.1X/RADIUS con VLAN Dinámica (o MPSK para IoT). En licencias, Meraki bloquea el tráfico de la red si no se renueva la suscripción anual (OpEx), mientras que UniFi opera localmente sin licencias.",
            "Porque el límite del estándar IEEE 802.11 es de 2 SSIDs; UniFi exige licencia mensual y Meraki es gratuito.",
            "Los SSIDs no consumen tiempo de aire porque viajan por el cable Ethernet.",
            "Meraki solo funciona en 2,4 GHz.",
        ],
        "correct": 0,
        "explanation": "Muchos SSIDs saturan el aire con Beacons a 1 Mbps. Se consolida en 1 SSID con VLAN dinámica vía 802.1X/RADIUS o MPSK. En presupuesto, Meraki requiere OpEx anual obligatorio (si vence, apaga la red), mientras UniFi es 100% CapEx sin licencias.",
    },

    # TP 06 (IPv4, Encapsulamiento y Fragmentación)
    {
        "id": "tp6-1",
        "unit": "TP 06: IPv4, Encapsulamiento y Fragmentación",
        "question": "¿Qué tipo de servicio brinda el protocolo IPv4 a la capa superior y por qué NO incluye mecanismos de retransmisión ni control de errores de datos en los routers intermedios?",
        "options": [
            "Servicio orientado a la conexión y confiable; los routers retransmiten cada paquete perdido.",
            "Servicio NO orientado a la conexión (Connectionless) y NO confiable / de Mejor Esfuerzo (Best-Effort). No asume retransmisión para mantener los routers del núcleo rápidos, simples y sin estado de sesión (Principio End-to-End), y para no penalizar con retardos a aplicaciones en tiempo real como VoIP/RTP.",
            "Servicio garantizado con reserva fija de ancho de banda en cada salto.",
            "IP no verifica errores porque Ethernet ya garantiza entrega extremo a extremo entre distintas redes.",
        ],
        "correct": 1,
        "explanation": "IP es Connectionless y Best-Effort. Deja la confiabilidad y retransmisión a TCP en Capa 4 (extremo a extremo) para que los routers L3 conmuten paquetes a alta velocidad y para permitir tráfico UDP/RTP sin retardos de retransmisión.",
    },
    {
        "id": "tp6-2",
        "unit": "TP 06: IPv4, Encapsulamiento y Fragmentación",
        "question": "En una transmisión de videollamada corporativa VoIP/RTC mediante RTP sobre UDP en una red Ethernet IPv4 (Actividad 3 del TP 06), ¿cuál es el orden exacto de los encabezados en la trama y qué valores toman los campos de multiplexación?",
        "options": [
            "Header IP → Header Ethernet → Header TCP → Header RTP → FCS.",
            "Header Ethernet L2 (14 B, con EtherType = 0x0800) → Header IPv4 L3 (20 B, con Protocol = 17) → Header UDP L4 (8 B, con Puertos Origen/Destino) → Header RTP (12 B) → Payload de Audio/Video → Tráiler Ethernet FCS/CRC (4 B).",
            "Header RTP → Header UDP → Header IPv4 → Header Ethernet (sin tráiler).",
            "Header Ethernet (EtherType = 0x8100) → Header IPv4 (Protocol = 6) → Header UDP.",
        ],
        "correct": 1,
        "explanation": "El orden de afuera hacia adentro es Ethernet L2 (EtherType 0x0800 = IPv4) → IPv4 L3 (Protocol 17 = UDP) → UDP L4 (Puerto Destino RTP) → RTP → Datos de Audio/Video → Tráiler FCS (4 Bytes).",
    },
    {
        "id": "tp6-3",
        "unit": "TP 06: IPv4, Encapsulamiento y Fragmentación",
        "question": "¿Qué función cumplen los campos IHL (Internet Header Length) y Header Checksum en la cabecera IPv4, y por qué cada router L3 está obligado a recalcular el Header Checksum en cada salto?",
        "options": [
            "IHL mide el tamaño total del archivo y el Checksum solo se calcula en la PC de origen.",
            "IHL (4 bits) indica la longitud de la cabecera IP en palabras de 32 bits (4 bytes), siendo 5 su valor estándar (5 × 4 = 20 bytes). El Header Checksum protege solo la cabecera IP y cada router debe recalcularlo obligatoriamente porque en cada salto disminuye en 1 el campo TTL.",
            "El Header Checksum protege los datos del usuario pero no la cabecera IP.",
            "IHL indica la cantidad máxima de routers que puede cruzar el paquete.",
        ],
        "correct": 1,
        "explanation": "IHL especifica dónde termina la cabecera IP en múltiplos de 4 bytes (mínimo 5 = 20 bytes). El Header Checksum cubre únicamente la cabecera IPv4 y debe recalcularse en cada router porque el campo TTL se decrementa en cada salto.",
    },
    {
        "id": "tp6-4",
        "unit": "TP 06: IPv4, Encapsulamiento y Fragmentación",
        "question": "¿Qué problema crítico de red evita el campo Time to Live (TTL), y qué sucede exactamente cuando un router recibe un datagrama con TTL = 1 destinado a otra red y lo decrementa a 0?",
        "options": [
            "Evita colisiones físicas en el cable; cuando llega a 0 el router duplica el paquete.",
            "Evita que los paquetes circulen infinitamente en caso de un bucle de enrutamiento (routing loop). Cuando al decrementarlo llega a 0, el router descarta el datagrama y envía un mensaje ICMP Tipo 11, Código 0 (Time Exceeded) dirigido a la Dirección IP de Origen del paquete.",
            "Cuando llega a 0, el router le suma 64 y sigue reenviándolo al servidor destino.",
            "El router envía un mensaje ICMP al servidor de destino (8.8.8.8) avisando que el paquete murió.",
        ],
        "correct": 1,
        "explanation": "El TTL evita que un bucle de ruteo sature los enlaces indefinidamente. Cuando llega a 0, el router descarta el datagrama y envía un mensaje ICMP Time Exceeded (Tipo 11, Código 0) al host de IP Origen.",
    },
    {
        "id": "tp6-5",
        "unit": "TP 06: IPv4, Encapsulamiento y Fragmentación",
        "question": "Cuando un router L3 busca la dirección IP de destino de un datagrama en su tabla de enrutamiento y encuentra varias rutas coincidentes (por ejemplo, 10.0.0.0/8, 10.1.0.0/16 y 10.1.2.0/24), ¿qué regla aplica para elegir el camino?",
        "options": [
            "Elige la ruta con la máscara más corta (/8) porque abarca más direcciones.",
            "Aplica la regla de Coincidencia del Prefijo Más Largo (Longest Prefix Match), seleccionando la ruta coincidente que tenga la máscara de subred más larga y específica (/24).",
            "Envía una copia del paquete por las tres rutas simultáneamente.",
            "Descarta el paquete por ambigüedad en la tabla.",
        ],
        "correct": 1,
        "explanation": "Los routers IP evalúan la tabla de rutas mediante Longest Prefix Match: entre todas las rutas que coinciden con la IP destino, gana siempre la que tiene mayor cantidad de bits en 1 en su máscara (/24 > /16 > /8).",
    },
    {
        "id": "tp6-6",
        "unit": "TP 06: IPv4, Encapsulamiento y Fragmentación",
        "question": "Actividad 5 del TP 06: Un SysAdmin captura tráfico en Wireshark mientras el cliente 192.168.1.50 hace ping a 8.8.8.8. ¿Qué filtro de visualización (Display Filter) muestra el intercambio entre ambos hosts y qué filtro aísla únicamente los paquetes fragmentados?",
        "options": [
            "Intercambio: ip == 192.168.1.50 to 8.8.8.8 | Fragmentos: ip.fragmented == true",
            "Intercambio: ip.addr == 192.168.1.50 && ip.addr == 8.8.8.8 | Fragmentos: ip.flags.mf == 1 || ip.frag_offset > 0",
            "Intercambio: arp.addr == 8.8.8.8 | Fragmentos: tcp.Port == 80",
            "Intercambio: ping.host == 8.8.8.8 | Fragmentos: ip.ttl == 0",
        ],
        "correct": 1,
        "explanation": "'ip.addr == 192.168.1.50 && ip.addr == 8.8.8.8' muestra el tráfico entre ambos IPs. Y 'ip.flags.mf == 1 || ip.frag_offset > 0' captura todos los fragmentos (el primero tiene MF=1, los intermedios tienen ambos y el último tiene frag_offset > 0).",
    },
    {
        "id": "tp6-7",
        "unit": "TP 06: IPv4, Encapsulamiento y Fragmentación",
        "question": "Actividad 5 del TP 06: El cliente 192.168.1.50 envía un ping de 3.000 bytes de carga útil hacia 8.8.8.8 en una red Ethernet (MTU = 1500 bytes, cabecera IP = 20 bytes). Al inspeccionar el PRIMER fragmento en Wireshark, ¿qué valores tienen Total Length, DF, MF, Fragment Offset y Protocol?",
        "options": [
            "Total Length = 3028 bytes, DF = 1, MF = 0, Fragment Offset = 0, Protocol = 6 (TCP).",
            "Total Length = 1500 bytes (20 B cabecera IP + 1480 B datos), DF = 0, MF = 1 (More Fragments activo), Fragment Offset = 0, Protocol = 1 (ICMP).",
            "Total Length = 1480 bytes, DF = 0, MF = 0, Fragment Offset = 1480, Protocol = 17 (UDP).",
            "Total Length = 1000 bytes, DF = 1, MF = 1, Fragment Offset = 8, Protocol = 1 (ICMP).",
        ],
        "correct": 1,
        "explanation": "Con MTU de 1500 B y cabecera IP de 20 B, cada fragmento lleva máximo 1480 B de datos. El 1er fragmento tiene Total Length = 1500, DF = 0, MF = 1 (faltan más fragmentos), Fragment Offset = 0 y Protocol = 1 (ICMP).",
    },
    {
        "id": "tp6-8",
        "unit": "TP 06: IPv4, Encapsulamiento y Fragmentación",
        "question": "Continuando con el ping de 3.000 bytes (Actividad 5.c del TP 06), ¿qué valores de Fragment Offset (en bytes y en unidades de 8 bytes) y de la bandera More Fragments (MF) tienen el 2do fragmento (intermedio) y el 3er fragmento (último)?",
        "options": [
            "2do fragmento: Offset = 1500 B, MF = 0 | 3er fragmento: Offset = 3000 B, MF = 1.",
            "2do fragmento (intermedio): Offset = 1480 bytes (valor de campo 185) y MF = 1 | 3er fragmento (último): Offset = 2960 bytes (valor de campo 370) y MF = 0.",
            "Todos los fragmentos llevan Offset = 0 y MF = 1.",
            "2do fragmento: Offset = 740 bytes y MF = 1 | 3er fragmento: Offset = 1480 bytes y MF = 0.",
        ],
        "correct": 1,
        "explanation": "El 1er fragmento lleva los bytes 0..1479 (Offset=0, MF=1); el 2do fragmento lleva los bytes 1480..2959 (Offset=1480 B o 185 bloques de 8B, MF=1); el 3er fragmento lleva desde el byte 2960 hasta el final (Offset=2960 B o 370 bloques de 8B, y MF=0 indicando que es el último).",
    },
]

QUESTIONS_BY_ID = {q["id"]: q for q in QUESTIONS}


# ---------------------------------------------------------------- Configuración y Simulación en Memoria
def config(env, name: str) -> str:
    if name == "NEON_CONNECTION_STRING":
        return getattr(env, "DATABASE_URL", None) or getattr(env, name, None) or ""
    return getattr(env, name, None) or ""


def simulado(env, name: str) -> bool:
    return config(env, "MODO_LOCAL") == "1" and not config(env, name)


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash_pw(pw: str) -> str:
    return hashlib.sha256(f"redes2-salt:{pw}".encode("utf-8")).hexdigest()


# Estado en memoria para MODO_LOCAL=1 (cuando NEON_CONNECTION_STRING está vacía)
_mem_users: dict[str, dict] = {
    "local:franco": {
        "user_id": "local:franco",
        "username": "franco",
        "display_name": "Franco H.",
        "password_hash": _hash_pw("1234"),
        "created_at": "2026-10-27T15:00:00+00:00",
    },
    "local:sofia": {
        "user_id": "local:sofia",
        "username": "sofia",
        "display_name": "Sofía M.",
        "password_hash": _hash_pw("1234"),
        "created_at": "2026-10-27T15:10:00+00:00",
    },
    "local:mateo": {
        "user_id": "local:mateo",
        "username": "mateo",
        "display_name": "Mateo G.",
        "password_hash": _hash_pw("1234"),
        "created_at": "2026-10-27T15:20:00+00:00",
    },
    "local:valentina": {
        "user_id": "local:valentina",
        "username": "valentina",
        "display_name": "Valentina R.",
        "password_hash": _hash_pw("1234"),
        "created_at": "2026-10-27T15:30:00+00:00",
    },
}

# Pre-poblamos respuestas realistas de muestra en MODO_LOCAL para que las barras de porcentaje (%)
# y el Leaderboard tengan datos estadísticos desde el primer segundo.
_mem_responses: dict[tuple[str, str], dict] = {}


def _seed_local_responses():
    if _mem_responses:
        return
    # Patrones de respuesta para los 4 compañeros de ejemplo en modo local
    sample_profiles = [
        ("local:franco", 0.86, 0),
        ("local:sofia", 0.78, 1),
        ("local:valentina", 0.67, 2),
        ("local:mateo", 0.56, 3),
    ]
    for uid, acc, shift in sample_profiles:
        for idx, q in enumerate(QUESTIONS):
            # Determinamos si acierta según su tasa de acierto
            threshold = ((idx * 37 + shift * 13) % 100) / 100.0
            if threshold < acc:
                sel = q["correct"]
                ok = True
            else:
                sel = (q["correct"] + 1 + ((idx + shift) % 3)) % 4
                ok = False
            _mem_responses[(uid, q["id"])] = {
                "user_id": uid,
                "question_id": q["id"],
                "selected_option": sel,
                "is_correct": ok,
                "answered_at": "2026-10-27T16:00:00+00:00",
            }


_seed_local_responses()


# ---------------------------------------------------------------- Acceso a Neon (SQL por HTTP)
async def neon_sql(env, query: str, params: list | None = None) -> list[dict]:
    conn = config(env, "NEON_CONNECTION_STRING")
    if not conn:
        raise HTTPException(500, "Falta el secreto DATABASE_URL")
    host = urlparse(conn).hostname
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"https://{host}/sql",
            headers={"Neon-Connection-String": conn},
            json={"query": query, "params": params or []},
        )
    if r.status_code != 200:
        raise HTTPException(500, f"Error de base de datos: {r.text}")
    return r.json().get("rows", [])


def use_local_db(env) -> bool:
    return simulado(env, "NEON_CONNECTION_STRING") or not config(env, "NEON_CONNECTION_STRING")


# ---------------------------------------------------------------- Autenticación (Login de Participantes + Clerk)
_keys: dict = {}


def _jwt_secret(env) -> str:
    return config(env, "JWT_SECRET") or "quiz-redes2-fceqyn-secret-2026-key-32bytes!"


def create_local_token(env, user_id: str, username: str, display_name: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "display_name": display_name,
        "iss": "quiz-redes2-local",
        "iat": int(time.time()),
    }
    return jwt.encode(payload, _jwt_secret(env), algorithm="HS256")


async def _get_clerk_key(env, kid: str):
    if kid not in _keys:
        async with httpx.AsyncClient() as client:
            r = await client.get(env.CLERK_JWKS_URL)
        r.raise_for_status()
        for k in r.json()["keys"]:
            _keys[k["kid"]] = jwt.PyJWK(k).key
    return _keys.get(kid)


async def current_user(request: Request, authorization: str = Header(default="")) -> dict:
    """Devuelve {'user_id', 'username', 'display_name'} validando token local HS256 o Clerk RS256."""
    env = get_env(request)
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Iniciá sesión para participar en el cuestionario")
    token = authorization.removeprefix("Bearer ").strip()

    # 1. Intentar decodificar como token local HS256 (emitido por /api/auth/login o /api/auth/register)
    try:
        claims = jwt.decode(token, _jwt_secret(env), algorithms=["HS256"])
        if claims.get("iss") == "quiz-redes2-local":
            return {
                "user_id": claims["sub"],
                "username": claims.get("username", claims["sub"]),
                "display_name": claims.get("display_name", claims.get("username", "Participante")),
            }
    except jwt.PyJWTError:
        pass

    # 2. Si es token 'demo' en MODO_LOCAL
    if token == "demo" and config(env, "MODO_LOCAL") == "1":
        uid = "local:invitado"
        if uid not in _mem_users:
            _mem_users[uid] = {
                "user_id": uid,
                "username": "invitado",
                "display_name": "Estudiante Invitado",
                "password_hash": "",
                "created_at": _ahora(),
            }
        return {"user_id": uid, "username": "invitado", "display_name": "Estudiante Invitado"}

    # 3. Intentar verificar como token RS256 de Clerk
    if config(env, "CLERK_JWKS_URL"):
        try:
            kid = jwt.get_unverified_header(token)["kid"]
            key = await _get_clerk_key(env, kid)
            if key is None:
                raise HTTPException(401, "Clave de Clerk desconocida")
            claims = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                issuer=env.CLERK_ISSUER,
                options={"verify_aud": False},
            )
            sub = claims["sub"]
            uname = claims.get("username") or sub[-8:]
            dname = claims.get("name") or uname
            return {"user_id": sub, "username": uname, "display_name": dname}
        except jwt.PyJWTError:
            raise HTTPException(401, "Token inválido")

    raise HTTPException(401, "Sesión inválida o expirada")


# ---------------------------------------------------------------- Modelos Pydantic
class RegisterBody(BaseModel):
    username: str
    display_name: str
    password: str


class LoginBody(BaseModel):
    username: str
    password: str


class AnswerBody(BaseModel):
    question_id: str
    selected_option: int


# ---------------------------------------------------------------- Helpers de Datos (Local vs Neon)
async def ensure_user_in_db(env, user: dict, password_hash: str = ""):
    if use_local_db(env):
        if user["user_id"] not in _mem_users:
            _mem_users[user["user_id"]] = {
                "user_id": user["user_id"],
                "username": user["username"],
                "display_name": user["display_name"],
                "password_hash": password_hash,
                "created_at": _ahora(),
            }
        return
    await neon_sql(
        env,
        """
        insert into quiz_users (user_id, username, display_name, password_hash)
        values ($1, $2, $3, $4)
        on conflict (user_id) do update set display_name = excluded.display_name
        """,
        [user["user_id"], user["username"], user["display_name"], password_hash],
    )


async def compute_all_question_stats(env) -> dict[str, dict]:
    """Calcula para cada pregunta cuántas personas eligieron cada opción (0..3) y su porcentaje."""
    counts_by_q: dict[str, list[int]] = {q["id"]: [0, 0, 0, 0] for q in QUESTIONS}

    if use_local_db(env):
        for r in _mem_responses.values():
            qid = r["question_id"]
            opt = r["selected_option"]
            if qid in counts_by_q and 0 <= opt < 4:
                counts_by_q[qid][opt] += 1
    else:
        rows = await neon_sql(
            env,
            "select question_id, selected_option, count(*)::int as cnt from quiz_responses group by question_id, selected_option",
        )
        for row in rows:
            qid = row["question_id"]
            opt = int(row["selected_option"])
            cnt = int(row["cnt"])
            if qid in counts_by_q and 0 <= opt < 4:
                counts_by_q[qid][opt] = cnt

    stats: dict[str, dict] = {}
    for q in QUESTIONS:
        qid = q["id"]
        counts = counts_by_q[qid]
        total = sum(counts)
        correct_idx = q["correct"]
        correct_cnt = counts[correct_idx] if total > 0 else 0
        pcts = [round((c / total) * 100, 1) if total > 0 else 0.0 for c in counts]
        correct_pct = round((correct_cnt / total) * 100, 1) if total > 0 else 0.0
        stats[qid] = {
            "total_responses": total,
            "correct_responses": correct_cnt,
            "correct_pct": correct_pct,
            "option_counts": counts,
            "option_pcts": pcts,
        }
    return stats


async def get_user_responses(env, user_id: str) -> dict[str, dict]:
    if use_local_db(env):
        return {
            r["question_id"]: {
                "selected_option": r["selected_option"],
                "is_correct": r["is_correct"],
                "answered_at": r["answered_at"],
            }
            for (uid, _), r in _mem_responses.items()
            if uid == user_id
        }
    rows = await neon_sql(
        env,
        "select question_id, selected_option, is_correct, answered_at from quiz_responses where user_id = $1",
        [user_id],
    )
    return {
        row["question_id"]: {
            "selected_option": int(row["selected_option"]),
            "is_correct": bool(row["is_correct"]),
            "answered_at": str(row["answered_at"]),
        }
        for row in rows
    }


# ---------------------------------------------------------------- Rutas de API
@app.get("/health")
async def health():
    return {"ok": True, "service": "quiz-redes2-api", "total_questions": len(QUESTIONS)}


@app.post("/api/auth/register", status_code=201)
async def register(body: RegisterBody, request: Request):
    env = get_env(request)
    uname = body.username.strip().lower()
    dname = body.display_name.strip() or uname
    pw = body.password.strip()

    if len(uname) < 2 or len(pw) < 3:
        raise HTTPException(400, "El usuario debe tener al menos 2 caracteres y la contraseña al menos 3.")

    user_id = f"local:{uname}"
    pw_hash = _hash_pw(pw)

    if use_local_db(env):
        if user_id in _mem_users:
            raise HTTPException(409, "Ese nombre de usuario ya está registrado. Probá iniciar sesión.")
        _mem_users[user_id] = {
            "user_id": user_id,
            "username": uname,
            "display_name": dname,
            "password_hash": pw_hash,
            "created_at": _ahora(),
        }
    else:
        existing = await neon_sql(env, "select user_id from quiz_users where username = $1", [uname])
        if existing:
            raise HTTPException(409, "Ese nombre de usuario ya está registrado. Probá iniciar sesión.")
        await neon_sql(
            env,
            "insert into quiz_users (user_id, username, display_name, password_hash) values ($1, $2, $3, $4)",
            [user_id, uname, dname, pw_hash],
        )

    token = create_local_token(env, user_id, uname, dname)
    return {
        "token": token,
        "user": {"user_id": user_id, "username": uname, "display_name": dname},
    }


@app.post("/api/auth/login")
async def login(body: LoginBody, request: Request):
    env = get_env(request)
    uname = body.username.strip().lower()
    pw_hash = _hash_pw(body.password.strip())

    if use_local_db(env):
        user = _mem_users.get(f"local:{uname}")
        if not user or user.get("password_hash") != pw_hash:
            raise HTTPException(401, "Usuario o contraseña incorrectos.")
        u_obj = {"user_id": user["user_id"], "username": user["username"], "display_name": user["display_name"]}
    else:
        rows = await neon_sql(
            env,
            "select user_id, username, display_name, password_hash from quiz_users where username = $1",
            [uname],
        )
        if not rows or rows[0].get("password_hash") != pw_hash:
            raise HTTPException(401, "Usuario o contraseña incorrectos.")
        r0 = rows[0]
        u_obj = {"user_id": r0["user_id"], "username": r0["username"], "display_name": r0["display_name"]}

    token = create_local_token(env, u_obj["user_id"], u_obj["username"], u_obj["display_name"])
    return {"token": token, "user": u_obj}


@app.get("/api/me")
async def me(request: Request, user: dict = Depends(current_user)):
    env = get_env(request)
    await ensure_user_in_db(env, user)
    my_answers = await get_user_responses(env, user["user_id"])
    correct_count = sum(1 for a in my_answers.values() if a["is_correct"])
    answered_count = len(my_answers)
    return {
        "user": user,
        "answered_count": answered_count,
        "correct_count": correct_count,
        "score": correct_count * 10,
        "accuracy_pct": round((correct_count / answered_count) * 100, 1) if answered_count > 0 else 0.0,
        "answers": my_answers,
    }


@app.get("/api/questions")
async def list_questions(request: Request):
    env = get_env(request)
    stats = await compute_all_question_stats(env)
    return [
        {
            **q,
            "stats": stats[q["id"]],
        }
        for q in QUESTIONS
    ]


@app.post("/api/answer")
async def submit_answer(body: AnswerBody, request: Request, user: dict = Depends(current_user)):
    env = get_env(request)
    q = QUESTIONS_BY_ID.get(body.question_id)
    if not q:
        raise HTTPException(404, "Pregunta no encontrada")
    if not (0 <= body.selected_option < len(q["options"])):
        raise HTTPException(400, "Opción fuera de rango")

    await ensure_user_in_db(env, user)
    is_correct = body.selected_option == q["correct"]
    now_str = _ahora()

    if use_local_db(env):
        _mem_responses[(user["user_id"], q["id"])] = {
            "user_id": user["user_id"],
            "question_id": q["id"],
            "selected_option": body.selected_option,
            "is_correct": is_correct,
            "answered_at": now_str,
        }
    else:
        await neon_sql(
            env,
            """
            insert into quiz_responses (user_id, question_id, selected_option, is_correct, answered_at)
            values ($1, $2, $3, $4, now())
            on conflict (user_id, question_id)
            do update set selected_option = excluded.selected_option,
                          is_correct = excluded.is_correct,
                          answered_at = now()
            """,
            [user["user_id"], q["id"], body.selected_option, is_correct],
        )

    all_stats = await compute_all_question_stats(env)
    my_answers = await get_user_responses(env, user["user_id"])
    correct_count = sum(1 for a in my_answers.values() if a["is_correct"])
    answered_count = len(my_answers)

    return {
        "question_id": q["id"],
        "selected_option": body.selected_option,
        "is_correct": is_correct,
        "correct_option": q["correct"],
        "explanation": q["explanation"],
        "stats": all_stats[q["id"]],
        "user_summary": {
            "answered_count": answered_count,
            "correct_count": correct_count,
            "score": correct_count * 10,
            "accuracy_pct": round((correct_count / answered_count) * 100, 1) if answered_count > 0 else 0.0,
        },
    }


@app.post("/api/reset-my-answers")
async def reset_my_answers(request: Request, user: dict = Depends(current_user)):
    env = get_env(request)
    uid = user["user_id"]
    if use_local_db(env):
        keys_to_del = [k for k in _mem_responses if k[0] == uid]
        for k in keys_to_del:
            del _mem_responses[k]
    else:
        await neon_sql(env, "delete from quiz_responses where user_id = $1", [uid])
    return {"ok": True}


@app.get("/api/leaderboard")
async def get_leaderboard(request: Request):
    env = get_env(request)
    total_questions = len(QUESTIONS)

    if use_local_db(env):
        board = []
        for uid, u in _mem_users.items():
            user_resps = [r for (r_uid, _), r in _mem_responses.items() if r_uid == uid]
            answered = len(user_resps)
            if answered == 0:
                continue
            correct = sum(1 for r in user_resps if r["is_correct"])
            acc = round((correct / answered) * 100, 1)
            exam_grade = round((correct / total_questions) * 100, 1)
            board.append({
                "user_id": uid,
                "username": u["username"],
                "display_name": u["display_name"],
                "score": correct * 10,
                "correct_count": correct,
                "answered_count": answered,
                "total_questions": total_questions,
                "accuracy_pct": acc,
                "exam_grade_pct": exam_grade,
            })
        board.sort(key=lambda x: (-x["score"], -x["accuracy_pct"], x["display_name"]))
        for idx, entry in enumerate(board):
            entry["rank"] = idx + 1
        return board

    rows = await neon_sql(
        env,
        """
        select
          u.user_id,
          u.username,
          u.display_name,
          count(r.id)::int as answered_count,
           coalesce(sum(case when r.is_correct then 1 else 0 end), 0)::int as correct_count
        from quiz_users u
        join quiz_responses r on r.user_id = u.user_id
        group by u.user_id, u.username, u.display_name
        order by correct_count desc, answered_count asc, u.display_name asc
        """,
    )
    board = []
    for idx, r in enumerate(rows):
        ans = int(r["answered_count"])
        corr = int(r["correct_count"])
        acc = round((corr / ans) * 100, 1) if ans > 0 else 0.0
        exam_grade = round((corr / total_questions) * 100, 1)
        board.append({
            "rank": idx + 1,
            "user_id": r["user_id"],
            "username": r["username"],
            "display_name": r["display_name"],
            "score": corr * 10,
            "correct_count": corr,
            "answered_count": ans,
            "total_questions": total_questions,
            "accuracy_pct": acc,
            "exam_grade_pct": exam_grade,
        })
    return board
