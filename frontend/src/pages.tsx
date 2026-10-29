import { Link, Outlet, useLocation, useNavigate, useParams } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Gate, UserMenu, useParticipantInfo, useToken } from './auth'
import {
  createApi,
  OTHER_ENROLLED_COURSES,
  SUBJECTS_CATALOG,
  type Question,
  type SubjectConfig,
  type SubjectId,
  type UserAnswerRecord,
} from './api'

export type QuizMode = 'pool' | 'topics' | 'all'

const ACTIVE_SUBJECT_STORAGE_KEY = 'fceqyn_active_subject'
const QUIZ_MODE_STORAGE_KEY = 'redes2_quiz_mode'
const QUIZ_TOPICS_STORAGE_KEY = 'redes2_quiz_selected_units'
const ADAPTIVE_STORAGE_PREFIX = 'redes2_adaptive_profile_v3_'
const SLOW_RESPONSE_MS = 60000 // > 1 minuto (60s) dispara refuerzo de preguntas del mismo estilo

type SubjectContextValue = {
  subjectId: SubjectId
  subject: SubjectConfig
  setSubjectId: (id: SubjectId) => void
}

const SubjectContext = createContext<SubjectContextValue>({
  subjectId: 'so',
  subject: SUBJECTS_CATALOG.so,
  setSubjectId: () => {},
})

export function useActiveSubject() {
  return useContext(SubjectContext)
}

type AdaptiveQuestionStat = {
  wrongCount: number
  slowCount: number
  attempts: number
  lastResponseMs: number
  lastCorrect: boolean
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function weightedRandomSample(items: Question[], weights: number[], k: number): string[] {
  const keyed = items.map((item, idx) => {
    const w = Math.max(0.05, weights[idx] ?? 1)
    const u = Math.max(1e-9, Math.random())
    // Algoritmo Efraimidis-Spirakis para muestreo aleatorio ponderado sin reemplazo
    const score = Math.pow(u, 1 / w)
    return { id: item.id, score }
  })
  keyed.sort((a, b) => b.score - a.score)
  return keyed.slice(0, Math.min(k, items.length)).map((x) => x.id)
}

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [subjectId, setSubjectIdState] = useState<SubjectId>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_SUBJECT_STORAGE_KEY)
      if (saved === 'so' || saved === 'redes2') return saved
    } catch {
      // ignore
    }
    return 'so'
  })

  const setSubjectId = (nextId: SubjectId) => {
    setSubjectIdState(nextId)
    try {
      localStorage.setItem(ACTIVE_SUBJECT_STORAGE_KEY, nextId)
    } catch {
      // ignore
    }
  }

  // Sincronizar con la URL si el usuario entra directamente a /materia/so o /materia/redes2
  useEffect(() => {
    const m = location.pathname.match(/^\/materia\/(so|redes2)/)
    if (m && (m[1] === 'so' || m[1] === 'redes2') && m[1] !== subjectId) {
      setSubjectId(m[1])
    }
  }, [location.pathname, subjectId])

  const subject = SUBJECTS_CATALOG[subjectId] ?? SUBJECTS_CATALOG.so
  const isLanding = location.pathname === '/'

  useEffect(() => {
    document.documentElement.setAttribute('data-subject-theme', subject.theme)
  }, [subject.theme])

  return (
    <SubjectContext.Provider value={{ subjectId, subject, setSubjectId }}>
      <div className="app-shell" data-subject-theme={subject.theme}>
        <header className="topbar">
          <div className="topbar-inner">
            <div className="topbar-left-group">
              <Link to="/" className="brand-link">
                <span className="brand-logo">{isLanding ? 'UNaM' : subject.code}</span>
                <div>
                  <strong>{isLanding ? 'Portal de Preparciales FCEQyN' : subject.name}</strong>
                  <small>
                    {isLanding
                      ? 'Materias con Examen • Sincronizado con Aula Virtual'
                      : `${subject.exam_badge}`}
                  </small>
                </div>
              </Link>

              {/* Selector rápido de Materia con su color distintivo */}
              <div className="subject-switcher-bar" role="group" aria-label="Selector de Materia">
                <button
                  type="button"
                  className={
                    subjectId === 'so' ? 'subject-switch-pill pill-green active' : 'subject-switch-pill pill-green'
                  }
                  onClick={() => {
                    setSubjectId('so')
                    if (isLanding || location.pathname.startsWith('/materia/')) {
                      void navigate({ to: '/materia/$subjectId', params: { subjectId: 'so' } })
                    }
                  }}
                >
                  <span className="dot-indicator dot-green" />
                  Sistemas Operativos
                </button>
                <button
                  type="button"
                  className={
                    subjectId === 'redes2' ? 'subject-switch-pill pill-blue active' : 'subject-switch-pill pill-blue'
                  }
                  onClick={() => {
                    setSubjectId('redes2')
                    if (isLanding || location.pathname.startsWith('/materia/')) {
                      void navigate({ to: '/materia/$subjectId', params: { subjectId: 'redes2' } })
                    }
                  }}
                >
                  <span className="dot-indicator dot-blue" />
                  Redes II
                </button>
              </div>
            </div>

            <nav className="main-nav">
              <Link to="/" activeProps={{ className: 'nav-item active' }} inactiveProps={{ className: 'nav-item' }}>
                Materias
              </Link>
              <Link
                to="/materia/$subjectId"
                params={{ subjectId }}
                activeProps={{ className: 'nav-item active' }}
                inactiveProps={{ className: 'nav-item' }}
              >
                Inicio {subject.code}
              </Link>
              <Link to="/quiz" activeProps={{ className: 'nav-item active' }} inactiveProps={{ className: 'nav-item' }}>
                Preparcial / Quiz
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
    </SubjectContext.Provider>
  )
}

export function LandingPage() {
  const navigate = useNavigate()
  const { setSubjectId } = useActiveSubject()
  const getToken = useToken()
  const api = useMemo(() => createApi(getToken), [getToken])

  const subjectsQuery = useQuery({
    queryKey: ['subjects'],
    queryFn: api.subjects,
  })

  const soInfo =
    subjectsQuery.data?.find((s) => s.id === 'so') ?? {
      ...SUBJECTS_CATALOG.so,
      question_count: 0,
    }
  const redesInfo =
    subjectsQuery.data?.find((s) => s.id === 'redes2') ?? {
      ...SUBJECTS_CATALOG.redes2,
      question_count: 58,
    }

  const openSubject = (id: SubjectId, dest: 'home' | 'quiz' | 'leaderboard' = 'home') => {
    setSubjectId(id)
    if (dest === 'quiz') {
      void navigate({ to: '/quiz' })
    } else if (dest === 'leaderboard') {
      void navigate({ to: '/leaderboard' })
    } else {
      void navigate({ to: '/materia/$subjectId', params: { subjectId: id } })
    }
  }

  return (
    <div className="landing-wrapper">
      <section className="landing-hero">
        <div className="landing-hero-badges">
          <span className="landing-badge-sync">📡 Sincronizado con Aula Virtual FCEQyN (Moodle)</span>
          <span className="landing-badge-exam">📅 Próximo Examen Confirmado: Sistemas Operativos (05/11/2026)</span>
        </div>
        <h1>Portal de Preparciales y Simulacros por Materia</h1>
        <p className="landing-lead">
          Seleccioná la materia que querés preparar. Cada asignatura cambia dinámicamente la paleta visual de la plataforma (
          <strong className="text-green-highlight">Verde para Sistemas Operativos</strong> y{' '}
          <strong className="text-blue-highlight">Azul para Comunicaciones y Redes II</strong>) y mantiene su propio banco de ejercicios, pulls adaptativos y tabla de posiciones.
        </p>
      </section>

      <section className="landing-subjects-grid">
        {/* TARJETA 1: SISTEMAS OPERATIVOS (VERDE) - EXAMEN CONFIRMADO */}
        <article className="subject-card subject-card-green">
          <div className="subject-card-top">
            <div className="subject-identity">
              <span className="subject-avatar avatar-green">SO</span>
              <div>
                <span className="subject-status-pill status-confirmed">
                  🟢 EXAMEN CONFIRMADO • Jueves 05/11/2026 — 10:00 h
                </span>
                <h2>{soInfo.name}</h2>
                <small>{soInfo.professors}</small>
              </div>
            </div>
            <span className="theme-tag tag-green">Tema Verde</span>
          </div>

          <p className="subject-description">{soInfo.description}</p>

          <div className="subject-meta-box meta-green">
            <div>
              <strong>Modalidad confirmada en Avisos (Aula Virtual #51):</strong>
              <span>1er Parcial Práctico • Jueves 05 de Noviembre 10:00 hs (Semana 10)</span>
            </div>
            <div>
              <strong>Horarios de cátedra:</strong>
              <span>{soInfo.schedule}</span>
            </div>
          </div>

          <div className="subject-topics-preview">
            <h4>Temas confirmados para el 1er Parcial Práctico:</h4>
            <div className="subject-topics-chips">
              {soInfo.topics.map((t) => (
                <div key={t.code} className="subject-topic-item item-green">
                  <strong>{t.code}</strong>
                  <span>{t.detail}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="subject-card-actions">
            <button
              type="button"
              className="btn-subject-green"
              onClick={() => openSubject('so', 'home')}
            >
              Entrar a Sistemas Operativos →
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => openSubject('so', 'quiz')}
            >
              Ir a Ejercicios de Preparcial ({soInfo.question_count ?? 0})
            </button>
          </div>
        </article>

        {/* TARJETA 2: COMUNICACIONES Y REDES II (AZUL) */}
        <article className="subject-card subject-card-blue">
          <div className="subject-card-top">
            <div className="subject-identity">
              <span className="subject-avatar avatar-blue">R2</span>
              <div>
                <span className="subject-status-pill status-completed">
                  🔵 PARCIAL RENDIDO • 29/10/2026 — {redesInfo.question_count ?? 58} ejercicios activos
                </span>
                <h2>{redesInfo.name}</h2>
                <small>{redesInfo.professors}</small>
              </div>
            </div>
            <span className="theme-tag tag-blue">Tema Azul</span>
          </div>

          <p className="subject-description">{redesInfo.description}</p>

          <div className="subject-meta-box meta-blue">
            <div>
              <strong>Alcance del Banco Oficial (Curso #50):</strong>
              <span>{redesInfo.exam_title}</span>
            </div>
            <div>
              <strong>Funcionalidades activas:</strong>
              <span>Pull Aleatorio Adaptativo (&gt; 1 min), Multi-selección por TP/Lab y Leaderboard</span>
            </div>
          </div>

          <div className="subject-topics-preview">
            <h4>Unidades y Laboratorios incluidos ({redesInfo.question_count ?? 58} preguntas):</h4>
            <div className="subject-topics-chips">
              {redesInfo.topics.map((t) => (
                <div key={t.code} className="subject-topic-item item-blue">
                  <strong>{t.code}</strong>
                  <span>{t.detail}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="subject-card-actions">
            <button
              type="button"
              className="btn-subject-blue"
              onClick={() => openSubject('redes2', 'home')}
            >
              Entrar a Redes II →
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => openSubject('redes2', 'quiz')}
            >
              Practicar Cuestionario ({redesInfo.question_count ?? 58})
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => openSubject('redes2', 'leaderboard')}
            >
              Leaderboard
            </button>
          </div>
        </article>
      </section>

      {/* OTRAS MATERIAS DETECTADAS EN EL AULA VIRTUAL */}
      <section className="panel-card other-courses-section">
        <div className="card-header-row">
          <div>
            <h3>Otras materias cursadas en el Aula Virtual (Moodle FCEQyN)</h3>
            <p className="muted" style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
              Detectadas automáticamente mediante MCP. Por el momento no registran fecha de examen parcial confirmada.
            </p>
          </div>
        </div>
        <div className="other-courses-grid">
          {OTHER_ENROLLED_COURSES.map((c) => (
            <div key={c.course_id} className="other-course-card">
              <span className="other-course-badge">{c.code}</span>
              <div>
                <strong>{c.name}</strong>
                <small>{c.status}</small>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export function Home() {
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { subjectId?: string }
  const { subjectId, subject, setSubjectId } = useActiveSubject()

  useEffect(() => {
    if (params.subjectId === 'so' || params.subjectId === 'redes2') {
      if (params.subjectId !== subjectId) {
        setSubjectId(params.subjectId)
      }
    }
  }, [params.subjectId, subjectId, setSubjectId])

  const activeId: SubjectId =
    params.subjectId === 'so' || params.subjectId === 'redes2' ? params.subjectId : subjectId
  const currentSubject = SUBJECTS_CATALOG[activeId] ?? subject

  const getToken = useToken()
  const api = useMemo(() => createApi(getToken), [getToken])
  const board = useQuery({
    queryKey: ['leaderboard', activeId],
    queryFn: () => api.leaderboard(activeId),
    refetchInterval: 8000,
  })
  const questions = useQuery({
    queryKey: ['questions', activeId],
    queryFn: () => api.questions(activeId),
  })

  const totalQ = questions.data?.length ?? (activeId === 'redes2' ? 58 : 0)

  const goToQuizMode = (mode: QuizMode, preselectedUnits?: string[]) => {
    try {
      localStorage.setItem(`${QUIZ_MODE_STORAGE_KEY}_${activeId}`, mode)
      localStorage.setItem(QUIZ_MODE_STORAGE_KEY, mode)
      if (preselectedUnits && preselectedUnits.length > 0) {
        localStorage.setItem(`${QUIZ_TOPICS_STORAGE_KEY}_${activeId}`, JSON.stringify(preselectedUnits))
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
        <div className="subject-breadcrumb-row">
          <Link to="/" className="back-to-portal-link">
            ← Volver al Portal de Materias
          </Link>
          <span className="pill-badge">{currentSubject.exam_badge}</span>
        </div>

        <h1>{currentSubject.name} — Preparcial y Simulacro</h1>
        <p className="hero-lead">{currentSubject.description}</p>

        {activeId === 'so' && totalQ === 0 && (
          <div className="so-ready-banner">
            <div className="so-ready-header">
              <span className="so-ready-icon">🟢</span>
              <div>
                <strong>Entorno de Sistemas Operativos (Tema Verde) Configurado y Sincronizado</strong>
                <p>
                  Se verificó en el Aula Virtual (Curso #51) el aviso del <strong>Prof. Claudio Omar Biale</strong> confirmando el{' '}
                  <strong>1er Parcial Práctico para el Jueves 05/11/2026 a las 10:00 h</strong> sobre:{' '}
                  <em>Gestión de Procesos, Planificación de CPU, Señales y Tuberías e Interbloqueos</em>. Listo para incorporar los ejercicios de preparcial que indiques.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mode-cards-home">
          <button
            type="button"
            className="home-mode-card"
            onClick={() => goToQuizMode('pool')}
          >
            <span className="home-mode-icon">🎲</span>
            <div>
              <strong>Pull de Ejercicios (Simulacro)</strong>
              <span>Tiradas aleatorias adaptativas priorizando errores y demoras (&gt; 1 min)</span>
            </div>
          </button>

          <button
            type="button"
            className="home-mode-card"
            onClick={() => goToQuizMode('topics')}
          >
            <span className="home-mode-icon">📚</span>
            <div>
              <strong>Práctica por Temas (Multi-selección)</strong>
              <span>Seleccioná uno o varios temas de {currentSubject.short_name} a la vez</span>
            </div>
          </button>

          <button
            type="button"
            className="home-mode-card"
            onClick={() => goToQuizMode('all')}
          >
            <span className="home-mode-icon">📋</span>
            <div>
              <strong>Banco Completo ({totalQ} ejercicios)</strong>
              <span>Todos los ejercicios oficiales de {currentSubject.short_name} de principio a fin</span>
            </div>
          </button>
        </div>

        <div className="hero-actions">
          <Link to="/quiz" className="btn-primary">
            Abrir Preparcial de {currentSubject.short_name}
          </Link>
          <Link to="/leaderboard" className="btn-secondary">
            Ver Leaderboard de {currentSubject.short_name}
          </Link>
          <Link to="/" className="btn-ghost">
            Cambiar de Materia
          </Link>
        </div>

        <div className="topics-grid">
          {currentSubject.topics.map((topic) => (
            <button
              key={topic.code}
              type="button"
              className="topic-chip topic-chip-btn"
              onClick={() => goToQuizMode('topics', [topic.title])}
            >
              <strong>{topic.code}</strong>
              <span>{topic.detail}</span>
            </button>
          ))}
        </div>
      </section>

      <aside className="side-card">
        <div className="card-header-row">
          <h2>Ranking — {currentSubject.code}</h2>
          <Link to="/leaderboard" className="text-link">
            Ver todos
          </Link>
        </div>
        {board.isLoading && <p className="muted">Cargando posiciones…</p>}
        {board.isError && <p className="error-text">Error al conectar con la API</p>}
        {!board.isLoading && (board.data?.length ?? 0) === 0 && (
          <p className="muted" style={{ fontSize: '13px' }}>
            Aún no hay intentos registrados en <strong>{currentSubject.name}</strong>.
          </p>
        )}
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
  const { subjectId, subject } = useActiveSubject()
  const getToken = useToken()
  const userInfo = useParticipantInfo()
  const api = useMemo(
    () => createApi(getToken, userInfo),
    [getToken, userInfo.displayName, userInfo.username],
  )
  const qc = useQueryClient()

  const [quizMode, setQuizMode] = useState<QuizMode>(() => {
    try {
      const saved =
        localStorage.getItem(`${QUIZ_MODE_STORAGE_KEY}_${subjectId}`) ??
        localStorage.getItem(QUIZ_MODE_STORAGE_KEY)
      if (saved === 'pool' || saved === 'topics' || saved === 'all') return saved
    } catch {
      // ignore
    }
    return 'pool'
  })

  const [selectedUnits, setSelectedUnits] = useState<string[]>(() => {
    try {
      const raw =
        localStorage.getItem(`${QUIZ_TOPICS_STORAGE_KEY}_${subjectId}`) ??
        localStorage.getItem(QUIZ_TOPICS_STORAGE_KEY)
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
  const [poolCriteria, setPoolCriteria] = useState<'adaptive' | 'random' | 'pending'>('adaptive')
  const [poolNumber, setPoolNumber] = useState<number>(1)
  const [poolQuestionIds, setPoolQuestionIds] = useState<string[]>([])
  const [shuffleTopicsOrder, setShuffleTopicsOrder] = useState<boolean>(false)
  const [shuffledTopicIds, setShuffledTopicIds] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState<number>(0)

  // Orden aleatorio de las 4 opciones (A, B, C, D) por pregunta en la sesión/pull actual
  const [optionShuffleSeed, setOptionShuffleSeed] = useState<number>(1)
  // Respuestas emitidas dentro del Pull actual (permite volver a practicar preguntas en un nuevo Pull)
  const [pullSessionAnswers, setPullSessionAnswers] = useState<Record<string, UserAnswerRecord>>({})

  // Cronómetro de tiempo de respuesta por pregunta (umbral > 1 minuto = 60000 ms)
  const questionStartRef = useRef<number>(performance.now())
  const [elapsedMs, setElapsedMs] = useState<number>(0)

  const adaptiveKey = `${ADAPTIVE_STORAGE_PREFIX}${subjectId}_${userInfo.username || 'anon'}`
  const [adaptiveProfile, setAdaptiveProfile] = useState<Record<string, AdaptiveQuestionStat>>(() => {
    try {
      const raw = localStorage.getItem(adaptiveKey)
      if (raw) return JSON.parse(raw)
    } catch {
      // ignore
    }
    return {}
  })

  // Al cambiar de materia (ej. de Redes II a Sistemas Operativos), reiniciar selección de pull/unidades
  useEffect(() => {
    setPoolQuestionIds([])
    setPullSessionAnswers({})
    setCurrentIndex(0)
    try {
      const rawUnits = localStorage.getItem(`${QUIZ_TOPICS_STORAGE_KEY}_${subjectId}`)
      setSelectedUnits(rawUnits ? JSON.parse(rawUnits) : [])
    } catch {
      setSelectedUnits([])
    }
  }, [subjectId])

  const questionsQuery = useQuery({
    queryKey: ['questions', subjectId],
    queryFn: () => api.questions(subjectId),
    refetchInterval: 6000,
  })

  const meQuery = useQuery({
    queryKey: ['me', subjectId],
    queryFn: () => api.me(subjectId),
  })

  const boardQuery = useQuery({
    queryKey: ['leaderboard', subjectId],
    queryFn: () => api.leaderboard(subjectId),
    refetchInterval: 6000,
  })

  const allQuestions: Question[] = questionsQuery.data ?? []
  const myAnswers = meQuery.data?.answers ?? {}

  // Sincronizar datos históricos del servidor (errores y tiempos > 1 min) con el perfil adaptativo local
  useEffect(() => {
    if (!meQuery.data?.answers) return
    setAdaptiveProfile((prev) => {
      let changed = false
      const next = { ...prev }
      for (const [qid, ans] of Object.entries(meQuery.data.answers)) {
        const rMs = ans.response_time_ms ?? 0
        const isSlow = rMs > SLOW_RESPONSE_MS
        if (!next[qid]) {
          next[qid] = {
            wrongCount: ans.is_correct ? 0 : 1,
            slowCount: isSlow ? 1 : 0,
            attempts: 1,
            lastResponseMs: rMs,
            lastCorrect: ans.is_correct,
          }
          changed = true
        }
      }
      if (changed) {
        try {
          localStorage.setItem(adaptiveKey, JSON.stringify(next))
        } catch {
          // ignore
        }
        return next
      }
      return prev
    })
  }, [meQuery.data?.answers, adaptiveKey])

  const answerMutation = useMutation({
    mutationFn: ({
      question_id,
      selected_option,
      response_time_ms,
    }: {
      question_id: string
      selected_option: number
      response_time_ms: number
    }) => api.submitAnswer(question_id, selected_option, response_time_ms),
    onSuccess: (data) => {
      const rMs = data.response_time_ms ?? 0
      const isSlow = rMs > SLOW_RESPONSE_MS
      setPullSessionAnswers((prev) => ({
        ...prev,
        [data.question_id]: {
          selected_option: data.selected_option,
          is_correct: data.is_correct,
          answered_at: new Date().toISOString(),
          response_time_ms: rMs,
          practice_retry: Boolean(data.practice_retry),
        },
      }))
      setAdaptiveProfile((prev) => {
        const cur = prev[data.question_id] ?? {
          wrongCount: 0,
          slowCount: 0,
          attempts: 0,
          lastResponseMs: 0,
          lastCorrect: true,
        }
        const next: Record<string, AdaptiveQuestionStat> = {
          ...prev,
          [data.question_id]: {
            wrongCount: cur.wrongCount + (data.is_correct ? 0 : 1),
            slowCount: cur.slowCount + (isSlow ? 1 : 0),
            attempts: cur.attempts + 1,
            lastResponseMs: rMs,
            lastCorrect: data.is_correct,
          },
        }
        try {
          localStorage.setItem(adaptiveKey, JSON.stringify(next))
        } catch {
          // ignore
        }
        return next
      })
      qc.invalidateQueries({ queryKey: ['questions', subjectId] })
      qc.invalidateQueries({ queryKey: ['me', subjectId] })
      qc.invalidateQueries({ queryKey: ['leaderboard', subjectId] })
    },
  })

  const resetMutation = useMutation({
    mutationFn: () => api.resetMyAnswers(subjectId),
    onSuccess: () => {
      setPullSessionAnswers({})
      setAdaptiveProfile({})
      try {
        localStorage.removeItem(adaptiveKey)
      } catch {
        // ignore
      }
      qc.invalidateQueries({ queryKey: ['questions', subjectId] })
      qc.invalidateQueries({ queryKey: ['me', subjectId] })
      qc.invalidateQueries({ queryKey: ['leaderboard', subjectId] })
      setCurrentIndex(0)
    },
  })

  const units = useMemo(() => {
    const map = new Map<string, number>()
    for (const q of allQuestions) {
      map.set(q.unit, (map.get(q.unit) ?? 0) + 1)
    }
    return Array.from(map.entries())
  }, [allQuestions])

  // Analizar qué estilos de preguntas necesitan refuerzo (errores o tiempo de respuesta > 1 minuto)
  const adaptiveInsights = useMemo(() => {
    const styleBoost = new Map<string, { errors: number; slow: number; score: number }>()
    const unitBoost = new Map<string, number>()
    let totalSlowCount = 0
    let totalWrongCount = 0

    for (const q of allQuestions) {
      const styleName = q.style || q.unit
      const localStat = adaptiveProfile[q.id]
      const serverAns = myAnswers[q.id]

      const wrong = localStat ? localStat.wrongCount : serverAns && !serverAns.is_correct ? 1 : 0
      const slow =
        localStat
          ? localStat.slowCount
          : serverAns?.response_time_ms && serverAns.response_time_ms > SLOW_RESPONSE_MS
            ? 1
            : 0

      if (wrong > 0 || slow > 0) {
        totalWrongCount += wrong
        totalSlowCount += slow
        const prev = styleBoost.get(styleName) ?? { errors: 0, slow: 0, score: 0 }
        const addedScore = wrong * 3.5 + slow * 2.5
        styleBoost.set(styleName, {
          errors: prev.errors + wrong,
          slow: prev.slow + slow,
          score: prev.score + addedScore,
        })
        unitBoost.set(q.unit, (unitBoost.get(q.unit) ?? 0) + wrong * 1.5 + slow * 1.0)
      }
    }

    const reinforcedStyles = Array.from(styleBoost.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .map(([style, data]) => ({ style, ...data }))

    return { styleBoost, unitBoost, reinforcedStyles, totalSlowCount, totalWrongCount }
  }, [allQuestions, adaptiveProfile, myAnswers])

  // Inicializar temas seleccionados por defecto si está vacío cuando cargan las preguntas
  useEffect(() => {
    if (units.length > 0 && selectedUnits.length === 0) {
      const initial = units.slice(0, 2).map(([u]) => u)
      setSelectedUnits(initial)
    }
  }, [units, selectedUnits.length])

  // Función para generar un nuevo Pull Aleatorio y Adaptativo de preguntas
  const generateNewPool = (
    size: number = poolSize,
    criteria: 'adaptive' | 'random' | 'pending' = poolCriteria,
    incrementCounter: boolean = true,
  ) => {
    if (allQuestions.length === 0) return
    let selectedIds: string[] = []

    if (criteria === 'adaptive') {
      // Muestreo aleatorio ponderado: todas las preguntas pueden salir al azar, pero se inyectan
      // con mucha mayor probabilidad preguntas del mismo ESTILO donde el usuario falló o tardó > 1m
      const weights = allQuestions.map((q) => {
        const styleName = q.style || q.unit
        const sBoost = adaptiveInsights.styleBoost.get(styleName)?.score ?? 0
        const uBoost = adaptiveInsights.unitBoost.get(q.unit) ?? 0
        const localStat = adaptiveProfile[q.id]
        const serverAns = myAnswers[q.id]

        let w = 1.0 + sBoost + uBoost * 0.4
        const isWrong = (localStat && !localStat.lastCorrect) || (serverAns && !serverAns.is_correct)
        const isSlow =
          (localStat && localStat.lastResponseMs > SLOW_RESPONSE_MS) ||
          (serverAns?.response_time_ms && serverAns.response_time_ms > SLOW_RESPONSE_MS)
        const isUnanswered = !localStat && !serverAns

        if (isWrong) w += 4.5
        if (isSlow) w += 3.0
        if (isUnanswered) w += 1.4
        if (!isWrong && !isSlow && !isUnanswered) w *= 0.65
        return w
      })
      selectedIds = weightedRandomSample(allQuestions, weights, size)
    } else if (criteria === 'pending') {
      const pendingOrWrong = allQuestions
        .filter((q) => !myAnswers[q.id] || !myAnswers[q.id].is_correct || (myAnswers[q.id]?.response_time_ms ?? 0) > SLOW_RESPONSE_MS)
        .map((q) => q.id)
      const alreadyCorrectFast = allQuestions
        .filter((q) => myAnswers[q.id]?.is_correct && (myAnswers[q.id]?.response_time_ms ?? 0) <= SLOW_RESPONSE_MS)
        .map((q) => q.id)
      selectedIds = [...shuffleArray(pendingOrWrong), ...shuffleArray(alreadyCorrectFast)].slice(
        0,
        Math.min(size, allQuestions.length),
      )
    } else {
      selectedIds = shuffleArray(allQuestions.map((q) => q.id)).slice(
        0,
        Math.min(size, allQuestions.length),
      )
    }

    setPoolQuestionIds(selectedIds)
    setPullSessionAnswers({})
    setOptionShuffleSeed((s) => s + 1)
    if (incrementCounter) {
      setPoolNumber((n) => n + 1)
    }
    setCurrentIndex(0)
  }

  // Generar el primer pull automáticamente apenas llegan las preguntas
  useEffect(() => {
    if (allQuestions.length > 0 && poolQuestionIds.length === 0) {
      generateNewPool(poolSize, poolCriteria, false)
    }
  }, [allQuestions.length, poolQuestionIds.length])

  const changeMode = (nextMode: QuizMode) => {
    setQuizMode(nextMode)
    setCurrentIndex(0)
    try {
      localStorage.setItem(`${QUIZ_MODE_STORAGE_KEY}_${subjectId}`, nextMode)
      localStorage.setItem(QUIZ_MODE_STORAGE_KEY, nextMode)
    } catch {
      // ignore
    }
  }

  const toggleUnitSelection = (uName: string) => {
    setQuizMode('topics')
    try {
      localStorage.setItem(`${QUIZ_MODE_STORAGE_KEY}_${subjectId}`, 'topics')
      localStorage.setItem(QUIZ_MODE_STORAGE_KEY, 'topics')
    } catch {
      // ignore
    }
    setSelectedUnits((prev) => {
      const exists = prev.includes(uName)
      const next = exists ? prev.filter((item) => item !== uName) : [...prev, uName]
      try {
        localStorage.setItem(`${QUIZ_TOPICS_STORAGE_KEY}_${subjectId}`, JSON.stringify(next))
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
      localStorage.setItem(`${QUIZ_TOPICS_STORAGE_KEY}_${subjectId}`, JSON.stringify(allUnitNames))
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

  // Orden aleatorio de las 4 opciones (0..3) para cada pregunta en el pull/sesión actual
  const optionOrderMap = useMemo(() => {
    const map: Record<string, number[]> = {}
    for (const q of allQuestions) {
      map[q.id] = shuffleArray([0, 1, 2, 3])
    }
    return map
  }, [allQuestions.length, optionShuffleSeed])

  const safeIndex = Math.min(currentIndex, Math.max(0, filteredQuestions.length - 1))
  const currentQ = filteredQuestions[safeIndex]
  const currentAnswer = currentQ
    ? quizMode === 'pool' && poolNumber > 1
      ? pullSessionAnswers[currentQ.id]
      : (pullSessionAnswers[currentQ.id] ?? myAnswers[currentQ.id])
    : undefined

  // Reiniciar el cronómetro cada vez que el usuario cambia de pregunta o genera un nuevo pull
  useEffect(() => {
    questionStartRef.current = performance.now()
    setElapsedMs(0)
  }, [currentQ?.id, poolNumber, quizMode])

  useEffect(() => {
    if (!currentQ || currentAnswer) return
    const timer = window.setInterval(() => {
      setElapsedMs(Math.max(0, Math.round(performance.now() - questionStartRef.current)))
    }, 100)
    return () => window.clearInterval(timer)
  }, [currentQ?.id, Boolean(currentAnswer), poolNumber, quizMode])

  // Estadísticas del subconjunto activo (Pull / Temas seleccionados / Todas)
  const subsetStats = useMemo(() => {
    let answered = 0
    let correct = 0
    for (const q of filteredQuestions) {
      const ans =
        quizMode === 'pool' && poolNumber > 1
          ? pullSessionAnswers[q.id]
          : (pullSessionAnswers[q.id] ?? myAnswers[q.id])
      if (ans) {
        answered += 1
        if (ans.is_correct) correct += 1
      }
    }
    const pct = answered > 0 ? Math.round((correct / answered) * 100) : 0
    return { answered, correct, total: filteredQuestions.length, pct }
  }, [filteredQuestions, myAnswers, pullSessionAnswers, quizMode, poolNumber])

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
            <>
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
                    <span>Algoritmo:</span>
                    <select
                      value={poolCriteria}
                      onChange={(e) => {
                        const nextCrit = e.target.value as 'adaptive' | 'random' | 'pending'
                        setPoolCriteria(nextCrit)
                        generateNewPool(poolSize, nextCrit, true)
                      }}
                    >
                      <option value="adaptive">🧠 Adaptativo IA (Azar + errores y &gt; 1 min)</option>
                      <option value="random">🎲 100% Aleatorio puro</option>
                      <option value="pending">🎯 Priorizar pendientes / lentas (&gt; 1 min)</option>
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

              <div className="adaptive-learning-bar">
                <div className="adaptive-learning-title">
                  <span>🧠 <strong>Aprendizaje Adaptativo Activo:</strong></span>
                  <small>
                    El sistema mide tus errores y respuestas que demoran <strong>&gt; 1 minuto (60 s)</strong> para incluir en tus pulls más preguntas del mismo estilo, con opciones en orden aleatorio.
                  </small>
                </div>
                {adaptiveInsights.reinforcedStyles.length > 0 ? (
                  <div className="adaptive-tags-row">
                    <span className="adaptive-label">Reforzando estilos:</span>
                    {adaptiveInsights.reinforcedStyles.slice(0, 4).map((item) => (
                      <span key={item.style} className="adaptive-style-chip">
                        <strong>{item.style}</strong>
                        {item.errors > 0 && <span className="chip-err">✗ {item.errors} err</span>}
                        {item.slow > 0 && <span className="chip-slow">⏱️ {item.slow} (&gt;1m)</span>}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="adaptive-tags-row">
                    <span className="adaptive-label">
                      Respondé preguntas para que el motor detecte qué estilos reforzar (errores o tiempo &gt; 1 min).
                    </span>
                  </div>
                )}
              </div>
            </>
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
                  Cuestionario Completo ({subject.short_name}): <strong>{allQuestions.length} ejercicios</strong> •{' '}
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
                  🔀 {shuffleTopicsOrder ? 'Orden aleatorio (Activo)' : 'Ordenar por Unidad'}
                </button>
              </div>
            </div>
          )}
        </div>

        {allQuestions.length === 0 ? (
          <div className="panel-card empty-topics-state">
            <span className="pill-badge">{subject.exam_badge}</span>
            <h3>Preparcial de {subject.name} — Listo para Cargar Ejercicios</h3>
            <p className="muted">
              El entorno de <strong>{subject.name}</strong> (Tema Verde) ya está configurado con los 4 temas confirmados en el Aula Virtual por el Prof. Claudio Biale para el parcial del <strong>05/11/2026</strong>:
            </p>
            <div className="topics-grid" style={{ margin: '14px 0' }}>
              {subject.topics.map((t) => (
                <div key={t.code} className="topic-chip">
                  <strong>{t.code}</strong>
                  <span>{t.detail}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
              <Link to="/" className="btn-primary">
                ← Volver al Portal de Materias
              </Link>
              <Link to="/materia/$subjectId" params={{ subjectId: 'redes2' }} className="btn-secondary">
                Ir a Comunicaciones y Redes II (58 preguntas)
              </Link>
            </div>
          </div>
        ) : !currentQ ? (
          <div className="panel-card empty-topics-state">
            <h3>No hay temas seleccionados</h3>
            <p className="muted">
              Seleccioná al menos uno o varios temas en el panel izquierdo para comenzar el cuestionario por temas.
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
                const ans =
                  quizMode === 'pool' && poolNumber > 1
                    ? pullSessionAnswers[q.id]
                    : (pullSessionAnswers[q.id] ?? myAnswers[q.id])
                let cls = 'q-dot'
                if (idx === safeIndex) cls += ' current'
                if (ans) cls += ans.is_correct ? ' answered-ok' : ' answered-bad'
                return (
                  <button
                    key={q.id}
                    type="button"
                    className={cls}
                    onClick={() => setCurrentIndex(idx)}
                    title={`Pregunta ${idx + 1} (${q.style || q.unit})`}
                  >
                    {idx + 1}
                  </button>
                )
              })}
            </div>

            <div className="q-header-bar">
              <div className="q-badges-left">
                <span className="unit-badge">{currentQ.unit}</span>
                {currentQ.style && (
                  <span className="style-badge" title="Estilo de pregunta para aprendizaje adaptativo">
                    🏷️ {currentQ.style}
                  </span>
                )}
              </div>

              <div className="q-badges-right">
                {currentAnswer ? (
                  <span
                    className={
                      (currentAnswer.response_time_ms ?? 0) > SLOW_RESPONSE_MS
                        ? 'timer-pill timer-slow'
                        : 'timer-pill timer-fast'
                    }
                    title="Si tardás más de 1 minuto (60s), el sistema agregará más preguntas de este mismo estilo en los próximos pulls"
                  >
                    ⏱️ {((currentAnswer.response_time_ms ?? 0) / 1000).toFixed(1)}s{' '}
                    {(currentAnswer.response_time_ms ?? 0) > SLOW_RESPONSE_MS ? '(> 1 min • refuerza estilo)' : '(≤ 1 min • en tiempo)'}
                  </span>
                ) : (
                  <span
                    className={elapsedMs > SLOW_RESPONSE_MS ? 'timer-pill timer-slow' : 'timer-pill'}
                    title="Umbral adaptativo: > 1 minuto (60s) suma más preguntas de este estilo"
                  >
                    ⏱️ {(elapsedMs / 1000).toFixed(1)}s {elapsedMs > SLOW_RESPONSE_MS && '• > 1 min (refuerzo)'}
                  </span>
                )}

                <div className="crowd-stat-pill">
                  <span>
                    📊 <strong>{currentQ.stats.correct_pct}%</strong> acertó ({currentQ.stats.total_responses}{' '}
                    {currentQ.stats.total_responses === 1 ? 'resp.' : 'resps.'})
                  </span>
                </div>
              </div>
            </div>

            <h2 className="question-text">
              {safeIndex + 1}. {currentQ.question}
            </h2>

            {(() => {
              const currentOrder = optionOrderMap[currentQ.id] ?? [0, 1, 2, 3]
              const correctVisualIdx = currentOrder.indexOf(currentQ.correct)
              const correctLetter = letters[correctVisualIdx >= 0 ? correctVisualIdx : currentQ.correct]

              return (
                <>
                  <div className="options-stack">
                    {currentOrder.map((origIdx, visualIdx) => {
                      const optText = currentQ.options[origIdx]
                      const isSelected = currentAnswer?.selected_option === origIdx
                      const isCorrectOption = currentQ.correct === origIdx
                      const showResults = Boolean(currentAnswer)
                      const optPct = currentQ.stats.option_pcts[origIdx] ?? 0
                      const optCnt = currentQ.stats.option_counts[origIdx] ?? 0

                      let cardClass = 'option-card'
                      if (showResults) {
                        if (isCorrectOption) cardClass += ' option-correct'
                        else if (isSelected && !currentAnswer?.is_correct) cardClass += ' option-wrong'
                      } else if (isSelected) {
                        cardClass += ' option-selected'
                      }

                      return (
                        <button
                          key={origIdx}
                          type="button"
                          className={cardClass}
                          disabled={Boolean(currentAnswer) || answerMutation.isPending}
                          onClick={() => {
                            if (currentAnswer) return
                            const measuredMs = Math.max(
                              100,
                              Math.round(performance.now() - questionStartRef.current),
                            )
                            answerMutation.mutate({
                              question_id: currentQ.id,
                              selected_option: origIdx,
                              response_time_ms: measuredMs,
                            })
                          }}
                        >
                          {/* Barra de fondo con el porcentaje de participantes que seleccionó esta opción */}
                          {showResults && (
                            <div
                              className="option-pct-bar"
                              style={{ width: `${optPct}%` }}
                            />
                          )}

                          <div className="option-content-row">
                            <span className="option-letter">{letters[visualIdx]}</span>
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
                          ? currentAnswer.practice_retry
                            ? `✓ ¡Respuesta Correcta! (Repaso de práctica: no suma puntos extra) • Tiempo: ${((currentAnswer.response_time_ms ?? 0) / 1000).toFixed(1)}s`
                            : `✓ ¡Respuesta Correcta! (+10 puntos) • Tiempo: ${((currentAnswer.response_time_ms ?? 0) / 1000).toFixed(1)}s`
                          : `✗ Respuesta Incorrecta — La opción correcta es la ${correctLetter} • Tiempo: ${((currentAnswer.response_time_ms ?? 0) / 1000).toFixed(1)}s`}
                      </div>
                      {currentAnswer.practice_retry && (
                        <div className="exp-adaptive-note">
                          🔁 <strong>Modo Repaso:</strong> Ya habías respondido esta pregunta en un intento anterior, por lo que tu puntaje general y tu % de aciertos mantienen el resultado de tu primera respuesta (solo se reinician si tocás <em>“Reiniciar mis respuestas”</em>).
                        </div>
                      )}
                      {(!currentAnswer.is_correct || (currentAnswer.response_time_ms ?? 0) > SLOW_RESPONSE_MS) && (
                        <div className="exp-adaptive-note">
                          🧠 <strong>Nota de aprendizaje adaptativo:</strong> Como{' '}
                          {!currentAnswer.is_correct && (currentAnswer.response_time_ms ?? 0) > SLOW_RESPONSE_MS
                            ? 'esta respuesta fue incorrecta y demoró más de 1 minuto (60s)'
                            : !currentAnswer.is_correct
                              ? 'tuviste un error en esta pregunta'
                              : 'tardaste más de 1 minuto (60s) en responder'}{' '}
                          ({((currentAnswer.response_time_ms ?? 0) / 1000).toFixed(1)}s), el generador de Pulls priorizará más preguntas del estilo{' '}
                          <strong>“{currentQ.style || currentQ.unit}”</strong>.
                        </div>
                      )}
                      <p className="exp-text">
                        <strong>Fundamento de cátedra:</strong> {currentQ.explanation}
                      </p>
                      <div className="exp-crowd-note">
                        Distribución de respuestas de la clase en esta pregunta:{' '}
                        {currentOrder.map((origIdx, visualIdx) => (
                          <span key={letters[visualIdx]} className="dist-chip">
                            Opción {letters[visualIdx]}: <strong>{currentQ.stats.option_pcts[origIdx]}%</strong> ({currentQ.stats.option_counts[origIdx]})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )
            })()}

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
  const { subjectId, subject } = useActiveSubject()
  const getToken = useToken()
  const userInfo = useParticipantInfo()
  const api = useMemo(
    () => createApi(getToken, userInfo),
    [getToken, userInfo.displayName, userInfo.username],
  )

  const boardQuery = useQuery({
    queryKey: ['leaderboard', subjectId],
    queryFn: () => api.leaderboard(subjectId),
    refetchInterval: 5000,
  })

  const meQuery = useQuery({
    queryKey: ['me', subjectId],
    queryFn: () => api.me(subjectId),
    retry: false,
  })

  const entries = boardQuery.data ?? []
  const top3 = entries.slice(0, 3)
  const totalQ = entries[0]?.total_questions ?? (subjectId === 'redes2' ? 58 : 0)

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-header">
        <div>
          <span className="pill-badge">{subject.exam_badge}</span>
          <h1>Leaderboard General — {subject.name}</h1>
          <p>
            Puntuación acumulada de todos los participantes sobre los ejercicios oficiales de{' '}
            <strong>{subject.name}</strong> (10 puntos por cada acierto).
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link to="/quiz" className="btn-primary">
            Ir a responder ejercicios
          </Link>
          <Link to="/" className="btn-secondary">
            Cambiar Materia
          </Link>
        </div>
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
        {entries.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Todavía no hay respuestas registradas para <strong>{subject.name}</strong>.
          </p>
        ) : (
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
        )}
      </div>
    </div>
  )
}
