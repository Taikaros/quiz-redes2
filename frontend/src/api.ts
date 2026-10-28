export type QuestionStats = {
  total_responses: number
  correct_responses: number
  correct_pct: number
  option_counts: number[]
  option_pcts: number[]
}

export type Question = {
  id: string
  unit: string
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
}

export type MeResponse = {
  user: UserProfile
  answered_count: number
  correct_count: number
  score: number
  accuracy_pct: number
  answers: Record<string, UserAnswerRecord>
}

export type AnswerResponse = {
  question_id: string
  selected_option: number
  is_correct: boolean
  correct_option: number
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
  me: () => Promise<MeResponse>
  questions: () => Promise<Question[]>
  submitAnswer: (question_id: string, selected_option: number) => Promise<AnswerResponse>
  resetMyAnswers: () => Promise<{ ok: boolean }>
  leaderboard: () => Promise<LeaderboardEntry[]>
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
    // API simulada en el navegador si todavía no se configuró VITE_API_URL (igual que en taller-jcsa-2026)
    return {
      me: async () => {
        const answered_count = Object.keys(mockMyAnswers).length
        const correct_count = Object.values(mockMyAnswers).filter((a) => a.is_correct).length
        return {
          user: {
            user_id: `demo:${userInfo.username}`,
            username: userInfo.username,
            display_name: userInfo.displayName,
          },
          answered_count,
          correct_count,
          score: correct_count * 10,
          accuracy_pct: answered_count > 0 ? Math.round((correct_count / answered_count) * 1000) / 10 : 0,
          answers: { ...mockMyAnswers },
        }
      },
      questions: async () =>
        BASE_QUESTIONS.map((q) => ({
          ...q,
          stats: buildMockStats(q.id, q.correct),
        })),
      submitAnswer: async (question_id, selected_option) => {
        const q = BASE_QUESTIONS.find((x) => x.id === question_id)!
        const prev = mockMyAnswers[question_id]
        if (prev) {
          mockCounts[question_id][prev.selected_option] = Math.max(
            0,
            mockCounts[question_id][prev.selected_option] - 1,
          )
        }
        mockCounts[question_id][selected_option] = (mockCounts[question_id][selected_option] || 0) + 1
        const is_correct = selected_option === q.correct
        mockMyAnswers[question_id] = {
          selected_option,
          is_correct,
          answered_at: new Date().toISOString(),
        }
        const answered_count = Object.keys(mockMyAnswers).length
        const correct_count = Object.values(mockMyAnswers).filter((a) => a.is_correct).length
        return {
          question_id,
          selected_option,
          is_correct,
          correct_option: q.correct,
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
      leaderboard: async () => {
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

  return {
    me: () => call<MeResponse>('/api/me'),
    questions: () => call<Question[]>('/api/questions'),
    submitAnswer: (question_id, selected_option) =>
      call<AnswerResponse>('/api/answer', {
        method: 'POST',
        body: JSON.stringify({
          question_id,
          selected_option,
          display_name: userInfo.displayName,
          username: userInfo.username,
        }),
      }),
    resetMyAnswers: () =>
      call<{ ok: boolean }>('/api/reset-my-answers', {
        method: 'POST',
      }),
    linkLegacyAccount: (username, password) =>
      call<{ linked: boolean; user: UserProfile }>('/api/auth/link-legacy', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    leaderboard: () => call<LeaderboardEntry[]>('/api/leaderboard'),
  }
}
