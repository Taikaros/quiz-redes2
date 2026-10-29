"""API de Cuestionario y Leaderboard — Comunicaciones y Redes II (FCEQyN - UNaM).

Basado en la arquitectura de taller-jcsa-2026:
- FastAPI sobre Cloudflare Python Workers (`WorkerEntrypoint` + `asgi`)
- Base de datos serverless Neon (PostgreSQL vía HTTP `/sql`) o simulación en memoria (`MODO_LOCAL=1`)
- Autenticación de participantes mediante tokens RS256 de Clerk.
- Vinculación de cuentas legadas para conservar las respuestas ya registradas.
"""
import hashlib
import hmac
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse

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
        dev_vars = Path(__file__).resolve().parent.parent / ".dev.vars"
        if dev_vars.exists():
            for line in dev_vars.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                setattr(self, k.strip(), v.strip())
        for k in ("MODO_LOCAL", "DATABASE_URL", "NEON_CONNECTION_STRING", "CLERK_ISSUER", "CLERK_JWKS_URL"):
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
    {
        "id": "tp1-1",
        "unit": "TP 01 / Lab 01: Dispositivos y Dimensionamiento",
        "style": "Dominios y Equipos OSI",
        "question": "Un switch Capa 2 de 24 puertos tiene todos sus puertos asignados a la VLAN por defecto (VLAN 1) y conectados a distintas PCs. ¿Cuántos dominios de colisión y cuántos dominios de broadcast existen en ese switch?",
        "options": [
            "1 único dominio de colisión compartido y 1 único dominio de broadcast general.",
            "24 dominios de colisión independientes y 1 único dominio de broadcast compartido.",
            "1 único dominio de colisión compartido y 24 dominios de broadcast independientes.",
            "24 dominios de colisión independientes y 24 dominios de broadcast separados."
        ],
        "correct": 1,
        "explanation": "Un Switch L2 microsegmenta la red creando 1 dominio de colisión independiente por cada puerto. Sin embargo, las tramas Broadcast (FF:FF:FF:FF:FF:FF) se inundan por todos los puertos de la misma VLAN, formando 1 único dominio de broadcast."
    },
    {
        "id": "tp1-2",
        "unit": "TP 01 / Lab 01: Dispositivos y Dimensionamiento",
        "style": "Funcionamiento Switch y ARP",
        "question": "¿Qué acción toma un Switch Capa 2 cuando recibe una trama cuya dirección MAC de destino NO se encuentra aún en su tabla CAM (MAC Address Table)?",
        "options": [
            "Aprende la MAC origen en la tabla CAM e inunda la trama por los demás puertos de esa VLAN.",
            "Descarta la trama inmediatamente en el buffer de entrada y devuelve un error ICMP al host emisor.",
            "Consulta la dirección física al router de puerta de enlace predeterminada generando una petición ARP.",
            "Retiene la trama en cola y la reenvía únicamente a través del puerto troncal principal (Uplink)."
        ],
        "correct": 0,
        "explanation": "El switch construye su tabla CAM inspeccionando siempre la MAC Origen de cada trama entrante. Si la MAC Destino es desconocida (Unicast desconocido) o Broadcast, aplica inundación (flooding) por todos los puertos de esa misma VLAN excepto por el de ingreso."
    },
    {
        "id": "tp1-3",
        "unit": "TP 01 / Lab 01: Dispositivos y Dimensionamiento",
        "style": "Dimensionamiento y Cálculo",
        "question": "Se desea transferir un archivo de 150 MB entre dos estaciones a través de un enlace FastEthernet (100 Mbps). ¿Cuál es el tiempo teórico mínimo de transferencia y por qué el tiempo real será mayor?",
        "options": [
            "1,5 segundos teóricos (150 MB / 100 Mbps); en la práctica tarda más por la atenuación del cable UTP.",
            "12 s teóricos (1200 Mbits / 100 Mbps); el real es mayor por cabeceras L2-L4, IFG, ACKs y contienda.",
            "15 segundos teóricos (1500 Mbits / 100 Mbps); el real es mayor porque STP reserva 20% para tramas BPDU.",
            "120 segundos teóricos (12000 Mbits / 100 Mbps); el real es mayor por los bits de paridad de Capa 1."
        ],
        "correct": 1,
        "explanation": "Cálculo del TP 01: 150 MB × 8 bits/Byte = 1200 Mbits. Dividiendo por el ancho de banda nominal: 1200 Mbps / 100 Mbps = 12 segundos teóricos. En la práctica es mayor por cabeceras L2/L3/L4, Interframe Gap (IFG) y confirmaciones TCP."
    },
    {
        "id": "tp1-4",
        "unit": "TP 01 / Lab 01: Dispositivos y Dimensionamiento",
        "style": "Dimensionamiento y Cálculo",
        "question": "Necesitás adquirir un Switch de acceso GigabitEthernet de 48 puertos que garantice conmutación Wire-Speed (Non-Blocking) en modo Full-Duplex. ¿Cuál debe ser la capacidad mínima de su matriz de conmutación (Backplane)?",
        "options": [
            "192 Gbps (48 puertos × 2 Gbps × 2 incluyendo reserva de Uplink)",
            "24 Gbps (aplicando factor de simultaneidad del 50% en acceso)",
            "96 Gbps (48 puertos × 1 Gbps × 2 por operación simultánea Tx/Rx)",
            "48 Gbps (1 Gbps por cada puerto activo en sentido unidireccional)"
        ],
        "correct": 2,
        "explanation": "Fórmula Backplane Non-Blocking Full-Duplex: N° Puertos × Velocidad × 2. Para 48 puertos de 1 Gbps que transmiten y reciben simultáneamente: 48 × 1 Gbps × 2 = 96 Gbps (y para 24 puertos GbE es 48 Gbps)."
    },
    {
        "id": "tp1-5",
        "unit": "TP 01 / Lab 01: Dispositivos y Dimensionamiento",
        "style": "Dimensionamiento y Cálculo",
        "question": "Un switch de capa de acceso posee 48 puertos de 1 Gbps para puestos de trabajo y se diseña aplicando una relación de sobresuscripción (oversubscription) estándar de 20:1 hacia distribución. ¿Qué ancho de banda de Uplink requiere como mínimo?",
        "options": [
            "0,5 Gbps mínimos (cubierto con un puerto FastEthernet en modo Full-Duplex)",
            "48 Gbps mínimos en el troncal (relación directa 1:1 sin sobresuscripción)",
            "9,6 Gbps mínimos (calculado sobre el backplane total de 96 Gbps dividido 10)",
            "2,4 Gbps mínimos (48 Gbps / 20, cubierto con un enlace de 2.5G o 10G SFP+)"
        ],
        "correct": 3,
        "explanation": "Capacidad total de acceso = 48 × 1 Gbps = 48 Gbps. Con relación de sobresuscripción 20:1: 48 Gbps / 20 = 2,4 Gbps (cubierto comercialmente con un uplink 2.5G o 10G SFP+)."
    },
    {
        "id": "tp1-6",
        "unit": "TP 01 / Lab 01: Dispositivos y Dimensionamiento",
        "style": "Dominios y Equipos OSI",
        "question": "¿En qué capa del modelo OSI opera un Router (o Switch Capa 3) y cuál es su diferencia clave frente a un Switch Capa 2 respecto a los dominios?",
        "options": [
            "Opera en Capa 1 (Física); regenera la señal eléctrica y unifica todos los dominios de colisión y broadcast.",
            "Opera en Capa 2 (Enlace); mantiene un único dominio de broadcast global y reenvía tramas ARP hacia Internet.",
            "Opera en Capa 4 (Transporte); filtra únicamente por dirección física MAC de origen sin procesar cabeceras IP.",
            "Opera en Capa 3 (Red); separa dominios de colisión y de broadcast, enrutando por Dirección IP Destino."
        ],
        "correct": 3,
        "explanation": "Un Router o Switch L3 desencapsula la trama de enlace, no propaga tramas broadcast L2 hacia otras redes y toma decisiones de encaminamiento consultando su tabla de rutas por IP Destino."
    },
    {
        "id": "tp1-7",
        "unit": "TP 01 / Lab 01: Dispositivos y Dimensionamiento",
        "style": "Dominios y Equipos OSI",
        "question": "Según la tabla de análisis de equipamiento (TP 01 Actividad 1), ¿en qué capa OSI operan un Access Point (AP), un Bridge y un Firewall, y cómo afectan a los dominios de colisión y de broadcast?",
        "options": [
            "AP en Capa 2 (1 dominio CSMA/CA por radio) y Bridge en Capa 2 separan colisiones; Firewall en Capa 3–4+ separa ambos.",
            "AP, Bridge y Firewall operan en Capa 2 creando un dominio de colisión exclusivo por cada estación conectada.",
            "AP en Capa 1 como repetidor de radiofrecuencia; Bridge en Capa 3 enrutando IP; Firewall en Capa 2 filtrando MAC.",
            "AP en Capa 3 separando broadcast; Bridge en Capa 1 uniendo colisiones; Firewall en Capa 2 sin separar dominios."
        ],
        "correct": 0,
        "explanation": "En la arquitectura jerárquica: los equipos de Capa 1 (Hub/Repetidor) no separan nada; los de Capa 2 (Bridge, Switch L2, AP) separan dominios de colisión (en el AP, todos los clientes de una misma radio comparten 1 dominio CSMA/CA); y los de Capa 3+ (Switch L3, Router, Firewall) separan dominios de broadcast."
    },
    {
        "id": "tp1-8",
        "unit": "TP 01 / Lab 01: Dispositivos y Dimensionamiento",
        "style": "Funcionamiento Switch y ARP",
        "question": "En el análisis del funcionamiento del Switch (Lab 01 Actividad 5), ¿cuál es la diferencia entre los tres métodos de reenvío de tramas: Store-and-Forward, Cut-Through y Fragment-Free?",
        "options": [
            "Store-and-Forward omite el CRC; Cut-Through guarda toda la trama en RAM; Fragment-Free desencapsula el paquete IP.",
            "Store-and-Forward valida el FCS completo; Cut-Through lee la MAC destino; Fragment-Free lee los primeros 64 B.",
            "Los tres métodos almacenan la trama completa pero difieren únicamente en el tiempo de retención de la tabla CAM.",
            "Store-and-Forward lee solo 14 bytes; Cut-Through valida el CRC-32 final; Fragment-Free fragmenta paquetes de Capa 3."
        ],
        "correct": 1,
        "explanation": "Store-and-Forward (el más utilizado) garantiza integridad verificando el FCS (CRC-32) al final de la trama completa. Cut-Through prioriza mínima latencia leyendo solo la MAC destino, y Fragment-Free inspecciona los primeros 64 bytes para descartar fragmentos de colisión (runts)."
    },
    {
        "id": "tp1-9",
        "unit": "TP 01 / Lab 01: Dispositivos y Dimensionamiento",
        "style": "Funcionamiento Switch y ARP",
        "question": "En el Laboratorio 01, ¿por qué el primer ping entre dos PCs suele perder el primer paquete en el simulador, cuánto tiempo duran las entradas dinámicas en la tabla MAC del switch y con qué comandos se consulta y se vacía dicha tabla?",
        "options": [
            "Por la negociación de velocidad UTP; las MAC duran 30 s, se ven con 'show ip route' y se borran con 'reload'.",
            "Porque STP recalcula costos en cada ping; las MAC duran 3600 s y se gestionan desde la PC con 'ipconfig /flushdns'.",
            "Porque el switch descarta el primer ICMP por seguridad; las MAC son permanentes y solo se borran apagando el equipo.",
            "Por la consulta inicial ARP (Broadcast); las MAC DYNAMIC duran 300 s (show/clear mac address-table)."
        ],
        "correct": 3,
        "explanation": "Antes de enviar el ICMP Echo Request, la PC necesita resolver la MAC destino mediante un ARP Request (Broadcast). El switch aprende las MAC con tipo DYNAMIC (envejecimiento = 300 s), verificable con 'show mac address-table' y borrable con 'clear mac address-table dynamic'."
    },
    {
        "id": "tp1-10",
        "unit": "TP 01 / Lab 01: Dispositivos y Dimensionamiento",
        "style": "Dimensionamiento y Cálculo",
        "question": "¿Por qué en la Actividad 5d del Lab 01 la tercera PC queda incomunicada en el escenario del Repetidor, y qué capacidad de Uplink requiere un Switch de 24 puertos Gigabit si se pide una relación 1:1 (sin sobresuscripción)?",
        "options": [
            "Porque el repetidor bloquea el puerto por Spanning Tree; y un Uplink 1:1 de 24 puertos GbE requiere 10 Gbps.",
            "Porque el repetidor exige cable cruzado en el tercer puerto; y un Uplink 1:1 de 24 puertos GbE requiere 48 Gbps.",
            "Porque el repetidor filtra la tercera IP por seguridad; un Uplink 1:1 de 24 puertos GbE requiere 1,2 Gbps.",
            "Porque un Repetidor solo tiene 2 puertos físicos punto a punto; y un Uplink 1:1 para 24 puertos GbE requiere 24 Gbps."
        ],
        "correct": 3,
        "explanation": "Un repetidor simple solo posee 2 puertos físicos (un Hub es un repetidor multipuerto). En el TP 01 Act. 4, un switch de 24 puertos GbE tiene Backplane = 24 × 1 × 2 = 48 Gbps y un Uplink sin sobresuscripción (1:1) = 24 × 1 Gbps / 1 = 24 Gbps (cubierto con puerto de 25G/40G o LACP)."
    },
    {
        "id": "lab2-1",
        "unit": "Lab 02: Cableado Estructurado TIA/EIA-568",
        "style": "Cableado Físico TIA-568",
        "question": "Según la norma ANSI/TIA/EIA-568, ¿cuál es la longitud máxima permitida para el Canal Horizontal completo y cómo se distribuye entre el cable fijo y los patch cords?",
        "options": [
            "120 m totales: hasta 100 m de Enlace Permanente fijo más 20 m adicionales permitidos para patch cords.",
            "90 m totales: hasta 85 m de Enlace Permanente en bandeja y hasta 5 m combinados para ambos patch cords.",
            "150 m totales cuando se utiliza cable UTP Categoría 6A blindado entre el patch panel y el puesto de trabajo.",
            "100 m totales: hasta 90 m de Enlace Permanente (cable sólido fijo) y hasta 10 m combinados para patch cords."
        ],
        "correct": 3,
        "explanation": "El canal horizontal completo no debe superar los 100 m: máximo 90 m para el enlace permanente (desde el patch panel hasta la roseta RJ-45 de pared) y máximo 10 m combinados para los patch cords flexibles."
    },
    {
        "id": "lab2-2",
        "unit": "Lab 02: Cableado Estructurado TIA/EIA-568",
        "style": "Cableado Físico TIA-568",
        "question": "Al armar una ficha RJ-45 bajo la norma T568B, ¿qué colores van ubicados en los pines 1, 2, 3 y 6 respectivamente?",
        "options": [
            "1: Blanco/Naranja, 2: Naranja, 3: Blanco/Azul, 6: Azul (pares continuos)",
            "1: Blanco/Naranja, 2: Naranja, 3: Blanco/Verde, 6: Verde (norma T568B)",
            "1: Blanco/Verde, 2: Verde, 3: Blanco/Marrón, 6: Marrón (pares extremos)",
            "1: Blanco/Verde, 2: Verde, 3: Blanco/Naranja, 6: Naranja (norma T568A)"
        ],
        "correct": 1,
        "explanation": "Secuencia T568B (pines 1 al 8): 1-Blanco/Naranja, 2-Naranja, 3-Blanco/Verde, 4-Azul, 5-Blanco/Azul, 6-Verde, 7-Blanco/Marrón, 8-Marrón. (T568A intercambia los pares Verde y Naranja)."
    },
    {
        "id": "lab2-3",
        "unit": "Lab 02: Cableado Estructurado TIA/EIA-568",
        "style": "Cableado Físico TIA-568",
        "question": "¿Qué topología física y lógica especifica la norma TIA/EIA-568 para el subsistema horizontal y qué tipo de cable se emplea para unir una PC a la roseta o el Patch Panel al Switch?",
        "options": [
            "Topología en Malla jerárquica; requiere cable cruzado en la patchera y cable directo en el área de trabajo.",
            "Topología física en Bus y lógica en Estrella; requiere cable cruzado (T568A a T568B) en ambos tramos.",
            "Topología física en Estrella y lógica en Estrella; requiere cable directo (misma norma en ambos extremos).",
            "Topología física en Anillo y lógica en Estrella; requiere cable consola transpuesto (Rollover) de 8 pines."
        ],
        "correct": 2,
        "explanation": "El subsistema horizontal se diseña en Estrella física y lógica. Para interconectar equipos de distinta naturaleza (PC a Switch) se utiliza cable directo manteniendo la misma norma en ambos extremos."
    },
    {
        "id": "lab2-4",
        "unit": "Lab 02: Cableado Estructurado TIA/EIA-568",
        "style": "Cableado Físico TIA-568",
        "question": "En el armado de patchcords (Lab 02 Actividad 1), ¿cuándo se usa un cable cruzado (568A–568B), qué pines se utilizan en 10/100 Mbps frente a 1 Gbps y cuál es el destrenzado máximo permitido al colocar el conector RJ-45?",
        "options": [
            "Une PC con Switch; usa los 8 hilos en 100 Mbps y permite hasta 50 mm de destrenzado antes del conector.",
            "Une teléfonos IP al Switch; usa solo los pines centrales 4 y 5 en 1 Gbps sin restricción de destrenzado.",
            "Une Switch con Router; invierte los pares azul y marrón en 1 Gbps, con destrenzado máximo de hasta 35 mm.",
            "Une equipos iguales (o PC–Router); usa pines 1,2,3,6 en 100M y 1–8 en 1G, con destrenzado ≤ 13 mm."
        ],
        "correct": 3,
        "explanation": "Un cable cruzado (T568A en una punta y T568B en la otra) une equipos de igual capa (PC–PC, Switch–Switch, Router–Router y PC–Router sin Auto-MDIX). En 10/100M usa 2 pares (1–2 Tx y 3–6 Rx) y en 1G los 4 pares (1–8). El destrenzado máximo es ≤ 13 mm (media pulgada) para evitar diafonía (NEXT)."
    },
    {
        "id": "lab2-5",
        "unit": "Lab 02: Cableado Estructurado TIA/EIA-568",
        "style": "Cableado Físico TIA-568",
        "question": "¿Qué ancho de banda y velocidades soportan las categorías UTP Cat 5e, Cat 6 y Cat 6A, qué secuencia muestra el tester en un cable cruzado y qué falla se conoce como 'par partido' (split pair)?",
        "options": [
            "Cat 5e (250 MHz, 10G a 100m), Cat 6 (500 MHz); el cruzado marca 1–8 lineal y 'split pair' es un hilo cortado.",
            "Cat 5e (100 MHz, 1G), Cat 6 (250 MHz, 10G a 55m), Cat 6A (500 MHz, 10G a 100m); split pair mezcla pares.",
            "Cat 5e, 6 y 6A operan a 100 MHz; el tester en cable cruzado enciende del 8 al 1 y 'split pair' es un cortocircuito.",
            "Cat 5e (50 MHz, 100M), Cat 6 (100 MHz, 1G) y Cat 6A (250 MHz, 2.5G); el tester detecta 'split pair' como pin abierto."
        ],
        "correct": 1,
        "explanation": "Cat 5e = 100 MHz (1G a 100m), Cat 6 = 250 MHz (10G hasta ~55m), Cat 6A = 500 MHz (10G a 100m). En un cruzado el tester muestra 1-3, 2-6, 3-1, 6-2 (y 4-4, 5-5, 7-7, 8-8). El 'split pair' tiene continuidad pin a pin pero mezcla hilos de distintos pares, generando altísima diafonía."
    },
    {
        "id": "lab2-6",
        "unit": "Lab 02: Cableado Estructurado TIA/EIA-568",
        "style": "Cableado Físico TIA-568",
        "question": "En la Actividad 5 del Lab 02 (Esquema de red en edificio), ¿cuáles son los 6 subsistemas del cableado estructurado ANSI/TIA-568 y qué función cumplen el Patch Panel, el IDF y el MDF?",
        "options": [
            "Cableado de Cobre, Fibra, Wi-Fi, Coaxial, Satelital y Telefónico; el IDF es el módem de internet y el MDF el switch.",
            "Existen 3 subsistemas (PC, Rack y Router); el Patch Panel amplifica la señal y el MDF se instala en cada oficina.",
            "Área de Trabajo, Horizontal, IDF (piso), Vertical/Backbone, MDF (sala principal) y Entrada de Servicios; el Patch Panel termina el cable fijo.",
            "Solo se definen el Cableado Horizontal entre pisos y el Cableado Vertical del escritorio al switch sin usar Patch Panel."
        ],
        "correct": 2,
        "explanation": "Los 6 subsistemas son: Área de Trabajo, Cableado Horizontal, Sala de Telecomunicaciones (IDF de cada piso), Cableado Vertical/Backbone (fibra entre pisos), Sala de Equipos (MDF principal) y Entrada de Servicios. El Patch Panel termina el cable fijo horizontal para administrar cambios con patch cords."
    },
    {
        "id": "tp3-1",
        "unit": "TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP",
        "style": "VLANs y Troncales 802.1Q",
        "question": "Cuando una trama Ethernet atraviesa un enlace Troncal (Trunk) bajo el estándar IEEE 802.1Q, ¿dónde se inserta la etiqueta de VLAN, cuántos bytes mide y cómo afecta al tamaño máximo de trama y al FCS?",
        "options": [
            "Se inserta entre MAC Origen y EtherType; mide 4 B (0x8100 + TCI), sube a 1522 B y recalcula el FCS.",
            "Se agrega al final después del FCS; mide 2 bytes, mantiene la trama en 1518 B y conserva el FCS original.",
            "Se inserta delante del Preámbulo; mide 8 bytes, reduce la carga útil a 1492 B y no requiere recalcular el FCS.",
            "Reemplaza la dirección MAC de Origen por el número de VLAN; mide 6 bytes y mantiene la trama máxima en 1518 B."
        ],
        "correct": 0,
        "explanation": "La etiqueta IEEE 802.1Q de 4 bytes se inserta entre MAC Origen y EtherType/Longitud. Está formada por TPID (0x8100, 2B) y TCI (PCP 3b + DEI 1b + VID 12b, 2B), sube la trama máxima de 1518 a 1522 bytes y obliga a recalcular el FCS."
    },
    {
        "id": "tp3-2",
        "unit": "TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP",
        "style": "VLANs y Troncales 802.1Q",
        "question": "Dentro de la etiqueta IEEE 802.1Q, el subcampo VID (VLAN Identifier) tiene 12 bits. ¿Cuántas VLANs utilizables permite direccionar y por qué?",
        "options": [
            "4096 VLANs utilizables en total, numeradas de forma continua desde la VLAN 0 hasta la VLAN 4095.",
            "4094 VLANs utilizables (1 a 4094), porque los valores extremos 0 y 4095 (0xFFF) están reservados.",
            "2048 VLANs utilizables, dado que la mitad superior del campo se emplea para prioridad de tráfico QoS.",
            "1024 VLANs utilizables (1 a 1024), porque los primeros 2 bits se reservan para el protocolo Spanning Tree."
        ],
        "correct": 1,
        "explanation": "Con 12 bits existen 2^12 = 4096 combinaciones (0 a 4095). Como las VLANs 0 (prioridad 802.1p sin VLAN) y 4095 (0xFFF, uso interno) están reservadas por el estándar, quedan 4094 VLANs válidas."
    },
    {
        "id": "tp3-3",
        "unit": "TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP",
        "style": "Spanning Tree (STP/RSTP/PVST+)",
        "question": "En una topología de tres switches (S1, S2 y S3) con configuración de fábrica (prioridad STP por defecto = 32768 + VLAN 1 = 32769), ¿qué criterio utiliza Spanning Tree (802.1D) para elegir al Root Bridge y qué riesgo operativo implica?",
        "options": [
            "Elige al switch con la dirección MAC numéricamente más alta, garantizando que gane el equipo de fabricación más reciente.",
            "Elige al switch con mayor cantidad de puertos Gigabit activos, optimizando automáticamente el tráfico troncal.",
            "Elige al switch con la dirección MAC numéricamente más baja, pudiendo dejar al equipo más viejo y lento como raíz.",
            "Elige al primer switch que completó el encendido eléctrico y envió la primera trama de anuncio en la VLAN 1."
        ],
        "correct": 2,
        "explanation": "Gana el menor Bridge ID = Prioridad + MAC. Si el administrador deja la prioridad por defecto en todos los switches, desempata la menor dirección MAC en hexadecimal, que suele corresponder al switch más antiguo de la red."
    },
    {
        "id": "tp3-4",
        "unit": "TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP",
        "style": "Spanning Tree (STP/RSTP/PVST+)",
        "question": "Caso del Lab 03: S1 es el Root Bridge y se conecta a S2 y S3 mediante enlaces FastEthernet (100 Mbps, costo 19). A su vez, S2 y S3 están unidos entre sí por un enlace GigabitEthernet (1 Gbps, costo 4). ¿Por qué STP bloquea un extremo del enlace Gigabit entre S2 y S3?",
        "options": [
            "Porque STP clásico 802.1D no reconoce interfaces GigabitEthernet y las bloquea por incompatibilidad de velocidad.",
            "Porque el algoritmo Spanning Tree bloquea por diseño el enlace de menor costo para reservarlo como backup.",
            "Porque desde S2 y S3 ir directo a S1 por FastEthernet cuesta 19, menor que ir vía el otro switch (23).",
            "Porque los puertos GigabitEthernet tienen asignada una prioridad de puerto superior (256) frente a FastEthernet."
        ],
        "correct": 2,
        "explanation": "STP elige Root Ports mirando el costo acumulado hacia el Root Bridge (S1). Como desde S2 y S3 hacia S1 el camino directo por FastEthernet cuesta 19 (menor que 4 + 19 = 23), el enlace Gigabit entre S2 y S3 queda como redundante y se bloquea en un extremo."
    },
    {
        "id": "tp3-5",
        "unit": "TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP",
        "style": "Spanning Tree (STP/RSTP/PVST+)",
        "question": "Si dos switches se conectan entre sí mediante dos cables FastEthernet en paralelo (Fa0/1 con Fa0/1 y Fa0/2 con Fa0/2), ¿cuál de los dos puertos se bloqueará en el switch no designado y por qué?",
        "options": [
            "Se bloquea Fa0/1 (128.1) porque Spanning Tree reserva siempre el primer puerto físico para gestión SNMP.",
            "Se bloquea Fa0/1 (128.1) porque en caso de empate de costo, STP elige el puerto con numeración física más alta.",
            "Se bloquean ambos puertos simultáneamente por detección de bucle hasta que el administrador configure EtherChannel.",
            "Se bloquea Fa0/2 (128.2) porque ante igual Bridge ID y costo de ruta, gana como Root Port el menor Port ID (128.1)."
        ],
        "correct": 3,
        "explanation": "Ante empate de Bridge ID y costo de ruta en enlaces paralelos, desempata el menor Port ID (Prioridad de puerto 128 + N° de puerto). Gana Fa0/1 (128.1) como Root Port y se bloquea Fa0/2 (128.2)."
    },
    {
        "id": "tp3-6",
        "unit": "TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP",
        "style": "Spanning Tree (STP/RSTP/PVST+)",
        "question": "¿Cuál es la diferencia fundamental en tiempos y estados de convergencia entre STP clásico (IEEE 802.1D) y RSTP (IEEE 802.1w)?",
        "options": [
            "RSTP elimina la elección de Root Bridge y permite múltiples caminos activos sin bloquear ningún puerto físico.",
            "Ambos protocolos tardan 30 s en converger, pero RSTP solo opera sobre enlaces troncales de fibra óptica monomodo.",
            "STP tarda 30–50 s (Blocking→Listening 15s→Learning 15s→Forwarding); RSTP converge en <1–2 s con Proposal/Agreement.",
            "STP converge en 1 s mediante negociación activa y RSTP tarda 50 s porque recalcula topologías por cada VLAN."
        ],
        "correct": 2,
        "explanation": "STP clásico espera temporizadores pasivos (30 a 50 s). RSTP (802.1w) unifica Blocking/Disabled/Listening en Discarding (Discarding → Learning → Forwarding), agrega los roles Alternate/Backup y usa sincronización activa Proposal/Agreement para converger en < 1 a 2 segundos."
    },
    {
        "id": "tp3-7",
        "unit": "TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP",
        "style": "Spanning Tree (STP/RSTP/PVST+)",
        "question": "¿Qué comando de Cisco IOS en modo de configuración global fuerza a un switch para convertirse en el Puente Raíz (Root Bridge) primario de la VLAN 1?",
        "options": [
            "Switch(config)# spanning-tree vlan 1 root primary",
            "Switch(config)# spanning-tree portfast root default",
            "Switch(config)# switchport trunk root-bridge vlan 1",
            "Switch(config)# vlan 1 spanning-tree root-bridge enable"
        ],
        "correct": 0,
        "explanation": "El comando 'spanning-tree vlan 1 root primary' (o 'spanning-tree vlan 1 priority 4096') reduce la prioridad BID del switch para garantizar que gane la elección de Root Bridge en esa VLAN."
    },
    {
        "id": "tp3-8",
        "unit": "TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP",
        "style": "VLANs y Troncales 802.1Q",
        "question": "¿Qué secuencia de comandos Cisco IOS configura correctamente la interfaz GigabitEthernet 0/1 como enlace Troncal (Trunk) con la VLAN 99 como nativa?",
        "options": [
            "interface g0/1 -> switchport mode access -> switchport access vlan 99",
            "interface g0/1 -> switchport mode trunk -> switchport trunk native vlan 99",
            "interface g0/1 -> trunk encapsulation enable -> native-vlan 99 active",
            "vlan 99 native -> interface g0/1 -> switchport trunk allowed vlan 99"
        ],
        "correct": 1,
        "explanation": "En Cisco IOS se ingresa a la interfaz ('interface g0/1'), se define el modo troncal ('switchport mode trunk') y se especifica la VLAN sin etiquetar ('switchport trunk native vlan 99')."
    },
    {
        "id": "tp3-9",
        "unit": "TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP",
        "style": "Tramas y Estándares IEEE 802.3",
        "question": "En la estructura de la trama Ethernet (TP 03 Actividad 2), ¿por qué el tamaño mínimo de trama es de 64 bytes (con 46 bytes mínimos de datos), cuánto mide la separación entre tramas (IFG) y cómo distingue el receptor si el campo de 2 bytes indica EtherType o Longitud?",
        "options": [
            "64 B es el tamaño del buffer de un Hub; el IFG mide 4 B y el campo de 2 B siempre indica la longitud total en bytes.",
            "64 B garantiza detectar colisiones CSMA/CD a tiempo; el IFG mide 12 B; y el campo ≥ 0x0600 (1536) es EtherType y ≤ 1500 es Longitud.",
            "64 B se exige solo en enlaces Full-Duplex; el IFG mide 8 B; y el campo de 2 B contiene la dirección IP del gateway.",
            "64 B incluye los 8 B de preámbulo; el IFG mide 64 B; y el campo ≤ 1500 indica protocolo IPv4 (0x0800) o ARP (0x0806)."
        ],
        "correct": 1,
        "explanation": "Trama Ethernet: Preámbulo (7B) + SFD (1B, 10101011) + MAC Destino (6B) + MAC Origen (6B) + EtherType/Longitud (2B: ≥ 0x0600 es EtherType, ≤ 1500 es Longitud 802.3) + Payload (46–1500B, con relleno/padding si < 46B para garantizar 64B mínimos en CSMA/CD) + FCS (4B). IFG = 12 bytes."
    },
    {
        "id": "tp3-10",
        "unit": "TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP",
        "style": "Tramas y Estándares IEEE 802.3",
        "question": "Según la Actividad 3 del TP 03 (Estado actual de las normas IEEE), ¿qué ocurrió con los estándares IEEE 802.1D (STP), 802.1w (RSTP), 802.2 (LLC), 802.3ad (LACP) y las enmiendas con letras de 802.3?",
        "options": [
            "802.1Q absorbió 802.1D/w; 802.2 fue retirado; 802.3ad pasó a 802.1AX; y las letras se unieron a 802.3-2022.",
            "802.1D absorbió a 802.1Q; LACP fue eliminado del estándar; y cada velocidad Ethernet mantiene su propio comité independiente.",
            "Todos continúan publicándose como estándares separados y activos sin cambios estructurales desde su creación.",
            "802.1Q fue reemplazado por 802.2; 802.3ad fue absorbido por 802.1D; y las enmiendas con letras fueron anuladas."
        ],
        "correct": 0,
        "explanation": "Regla clave de IEEE: las enmiendas con minúsculas (802.3u, 802.3ab, 802.3ae, etc.) se fusionan en el estándar base 802.3-2022 al aprobarse. Además, STP/RSTP pasaron a 802.1Q-2022, LACP pasó a 802.1AX y 802.2 (LLC) está retirado/inactivo."
    },
    {
        "id": "tp3-11",
        "unit": "TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP",
        "style": "Tramas y Estándares IEEE 802.3",
        "question": "¿Qué introdujeron específicamente en la evolución de Ethernet los subestándares IEEE 802.3x, 802.3ac, 802.3ah, 802.3ak, 802.3bz y 802.3df?",
        "options": [
            "802.3x: FastEthernet; 802.3ac: Gigabit en cobre; 802.3ah: LACP; 802.3ak: RSTP; 802.3bz: PoE++; 802.3df: 10GBASE-T.",
            "802.3x: Full-Duplex; .3ac: VLAN 1522B; .3ah: EFM/EPON; .3ak: CX4; .3bz: 2.5G/5G; .3df: 400G y 800G.",
            "802.3x: VLANs; 802.3ac: Wi-Fi 5; 802.3ah: PoE+; 802.3ak: fibra monomodo 40 km; 802.3bz: 100G; 802.3df: coaxial.",
            "802.3x: CSMA/CD; 802.3ac: Jumbo Frames de 9000 B; 802.3ah: GPON; 802.3ak: fibra OM4; 802.3bz: 1G; 802.3df: Wi-Fi 7."
        ],
        "correct": 1,
        "explanation": "Cada enmienda resolvió un hito: 802.3x habilitó Full-Duplex y control de flujo PAUSE; 802.3ac sumó los 4 B del tag VLAN (1522 B); 802.3ah llevó Ethernet a última milla (EFM); 802.3ak definió 10GBASE-CX4 twinaxial; 802.3bz permitió 2.5G/5G sobre Cat 5e/6; y 802.3df (2024) estandarizó 400G/800G."
    },
    {
        "id": "tp3-12",
        "unit": "TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP",
        "style": "Spanning Tree (STP/RSTP/PVST+)",
        "question": "Actividad 8 del Escenario 2 (Lab 03): Con el troncal Gi0/1 habilitado entre S2 y S3, se configura a S1 como raíz primaria de las VLAN 10 y 30 (secundaria de la 20) y a S2 como raíz primaria de la VLAN 20 (secundaria de la 10 y 30). ¿Qué puerto se bloquea en cada VLAN y qué beneficio aporta?",
        "options": [
            "Se bloquea Gi0/1 en todas las VLANs por igual, ya que Spanning Tree ejecuta una única instancia común para todo el switch.",
            "VLAN 20 bloquea S2 Gi0/1 por ser el puente raíz y las VLAN 10/30 dejan en Forwarding los tres enlaces formando un anillo.",
            "VLAN 10/30 bloquean S3 Gi0/1 y VLAN 20 bloquea S1 Fa0/3, logrando balanceo de carga en Capa 2 con PVST+ sobre todos los enlaces.",
            "VLAN 10/30 bloquean los enlaces FastEthernet de S1 y todas las VLANs conmutan únicamente por el troncal Gigabit S2–S3."
        ],
        "correct": 2,
        "explanation": "PVST+ ejecuta una instancia STP independiente por cada VLAN. En VLAN 10 y 30 (raíz S1) se bloquea S3 Gi0/1; en VLAN 20 (raíz S2) S3 llega a S2 por Gi0/1 (costo 4 < 19) y se bloquea S1 Fa0/3. Así se aprovechan todos los enlaces físicos sin bucles."
    },
    {
        "id": "tp3-13",
        "unit": "TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP",
        "style": "VLANs y Troncales 802.1Q",
        "question": "En el Escenario 2 del Lab 03, ¿cuáles son los rangos de VLAN normal y extendido en Cisco IOS, por qué en el switch Catalyst 2960 NO se usa 'switchport trunk encapsulation dot1q' y cómo se crea la interfaz de gestión (SVI) en la VLAN 99?",
        "options": [
            "Normal 1–500 y extendido 501–2000; el 2960 usa ISL por defecto y la SVI se asigna sobre el puerto físico Fa0/24.",
            "Normal 1–4094 guardado en running-config; el 2960 no soporta troncales y la SVI enruta tráfico entre VLAN 10 y VLAN 20.",
            "Normal 2–1000 y extendido 1001–4096; la VLAN 1 debe eliminarse antes de crear la SVI con 'ip default-gateway 99'.",
            "Normal 1–1005 (en vlan.dat) y extendido 1006–4094; el 2960 solo admite 802.1Q; SVI en interface vlan 99."
        ],
        "correct": 3,
        "explanation": "Las VLANs de rango normal (1–1005) se guardan en vlan.dat (la 1 no se puede borrar) y las extendidas son 1006–4094. El Catalyst 2960 solo soporta 802.1Q (por eso basta con 'switchport mode trunk'). La SVI ('interface vlan 99' + 'ip address ...' + 'no shutdown') permite gestionar el switch L2 por IP."
    },
    {
        "id": "tp4-1",
        "unit": "TP 04 / Lab 04: Fibra Óptica, OTDR y GPON",
        "style": "Fibra Óptica, Empalme y OTDR",
        "question": "¿Cuáles son los diámetros de núcleo y revestimiento de la fibra Monomodo (SMF) frente a la Multimodo (MMF), y por qué la fibra Monomodo alcanza decenas de kilómetros?",
        "options": [
            "SMF tiene núcleo de 50 µm y MMF de 9 µm con revestimiento de 250 µm; la SMF usa fuentes LED de baja potencia.",
            "Ambas tienen núcleo de 62,5 µm; la SMF alcanza 80 km únicamente porque utiliza conectores verdes APC en los extremos.",
            "SMF tiene núcleo de 9 µm sin revestimiento óptico y MMF tiene 125 µm de núcleo; ambas operan exclusivamente en 850 nm.",
            "Revestimiento de 125 µm en ambas; SMF tiene núcleo de 9 µm (1 modo axial con Láser) y MMF 50 o 62,5 µm."
        ],
        "correct": 3,
        "explanation": "El revestimiento (cladding) es de 125 µm en ambas. La Monomodo (9/125 µm) guía un único modo axial con luz láser (1310/1550 nm) sin dispersión modal (>20–80 km). La Multimodo (50/125 o 62,5/125 µm) sufre dispersión modal que limita su alcance a 300–550 m."
    },
    {
        "id": "tp4-2",
        "unit": "TP 04 / Lab 04: Fibra Óptica, OTDR y GPON",
        "style": "Arquitectura GPON y FTTx",
        "question": "En una red GPON (ITU-T G.984), ¿qué longitudes de onda, velocidades nominales y métodos de acceso al medio se utilizan en Bajada (Downstream) y en Subida (Upstream) sobre el mismo pelo de fibra?",
        "options": [
            "Bajada en 1310 nm a 1,244 Gbps por TDMA y Subida en 1490 nm a 2,488 Gbps en modo Broadcast compartido sin cifrado.",
            "Utiliza dos pelos de fibra separados: uno para bajada y otro para subida, operando ambos en la ventana de 1550 nm.",
            "Bajada en 850 nm a 1 Gbps por CSMA/CD y Subida en 1300 nm a 1 Gbps mediante paso de testigo (Token Passing).",
            "Bajada en 1490 nm a 2,488 Gbps en modo Broadcast (con AES) y Subida en 1310 nm a 1,244 Gbps mediante TDMA con Ranging."
        ],
        "correct": 3,
        "explanation": "Mediante WDM sobre un solo pelo de fibra: Bajada en 1490 nm (2,48832 Gbps) en modo Broadcast con cifrado AES-128; Subida en 1310 nm (1,24416 Gbps) mediante TDMA y ecualización de retardo (Ranging). Además, 1550 nm se reserva para video RF."
    },
    {
        "id": "tp4-3",
        "unit": "TP 04 / Lab 04: Fibra Óptica, OTDR y GPON",
        "style": "Arquitectura GPON y FTTx",
        "question": "Si un puerto GPON estándar (2,48832 Gbps de bajada / 1,24416 Gbps de subida) alimenta un splitter 1:64 con los 64 abonados descargando simultáneamente, ¿cuál es el ancho de banda promedio por abonado y qué T-CONT usarías para VoIP vs. Internet?",
        "options": [
            "19,44 Mbps de bajada y 38,88 Mbps de subida; sin necesidad de configurar perfiles T-CONT ni algoritmo DBA en la OLT.",
            "100,0 Mbps de bajada y 50,0 Mbps de subida; T-CONT Tipo 4 (Best-Effort) para VoIP y Tipo 1 (fijo) para descargas web.",
            "38,88 Mbps de bajada y 19,44 Mbps de subida; T-CONT Tipo 1 (ancho de banda fijo) para VoIP y Tipo 4 (Best-Effort) para Internet.",
            "77,76 Mbps de bajada y 38,88 Mbps de subida; T-CONT Tipo 5 para señalización de voz y Tipo 2 para navegación residencial."
        ],
        "correct": 2,
        "explanation": "Bajada promedio = 2488,32 / 64 = 38,88 Mbps; Subida promedio = 1244,16 / 64 = 19,44 Mbps. Con DBA se asigna T-CONT Tipo 1 (Fixed) para tráfico sensible al retardo (VoIP) y T-CONT Tipo 4 (Best-Effort) para internet residencial."
    },
    {
        "id": "tp4-4",
        "unit": "TP 04 / Lab 04: Fibra Óptica, OTDR y GPON",
        "style": "Fibra Óptica, Empalme y OTDR",
        "question": "En el Taller de Fibra Óptica (Lab 04), ¿cuál es la diferencia física entre una Macrocurvatura y una Microcurvatura, y cómo se identifica una macrocurvatura con un OTDR?",
        "options": [
            "Macrocurvatura es un doblez visible (atenúa mucho más en 1550 nm que en 1310 nm); microcurvatura es en µm.",
            "Ambas son deformaciones idénticas del recubrimiento y producen mayor pérdida en 1310 nm que en la ventana de 1550 nm.",
            "Macrocurvatura ocurre solo en conectores mecánicos mal pulidos y se detecta porque el OTDR muestra una ganancia aparente.",
            "Macrocurvatura genera un alto pico reflectivo de Fresnel en el OTDR y la microcurvatura produce el corte total del núcleo."
        ],
        "correct": 0,
        "explanation": "En una macrocurvatura el radio de giro cae por debajo del mínimo (20× diámetro en tendido, 10× instalado) rompiendo el ángulo crítico. Al comparar trazas OTDR en 1310 nm y 1550 nm, una pérdida mucho mayor en 1550 nm confirma una macrocurvatura."
    },
    {
        "id": "tp4-5",
        "unit": "TP 04 / Lab 04: Fibra Óptica, OTDR y GPON",
        "style": "Fibra Óptica, Empalme y OTDR",
        "question": "Durante el empalme por fusión de fibra óptica, ¿por qué es obligatorio limpiar la fibra pelada con alcohol isopropílico ≥ 99% y cómo realiza el corte la cortadora de precisión (cleaver)?",
        "options": [
            "Para enfriar la fibra antes del horno; el cleaver corta el acrilato y el vidrio juntos en un solo paso sin usar peladora.",
            "Para disolver el revestimiento de 125 µm; el cleaver pule la punta con láser dejando un ángulo biselado de 8° como en APC.",
            "Para lubricar el vidrio en los electrodos; el cleaver guillotina toda la sección transversal de la fibra por presión directa.",
            "Porque el agua/impurezas hierven en el arco (~2000 °C) creando burbujas; el cleaver hace una micro-muesca con diamante y tracciona a 90°."
        ],
        "correct": 3,
        "explanation": "El alcohol común contiene agua que se vaporiza explosivamente en el arco eléctrico generando burbujas. El cleaver marca apenas el vidrio con diamante (scoring) y lo tracciona longitudinalmente logrando una cara espejo a 90° (desviación ≤ 0,5°–1°; pérdida de fusión 0,02–0,05 dB)."
    },
    {
        "id": "tp4-6",
        "unit": "TP 04 / Lab 04: Fibra Óptica, OTDR y GPON",
        "style": "Fibra Óptica, Empalme y OTDR",
        "question": "En una medición con OTDR, ¿qué son la Zona Muerta de Evento (EDZ) y la Zona Muerta de Atenuación (ADZ), y qué indica un valor de ORL (Optical Return Loss) de 60 dB frente a uno de 45 dB?",
        "options": [
            "EDZ ocurre en empalmes por fusión no reflectivos y ADZ en macrocurvaturas; un ORL de 60 dB indica que el conector está roto.",
            "EDZ mide la longitud total de la bobina de lanzamiento y ADZ el ancho del pulso; el ORL debe ser cercano a 0 dB.",
            "Son tramos de fibra sin señal óptica; un ORL de 45 dB es superior a 60 dB porque indica menor pérdida de inserción.",
            "Distancias de saturación tras un reflejo (EDZ separa 2 eventos; ADZ vuelve a medir dB); ORL de 60 dB es mejor."
        ],
        "correct": 3,
        "explanation": "EDZ (~1–3 m, hasta −1,5 dB del pico) es la distancia mínima para distinguir dos eventos reflectivos; ADZ (~3–10 m, hasta ±0,5 dB de la recta) permite volver a medir atenuación. En ORL = 10·log10(P_inc / P_ref), un valor más alto en dB (50–60 dB en APC) significa mucha menos luz reflejada."
    },
    {
        "id": "tp4-7",
        "unit": "TP 04 / Lab 04: Fibra Óptica, OTDR y GPON",
        "style": "Arquitectura GPON y FTTx",
        "question": "Actividad 1 del TP 04: Al diseñar una red GPON que conecta tres viviendas unifamiliares y un edificio de departamentos, ¿cuál es la diferencia entre FTTH, FTTB y FTTC, qué unidad (SFU o MDU) va en cada caso y por qué la ODN es pasiva?",
        "options": [
            "En FTTH y FTTB se instala un splitter activo 1:64 dentro de cada departamento y la ODN requiere baterías en vía pública.",
            "FTTH usa fibra multimodo OM3, FTTB usa cable coaxial RG-6 desde la central y FTTC usa enlaces inalámbricos de 6 GHz.",
            "FTTH llega a cada casa (SFU), FTTB al edificio (MDU + UTP) y FTTC al gabinete; la ODN usa splitters pasivos.",
            "FTTH usa MDU en casas y FTTB instala una OLT en el edificio; la ODN lleva amplificadores alimentados por PoE en los postes."
        ],
        "correct": 2,
        "explanation": "El escenario FTTx indica hasta dónde llega la fibra: FTTH (vivienda, con ONT SFU), FTTB (edificio, con ONU MDU que reparte por UTP/cobre a cada depto) y FTTC (acera/gabinete). La ODN es pasiva porque entre OLT y ONT/ONU solo hay fibra, empalmes y splitters ópticos pasivos."
    },
    {
        "id": "tp4-8",
        "unit": "TP 04 / Lab 04: Fibra Óptica, OTDR y GPON",
        "style": "Arquitectura GPON y FTTx",
        "question": "¿Qué definen las normas ITU-T G.984.1 a G.984.4 en GPON, cuánta atenuación introduce aproximadamente un splitter 1:64, y qué colores de cubierta identifican a las fibras Monomodo (G.652/G.657) frente a las Multimodo (OM1 a OM5)?",
        "options": [
            "G.984.1 (general), .2 (PMD 28 dB), .3 (GTC/GEM/DBA), .4 (OMCI); el splitter 1:64 pierde ~20,5 dB; Amarillo=SM, Naranja=OM1/2, Aqua=OM3/4.",
            "Un splitter 1:64 pierde 3,5 dB en total; el color Amarillo identifica fibra Multimodo OM1 y el Naranja fibra Monomodo.",
            "G.984 define empalmes por fusión; el splitter 1:64 pierde 64 dB (1 dB por boca) y todas las fibras usan cubierta verde lima.",
            "G.984.1 a .4 definen velocidades de 40 Gbps; el splitter 1:64 amplifica la señal 20 dB y el color Azul indica fibra OM5."
        ],
        "correct": 0,
        "explanation": "En GPON (presupuesto óptico Clase B+ = 28 dB), cada división por 2 atenúa ~3 a 3,5 dB: un splitter 1:64 (2^6) pierde ~20,5 dB. Colores estándar TIA-598: Amarillo = Monomodo, Naranja = OM1/OM2, Aqua = OM3/OM4 y Verde Lima = OM5."
    },
    {
        "id": "tp4-9",
        "unit": "TP 04 / Lab 04: Fibra Óptica, OTDR y GPON",
        "style": "Fibra Óptica, Empalme y OTDR",
        "question": "En el informe de práctica del Lab 04 (Actividad 6), ¿cómo se distinguen en la traza del OTDR los eventos reflexivos de los no reflexivos, por qué puede aparecer una falsa 'ganancia' en un empalme, para qué sirve el VFL y por qué nunca se debe acoplar un conector APC con uno UPC?",
        "options": [
            "Reflexivos (pico+escalón: conector/fin) vs No reflexivos (escalón: fusión/curva); falsa ganancia; APC(8°)≠UPC(0°).",
            "Los eventos no reflexivos son conectores sucios; el OLTS grafica distancia de fallas igual que el OTDR y el VFL opera en 1550 nm.",
            "La fusión da un pico reflectivo alto y el conector solo un escalón; APC y UPC se pueden unir si ambos son monomodo.",
            "La falsa ganancia indica que el láser del OTDR aumentó su potencia; el VFL mide ORL en dB y APC es azul mientras UPC es verde."
        ],
        "correct": 0,
        "explanation": "Conectores y cortes generan pico de Fresnel + escalón (reflexivos); fusiones y curvas generan solo escalón (no reflexivos). La falsa 'ganancia' ocurre al empalmar fibras con distinto coeficiente de retrodispersión (se promedia midiendo en A→B y B→A). Unir APC (verde, 8°) con UPC (azul, 0°) daña las férulas y causa alta pérdida."
    },
    {
        "id": "tp5-1",
        "unit": "TP 05: Redes Inalámbricas IEEE 802.11 (Wi-Fi)",
        "style": "Normativa, Canales y Espectro Wi-Fi",
        "question": "Según la Resolución ENACOM 756/2023 en Argentina para la banda de 6 GHz (5925–7125 MHz, Wi-Fi 6E y Wi-Fi 7), ¿dónde está permitido su uso, con qué límites de potencia PIRE y por qué está prohibido en exteriores?",
        "options": [
            "Permitido en enlaces exteriores punto a punto rurales con 36 dBm (4 W) de PIRE sin restricciones de coordinación.",
            "Permitido tanto en interiores como en patios abiertos hasta 30 dBm, pero únicamente utilizando canales de 20 MHz.",
            "Exclusivo en interiores (Indoor): AP ≤ 30 dBm PIRE y cliente ≤ 24 dBm; prohibido afuera por enlaces fijos.",
            "Habilitado solo para operadores con licencia paga de espectro en la subbanda de 5925 a 6425 MHz (500 MHz totales)."
        ],
        "correct": 2,
        "explanation": "La Res. ENACOM 756/2023 habilita los 1200 MHz completos (5925–7125 MHz) sin licencia solo en interiores (LPI: AP ≤ 30 dBm PIRE, cliente ≤ 24 dBm PIRE), donde las paredes atenúan la señal y protegen a los radioenlaces fijos de microondas y servicios satelitales."
    },
    {
        "id": "tp5-2",
        "unit": "TP 05: Redes Inalámbricas IEEE 802.11 (Wi-Fi)",
        "style": "Normativa, Canales y Espectro Wi-Fi",
        "question": "En la banda de 2,4 GHz, un técnico configura 5 APs cercanos en los canales 1, 3, 6, 9 y 11. ¿Por qué es un grave error técnico y por qué la interferencia generada es peor que poner dos APs en el mismo canal?",
        "options": [
            "Porque en la misma celda física la Interferencia Co-Canal (CCI) destruye los paquetes, mientras que la ACI reparte el ancho de banda.",
            "Porque cada canal ocupa 20–22 MHz (separados por 5 MHz): usar 3 y 9 genera solapamiento parcial (ACI), que corrompe tramas sin arbitraje CSMA/CA.",
            "Porque los dispositivos clientes modernos solo pueden sintonizar canales impares múltiplos de 5 dentro de la banda de 2,4 GHz.",
            "Porque los canales 3 y 9 en 2,4 GHz están reservados por ENACOM para radares meteorológicos y exigen protocolo DFS."
        ],
        "correct": 1,
        "explanation": "En 2,4 GHz solo deben usarse los canales 1, 6 y 11. En CCI (mismo canal) los equipos se escuchan y se turnan con CSMA/CA; en ACI (canales 3 y 9 parcialmente solapados) no decodifican el preámbulo ajeno, transmiten encima y provocan colisiones y retransmisiones."
    },
    {
        "id": "tp5-3",
        "unit": "TP 05: Redes Inalámbricas IEEE 802.11 (Wi-Fi)",
        "style": "Normativa, Canales y Espectro Wi-Fi",
        "question": "¿Qué ocurre en una red de telefonía inalámbrica corporativa (VoWiFi) si se configuran los APs de 5 GHz en canales DFS (U-NII-2A: 52–64 y U-NII-2C: 100–144) cercanos a un radar?",
        "options": [
            "Exige 60 s de escucha previa (CAC), evacúa el canal si detecta radar y fuerza escaneo pasivo, cortando llamadas.",
            "El protocolo DFS activa automáticamente el cifrado WPA3-Enterprise para evitar que el radar interfiera con los paquetes RTP.",
            "El AP conmuta instantáneamente a 2,4 GHz en menos de 1 ms de forma transparente sin afectar el roaming ni las llamadas VoIP.",
            "Los teléfonos inalámbricos duplican su alcance de cobertura al sincronizarse con la portadora del radar meteorológico."
        ],
        "correct": 0,
        "explanation": "Para VoWiFi se recomiendan canales sin DFS (U-NII-1: 36–48 y U-NII-3: 149–165) para evitar el silencio de 60 s del CAC ( hasta 10 min en canales TWDR 120–128), los desalojos bruscos por radar y la demora del escaneo pasivo en el roaming."
    },
    {
        "id": "tp5-4",
        "unit": "TP 05: Redes Inalámbricas IEEE 802.11 (Wi-Fi)",
        "style": "Dimensionamiento y Cálculo",
        "question": "Caso Aula Magna (Actividad 3 del TP 05 - Criterio CWNP): Hay 120 estudiantes con 180 dispositivos en total, el 80% se conecta en 5 GHz (144 dispositivos / 96 usuarios), cada radio de 5 GHz entrega 100 Mbps útiles y soporta máximo 30 clientes asociados. ¿Cómo se calcula la cantidad de APs según el criterio CWNP y por qué nunca se promedian ambos resultados?",
        "options": [
            "Se calcula por clientes (⌈144/30⌉ = 5 APs) y por caudal (⌈Mbps/100⌉ = 2–3 APs a 2M, o 6 APs a 4M) y se elige SIEMPRE el MÁXIMO.",
            "Se adopta siempre el menor de los dos cálculos (2 o 3 APs) porque el caudal de 2 Mbps por estudiante es el único factor limitante.",
            "Se promedian los APs por capacidad y por clientes asociados (ej. (3 + 5)/2 = 4 APs) para optimizar el presupuesto de compra.",
            "Se divide el total de 180 dispositivos por 100 Mbps de caudal efectivo, dando un requerimiento fijo de 2 APs para todo el salón."
        ],
        "correct": 0,
        "explanation": "Fórmula CWNP: N_AP = máx( ⌈Demanda_Mbps / Caudal_útil_radio⌉ , ⌈Clientes_banda / Clientes_máx_radio⌉ ). Con 144 dispositivos en 5 GHz: por asociación da ⌈144/30⌉ = 5 APs (a 2 Mbps domina 5 APs; a 4 Mbps da ⌈576/100⌉ = 6 APs). Nunca se promedia porque ambas restricciones deben cumplirse a la vez."
    },
    {
        "id": "tp5-5",
        "unit": "TP 05: Redes Inalámbricas IEEE 802.11 (Wi-Fi)",
        "style": "Seguridad Wi-Fi, PoE y Site Survey",
        "question": "Actividad 4 del TP 05 (PoE): Se instalan 12 APs Wi-Fi 7 que consumen hasta 39 W cada uno (en el PD) en un switch con presupuesto PoE de 370 W. ¿Qué norma/clase IEEE 802.3 requiere cada puerto, qué pasa si el switch solo entrega 802.3at (25,5 W en PD) y alcanza o no el presupuesto de 370 W?",
        "options": [
            "Requiere IEEE 802.3at (PoE+ de 30 W); el presupuesto de 370 W alcanza justo porque 12 × 30 W = 360 W medidos en la fuente del switch.",
            "Requiere IEEE 802.3bt Tipo 3 (Clase 6: 60W PSE / 51W PD); con 802.3at el AP degrada radios/MIMO; y 12 × 39 W = 468 W excede los 370 W.",
            "Requiere IEEE 802.3bt Tipo 4 (90 W); si se conectan a un switch 802.3at los APs entran en cortocircuito y queman la fuente PoE.",
            "Alcanza con IEEE 802.3af (15,4 W) por puerto y el presupuesto de 370 W alimenta los 12 APs a máxima capacidad sin inconvenientes."
        ],
        "correct": 1,
        "explanation": "Potencia máxima en el PD: 802.3af = 12,95 W; 802.3at = 25,5 W; 802.3bt Tipo 3 (Clases 5–6) = 40–51 W. Para 39 W en PD se requiere 802.3bt Tipo 3 (Clase 6). Con 802.3at el AP apaga 6 GHz o reduce MIMO, y 12 × 39 W = 468 W supera los 370 W del switch."
    },
    {
        "id": "tp5-6",
        "unit": "TP 05: Redes Inalámbricas IEEE 802.11 (Wi-Fi)",
        "style": "Normativa, Canales y Espectro Wi-Fi",
        "question": "Al mediodía, el Wi-Fi en 2,4 GHz cerca del comedor universitario se vuelve inutilizable. El Analizador Wi-Fi muestra apenas 15% de ocupación del canal, pero el Analizador de Espectro RF muestra un Duty Cycle del 85%. ¿Cuál es el diagnóstico y la solución?",
        "options": [
            "Hay 70% de interferencia física no-Wi-Fi (hornos microondas a ~2450 MHz); solución: migrar a 5,8 GHz (U-NII-3).",
            "Los clientes están sufriendo el problema del nodo oculto en 5 GHz; se soluciona configurando canales de 40 MHz en la banda de 2,4 GHz.",
            "Hay un ataque de deautenticación 802.11 en Capa 2; se soluciona aumentando la potencia de transmisión de los APs en 2,4 GHz.",
            "El analizador de espectro está descalibrado porque la ocupación RF nunca puede superar el porcentaje de tramas Beacons de Capa 2."
        ],
        "correct": 0,
        "explanation": "El analizador Wi-Fi solo ve tramas 802.11 (Capa 2), pero el analizador de espectro mide energía RF física (Capa 1): los hornos microondas (~2450 MHz, alto Duty Cycle) saturan los canales 6–11 y bloquean el CCA de CSMA/CA. Solución: migrar a 5,8 GHz (canales 149–165 de 20 MHz)."
    },
    {
        "id": "tp5-7",
        "unit": "TP 05: Redes Inalámbricas IEEE 802.11 (Wi-Fi)",
        "style": "Seguridad Wi-Fi, PoE y Site Survey",
        "question": "¿Por qué configurar 8 o 10 SSIDs distintos en los mismos APs degrada severamente el rendimiento, cómo se resuelve usando un único SSID y qué diferencia crítica de licenciamiento tiene Cisco Meraki frente a Ubiquiti UniFi?",
        "options": [
            "Los SSIDs adicionales solo afectan al cable Ethernet del switch; Meraki y UniFi requieren ambos suscripción obligatoria para pasar tráfico L2.",
            "Cada SSID envía Beacons a tasa básica consumiendo Airtime; se usa 1 SSID + VLAN dinámica, y Meraki exige licencia.",
            "Porque el estándar 802.11 admite máximo 4 SSIDs por radio; UniFi exige pagar licencia anual por AP y Meraki opera con controlador local gratuito.",
            "Porque cada SSID adicional reduce en 3 dB la potencia de la antena; se resuelve creando 10 VLANs nativas en un enlace troncal sin autenticación."
        ],
        "correct": 1,
        "explanation": "Muchos SSIDs saturan el aire con tramas Beacon enviadas a la tasa más baja (1 o 6 Mbps). Se consolida en ≤ 3 SSIDs (idealmente 1 SSID con VLAN dinámica vía 802.1X/RADIUS o MPSK). En un organismo sin presupuesto anual asegurado (OpEx), Meraki es riesgoso porque deja de pasar tráfico si vence la licencia, mientras que UniFi no cobra licencias."
    },
    {
        "id": "tp5-8",
        "unit": "TP 05: Redes Inalámbricas IEEE 802.11 (Wi-Fi)",
        "style": "Seguridad Wi-Fi, PoE y Site Survey",
        "question": "Actividad 5 del TP 05 (Informe de Relevamiento / Site Survey): ¿Por qué un informe que solo muestra un mapa con '−62 dBm en verde' es insuficiente, qué responden las capas de SNR, CCI y Cobertura Secundaria, y cuáles son sus valores objetivo?",
        "options": [
            "El informe es inválido únicamente porque el nivel de señal objetivo para redes Wi-Fi corporativas debe ser positivo (+20 dBm a +30 dBm).",
            "El SNR mide cuántos clientes hay asociados, la CCI mide la atenuación de las paredes de hormigón y la cobertura secundaria mide el PoE.",
            "Un nivel de −62 dBm garantiza por sí solo máxima velocidad y roaming perfecto sin necesidad de medir el piso de ruido ni canales.",
            "RSSI ignora ruido, contienda y roaming: faltan SNR (≥25 dB voz / ≥20 dB datos), CCI (APs en igual canal, ideal 1) y 2° AP (≥−67 dBm para roaming)."
        ],
        "correct": 3,
        "explanation": "Mostrar solo RSSI tiene tres fallas críticas: 1) sin el piso de ruido no se conoce el SNR (RSSI − Ruido; mínimo ≥ 20 dB datos y ≥ 25 dB voz), 2) no muestra la Interferencia Co-Canal (CCI: cuántos APs compiten por el airtime) y 3) no verifica cobertura secundaria para roaming ni documenta banda/canal/dispositivo."
    },
    {
        "id": "tp5-9",
        "unit": "TP 05: Redes Inalámbricas IEEE 802.11 (Wi-Fi)",
        "style": "Seguridad Wi-Fi, PoE y Site Survey",
        "question": "Actividad 6 del TP 05 (802.1X, RADIUS y MPSK): ¿Qué tres atributos estándar devuelve el servidor RADIUS para asignar a cada usuario su VLAN en un único SSID, y por qué MPSK (Multiple Pre-Shared Keys) para dispositivos IoT tiene limitaciones en la banda de 6 GHz?",
        "options": [
            "RADIUS asigna la VLAN modificando la dirección MAC del cliente; y MPSK no funciona en 2,4 GHz ni en 5 GHz por falta de cifrado AES.",
            "RADIUS devuelve Dirección IP, Máscara y Gateway por EAP; y MPSK funciona exclusivamente sobre canales de 160 MHz en la banda de 6 GHz.",
            "RADIUS devuelve el nombre del SSID, el canal RF y la potencia PIRE; y los dispositivos IoT tienen prohibido por ENACOM conectarse a redes con VLANs.",
            "RADIUS envía Tunnel-Type, Tunnel-Medium-Type y Tunnel-Private-Group-ID; y 6 GHz exige WPA3, prohibiendo WPA2-PSK."
        ],
        "correct": 3,
        "explanation": "Con 802.1X, tras validar las credenciales EAP, el servidor RADIUS envía al AP los 3 atributos Tunnel-* en el Access-Accept para ubicar al cliente en su VLAN. En cambio, MPSK/PPSK se basa en WPA2-PSK, el cual está prohibido en la banda de 6 GHz (que exige obligatoriamente WPA3-SAE u OWE)."
    },
    {
        "id": "tp6-1",
        "unit": "TP 06: IPv4, Encapsulamiento y Fragmentación",
        "style": "Cabecera IPv4, Enrutamiento y TTL",
        "question": "¿Qué tipo de servicio brinda el protocolo IPv4 a la capa superior y por qué NO incluye mecanismos de retransmisión ni control de errores de datos en los routers intermedios?",
        "options": [
            "Servicio no orientado a conexión (Connectionless) y Best-Effort, delegando la confiabilidad a Capa 4 (End-to-End).",
            "Servicio orientado a la conexión y confiable; cada router intermedio almacena copia del paquete y lo retransmite si se pierde.",
            "Servicio con reserva garantizada de ancho de banda y control de flujo ventana a ventana en cada salto de Capa 3.",
            "Servicio sin control de cabecera ni de datos porque la trama Ethernet de Capa 2 se conserva intacta de extremo a extremo."
        ],
        "correct": 0,
        "explanation": "IP es Connectionless y Best-Effort para mantener los routers del núcleo rápidos, simples y sin estado de sesión, y para no penalizar con retardos de retransmisión al tráfico en tiempo real (VoIP/RTP sobre UDP). La confiabilidad la aporta TCP extremo a extremo."
    },
    {
        "id": "tp6-2",
        "unit": "TP 06: IPv4, Encapsulamiento y Fragmentación",
        "style": "Encapsulamiento y Capa 4 (TCP/UDP)",
        "question": "En una transmisión de videollamada corporativa VoIP/RTC mediante RTP sobre UDP en una red Ethernet IPv4 (Actividad 3 del TP 06), ¿cuál es el orden exacto de los encabezados en la trama y qué valores toman los campos de multiplexación?",
        "options": [
            "Header Ethernet (14B, EtherType=0x0800) → Header IPv4 (20B, Protocol=17) → Header UDP (8B) → Header RTP (12B) → Datos → FCS (4B).",
            "Header IPv4 (20B) → Header Ethernet (14B) → Header TCP (20B, Protocol=6) → Header RTP (12B) → Datos → FCS (4B).",
            "Header Ethernet (14B, EtherType=0x8100) → Header ICMP (8B, Protocol=1) → Header UDP (8B) → Header RTP (12B) → FCS (4B).",
            "Header RTP (12B) → Header UDP (8B) → Header IPv4 (20B) → Header Ethernet (14B) sin tráiler de verificación final."
        ],
        "correct": 0,
        "explanation": "El orden de afuera hacia adentro en el cable es: | Ethernet (14B, EtherType 0x0800) | IPv4 (20B, Protocol 17) | UDP (8B, Puertos) | RTP (12B, Secuencia y Timestamp) | Payload Voz/Video | FCS (4B) |."
    },
    {
        "id": "tp6-3",
        "unit": "TP 06: IPv4, Encapsulamiento y Fragmentación",
        "style": "Cabecera IPv4, Enrutamiento y TTL",
        "question": "¿Qué función cumplen los campos IHL (Internet Header Length) y Header Checksum en la cabecera IPv4, y por qué cada router L3 está obligado a recalcular el Header Checksum en cada salto?",
        "options": [
            "IHL mide la cabecera IP en palabras de 4 B (mín. 5 = 20B); el Checksum se recalcula al restar 1 al TTL.",
            "IHL define el tamaño máximo de trama (MTU) del enlace y el Checksum se recalcula porque el router cambia la IP de origen.",
            "IHL indica la cantidad de fragmentos generados y el Header Checksum verifica tanto la cabecera IP como el payload TCP/UDP.",
            "IHL mide la longitud total del paquete en bytes y el Header Checksum se calcula una sola vez en el host emisor."
        ],
        "correct": 0,
        "explanation": "IHL (4 bits) especifica dónde termina la cabecera IP en palabras de 32 bits (4 bytes): mínimo 5 (20 B) y máximo 15 (60 B). El Header Checksum cubre solo la cabecera IP y cada router debe recalcularlo porque el campo TTL disminuye en 1 en cada salto."
    },
    {
        "id": "tp6-4",
        "unit": "TP 06: IPv4, Encapsulamiento y Fragmentación",
        "style": "Cabecera IPv4, Enrutamiento y TTL",
        "question": "¿Qué problema crítico de red evita el campo Time to Live (TTL), y qué sucede exactamente cuando un router recibe un datagrama con TTL = 1 destinado a otra red y lo decrementa a 0?",
        "options": [
            "Limita el tamaño del paquete en bytes; cuando llega a 0 el router fragmenta el datagrama y avisa por ICMP al servidor destino.",
            "Mide los segundos exactos de reloj desde que salió de la PC; al llegar a 0 el router le recarga 64 saltos y continúa el reenvío.",
            "Evita bucles infinitos de enrutamiento; al llegar a 0 el router descarta el paquete y envía ICMP Tipo 11 al origen.",
            "Evita colisiones de Capa 2 en enlaces troncales; cuando llega a 0 el switch inunda la trama por todos los puertos."
        ],
        "correct": 2,
        "explanation": "El TTL evita que un bucle de enrutamiento (routing loop) sature los enlaces indefinidamente. Cuando llega a 0, el router descarta el datagrama y envía un mensaje ICMP Time Exceeded (Tipo 11, Código 0) a la IP de Origen (principio con el que funciona Traceroute)."
    },
    {
        "id": "tp6-5",
        "unit": "TP 06: IPv4, Encapsulamiento y Fragmentación",
        "style": "Cabecera IPv4, Enrutamiento y TTL",
        "question": "Cuando un router L3 busca la dirección IP de destino de un datagrama en su tabla de enrutamiento y encuentra varias rutas coincidentes (por ejemplo, 10.0.0.0/8, 10.1.0.0/16 y 10.1.2.0/24), ¿qué regla aplica para elegir el camino?",
        "options": [
            "Elige la ruta con la máscara de subred más corta (/8), ya que abarca la mayor cantidad de direcciones IP posibles.",
            "Duplica el datagrama y lo envía simultáneamente por las tres interfaces para garantizar que llegue por el camino más rápido.",
            "Descarta el datagrama por conflicto de rutas en la tabla y devuelve un mensaje ICMP Redirect al host de origen.",
            "Aplica la Coincidencia del Prefijo Más Largo (Longest Prefix Match), eligiendo la ruta coincidente con máscara más específica (/24)."
        ],
        "correct": 3,
        "explanation": "Los routers IP evalúan la tabla de rutas mediante Longest Prefix Match: entre todas las rutas que coinciden con la IP destino, gana siempre la que tiene mayor cantidad de bits en 1 en su máscara (/24 > /16 > /8)."
    },
    {
        "id": "tp6-6",
        "unit": "TP 06: IPv4, Encapsulamiento y Fragmentación",
        "style": "Fragmentación IP y Wireshark",
        "question": "Actividad 5 del TP 06: Un SysAdmin captura tráfico en Wireshark mientras el cliente 192.168.1.50 hace ping a 8.8.8.8. ¿Qué filtro de visualización (Display Filter) muestra el intercambio entre ambos hosts y qué filtro aísla únicamente los paquetes fragmentados?",
        "options": [
            "Intercambio: ip.addr == 192.168.1.50 && ip.addr == 8.8.8.8 | Fragmentos: ip.flags.mf == 1 || ip.frag_offset > 0",
            "Intercambio: arp.addr == 192.168.1.50 || 8.8.8.8 | Fragmentos: ip.flags.df == 1 && icmp.type == 8",
            "Intercambio: ping.host == 8.8.8.8 && 192.168.1.50 | Fragmentos: frame.len > 1500",
            "Intercambio: ip.src == 192.168.1.50 -> 8.8.8.8 | Fragmentos: ip.fragmented == true"
        ],
        "correct": 0,
        "explanation": "'ip.addr == 192.168.1.50 && ip.addr == 8.8.8.8' muestra el tráfico entre ambos IPs en ambos sentidos. Y 'ip.flags.mf == 1 || ip.frag_offset > 0' captura todos los fragmentos (el primero tiene MF=1, los intermedios tienen ambos y el último tiene frag_offset > 0 con MF=0)."
    },
    {
        "id": "tp6-7",
        "unit": "TP 06: IPv4, Encapsulamiento y Fragmentación",
        "style": "Fragmentación IP y Wireshark",
        "question": "Actividad 5 del TP 06: El cliente 192.168.1.50 envía un ping de 3.000 bytes de carga útil hacia 8.8.8.8 en una red Ethernet (MTU = 1500 bytes, cabecera IP = 20 bytes). Al inspeccionar el PRIMER fragmento en Wireshark, ¿qué valores tienen Header Length, Total Length, DF, MF, Fragment Offset y Protocol?",
        "options": [
            "Header Length = 20 B, Total Length = 1000 B, DF = 1, MF = 1, Fragment Offset = 1480 y Protocol = 1 (ICMP).",
            "Header Length = 20 B, Total Length = 3028 B, DF = 1, MF = 0, Fragment Offset = 0 y Protocol = 6 (TCP).",
            "Header Length = 20 B (IHL=5), Total Length = 1500 B (20B+1480B), DF = 0, MF = 1, Offset = 0 y Protocol = 1.",
            "Header Length = 28 B, Total Length = 1480 B, DF = 0, MF = 0, Fragment Offset = 185 y Protocol = 17 (UDP)."
        ],
        "correct": 2,
        "explanation": "Con MTU de 1500 B y cabecera IP de 20 B (IHL = 5), D_máx = ⌊(1500 − 20)/8⌋ × 8 = 1480 B de datos por fragmento. El 1er fragmento tiene Total Length = 1500, DF = 0, MF = 1 (vienen más fragmentos), Fragment Offset = 0 y Protocol = 1 (ICMP)."
    },
    {
        "id": "tp6-8",
        "unit": "TP 06: IPv4, Encapsulamiento y Fragmentación",
        "style": "Fragmentación IP y Wireshark",
        "question": "Continuando con el ping de 3.000 bytes (Actividad 5.c del TP 06), ¿qué valores de Fragment Offset (en bytes y en el campo de cabecera en unidades de 8 bytes) y de la bandera More Fragments (MF) tienen el 2do fragmento (intermedio) y el 3er fragmento (último)?",
        "options": [
            "2do fragmento: Offset = 1480 B (campo = 185) y MF = 1 | 3er fragmento: Offset = 2960 B (campo = 370) y MF = 0.",
            "2do fragmento: Offset = 1500 B (campo = 187,5) y MF = 0 | 3er fragmento: Offset = 3000 B (campo = 375) y MF = 1.",
            "2do fragmento: Offset = 740 B (campo = 92) y MF = 1 | 3er fragmento: Offset = 1480 B (campo = 185) y MF = 0.",
            "Ambos fragmentos conservan Offset = 0 igual que el primero y solo se diferencian por el número de identificación IP."
        ],
        "correct": 0,
        "explanation": "El 1er fragmento lleva los bytes 0..1479 (Offset=0, MF=1); el 2do fragmento lleva los bytes 1480..2959 (Offset=1480 B o 185 en bloques de 8B, MF=1); el 3er fragmento lleva desde el byte 2960 hasta el final (Offset=2960 B o 370 en bloques de 8B, y MF=0 indicando que es el último)."
    },
    {
        "id": "tp6-9",
        "unit": "TP 06: IPv4, Encapsulamiento y Fragmentación",
        "style": "Encapsulamiento y Capa 4 (TCP/UDP)",
        "question": "En la Capa 4 (Transporte) dentro del encapsulamiento estudiado en el TP 06 (Actividades 1 y 3), ¿cuál es la diferencia de cabecera y servicio entre UDP y TCP, y por qué el tráfico de voz/video en tiempo real elige UDP?",
        "options": [
            "UDP y TCP tienen exactamente la misma cabecera de 20 B y solo se diferencian en la dirección MAC de destino que utilizan.",
            "TCP (8 B) se utiliza siempre en telefonía IP porque su triple apretón de manos (SYN/ACK) elimina el jitter de la red.",
            "UDP tiene cabecera de 60 B y retransmite paquetes perdidos; TCP tiene 4 B de cabecera y no utiliza números de puerto.",
            "UDP (8 B) opera sin conexión ni retransmisión para baja latencia; TCP (20 B mín.) es orientado a conexión."
        ],
        "correct": 3,
        "explanation": "En Capa 4 (límite superior del 1er Parcial), UDP agrega solo 8 bytes (Puerto Origen, Puerto Destino, Longitud y Checksum) sin conexión ni retransmisión (ideal para VoIP/RTP porque un paquete retransmitido llegaría tarde), mientras que TCP agrega mínimo 20 bytes con conexión (SYN, SYN-ACK, ACK), retransmisión y control de flujo/congestión."
    },
    {
        "id": "tp6-10",
        "unit": "TP 06: IPv4, Encapsulamiento y Fragmentación",
        "style": "Encapsulamiento y Capa 4 (TCP/UDP)",
        "question": "Al desencapsular una trama en el host destino (Actividad 3 del TP 06), ¿qué campo de cada capa permite demultiplexar la carga hacia el protocolo superior y qué ocurre con las direcciones MAC e IP cuando el paquete atraviesa múltiples routers?",
        "options": [
            "Las direcciones IP origen/destino se reescriben en cada router intermedio, mientras que las MAC se mantienen fijas de punta a punta.",
            "Demultiplexan EtherType (L2), Protocol (L3) y Puerto Destino (L4); las IP se mantienen y las MAC + FCS cambian.",
            "Todos los routers del camino desencapsulan hasta la cabecera de aplicación RTP para consultar la tabla de enrutamiento IP.",
            "El switch de Capa 2 decrementa el TTL y cambia el puerto UDP, mientras que el router de Capa 3 conserva intacta la cabecera Ethernet."
        ],
        "correct": 1,
        "explanation": "Cada capa identifica al protocolo superior mediante su campo de demultiplexación: EtherType (0x0800 IPv4) en L2, Protocol (17 UDP, 6 TCP, 1 ICMP) en L3 y Puerto Destino en L4. Al cruzar routers, las IP origen/destino permanecen fijas (salvo NAT) y las MAC + FCS cambian salto a salto."
    },
    {
        "id": "tp6-11",
        "unit": "TP 06: IPv4, Encapsulamiento y Fragmentación",
        "style": "Fragmentación IP y Wireshark",
        "question": "En la prueba de fragmentación con 'ping -l 3000 8.8.8.8' (Windows) o 'ping -s 3000 8.8.8.8' (Linux) sobre Ethernet (MTU = 1500 B, IHL = 20 B), ¿cuántos bytes de datos IP totales lleva el datagrama original contando la cabecera ICMP, cuál es el Total Length del 3er fragmento y qué pasaría si tuviera el flag DF = 1?",
        "options": [
            "Se divide en 2 fragmentos iguales de 1504 B en el cable; con DF = 1 el switch de Capa 2 divide la trama automáticamente.",
            "Lleva 3008 B de datos IP (8B ICMP + 3000B); el 3er fragmento tiene Total Length = 68 B (20B IP + 48B datos); con DF = 1 se descarta (ICMP Tipo 3 Cód. 4).",
            "Lleva 3028 B de datos IP porque la cabecera ICMP de 8 B se duplica en cada fragmento; el 3er fragmento tiene Total Length = 84 B.",
            "Lleva 3000 B exactos porque ICMP no agrega cabecera; el 3er fragmento mide 40 B y con DF = 1 el router lo fragmenta igual."
        ],
        "correct": 1,
        "explanation": "Los datos que encapsula IP en un ping de 3000 B son 8 B (cabecera ICMP Echo Request, que viaja solo en el 1er fragmento) + 3000 B = 3008 B. Repartiendo de a 1480 B (D_máx): Frag 1 = 1480 B (Total Length 1500), Frag 2 = 1480 B (Total Length 1500, Offset 1480) y Frag 3 = 48 B restantes (Total Length = 20 B IP + 48 B = 68 B, Offset 2960, MF = 0). Con DF = 1 el router descarta y envía ICMP Tipo 3 Código 4."
    }
]

for _q in QUESTIONS:
    _q.setdefault("subject", "redes2")

QUESTIONS_BY_ID = {q["id"]: q for q in QUESTIONS}

SUBJECTS: list[dict] = [
    {
        "id": "so",
        "code": "SO",
        "name": "Sistemas Operativos",
        "short_name": "Sistemas Operativos",
        "theme": "green",
        "primary_color": "#059669",
        "course_id": 51,
        "exam_status": "confirmed",
        "exam_badge": "Confirmado • Jueves 05/11/2026 — 10:00 h",
        "exam_title": "1er Parcial Práctico — Sistemas Operativos",
        "exam_date": "2026-11-05T10:00:00-03:00",
        "professors": "Prof. Adj. Ing. Rubén Castaño • Aux. 1a Lic. Claudio Biale",
        "schedule": "Teoría: Martes 14:00 a 16:00 h • Práctica: Jueves 10:00 a 12:00 h",
        "description": "Preparcial interactivo sincronizado con el Aula Virtual FCEQyN (Curso #51). Temas confirmados por la cátedra para el 1er Parcial Práctico del 05/11/2026.",
        "topics": [
            {
                "code": "TP 1 • Planificación de CPU",
                "title": "Planificación de CPU",
                "detail": "Criterios, algoritmos FCFS, SJF/SRTF, Prioridades, Round-Robin y Colas Multinivel",
            },
            {
                "code": "TP 2 • Gestión de Procesos",
                "title": "Gestión de Procesos",
                "detail": "Estados, PCB, cambio de contexto, creación y terminación (fork, exec, wait), procesos zombi y huérfanos",
            },
            {
                "code": "TP 2 • Señales y Tuberías",
                "title": "Señales y Tuberías (Pipes)",
                "detail": "Comunicación entre procesos (IPC), señales POSIX y tuberías en lenguaje C",
            },
            {
                "code": "TP 3 • Interbloqueos",
                "title": "Interbloqueos (Deadlocks)",
                "detail": "Condiciones de Coffman, grafo de asignación de recursos, prevención, detección y Algoritmo del Banquero",
            },
        ],
    },
    {
        "id": "redes2",
        "code": "R2",
        "name": "Comunicaciones y Redes II",
        "short_name": "Comunicaciones y Redes II",
        "theme": "blue",
        "primary_color": "#1d4ed8",
        "course_id": 50,
        "exam_status": "completed",
        "exam_badge": "1er Parcial Rendido • Jueves 29/10/2026 — Banco Activo",
        "exam_title": "1er Parcial Práctico — Capas 1 a 4 (TP 01 al TP 06 + Labs 01 al 04)",
        "exam_date": "2026-10-29T13:00:00-03:00",
        "professors": "Cátedra Comunicaciones y Redes II — FCEQyN UNaM",
        "schedule": "TP 01 al TP 06 y Laboratorios 01 al 04 (Capas 1 a 4 OSI)",
        "description": "Banco colaborativo de 58 ejercicios de parcial con aprendizaje adaptativo, simulacro por pulls, multi-selección de temas y ranking en tiempo real.",
        "topics": [
            {
                "code": "TP 01 / Lab 01",
                "title": "TP 01 / Lab 01: Dispositivos y Dimensionamiento",
                "detail": "Dominios colisión/broadcast, Backplane Full-Duplex y Uplink 20:1",
            },
            {
                "code": "Lab 02",
                "title": "Lab 02: Cableado Estructurado TIA/EIA-568",
                "detail": "Cableado Estructurado ANSI/TIA/EIA-568, T568A/B y enlace de 100 m",
            },
            {
                "code": "TP 03 / Lab 03",
                "title": "TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP",
                "detail": "Trama 802.3, VLAN 802.1Q, STP 802.1D vs RSTP 802.1w, PoE e IOS CLI",
            },
            {
                "code": "TP 04 / Lab 04",
                "title": "TP 04 / Lab 04: Fibra Óptica, OTDR y GPON",
                "detail": "Fibra SMF vs MMF, GPON (WDM/TDMA/DBA), Fusión, OTDR y ORL",
            },
            {
                "code": "TP 05",
                "title": "TP 05: Redes Inalámbricas IEEE 802.11 (Wi-Fi)",
                "detail": "Wi-Fi 6E/7 (ENACOM 756/2023), Canales, DFS, Cálculo CWNP y Espectro RF",
            },
            {
                "code": "TP 06",
                "title": "TP 06: IPv4, Encapsulamiento y Fragmentación",
                "detail": "IPv4, Encapsulamiento VoIP/RTP/UDP, Cabecera IP, TTL, ICMP y Wireshark",
            },
        ],
    },
]
SUBJECTS_BY_ID = {s["id"]: s for s in SUBJECTS}


def get_questions_for_subject(subject: str | None) -> list[dict]:
    subj = (subject or "redes2").strip().lower()
    return [q for q in QUESTIONS if q.get("subject", "redes2") == subj]


# ---------------------------------------------------------------- Configuración y Simulación en Memoria
def config(env, name: str) -> str:
    if name == "NEON_CONNECTION_STRING":
        val = getattr(env, "DATABASE_URL", None) or getattr(env, name, None) or ""
    else:
        val = getattr(env, name, None) or ""
    return str(val).strip().strip('"').strip("'")


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
_mem_clerk_user_ids: dict[str, str] = {}


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


async def _get_clerk_key(env, kid: str):
    if kid not in _keys:
        async with httpx.AsyncClient() as client:
            r = await client.get(env.CLERK_JWKS_URL)
        r.raise_for_status()
        for k in r.json()["keys"]:
            _keys[k["kid"]] = jwt.PyJWK(k).key
    return _keys.get(kid)


async def current_user(
    request: Request,
    authorization: str = Header(default=""),
    x_user_name: str = Header(default=""),
    x_user_username: str = Header(default=""),
) -> dict:
    """Devuelve {'user_id', 'username', 'display_name'} verificando el token de Clerk (o modo local)."""
    env = get_env(request)
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Falta el token")

    header_dname = unquote(x_user_name).strip() if x_user_name else ""
    header_uname = unquote(x_user_username).strip() if x_user_username else ""
    if simulado(env, "CLERK_JWKS_URL"):
        uid = "usuario-local"
        uname = header_uname or "usuario-local"
        dname = header_dname or "Usuario Local"
        return {"user_id": uid, "username": uname, "display_name": dname}

    token = authorization.removeprefix("Bearer ").strip()
    try:
        kid = jwt.get_unverified_header(token)["kid"]
        key = await _get_clerk_key(env, kid)
        if key is None:
            raise HTTPException(401, "Clave desconocida")
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=env.CLERK_ISSUER,
            options={"verify_aud": False},
        )
    except Exception:
        raise HTTPException(401, "Token de Clerk inválido")

    sub = claims["sub"]
    uname = claims.get("username") or header_uname or sub[-8:]
    dname = claims.get("name") or header_dname or uname
    return {
        "user_id": sub,
        "clerk_user_id": sub,
        "username": uname,
        "display_name": dname,
    }


# ---------------------------------------------------------------- Modelos Pydantic
class LegacyLinkBody(BaseModel):
    username: str
    password: str


class AnswerBody(BaseModel):
    question_id: str
    selected_option: int
    response_time_ms: int = 0


# ---------------------------------------------------------------- Helpers de Datos (Local vs Neon)
async def ensure_user_in_db(env, user: dict):
    if use_local_db(env):
        if user["user_id"] not in _mem_users:
            _mem_users[user["user_id"]] = {
                "user_id": user["user_id"],
                "username": user["username"],
                "display_name": user["display_name"],
                "password_hash": "",
                "created_at": _ahora(),
            }
        return
    clerk_user_id = user.get("clerk_user_id")
    if not clerk_user_id:
        raise HTTPException(401, "Se requiere una identidad de Clerk")
    rows = await neon_sql(
        env,
        "select user_id, username, display_name from quiz_users where clerk_user_id = $1",
        [clerk_user_id],
    )
    if rows:
        db_user = rows[0]
        if user.get("display_name") and user["display_name"] not in ("Participante", db_user["display_name"]):
            await neon_sql(
                env,
                "update quiz_users set display_name = $1 where user_id = $2",
                [user["display_name"], db_user["user_id"]],
            )
            db_user["display_name"] = user["display_name"]
        user.update(db_user)
        user["clerk_user_id"] = clerk_user_id
        return
    uname = user["username"]
    existing = await neon_sql(
        env, "select user_id, clerk_user_id from quiz_users where username = $1", [uname]
    )
    if existing:
        if existing[0].get("clerk_user_id"):
            uname = f"{uname}_{clerk_user_id[-4:]}"
            user["username"] = uname
        else:
            raise HTTPException(
                409,
                "Ya existe una cuenta con ese usuario. Vinculá tu cuenta anterior para recuperar tu progreso.",
            )
    internal_user_id = f"clerk:{clerk_user_id}"
    await neon_sql(
        env,
        """
        insert into quiz_users (user_id, username, display_name, password_hash, clerk_user_id)
        values ($1, $2, $3, '', $4)
        on conflict (user_id) do update set display_name = excluded.display_name
        """,
        [internal_user_id, uname, user["display_name"], clerk_user_id],
    )
    user["user_id"] = internal_user_id


async def link_legacy_account(
    env, clerk_user: dict, username: str, password: str
) -> dict:
    clerk_user_id = clerk_user.get("clerk_user_id")
    if not clerk_user_id:
        raise HTTPException(401, "Iniciá sesión con Clerk antes de vincular tu cuenta.")

    uname = username.strip().lower()
    password = password.strip()
    if not uname or not password:
        raise HTTPException(400, "Ingresá tu usuario y contraseña anteriores.")

    if use_local_db(env):
        legacy_user = next(
            (u for u in _mem_users.values() if u["username"] == uname), None
        )
        if not legacy_user:
            raise HTTPException(404, "No encontramos una cuenta anterior con ese usuario.")
        if legacy_user.get("clerk_user_id") != clerk_user_id and not hmac.compare_digest(
            str(legacy_user.get("password_hash", "")), _hash_pw(password)
        ):
            raise HTTPException(401, "El usuario o la contraseña anteriores no coinciden.")
        existing_user_id = _mem_clerk_user_ids.get(clerk_user_id)
        if existing_user_id and existing_user_id != legacy_user["user_id"]:
            raise HTTPException(409, "Esta cuenta de Clerk ya está vinculada a otra cuenta.")
        if legacy_user.get("clerk_user_id") not in (None, clerk_user_id):
            raise HTTPException(409, "La cuenta anterior ya está vinculada a otra identidad.")
        legacy_user["clerk_user_id"] = clerk_user_id
        legacy_user["password_hash"] = None
        _mem_clerk_user_ids[clerk_user_id] = legacy_user["user_id"]
    else:
        rows = await neon_sql(
            env,
            """
            select user_id, username, display_name, password_hash, clerk_user_id
            from quiz_users where username = $1
            """,
            [uname],
        )
        if not rows:
            raise HTTPException(404, "No encontramos una cuenta anterior con ese usuario.")
        legacy_user = rows[0]
        if legacy_user.get("clerk_user_id") != clerk_user_id and not hmac.compare_digest(
            str(legacy_user.get("password_hash") or ""), _hash_pw(password)
        ):
            raise HTTPException(401, "El usuario o la contraseña anteriores no coinciden.")
        mapped = await neon_sql(
            env,
            "select user_id from quiz_users where clerk_user_id = $1",
            [clerk_user_id],
        )
        if mapped and mapped[0]["user_id"] != legacy_user["user_id"]:
            raise HTTPException(409, "Esta cuenta de Clerk ya está vinculada a otra cuenta.")
        if legacy_user.get("clerk_user_id") not in (None, clerk_user_id):
            raise HTTPException(409, "La cuenta anterior ya está vinculada a otra identidad.")
        linked = await neon_sql(
            env,
            """
            update quiz_users set clerk_user_id = $1, password_hash = null
            where user_id = $2 and clerk_user_id is null
            returning user_id
            """,
            [clerk_user_id, legacy_user["user_id"]],
        )
        if not linked and legacy_user.get("clerk_user_id") != clerk_user_id:
            raise HTTPException(409, "No se pudo vincular la cuenta anterior.")

    clerk_user.update(
        {
            "user_id": legacy_user["user_id"],
            "clerk_user_id": clerk_user_id,
            "username": legacy_user["username"],
            "display_name": legacy_user["display_name"],
        }
    )
    return clerk_user


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
                "response_time_ms": int(r.get("response_time_ms") or 0),
            }
            for (uid, _), r in _mem_responses.items()
            if uid == user_id
        }
    rows = await neon_sql(
        env,
        "select question_id, selected_option, is_correct, answered_at, coalesce(response_time_ms, 0)::int as response_time_ms from quiz_responses where user_id = $1",
        [user_id],
    )
    return {
        row["question_id"]: {
            "selected_option": int(row["selected_option"]),
            "is_correct": bool(row["is_correct"]),
            "answered_at": str(row["answered_at"]),
            "response_time_ms": int(row.get("response_time_ms") or 0),
        }
        for row in rows
    }


# ---------------------------------------------------------------- Rutas de API
@app.get("/health")
async def health():
    return {
        "ok": True,
        "service": "quiz-fceqyn-api",
        "total_questions": len(QUESTIONS),
        "subjects": [s["id"] for s in SUBJECTS],
    }


@app.get("/api/subjects")
async def list_subjects():
    result = []
    for s in SUBJECTS:
        qs = get_questions_for_subject(s["id"])
        result.append({
            **s,
            "question_count": len(qs),
        })
    return result


@app.post("/api/auth/register", status_code=201)
async def register():
    raise HTTPException(410, "El registro ahora se realiza con Clerk.")


@app.post("/api/auth/login")
async def login():
    raise HTTPException(410, "El inicio de sesión ahora se realiza con Clerk.")


@app.post("/api/auth/link-legacy")
async def link_legacy(body: LegacyLinkBody, request: Request, user: dict = Depends(current_user)):
    env = get_env(request)
    linked_user = await link_legacy_account(env, user, body.username, body.password)
    return {
        "linked": True,
        "user": {
            "user_id": linked_user["user_id"],
            "username": linked_user["username"],
            "display_name": linked_user["display_name"],
        },
    }


@app.get("/api/me")
async def me(request: Request, subject: str | None = None, user: dict = Depends(current_user)):
    env = get_env(request)
    await ensure_user_in_db(env, user)
    all_my_answers = await get_user_responses(env, user["user_id"])
    if subject:
        subj_qids = {q["id"] for q in get_questions_for_subject(subject)}
        my_answers = {k: v for k, v in all_my_answers.items() if k in subj_qids}
    else:
        my_answers = all_my_answers
    correct_count = sum(1 for a in my_answers.values() if a["is_correct"])
    answered_count = len(my_answers)
    return {
        "user": user,
        "subject": (subject or "all").lower(),
        "answered_count": answered_count,
        "correct_count": correct_count,
        "score": correct_count * 10,
        "accuracy_pct": round((correct_count / answered_count) * 100, 1) if answered_count > 0 else 0.0,
        "answers": my_answers,
    }


@app.get("/api/questions")
async def list_questions(request: Request, subject: str | None = None):
    env = get_env(request)
    stats = await compute_all_question_stats(env)
    qs = get_questions_for_subject(subject) if subject else QUESTIONS
    return [
        {
            **q,
            "stats": stats[q["id"]],
        }
        for q in qs
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
    r_time = max(0, int(body.response_time_ms or 0))
    practice_retry = False

    if use_local_db(env):
        if (user["user_id"], q["id"]) in _mem_responses:
            practice_retry = True
        else:
            _mem_responses[(user["user_id"], q["id"])] = {
                "user_id": user["user_id"],
                "question_id": q["id"],
                "selected_option": body.selected_option,
                "is_correct": is_correct,
                "answered_at": now_str,
                "response_time_ms": r_time,
            }
    else:
        inserted = await neon_sql(
            env,
            """
            insert into quiz_responses (user_id, question_id, selected_option, is_correct, answered_at, response_time_ms)
            values ($1, $2, $3, $4, now(), $5)
            on conflict (user_id, question_id)
            do nothing
            returning id
            """,
            [user["user_id"], q["id"], body.selected_option, is_correct, r_time],
        )
        if not inserted:
            practice_retry = True

    all_stats = await compute_all_question_stats(env)
    all_my_answers = await get_user_responses(env, user["user_id"])
    q_subject = q.get("subject", "redes2")
    subj_qids = {item["id"] for item in get_questions_for_subject(q_subject)}
    my_answers = {k: v for k, v in all_my_answers.items() if k in subj_qids}
    correct_count = sum(1 for a in my_answers.values() if a["is_correct"])
    answered_count = len(my_answers)

    return {
        "question_id": q["id"],
        "subject": q_subject,
        "selected_option": body.selected_option,
        "is_correct": is_correct,
        "correct_option": q["correct"],
        "response_time_ms": r_time,
        "practice_retry": practice_retry,
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
async def reset_my_answers(request: Request, subject: str | None = None, user: dict = Depends(current_user)):
    env = get_env(request)
    uid = user["user_id"]
    if subject:
        subj_qids = [q["id"] for q in get_questions_for_subject(subject)]
    else:
        subj_qids = None

    if use_local_db(env):
        keys_to_del = [
            k for k in _mem_responses
            if k[0] == uid and (subj_qids is None or k[1] in set(subj_qids))
        ]
        for k in keys_to_del:
            del _mem_responses[k]
    else:
        if subj_qids is not None:
            if subj_qids:
                await neon_sql(
                    env,
                    "delete from quiz_responses where user_id = $1 and question_id = any($2::text[])",
                    [uid, subj_qids],
                )
        else:
            await neon_sql(env, "delete from quiz_responses where user_id = $1", [uid])
    return {"ok": True}


@app.get("/api/leaderboard")
async def get_leaderboard(request: Request, subject: str | None = None):
    env = get_env(request)
    subj_questions = get_questions_for_subject(subject) if subject else QUESTIONS
    total_questions = len(subj_questions)
    if total_questions == 0:
        return []
    subj_qids = [q["id"] for q in subj_questions]
    subj_qids_set = set(subj_qids)

    if use_local_db(env):
        board = []
        for uid, u in _mem_users.items():
            user_resps = [
                r for (r_uid, qid), r in _mem_responses.items()
                if r_uid == uid and qid in subj_qids_set
            ]
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
        where r.question_id = any($1::text[])
        group by u.user_id, u.username, u.display_name
        order by correct_count desc, answered_count asc, u.display_name asc
        """,
        [subj_qids],
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
