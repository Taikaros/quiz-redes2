import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Gate, UserMenu, useParticipantInfo, useToken } from './auth'
import { createApi, type Question } from './api'

export type QuizMode = 'pool' | 'topics' | 'all'

const QUIZ_MODE_STORAGE_KEY = 'redes2_quiz_mode'
const QUIZ_TOPICS_STORAGE_KEY = 'redes2_quiz_selected_units'

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function Layout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand-link">
            <span className="brand-logo">R2</span>
            <div>
              <strong>Comunicaciones y Redes II</strong>
              <small>Entrenador 1er Parcial • FCEQyN - UNaM</small>
            </div>
          </Link>

          <nav className="main-nav">
            <Link to="/" activeProps={{ className: 'nav-item active' }} inactiveProps={{ className: 'nav-item' }}>
              Inicio
            </Link>
            <Link to="/quiz" activeProps={{ className: 'nav-item active' }} inactiveProps={{ className: 'nav-item' }}>
              Cuestionario
            </Link>
            <Link
              to="/leaderboard"
              activeProps={{ className: 'nav-item active' }}
              inactiveProps={{ className: 'nav-item' }}
            >
              Leaderboard
            </Link>
            <UserMenu />
          </nav>
        </div>
      </header>

      <main className="main-container">
        <Outlet />
      </main>
    </div>
  )
}

export function Home() {
  const navigate = useNavigate()
  const getToken = useToken()
  const api = useMemo(() => createApi(getToken), [getToken])
  const board = useQuery({
    queryKey: ['leaderboard'],
    queryFn: api.leaderboard,
    refetchInterval: 8000,
  })
  const questions = useQuery({
    queryKey: ['questions'],
    queryFn: api.questions,
  })

  const totalQ = questions.data?.length ?? 58

  const goToQuizMode = (mode: QuizMode, preselectedUnits?: string[]) => {
    try {
      localStorage.setItem(QUIZ_MODE_STORAGE_KEY, mode)
      if (preselectedUnits && preselectedUnits.length > 0) {
        localStorage.setItem(QUIZ_TOPICS_STORAGE_KEY, JSON.stringify(preselectedUnits))
      }
    } catch {
      // ignore storage errors
    }
    void navigate({ to: '/quiz' })
  }

  return (
    <div className="home-grid">
      <section className="hero-card">
        <span className="pill-badge">Parcial Práctico • Jueves 29/10 — 13:00 h</span>
        <h1>Plataforma Colaborativa de Práctica y Ranking</h1>
        <p className="hero-lead">
          Practicá con los ejercicios, cálculos y casos reales de los{' '}
          <strong>TP 01 al TP 06 y Laboratorios 01 al 04</strong>. Elegí entre un{' '}
          <strong>Pull aleatorio tipo simulacro</strong>, un{' '}
          <strong>cuestionario combinando múltiples temas</strong> o el{' '}
          <strong>banco completo con todas las preguntas</strong>.
        </p>

        <div className="mode-cards-home">
          <button
            type="button"
            className="home-mode-card"
            onClick={() => goToQuizMode('pool')}
          >
            <span className="home-mode-icon">🎲</span>
            <div>
              <strong>Pull de Preguntas (Simulacro)</strong>
              <span>Tiradas aleatorias de 10, 15 o 20 preguntas como el cuestionario inicial</span>
            </div>
          </button>

          <button
            type="button"
            className="home-mode-card"
            onClick={() => goToQuizMode('topics')}
          >
            <span className="home-mode-icon">📚</span>
            <div>
              <strong>Cuestionario por Temas (Multi-selección)</strong>
              <span>Seleccioná uno o varios TPs / Laboratorios a la vez para practicar a medida</span>
            </div>
          </button>

          <button
            type="button"
            className="home-mode-card"
            onClick={() => goToQuizMode('all')}
          >
            <span className="home-mode-icon">📋</span>
            <div>
              <strong>Cuestionario Completo ({totalQ} preguntas)</strong>
              <span>Todas las preguntas oficiales del temario de principio a fin</span>
            </div>
          </button>
        </div>

        <div className="hero-actions">
          <Link to="/quiz" className="btn-primary">
            Abrir Cuestionario Ahora
          </Link>
          <Link to="/leaderboard" className="btn-secondary">
            Ver Tabla de Posiciones (Leaderboard)
          </Link>
        </div>

        <div className="topics-grid">
          <button
            type="button"
            className="topic-chip topic-chip-btn"
            onClick={() => goToQuizMode('topics', ['TP 01 / Lab 01: Dispositivos y Dimensionamiento'])}
          >
            <strong>TP 01 / Lab 01</strong>
            <span>Dominios colisión/broadcast, Backplane Full-Duplex y Uplink 20:1</span>
          </button>
          <button
            type="button"
            className="topic-chip topic-chip-btn"
            onClick={() => goToQuizMode('topics', ['Lab 02: Cableado Estructurado TIA/EIA-568'])}
          >
            <strong>Lab 02</strong>
            <span>Cableado Estructurado ANSI/TIA/EIA-568, T568A/B y enlace de 100 m</span>
          </button>
          <button
            type="button"
            className="topic-chip topic-chip-btn"
            onClick={() => goToQuizMode('topics', ['TP 03 / Lab 03: Ethernet, VLANs (802.1Q) y STP'])}
          >
            <strong>TP 03 / Lab 03</strong>
            <span>Trama 802.3, VLAN 802.1Q, STP 802.1D vs RSTP 802.1w, PoE e IOS CLI</span>
          </button>
          <button
            type="button"
            className="topic-chip topic-chip-btn"
            onClick={() => goToQuizMode('topics', ['TP 04 / Lab 04: Fibra Óptica, OTDR y GPON'])}
          >
            <strong>TP 04 / Lab 04</strong>
            <span>Fibra SMF vs MMF, GPON (WDM/TDMA/DBA), Fusión, OTDR y ORL</span>
          </button>
          <button
            type="button"
            className="topic-chip topic-chip-btn"
            onClick={() => goToQuizMode('topics', ['TP 05: Redes Inalámbricas IEEE 802.11 (Wi-Fi)'])}
          >
            <strong>TP 05</strong>
            <span>Wi-Fi 6E/7 (ENACOM 756/2023), Canales, DFS, Cálculo CWNP y Espectro RF</span>
          </button>
          <button
            type="button"
            className="topic-chip topic-chip-btn"
            onClick={() => goToQuizMode('topics', ['TP 06: IPv4, Encapsulamiento y Fragmentación'])}
          >
            <strong>TP 06</strong>
            <span>IPv4, Encapsulamiento VoIP/RTP/UDP, Cabecera IP, TTL, ICMP y Wireshark</span>
          </button>
        </div>
      </section>

      <aside className="side-card">
        <div className="card-header-row">
          <h2>Top Participantes en Vivo</h2>
          <Link to="/leaderboard" className="text-link">
            Ver todos
          </Link>
        </div>
        {board.isLoading && <p className="muted">Cargando posiciones…</p>}
        {board.isError && <p className="error-text">Error al conectar con la API</p>}
        <div className="mini-board">
          {board.data?.slice(0, 6).map((row) => (
            <div key={row.user_id} className="mini-board-row">
              <span className={`rank-badge rank-${row.rank}`}>#{row.rank}</span>
              <div className="mini-board-user">
                <strong>{row.display_name}</strong>
                <small>
                  {row.correct_count}/{row.answered_count} aciertos ({row.accuracy_pct}%)
                </small>
              </div>
              <span className="score-tag">{row.score} pts</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}

export function MigratePage() {
  return (
    <Gate>
      <LegacyAccountMigration />
    </Gate>
  )
}

function LegacyAccountMigration() {
  const getToken = useToken()
  const userInfo = useParticipantInfo()
  const api = useMemo(() => createApi(getToken, userInfo), [getToken, userInfo.displayName, userInfo.username])
  const queryClient = useQueryClient()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const migration = useMutation({
    mutationFn: () => api.linkLegacyAccount(username, password),
    onSuccess: async () => {
      setPassword('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['me'] }),
        queryClient.invalidateQueries({ queryKey: ['leaderboard'] }),
      ])
    },
  })

  return (
    <div className="auth-wrapper">
      <section className="auth-card">
        <div className="auth-header">
          <h2>Recuperá tu progreso anterior</h2>
          <p>
            Iniciá sesión con Clerk y vinculá tu cuenta anterior para conservar tus respuestas y puntaje.
            La contraseña anterior solo verifica que sos titular de esa cuenta; no se copia a Clerk.
          </p>
        </div>
        {migration.isSuccess ? (
          <div>
            <p className="text-success">
              La cuenta de {migration.data.user.display_name} quedó vinculada. Tu progreso anterior se conserva.
            </p>
            <Link to="/quiz" className="btn-primary">
              Volver al cuestionario
            </Link>
          </div>
        ) : (
          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault()
              migration.mutate()
            }}
          >
            <label className="field">
              <span>Usuario anterior</span>
              <input
                autoComplete="username"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Contraseña anterior</span>
              <input
                autoComplete="current-password"
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {migration.isError && (
              <p className="error-banner">
                {migration.error instanceof Error
                  ? migration.error.message
                  : 'No se pudo vincular la cuenta. Intentá nuevamente.'}
              </p>
            )}
            <button className="btn-primary" disabled={migration.isPending} type="submit">
              {migration.isPending ? 'Vinculando…' : 'Vincular y conservar mi progreso'}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}

export function QuizPage() {
  return (
    <Gate>
      <QuizWorkspace />
    </Gate>
  )
}

function QuizWorkspace() {
  const getToken = useToken()
  const userInfo = useParticipantInfo()
  const api = useMemo(
    () => createApi(getToken, userInfo),
    [getToken, userInfo.displayName, userInfo.username],
  )
  const qc = useQueryClient()

  const [quizMode, setQuizMode] = useState<QuizMode>(() => {
    try {
      const saved = localStorage.getItem(QUIZ_MODE_STORAGE_KEY)
      if (saved === 'pool' || saved === 'topics' || saved === 'all') return saved
    } catch {
      // ignore
    }
    return 'pool'
  })

  const [selectedUnits, setSelectedUnits] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(QUIZ_TOPICS_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {
      // ignore
    }
    return []
  })

  const [poolSize, setPoolSize] = useState<number>(15)
  const [poolCriteria, setPoolCriteria] = useState<'random' | 'pending'>('random')
  const [poolNumber, setPoolNumber] = useState<number>(1)
  const [poolQuestionIds, setPoolQuestionIds] = useState<string[]>([])
  const [shuffleTopicsOrder, setShuffleTopicsOrder] = useState<boolean>(false)
  const [shuffledTopicIds, setShuffledTopicIds] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState<number>(0)

  const questionsQuery = useQuery({
    queryKey: ['questions'],
    queryFn: api.questions,
    refetchInterval: 6000,
  })

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
  })

  const boardQuery = useQuery({
    queryKey: ['leaderboard'],
    queryFn: api.leaderboard,
    refetchInterval: 6000,
  })

  const answerMutation = useMutation({
    mutationFn: ({ question_id, selected_option }: { question_id: string; selected_option: number }) =>
      api.submitAnswer(question_id, selected_option),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions'] })
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['leaderboard'] })
    },
  })

  const resetMutation = useMutation({
    mutationFn: api.resetMyAnswers,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions'] })
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['leaderboard'] })
      setCurrentIndex(0)
    },
  })

  const allQuestions: Question[] = questionsQuery.data ?? []
  const myAnswers = meQuery.data?.answers ?? {}

  const units = useMemo(() => {
    const map = new Map<string, number>()
    for (const q of allQuestions) {
      map.set(q.unit, (map.get(q.unit) ?? 0) + 1)
    }
    return Array.from(map.entries())
  }, [allQuestions])

  // Inicializar temas seleccionados por defecto si está vacío cuando cargan las preguntas
  useEffect(() => {
    if (units.length > 0 && selectedUnits.length === 0) {
      const initial = units.slice(0, 2).map(([u]) => u)
      setSelectedUnits(initial)
    }
  }, [units, selectedUnits.length])

  // Función para generar un nuevo Pull Aleatorio de preguntas
  const generateNewPool = (
    size: number = poolSize,
    criteria: 'random' | 'pending' = poolCriteria,
    incrementCounter: boolean = true,
  ) => {
    if (allQuestions.length === 0) return
    let candidateIds: string[] = []
    if (criteria === 'pending') {
      const pendingOrWrong = allQuestions
        .filter((q) => !myAnswers[q.id] || !myAnswers[q.id].is_correct)
        .map((q) => q.id)
      const alreadyCorrect = allQuestions
        .filter((q) => myAnswers[q.id]?.is_correct)
        .map((q) => q.id)
      candidateIds = [...shuffleArray(pendingOrWrong), ...shuffleArray(alreadyCorrect)]
    } else {
      candidateIds = shuffleArray(allQuestions.map((q) => q.id))
    }
    setPoolQuestionIds(candidateIds.slice(0, Math.min(size, allQuestions.length)))
    if (incrementCounter) {
      setPoolNumber((n) => n + 1)
    }
    setCurrentIndex(0)
  }

  // Generar el primer pull automáticamente apenas llegan las preguntas
  useEffect(() => {
    if (allQuestions.length > 0 && poolQuestionIds.length === 0) {
      const ids = shuffleArray(allQuestions.map((q) => q.id)).slice(
        0,
        Math.min(poolSize, allQuestions.length),
      )
      setPoolQuestionIds(ids)
    }
  }, [allQuestions, poolQuestionIds.length, poolSize])

  const changeMode = (nextMode: QuizMode) => {
    setQuizMode(nextMode)
    setCurrentIndex(0)
    try {
      localStorage.setItem(QUIZ_MODE_STORAGE_KEY, nextMode)
    } catch {
      // ignore
    }
  }

  const toggleUnitSelection = (uName: string) => {
    setQuizMode('topics')
    try {
      localStorage.setItem(QUIZ_MODE_STORAGE_KEY, 'topics')
    } catch {
      // ignore
    }
    setSelectedUnits((prev) => {
      const exists = prev.includes(uName)
      const next = exists ? prev.filter((item) => item !== uName) : [...prev, uName]
      try {
        localStorage.setItem(QUIZ_TOPICS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
    setCurrentIndex(0)
  }

  const selectAllUnits = () => {
    const allUnitNames = units.map(([u]) => u)
    setSelectedUnits(allUnitNames)
    setCurrentIndex(0)
    try {
      localStorage.setItem(QUIZ_TOPICS_STORAGE_KEY, JSON.stringify(allUnitNames))
    } catch {
      // ignore
    }
  }

  const clearUnitsSelection = () => {
    setSelectedUnits([])
    setCurrentIndex(0)
  }

  // Actualizar orden mezclado cuando cambian los temas seleccionados o el modo
  useEffect(() => {
    if (!shuffleTopicsOrder) {
      setShuffledTopicIds([])
      return
    }
    const base =
      quizMode === 'topics'
        ? allQuestions.filter((q) => selectedUnits.includes(q.unit))
        : allQuestions
    setShuffledTopicIds(shuffleArray(base.map((q) => q.id)))
  }, [shuffleTopicsOrder, quizMode, selectedUnits, allQuestions.length])

  const filteredQuestions = useMemo(() => {
    if (allQuestions.length === 0) return []
    const byId = new Map(allQuestions.map((q) => [q.id, q]))

    if (quizMode === 'pool') {
      const list = poolQuestionIds
        .map((id) => byId.get(id))
        .filter((q): q is Question => Boolean(q))
      return list.length > 0 ? list : allQuestions.slice(0, Math.min(poolSize, allQuestions.length))
    }

    if (quizMode === 'topics') {
      const topicQuestions = allQuestions.filter((q) => selectedUnits.includes(q.unit))
      if (shuffleTopicsOrder && shuffledTopicIds.length > 0) {
        const mapped = shuffledTopicIds
          .map((id) => byId.get(id))
          .filter((q): q is Question => Boolean(q) && selectedUnits.includes(q!.unit))
        if (mapped.length === topicQuestions.length) return mapped
      }
      return topicQuestions
    }

    // quizMode === 'all'
    if (shuffleTopicsOrder && shuffledTopicIds.length > 0) {
      const mapped = shuffledTopicIds
        .map((id) => byId.get(id))
        .filter((q): q is Question => Boolean(q))
      if (mapped.length === allQuestions.length) return mapped
    }
    return allQuestions
  }, [allQuestions, quizMode, poolQuestionIds, poolSize, selectedUnits, shuffleTopicsOrder, shuffledTopicIds])

  const safeIndex = Math.min(currentIndex, Math.max(0, filteredQuestions.length - 1))
  const currentQ = filteredQuestions[safeIndex]
  const currentAnswer = currentQ ? myAnswers[currentQ.id] : undefined

  // Estadísticas del subconjunto activo (Pull / Temas seleccionados / Todas)
  const subsetStats = useMemo(() => {
    let answered = 0
    let correct = 0
    for (const q of filteredQuestions) {
      const ans = myAnswers[q.id]
      if (ans) {
        answered += 1
        if (ans.is_correct) correct += 1
      }
    }
    const pct = answered > 0 ? Math.round((correct / answered) * 100) : 0
    return { answered, correct, total: filteredQuestions.length, pct }
  }, [filteredQuestions, myAnswers])

  if (questionsQuery.isLoading || meQuery.isLoading) {
    return <div className="panel-card">Cargando banco de preguntas y estadísticas…</div>
  }

  if (questionsQuery.isError) {
    return (
      <div className="panel-card error-banner">
        No se pudo conectar con la API: {questionsQuery.error.message}
      </div>
    )
  }

  const letters = ['A', 'B', 'C', 'D']

  return (
    <div className="quiz-layout">
      {/* Columna Izquierda: Perfil, Modos de Cuestionario, Multi-selección de Temas y Mini Leaderboard */}
      <aside className="quiz-sidebar">
        <div className="panel-card">
          <div className="user-score-header">
            <div>
              <span className="muted-label">Participante activo</span>
              <h3>{meQuery.data?.user.display_name}</h3>
            </div>
            <span className="score-big">{meQuery.data?.score ?? 0} pts</span>
          </div>

          <div className="stats-mini-grid">
            <div className="stat-box">
              <span>Total General</span>
              <strong>
                {meQuery.data?.answered_count ?? 0} / {allQuestions.length}
              </strong>
            </div>
            <div className="stat-box">
              <span>Precisión Global</span>
              <strong
                className={
                  (meQuery.data?.accuracy_pct ?? 0) >= 60 ? 'text-success' : 'text-warn'
                }
              >
                {meQuery.data?.accuracy_pct ?? 0}%
              </strong>
            </div>
          </div>

          <button
            type="button"
            className="btn-ghost full-width"
            disabled={resetMutation.isPending}
            onClick={() => {
              if (confirm('¿Querés reiniciar todas tus respuestas para volver a practicar desde cero?')) {
                resetMutation.mutate()
              }
            }}
          >
            Reiniciar mis respuestas
          </button>
        </div>

        {/* Selector de los 3 Modos de Cuestionario en el Sidebar */}
        <div className="panel-card">
          <h4 className="panel-subtitle">Modo de Cuestionario</h4>
          <div className="mode-switcher-vertical">
            <button
              type="button"
              className={quizMode === 'pool' ? 'mode-pill active' : 'mode-pill'}
              onClick={() => changeMode('pool')}
            >
              <div>
                <strong>🎲 Pull Aleatorio (Simulacro)</strong>
                <small>Tiradas de {poolSize} preguntas al azar</small>
              </div>
              <span className="count-tag">{poolSize}</span>
            </button>

            <button
              type="button"
              className={quizMode === 'topics' ? 'mode-pill active' : 'mode-pill'}
              onClick={() => changeMode('topics')}
            >
              <div>
                <strong>📚 Por Temas (Multi-selección)</strong>
                <small>Combiná 1 o más TPs / Labs</small>
              </div>
              <span className="count-tag">{selectedUnits.length} temas</span>
            </button>

            <button
              type="button"
              className={quizMode === 'all' ? 'mode-pill active' : 'mode-pill'}
              onClick={() => changeMode('all')}
            >
              <div>
                <strong>📋 Cuestionario Completo</strong>
                <small>Todas las preguntas del parcial</small>
              </div>
              <span className="count-tag">{allQuestions.length}</span>
            </button>
          </div>
        </div>

        {/* Panel lateral de Selección Múltiple de Temas / Unidades */}
        <div className="panel-card">
          <div className="card-header-row" style={{ marginBottom: '8px' }}>
            <h4 className="panel-subtitle" style={{ margin: 0 }}>
              Temas / Unidades (Multi-selección)
            </h4>
            <div className="mini-actions-row">
              <button
                type="button"
                className="text-btn-inline"
                onClick={() => {
                  changeMode('topics')
                  selectAllUnits()
                }}
              >
                Todos
              </button>
              <span className="muted">•</span>
              <button
                type="button"
                className="text-btn-inline"
                onClick={() => {
                  changeMode('topics')
                  clearUnitsSelection()
                }}
              >
                Ninguno
              </button>
            </div>
          </div>
          <p className="sidebar-helper-text">
            Marcá <strong>uno o varios temas</strong> para armar tu cuestionario personalizado:
          </p>

          <div className="unit-filter-list">
            {units.map(([uName, cnt]) => {
              const isChecked = quizMode === 'topics' ? selectedUnits.includes(uName) : quizMode === 'all'
              return (
                <button
                  key={uName}
                  type="button"
                  className={isChecked && quizMode === 'topics' ? 'unit-pill active' : 'unit-pill'}
                  onClick={() => toggleUnitSelection(uName)}
                >
                  <span className="unit-check-row">
                    <span className={isChecked && quizMode === 'topics' ? 'check-box checked' : 'check-box'}>
                      {isChecked && quizMode === 'topics' ? '✓' : ''}
                    </span>
                    <span>{uName}</span>
                  </span>
                  <span className="count-tag">{cnt}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="panel-card">
          <div className="card-header-row">
            <h4 className="panel-subtitle" style={{ margin: 0 }}>
              Leaderboard en Vivo
            </h4>
            <Link to="/leaderboard" className="text-link">
              Completo
            </Link>
          </div>
          <div className="mini-board" style={{ marginTop: '10px' }}>
            {boardQuery.data?.slice(0, 5).map((entry) => {
              const isMe = entry.user_id === meQuery.data?.user.user_id
              return (
                <div
                  key={entry.user_id}
                  className={isMe ? 'mini-board-row is-me' : 'mini-board-row'}
                >
                  <span className={`rank-badge rank-${entry.rank}`}>#{entry.rank}</span>
                  <div className="mini-board-user">
                    <strong>
                      {entry.display_name} {isMe && '(Vos)'}
                    </strong>
                    <small>{entry.accuracy_pct}% acierto</small>
                  </div>
                  <span className="score-tag">{entry.score} pts</span>
                </div>
              )
            })}
          </div>
        </div>
      </aside>

      {/* Columna Principal: Barra de Modo + Tarjeta de Pregunta y Estadísticas por Opción */}
      <section className="quiz-main">
        {/* Barra Superior de Configuración del Cuestionario Activo */}
        <div className="panel-card quiz-mode-banner">
          <div className="quiz-mode-tabs">
            <button
              type="button"
              className={quizMode === 'pool' ? 'mode-tab active' : 'mode-tab'}
              onClick={() => changeMode('pool')}
            >
              🎲 Pull de Preguntas (Simulacro)
            </button>
            <button
              type="button"
              className={quizMode === 'topics' ? 'mode-tab active' : 'mode-tab'}
              onClick={() => changeMode('topics')}
            >
              📚 Por Temas ({selectedUnits.length} seleccionados)
            </button>
            <button
              type="button"
              className={quizMode === 'all' ? 'mode-tab active' : 'mode-tab'}
              onClick={() => changeMode('all')}
            >
              📋 Todas las Preguntas ({allQuestions.length})
            </button>
          </div>

          {quizMode === 'pool' && (
            <div className="mode-controls-bar">
              <div className="mode-controls-left">
                <span className="pull-badge">Pull #{poolNumber}</span>
                <label className="inline-control">
                  <span>Tamaño del pull:</span>
                  <select
                    value={poolSize}
                    onChange={(e) => {
                      const nextSize = Number(e.target.value)
                      setPoolSize(nextSize)
                      generateNewPool(nextSize, poolCriteria, true)
                    }}
                  >
                    <option value={10}>10 preguntas</option>
                    <option value={15}>15 preguntas (Simulacro)</option>
                    <option value={20}>20 preguntas</option>
                    <option value={25}>25 preguntas</option>
                  </select>
                </label>

                <label className="inline-control">
                  <span>Selección:</span>
                  <select
                    value={poolCriteria}
                    onChange={(e) => {
                      const nextCrit = e.target.value as 'random' | 'pending'
                      setPoolCriteria(nextCrit)
                      generateNewPool(poolSize, nextCrit, true)
                    }}
                  >
                    <option value="random">Al azar de todos los temas</option>
                    <option value="pending">Priorizar no respondidas / falladas</option>
                  </select>
                </label>
              </div>

              <div className="mode-controls-right">
                <span className="subset-progress-pill">
                  Progreso en este pull: <strong>{subsetStats.correct}/{subsetStats.answered}</strong> aciertos (de {subsetStats.total})
                </span>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => generateNewPool(poolSize, poolCriteria, true)}
                >
                  🎲 Generar nuevo Pull
                </button>
              </div>
            </div>
          )}

          {quizMode === 'topics' && (
            <div className="mode-controls-bar">
              <div className="mode-controls-left">
                <span className="subset-progress-pill">
                  <strong>{selectedUnits.length}</strong> {selectedUnits.length === 1 ? 'tema activo' : 'temas activos'} •{' '}
                  <strong>{filteredQuestions.length}</strong> preguntas en este cuestionario •{' '}
                  Aciertos: <strong>{subsetStats.correct}/{subsetStats.answered}</strong>
                </span>
              </div>
              <div className="mode-controls-right">
                <button
                  type="button"
                  className={shuffleTopicsOrder ? 'btn-secondary btn-sm active-toggle' : 'btn-secondary btn-sm'}
                  onClick={() => {
                    setShuffleTopicsOrder((v) => !v)
                    setCurrentIndex(0)
                  }}
                >
                  🔀 {shuffleTopicsOrder ? 'Orden mezclado (Activo)' : 'Mezclar preguntas'}
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={selectAllUnits}>
                  Marcar todos
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={clearUnitsSelection}>
                  Limpiar
                </button>
              </div>
            </div>
          )}

          {quizMode === 'all' && (
            <div className="mode-controls-bar">
              <div className="mode-controls-left">
                <span className="subset-progress-pill">
                  Cuestionario Completo: <strong>{allQuestions.length} preguntas</strong> (TP 01 al TP 06 + Labs 01 al 04) •{' '}
                  Respondidas: <strong>{subsetStats.answered}/{subsetStats.total}</strong> ({subsetStats.pct}% precisión)
                </span>
              </div>
              <div className="mode-controls-right">
                <button
                  type="button"
                  className={shuffleTopicsOrder ? 'btn-secondary btn-sm active-toggle' : 'btn-secondary btn-sm'}
                  onClick={() => {
                    setShuffleTopicsOrder((v) => !v)
                    setCurrentIndex(0)
                  }}
                >
                  🔀 {shuffleTopicsOrder ? 'Orden aleatorio (Activo)' : 'Ordenar por Unidad (TP 01 → TP 06)'}
                </button>
              </div>
            </div>
          )}
        </div>

        {!currentQ ? (
          <div className="panel-card empty-topics-state">
            <h3>No hay temas seleccionados</h3>
            <p className="muted">
              Seleccioná al menos uno o varios Trabajos Prácticos / Laboratorios en el panel izquierdo para comenzar el cuestionario por temas.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button type="button" className="btn-primary" onClick={selectAllUnits}>
                Seleccionar todos los temas ({allQuestions.length} preguntas)
              </button>
              <button type="button" className="btn-secondary" onClick={() => changeMode('pool')}>
                Ir a Pull Aleatorio ({poolSize} preguntas)
              </button>
            </div>
          </div>
        ) : (
          <div className="panel-card question-workspace">
            {/* Píldoras de navegación rápida entre preguntas */}
            <div className="question-dots">
              {filteredQuestions.map((q, idx) => {
                const ans = myAnswers[q.id]
                let cls = 'q-dot'
                if (idx === safeIndex) cls += ' current'
                if (ans) cls += ans.is_correct ? ' answered-ok' : ' answered-bad'
                return (
                  <button
                    key={q.id}
                    type="button"
                    className={cls}
                    onClick={() => setCurrentIndex(idx)}
                    title={`Pregunta ${idx + 1} (${q.unit})`}
                  >
                    {idx + 1}
                  </button>
                )
              })}
            </div>

            <div className="q-header-bar">
              <span className="unit-badge">{currentQ.unit}</span>
              <div className="crowd-stat-pill">
                <span>
                  📊 <strong>{currentQ.stats.correct_pct}%</strong> de los participantes acertó esta pregunta ({currentQ.stats.total_responses}{' '}
                  {currentQ.stats.total_responses === 1 ? 'respuesta' : 'respuestas'})
                </span>
              </div>
            </div>

            <h2 className="question-text">
              {safeIndex + 1}. {currentQ.question}
            </h2>

            <div className="options-stack">
              {currentQ.options.map((optText, idx) => {
                const isSelected = currentAnswer?.selected_option === idx
                const isCorrectOption = currentQ.correct === idx
                const showResults = Boolean(currentAnswer)
                const optPct = currentQ.stats.option_pcts[idx] ?? 0
                const optCnt = currentQ.stats.option_counts[idx] ?? 0

                let cardClass = 'option-card'
                if (showResults) {
                  if (isCorrectOption) cardClass += ' option-correct'
                  else if (isSelected && !currentAnswer?.is_correct) cardClass += ' option-wrong'
                } else if (isSelected) {
                  cardClass += ' option-selected'
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    className={cardClass}
                    disabled={answerMutation.isPending}
                    onClick={() =>
                      answerMutation.mutate({
                        question_id: currentQ.id,
                        selected_option: idx,
                      })
                    }
                  >
                    {/* Barra de fondo con el porcentaje de participantes que seleccionó esta opción */}
                    {showResults && (
                      <div
                        className="option-pct-bar"
                        style={{ width: `${optPct}%` }}
                      />
                    )}

                    <div className="option-content-row">
                      <span className="option-letter">{letters[idx]}</span>
                      <span className="option-label">{optText}</span>

                      {showResults && (
                        <span className="option-crowd-badge" title={`${optCnt} participantes eligieron esta opción`}>
                          <strong>{optPct}%</strong> <small>({optCnt})</small>
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {currentAnswer && (
              <div
                className={
                  currentAnswer.is_correct
                    ? 'explanation-panel exp-ok'
                    : 'explanation-panel exp-bad'
                }
              >
                <div className="exp-title">
                  {currentAnswer.is_correct
                    ? '✓ ¡Respuesta Correcta! (+10 puntos)'
                    : `✗ Respuesta Incorrecta — La opción correcta es la ${letters[currentQ.correct]}`}
                </div>
                <p className="exp-text">
                  <strong>Fundamento de cátedra:</strong> {currentQ.explanation}
                </p>
                <div className="exp-crowd-note">
                  Distribución de respuestas de la clase en esta pregunta:{' '}
                  {letters.map((L, i) => (
                    <span key={L} className="dist-chip">
                      Opción {L}: <strong>{currentQ.stats.option_pcts[i]}%</strong> ({currentQ.stats.option_counts[i]})
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="question-footer-nav">
              <button
                type="button"
                className="btn-secondary"
                disabled={safeIndex === 0}
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              >
                ← Anterior
              </button>

              <span className="q-pos-label">
                Pregunta {safeIndex + 1} de {filteredQuestions.length}
              </span>

              {quizMode === 'pool' && safeIndex >= filteredQuestions.length - 1 ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => generateNewPool(poolSize, poolCriteria, true)}
                >
                  🎲 Generar nuevo Pull →
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={safeIndex >= filteredQuestions.length - 1}
                  onClick={() =>
                    setCurrentIndex((i) => Math.min(filteredQuestions.length - 1, i + 1))
                  }
                >
                  Siguiente →
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export function LeaderboardPage() {
  const getToken = useToken()
  const userInfo = useParticipantInfo()
  const api = useMemo(
    () => createApi(getToken, userInfo),
    [getToken, userInfo.displayName, userInfo.username],
  )

  const boardQuery = useQuery({
    queryKey: ['leaderboard'],
    queryFn: api.leaderboard,
    refetchInterval: 5000,
  })

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
    retry: false,
  })

  const entries = boardQuery.data ?? []
  const top3 = entries.slice(0, 3)
  const totalQ = entries[0]?.total_questions ?? 58

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-header">
        <div>
          <span className="pill-badge">Actualización en tiempo real</span>
          <h1>Leaderboard General — Comunicaciones y Redes II</h1>
          <p>
            Puntuación acumulada de todos los participantes sobre los {totalQ} ejercicios oficiales del 1er Parcial de Práctica (10 puntos por cada acierto).
          </p>
        </div>
        <Link to="/quiz" className="btn-primary">
          Ir a responder preguntas
        </Link>
      </div>

      {/* Podio Top 3 */}
      {top3.length > 0 && (
        <div className="podium-grid">
          {top3.map((item) => (
            <div key={item.user_id} className={`podium-card podium-${item.rank}`}>
              <div className="podium-rank">Puesto #{item.rank}</div>
              <h3>{item.display_name}</h3>
              <span className="podium-username">@{item.username}</span>
              <div className="podium-score">{item.score} pts</div>
              <div className="podium-meta">
                <span>
                  Aciertos: <strong>{item.correct_count}/{item.answered_count}</strong>
                </span>
                <span>
                  Precisión: <strong>{item.accuracy_pct}%</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabla Completa */}
      <div className="panel-card">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Pos.</th>
              <th>Participante</th>
              <th>Puntaje</th>
              <th>Aciertos / Respondidas</th>
              <th>% Precisión</th>
              <th>Nota sobre Total ({totalQ})</th>
              <th>Estado Parcial (≥ 60%)</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((row) => {
              const isMe = row.user_id === meQuery.data?.user.user_id
              const pass = row.accuracy_pct >= 60
              return (
                <tr key={row.user_id} className={isMe ? 'row-me' : ''}>
                  <td>
                    <span className={`rank-badge rank-${row.rank}`}>#{row.rank}</span>
                  </td>
                  <td>
                    <strong>{row.display_name}</strong>{' '}
                    <small className="muted">@{row.username}</small>{' '}
                    {isMe && <span className="you-tag">Vos</span>}
                  </td>
                  <td>
                    <strong className="mono-score">{row.score} pts</strong>
                  </td>
                  <td>
                    {row.correct_count} / {row.answered_count}{' '}
                    <small className="muted">(de {row.total_questions})</small>
                  </td>
                  <td>
                    <strong>{row.accuracy_pct}%</strong>
                  </td>
                  <td>{row.exam_grade_pct}%</td>
                  <td>
                    <span className={pass ? 'status-pill pass' : 'status-pill warn'}>
                      {pass ? 'Aprobado (≥ 60%)' : 'Reforzar (< 60%)'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
