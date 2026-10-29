export type SubjectId = 'so' | 'redes2'

export type SubjectTopic = {
  code: string
  title: string
  detail: string
}

export type SubjectConfig = {
  id: SubjectId
  code: string
  name: string
  short_name: string
  theme: 'green' | 'blue'
  primary_color: string
  course_id: number
  exam_status: 'confirmed' | 'completed'
  exam_badge: string
  exam_title: string
  exam_date: string
  professors: string
  schedule: string
  description: string
  topics: SubjectTopic[]
  question_count?: number
}

export const SUBJECTS_CATALOG: Record<SubjectId, SubjectConfig> = {
  so: {
    id: 'so',
    code: 'SO',
    name: 'Sistemas Operativos',
    short_name: 'Sistemas Operativos',
    theme: 'green',
    primary_color: '#059669',
    course_id: 51,
    exam_status: 'confirmed',
    exam_badge: 'Examen Confirmado • Jueves 05/11/2026 — 10:00 h',
    exam_title: '1er Parcial Práctico — Sistemas Operativos',
    exam_date: '2026-11-05T10:00:00-03:00',
    professors: 'Prof. Reg. Adj. Ing. Rubén Castaño • Aux. 1a Lic. Claudio Biale',
    schedule: 'Teoría: Martes 14:00 a 16:00 h • Práctica: Jueves 10:00 a 12:00 h',
    description:
      'Preparcial interactivo sincronizado con el Aula Virtual FCEQyN (Curso #51). Incluye los 4 ejes prácticos confirmados en Avisos por el Prof. Claudio Biale para el parcial del jueves 05/11/2026.',
    topics: [
      {
        code: 'TP 1 • Planificación de CPU',
        title: 'Planificación de CPU',
        detail: 'Criterios, algoritmos FCFS, SJF/SRTF, Prioridades, Round-Robin y Colas Multinivel',
      },
      {
        code: 'TP 2 • Gestión de Procesos',
        title: 'Gestión de Procesos',
        detail: 'Estados, PCB, cambio de contexto, creación y terminación (fork, exec, wait), procesos zombi y huérfanos',
      },
      {
        code: 'TP 2 • Señales y Tuberías',
        title: 'Señales y Tuberías (Pipes)',
        detail: 'Comunicación entre procesos (IPC), manejo de señales POSIX y tuberías en lenguaje C',
      },
      {
        code: 'TP 3 • Interbloqueos',
        title: 'Interbloqueos (Deadlocks)',
        detail: 'Condiciones de Coffman, Grafo de Asignación de Recursos, prevención, detección y Algoritmo del Banquero',
      },
    ],
  },
  redes2: {
    id: 'redes2',
    code: 'R2',
    name: 'Comunicaciones y Redes II',
    short_name: 'Comunicaciones y Redes II',
    theme: 'blue',
    primary_color: '#1d4ed8',
    course_id: 50,
    exam_status: 'completed',
    exam_badge: '1er Parcial Rendido • Jueves 29/10/2026 — Banco Activo',
    exam_title: '1er Parcial Práctico — Capas 1 a 4 (TP 01 al TP 06 + Labs 01 al 04)',
    exam_date: '2026-10-29T13:00:00-03:00',
    professors: 'Cátedra Comunicaciones y Redes II — FCEQyN UNaM',
    schedule: 'TP 01 al TP 06 y Laboratorios 01 al 04 (Capas 1 a 4 OSI)',
    description:
      'Banco colaborativo de 58 ejercicios de parcial con aprendizaje adaptativo (> 1 min), simulacro por pulls, multi-selección de temas y ranking en tiempo real.',
    topics: [
      {
        code: 'TP 01 / Lab 01',
        title: 'TP 01 / Lab 01: Dispositivos y Dimensionamiento',
        detail: 'Dominios colisión/broadcast, Backplane Full-Duplex y Uplink 20:1',
      },
      {
        code: 'Lab 02',
        title: 'Lab 02: Cableado Estructurado TIA/EIA-568',
        detail: 'Cableado Estructurado ANSI/TIA/EIA-568, T568A/B y enlace de 100 m',
      },
      {
        code: 'TP 03 / Lab 03',
        title: 'TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP',
        detail: 'Trama 802.3, VLAN 802.1Q, STP 802.1D vs RSTP 802.1w, PoE e IOS CLI',
      },
      {
        code: 'TP 04 / Lab 04',
        title: 'TP 04 / Lab 04: Fibra Óptica, OTDR y GPON',
        detail: 'Fibra SMF vs MMF, GPON (WDM/TDMA/DBA), Fusión, OTDR y ORL',
      },
      {
        code: 'TP 05',
        title: 'TP 05: Redes Inalámbricas IEEE 802.11 (Wi-Fi)',
        detail: 'Wi-Fi 6E/7 (ENACOM 756/2023), Canales, DFS, Cálculo CWNP y Espectro RF',
      },
      {
        code: 'TP 06',
        title: 'TP 06: IPv4, Encapsulamiento y Fragmentación',
        detail: 'IPv4, Encapsulamiento VoIP/RTP/UDP, Cabecera IP, TTL, ICMP y Wireshark',
      },
    ],
  },
}

export const OTHER_ENROLLED_COURSES = [
  {
    course_id: 251,
    code: 'IS3',
    name: 'Ingeniería de Software III - Actualidad Informática',
    status: 'Cursando en Aula Virtual • Sin fecha de parcial confirmada',
  },
  {
    course_id: 47,
    code: 'SI',
    name: 'Sistemas de Información',
    status: 'Cursando en Aula Virtual • Sin fecha de parcial confirmada',
  },
  {
    course_id: 921,
    code: 'AC',
    name: 'Arquitectura de Computadoras (ASC Posadas)',
    status: 'Cursando en Aula Virtual • Sin fecha de parcial confirmada',
  },
  {
    course_id: 474,
    code: 'POO2',
    name: 'Programación Orientada a Objetos II',
    status: 'Cursando en Aula Virtual • Sin fecha de parcial confirmada',
  },
]

export type QuestionStats = {
  total_responses: number
  correct_responses: number
  correct_pct: number
  option_counts: number[]
  option_pcts: number[]
}

export type Question = {
  id: string
  subject?: SubjectId
  unit: string
  style?: string
  question: string
  options: string[]
  correct: number
  explanation: string
  stats: QuestionStats
}

export type UserProfile = {
  user_id: string
  username: string
  display_name: string
}

export type UserAnswerRecord = {
  selected_option: number
  is_correct: boolean
  answered_at: string
  response_time_ms?: number
  practice_retry?: boolean
}

export type MeResponse = {
  user: UserProfile
  subject?: string
  answered_count: number
  correct_count: number
  score: number
  accuracy_pct: number
  answers: Record<string, UserAnswerRecord>
}

export type AnswerResponse = {
  question_id: string
  subject?: string
  selected_option: number
  is_correct: boolean
  correct_option: number
  response_time_ms?: number
  practice_retry?: boolean
  explanation: string
  stats: QuestionStats
  user_summary: {
    answered_count: number
    correct_count: number
    score: number
    accuracy_pct: number
  }
}

export type LeaderboardEntry = {
  rank: number
  user_id: string
  username: string
  display_name: string
  score: number
  correct_count: number
  answered_count: number
  total_questions: number
  accuracy_pct: number
  exam_grade_pct: number
}

export type Api = {
  subjects: () => Promise<SubjectConfig[]>
  me: (subject?: SubjectId) => Promise<MeResponse>
  questions: (subject?: SubjectId) => Promise<Question[]>
  submitAnswer: (question_id: string, selected_option: number, response_time_ms?: number) => Promise<AnswerResponse>
  resetMyAnswers: (subject?: SubjectId) => Promise<{ ok: boolean }>
  leaderboard: (subject?: SubjectId) => Promise<LeaderboardEntry[]>
  linkLegacyAccount: (username: string, password: string) => Promise<{
    linked: boolean
    user: UserProfile
  }>
}

const API = (
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
  'https://quiz-redes2-api.kyasutora.workers.dev'
).replace(/\/+$/, '')

// ---------------------------------------------------------------- Banco de Preguntas para el Modo Demo (cuando no hay VITE_API_URL)
const BASE_QUESTIONS: Omit<Question, 'stats'>[] = [
  {
    id: 'tp1-1',
    unit: 'TP 01 / Lab 01: Dispositivos y Dimensionamiento',
    question:
      'Un switch Capa 2 de 24 puertos tiene todos sus puertos asignados a la VLAN por defecto (VLAN 1) y conectados a distintas PCs. ¿Cuántos dominios de colisión y cuántos dominios de broadcast existen en ese switch?',
    options: [
      '1 dominio de colisión y 24 dominios de broadcast.',
      '24 dominios de colisión independientes y 1 único dominio de broadcast.',
      '1 único dominio de colisión y 1 único dominio de broadcast.',
      '24 dominios de colisión y 24 dominios de broadcast.',
    ],
    correct: 1,
    explanation:
      'Un Switch L2 microsegmenta la red creando 1 dominio de colisión independiente por cada puerto. Sin embargo, las tramas Broadcast (FF:FF:FF:FF:FF:FF) se inundan por todos los puertos de la misma VLAN, formando 1 único dominio de broadcast.',
  },
  {
    id: 'tp1-2',
    unit: 'TP 01 / Lab 01: Dispositivos y Dimensionamiento',
    question:
      '¿Qué acción toma un Switch Capa 2 cuando recibe una trama cuya dirección MAC de destino NO se encuentra aún en su tabla CAM (MAC Address Table)?',
    options: [
      'Descarta la trama inmediatamente y envía un mensaje ICMP al origen.',
      'Consulta al router puerta de enlace predeterminada mediante ARP.',
      'Aprende la MAC de origen asociándola al puerto de entrada e inunda (flooding) la trama por todos los demás puertos activos de esa VLAN.',
      'Reenvía la trama únicamente por el puerto troncal (Uplink).',
    ],
    correct: 2,
    explanation:
      'El switch construye su tabla CAM inspeccionando siempre la MAC Origen de cada trama entrante. Si la MAC Destino es desconocida (Unicast desconocido) o Broadcast, aplica inundación (flooding) por todos los puertos de esa misma VLAN excepto por el de ingreso.',
  },
  {
    id: 'tp1-3',
    unit: 'TP 01 / Lab 01: Dispositivos y Dimensionamiento',
    question:
      'Se desea transferir un archivo de 150 MB entre dos estaciones a través de un enlace FastEthernet (100 Mbps). ¿Cuál es el tiempo teórico mínimo de transferencia y por qué el tiempo real será mayor?',
    options: [
      '1,5 segundos; en la práctica tarda más solo si el cable UTP supera los 50 metros.',
      '12 segundos teóricos (150 MB × 8 = 1200 Mbits / 100 Mbps); en la práctica es mayor por el overhead de cabeceras (Ethernet/IP/TCP), Interframe Gap, ACKs y contienda.',
      '15 segundos teóricos; porque FastEthernet reserva 20% del canal para tramas BPDU.',
      '120 segundos teóricos; porque cada Byte lleva 8 bits de paridad en Ethernet.',
    ],
    correct: 1,
    explanation:
      'Cálculo del TP 01: 150 MB × 8 bits/Byte = 1200 Mbits. Dividiendo por el ancho de banda nominal: 1200 Mbps / 100 Mbps = 12 segundos teóricos. En la práctica es mayor por cabeceras L2/L3/L4, IFG y confirmaciones.',
  },
  {
    id: 'tp1-4',
    unit: 'TP 01 / Lab 01: Dispositivos y Dimensionamiento',
    question:
      'Necesitás adquirir un Switch de acceso GigabitEthernet de 48 puertos que garantice conmutación Wire-Speed (Non-Blocking) en modo Full-Duplex. ¿Cuál debe ser la capacidad mínima de su matriz de conmutación (Backplane)?',
    options: ['48 Gbps', '96 Gbps', '24 Gbps', '192 Gbps'],
    correct: 1,
    explanation:
      'Fórmula Backplane Non-Blocking Full-Duplex: N° Puertos × Velocidad × 2. Para 48 puertos de 1 Gbps que transmiten y reciben simultáneamente: 48 × 1 Gbps × 2 = 96 Gbps (y para 24 puertos GbE es 48 Gbps).',
  },
  {
    id: 'tp1-5',
    unit: 'TP 01 / Lab 01: Dispositivos y Dimensionamiento',
    question:
      'Un switch de capa de acceso posee 48 puertos de 1 Gbps para puestos de trabajo y se diseña aplicando una relación de sobresuscripción (oversubscription) estándar de 20:1 hacia distribución. ¿Qué ancho de banda de Uplink requiere como mínimo?',
    options: [
      '48 Gbps (sin sobresuscripción)',
      '2,4 Gbps (cubierto con un enlace de 2.5G o 10GBASE)',
      '0,5 Gbps (cubierto con FastEthernet)',
      '20 Gbps (dos enlaces de 10G)',
    ],
    correct: 1,
    explanation:
      'Capacidad total de acceso = 48 × 1 Gbps = 48 Gbps. Con relación de sobresuscripción 20:1: 48 Gbps / 20 = 2,4 Gbps (cubierto con un uplink 2.5G o 10G SFP+).',
  },
  {
    id: 'lab2-1',
    unit: 'Lab 02: Cableado Estructurado TIA/EIA-568',
    question:
      'Según la norma ANSI/TIA/EIA-568, ¿cuál es la longitud máxima permitida para el Canal Horizontal completo y cómo se distribuye entre el cable fijo y los patch cords?',
    options: [
      '100 metros totales: hasta 90 metros de Enlace Permanente (cable sólido fijo) y hasta 10 metros combinados para patch cords (área de trabajo + gabinete).',
      '90 metros totales: 85 metros de cable fijo y 5 metros de patch cords.',
      '100 metros de enlace fijo más 20 metros adicionales de patch cords (120 m en total).',
      '300 metros utilizando cable UTP Categoría 6.',
    ],
    correct: 0,
    explanation:
      'El canal horizontal completo no debe superar los 100 m: máximo 90 m para el enlace permanente (desde el patch panel hasta la roseta RJ-45 de pared) y máximo 10 m combinados para los patch cords flexibles.',
  },
  {
    id: 'lab2-2',
    unit: 'Lab 02: Cableado Estructurado TIA/EIA-568',
    question:
      'Al armar una ficha RJ-45 bajo la norma T568B, ¿qué colores van ubicados en los pines 1, 2, 3 y 6 respectivamente?',
    options: [
      '1: Blanco/Verde, 2: Verde, 3: Blanco/Naranja, 6: Naranja',
      '1: Blanco/Naranja, 2: Naranja, 3: Blanco/Verde, 6: Verde',
      '1: Blanco/Naranja, 2: Naranja, 3: Blanco/Azul, 6: Azul',
      '1: Blanco/Verde, 2: Verde, 3: Blanco/Marrón, 6: Marrón',
    ],
    correct: 1,
    explanation:
      'Secuencia T568B (pines 1 al 8): 1-Blanco/Naranja, 2-Naranja, 3-Blanco/Verde, 4-Azul, 5-Blanco/Azul, 6-Verde, 7-Blanco/Marrón, 8-Marrón. (T568A intercambia los pares Verde y Naranja).',
  },
  {
    id: 'tp3-1',
    unit: 'TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP',
    question:
      'Cuando una trama Ethernet atraviesa un enlace Troncal (Trunk) bajo el estándar IEEE 802.1Q, ¿dónde se inserta la etiqueta de VLAN, cuántos bytes mide y cómo afecta al tamaño máximo de trama y al FCS?',
    options: [
      'Se inserta al final de la trama después del FCS; mide 2 bytes y no altera el FCS original.',
      'Se inserta entre la MAC Origen y el campo Tipo/Longitud; mide 4 bytes (TPID 0x8100 de 2B + TCI de 2B), eleva la trama máxima de 1518 a 1522 bytes y obliga a recalcular el FCS (CRC).',
      'Se inserta delante del Preámbulo; mide 8 bytes y mantiene el límite de 1500 bytes.',
      'Reemplaza la dirección MAC Origen por el ID de VLAN; mide 6 bytes.',
    ],
    correct: 1,
    explanation:
      'La etiqueta IEEE 802.1Q de 4 bytes se inserta entre MAC Origen y EtherType/Longitud. Está formada por TPID (0x8100) y TCI (PCP 3b + DEI 1b + VID 12b), sube la trama máxima a 1522 bytes y exige recalcular el FCS.',
  },
  {
    id: 'tp3-4',
    unit: 'TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP',
    question:
      'Caso del Lab 03: S1 es el Root Bridge y se conecta a S2 y S3 mediante enlaces FastEthernet (100 Mbps, costo 19). A su vez, S2 y S3 están unidos entre sí por un enlace GigabitEthernet (1 Gbps, costo 4). ¿Por qué STP bloquea un extremo del enlace Gigabit entre S2 y S3?',
    options: [
      'Porque STP no soporta enlaces GigabitEthernet y los desactiva por incompatibilidad.',
      'Porque cada switch no-raíz elige su Root Port evaluando el costo acumulado hacia el Root Bridge (S1): ir directo a S1 por FastEthernet cuesta 19, mientras que ir vía el otro switch por el enlace Gigabit costaría 4 + 19 = 23 > 19. Así el segmento Gigabit queda como camino redundante y se bloquea.',
      'Porque en STP los enlaces con menor costo siempre se bloquean por seguridad.',
      'Porque los puertos Gigabit tienen mayor prioridad física.',
    ],
    correct: 1,
    explanation:
      'STP elige Root Ports mirando el costo acumulado hacia el Root Bridge (S1). Como desde S2 y S3 hacia S1 el camino directo por FastEthernet cuesta 19 (menor que 4 + 19 = 23), el enlace Gigabit entre S2 y S3 queda como redundante y se bloquea en un extremo.',
  },
  {
    id: 'tp4-2',
    unit: 'TP 04 / Lab 04: Fibra Óptica, OTDR y GPON',
    question:
      'En una red GPON (ITU-T G.984), ¿qué longitudes de onda, velocidades nominales y métodos de acceso al medio se utilizan en Bajada (Downstream) y en Subida (Upstream) sobre el mismo pelo de fibra?',
    options: [
      'Bajada en 850 nm por CSMA/CD y Subida en 1300 nm por Token Ring.',
      'Bajada (OLT → ONTs) en 1490 nm a 2,488 Gbps en modo Broadcast cifrado con AES; Subida (ONTs → OLT) en 1310 nm a 1,244 Gbps usando TDMA con proceso de Ranging.',
      'Bajada en 1310 nm a 1 Gbps y Subida en 1490 nm a 10 Gbps.',
      'Usa dos fibras separadas: una para bajada y otra para subida en 1550 nm.',
    ],
    correct: 1,
    explanation:
      'Mediante WDM sobre un solo pelo de fibra: Bajada en 1490 nm (2,48832 Gbps) en modo Broadcast con cifrado AES-128; Subida en 1310 nm (1,24416 Gbps) mediante TDMA y ecualización de retardo (Ranging).',
  },
  {
    id: 'tp5-4',
    unit: 'TP 05: Redes Inalámbricas IEEE 802.11 (Wi-Fi)',
    question:
      'Caso Aula Magna (CWNP): Asisten 180 usuarios concurrentes. El 80% se conecta en 5 GHz (144 clientes) y cada uno requiere 4 Mbps. Si cada radio de 5 GHz soporta máximo 30 clientes asociados y entrega 100 Mbps de caudal efectivo, ¿cuántos APs se necesitan como mínimo y por qué?',
    options: [
      '5 APs, porque 144 / 30 = 4,8 redondeado hacia arriba.',
      '6 APs, porque se calcula por clientes (⌈144/30⌉ = 5 APs) y por caudal agregado (144 × 4 Mbps = 576 Mbps → ⌈576/100⌉ = 6 APs), y según la regla CWNP siempre se adopta el MÁXIMO entre ambos criterios (nunca el promedio).',
      '5,5 APs (se instalan 5 APs y un repetidor).',
      '3 APs usando canales de 160 MHz.',
    ],
    correct: 1,
    explanation:
      'Por asociación: ⌈144/30⌉ = 5 APs. Por throughput: ⌈576 Mbps / 100 Mbps⌉ = 6 APs. Siempre se toma el máximo (6 APs) para satisfacer el requerimiento más restrictivo.',
  },
  {
    id: 'tp6-7',
    unit: 'TP 06: IPv4, Encapsulamiento y Fragmentación',
    question:
      'Actividad 5 del TP 06: El cliente 192.168.1.50 envía un ping de 3.000 bytes de carga útil hacia 8.8.8.8 en una red Ethernet (MTU = 1500 bytes, cabecera IP = 20 bytes). Al inspeccionar el PRIMER fragmento en Wireshark, ¿qué valores tienen Total Length, DF, MF, Fragment Offset y Protocol?',
    options: [
      'Total Length = 3028 bytes, DF = 1, MF = 0, Fragment Offset = 0, Protocol = 6 (TCP).',
      'Total Length = 1500 bytes (20 B cabecera IP + 1480 B datos), DF = 0, MF = 1 (More Fragments activo), Fragment Offset = 0, Protocol = 1 (ICMP).',
      'Total Length = 1480 bytes, DF = 0, MF = 0, Fragment Offset = 1480, Protocol = 17 (UDP).',
      'Total Length = 1000 bytes, DF = 1, MF = 1, Fragment Offset = 8, Protocol = 1 (ICMP).',
    ],
    correct: 1,
    explanation:
      'Con MTU de 1500 B y cabecera IP de 20 B, cada fragmento lleva máximo 1480 B de datos. El 1er fragmento tiene Total Length = 1500, DF = 0, MF = 1 (faltan más fragmentos), Fragment Offset = 0 y Protocol = 1 (ICMP).',
  },
]

// Estado simulado en memoria del navegador cuando no está configurada VITE_API_URL
const mockCounts: Record<string, number[]> = {}
BASE_QUESTIONS.forEach((q, idx) => {
  const counts = [1, 1, 1, 1]
  counts[q.correct] = 6 + (idx % 4)
  mockCounts[q.id] = counts
})
let mockMyAnswers: Record<string, UserAnswerRecord> = {}

function buildMockStats(qid: string, correctIdx: number): QuestionStats {
  const counts = mockCounts[qid] || [0, 0, 0, 0]
  const total = counts.reduce((a, b) => a + b, 0)
  const correctCnt = counts[correctIdx] || 0
  return {
    total_responses: total,
    correct_responses: correctCnt,
    correct_pct: total > 0 ? Math.round((correctCnt / total) * 1000) / 10 : 0,
    option_counts: [...counts],
    option_pcts: counts.map((c) => (total > 0 ? Math.round((c / total) * 1000) / 10 : 0)),
  }
}

export function createApi(
  getToken: () => Promise<string | null>,
  userInfo: { displayName: string; username: string } = { displayName: 'Participante', username: 'user' },
): Api {
  if (!API) {
    // API simulada en el navegador si todavía no se configuró VITE_API_URL
    return {
      subjects: async () => [
        { ...SUBJECTS_CATALOG.so, question_count: 0 },
        { ...SUBJECTS_CATALOG.redes2, question_count: BASE_QUESTIONS.length },
      ],
      me: async (subject = 'redes2') => {
        const answers = subject === 'so' ? {} : { ...mockMyAnswers }
        const answered_count = Object.keys(answers).length
        const correct_count = Object.values(answers).filter((a) => a.is_correct).length
        return {
          user: {
            user_id: `demo:${userInfo.username}`,
            username: userInfo.username,
            display_name: userInfo.displayName,
          },
          subject,
          answered_count,
          correct_count,
          score: correct_count * 10,
          accuracy_pct: answered_count > 0 ? Math.round((correct_count / answered_count) * 1000) / 10 : 0,
          answers,
        }
      },
      questions: async (subject = 'redes2') =>
        subject === 'so'
          ? []
          : BASE_QUESTIONS.map((q) => ({
              ...q,
              subject: 'redes2' as SubjectId,
              stats: buildMockStats(q.id, q.correct),
            })),
      submitAnswer: async (question_id, selected_option, response_time_ms = 0) => {
        const q = BASE_QUESTIONS.find((x) => x.id === question_id)!
        const prev = mockMyAnswers[question_id]
        const is_correct = selected_option === q.correct
        const practice_retry = Boolean(prev)
        if (!prev) {
          mockCounts[question_id][selected_option] = (mockCounts[question_id][selected_option] || 0) + 1
          mockMyAnswers[question_id] = {
            selected_option,
            is_correct,
            answered_at: new Date().toISOString(),
            response_time_ms,
            practice_retry: false,
          }
        }
        const answered_count = Object.keys(mockMyAnswers).length
        const correct_count = Object.values(mockMyAnswers).filter((a) => a.is_correct).length
        return {
          question_id,
          subject: 'redes2',
          selected_option,
          is_correct,
          correct_option: q.correct,
          response_time_ms,
          practice_retry,
          explanation: q.explanation,
          stats: buildMockStats(question_id, q.correct),
          user_summary: {
            answered_count,
            correct_count,
            score: correct_count * 10,
            accuracy_pct: Math.round((correct_count / answered_count) * 1000) / 10,
          },
        }
      },
      resetMyAnswers: async () => {
        mockMyAnswers = {}
        return { ok: true }
      },
      linkLegacyAccount: async () => {
        throw new Error('Vincular una cuenta anterior requiere Clerk y la API configurada.')
      },
      leaderboard: async (subject = 'redes2') => {
        if (subject === 'so') return []
        const answered_count = Object.keys(mockMyAnswers).length
        const correct_count = Object.values(mockMyAnswers).filter((a) => a.is_correct).length
        const list: LeaderboardEntry[] = [
          {
            rank: 1,
            user_id: 'demo:franco',
            username: 'franco',
            display_name: 'Franco H.',
            score: 100,
            correct_count: 10,
            answered_count: 12,
            total_questions: BASE_QUESTIONS.length,
            accuracy_pct: 83.3,
            exam_grade_pct: 83.3,
          },
          {
            rank: 2,
            user_id: 'demo:sofia',
            username: 'sofia',
            display_name: 'Sofía M.',
            score: 90,
            correct_count: 9,
            answered_count: 12,
            total_questions: BASE_QUESTIONS.length,
            accuracy_pct: 75.0,
            exam_grade_pct: 75.0,
          },
        ]
        if (answered_count > 0) {
          list.push({
            rank: 0,
            user_id: `demo:${userInfo.username}`,
            username: userInfo.username,
            display_name: userInfo.displayName,
            score: correct_count * 10,
            correct_count,
            answered_count,
            total_questions: BASE_QUESTIONS.length,
            accuracy_pct: Math.round((correct_count / answered_count) * 1000) / 10,
            exam_grade_pct: Math.round((correct_count / BASE_QUESTIONS.length) * 1000) / 10,
          })
        }
        list.sort((a, b) => b.score - a.score || b.accuracy_pct - a.accuracy_pct)
        return list.map((item, idx) => ({ ...item, rank: idx + 1 }))
      },
    }
  }

  const call = async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const token = await getToken()
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-User-Name': encodeURIComponent(userInfo.displayName),
        'X-User-Username': encodeURIComponent(userInfo.username),
        ...init.headers,
      },
    })
    if (!res.ok) {
      let msg = `Error ${res.status}`
      try {
        const errJson = await res.json()
        if (errJson?.detail) msg = errJson.detail
      } catch {
        // ignore
      }
      throw new Error(msg)
    }
    return (res.status === 204 ? undefined : await res.json()) as T
  }

  const qs = (subject?: SubjectId) => (subject ? `?subject=${encodeURIComponent(subject)}` : '')

  return {
    subjects: () => call<SubjectConfig[]>('/api/subjects'),
    me: (subject) => call<MeResponse>(`/api/me${qs(subject)}`),
    questions: (subject) => call<Question[]>(`/api/questions${qs(subject)}`),
    submitAnswer: (question_id, selected_option, response_time_ms = 0) =>
      call<AnswerResponse>('/api/answer', {
        method: 'POST',
        body: JSON.stringify({
          question_id,
          selected_option,
          response_time_ms: Math.max(0, Math.round(response_time_ms)),
          display_name: userInfo.displayName,
          username: userInfo.username,
        }),
      }),
    resetMyAnswers: (subject) =>
      call<{ ok: boolean }>(`/api/reset-my-answers${qs(subject)}`, {
        method: 'POST',
      }),
    linkLegacyAccount: (username, password) =>
      call<{ linked: boolean; user: UserProfile }>('/api/auth/link-legacy', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    leaderboard: (subject) => call<LeaderboardEntry[]>(`/api/leaderboard${qs(subject)}`),
  }
}
