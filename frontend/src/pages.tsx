import { Link, Outlet } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Gate, UserMenu, useToken } from './auth'
import { createApi, type Question } from './api'

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

  const totalQ = questions.data?.length ?? 36

  return (
    <div className="home-grid">
      <section className="hero-card">
        <span className="pill-badge">Parcial Práctico • Jueves 29/10 — 13:00 h</span>
        <h1>Plataforma Colaborativa de Práctica y Ranking</h1>
        <p className="hero-lead">
          Practicá con los ejercicios, cálculos y casos reales de los{' '}
          <strong>TP 01 al TP 06 y Laboratorios 01 al 04</strong>. Al responder cada pregunta verás la{' '}
          <strong>fundamentación técnica de la cátedra</strong>, el{' '}
          <strong>porcentaje de compañeros que eligió cada opción</strong> y tu posición en el{' '}
          <strong>Leaderboard general</strong>.
        </p>

        <div className="hero-actions">
          <Link to="/quiz" className="btn-primary">
            Entrar al Cuestionario ({totalQ} preguntas)
          </Link>
          <Link to="/leaderboard" className="btn-secondary">
            Ver Tabla de Posiciones (Leaderboard)
          </Link>
        </div>

        <div className="topics-grid">
          <div className="topic-chip">
            <strong>TP 01 / Lab 01</strong>
            <span>Dominios colisión/broadcast, Backplane Full-Duplex y Uplink 20:1</span>
          </div>
          <div className="topic-chip">
            <strong>Lab 02</strong>
            <span>Cableado Estructurado ANSI/TIA/EIA-568, T568A/B y enlace de 100 m</span>
          </div>
          <div className="topic-chip">
            <strong>TP 03 / Lab 03</strong>
            <span>Trama 802.3, VLAN 802.1Q, STP 802.1D vs RSTP 802.1w, PoE e IOS CLI</span>
          </div>
          <div className="topic-chip">
            <strong>TP 04 / Lab 04</strong>
            <span>Fibra SMF vs MMF, GPON (WDM/TDMA/DBA), Fusión, OTDR y ORL</span>
          </div>
          <div className="topic-chip">
            <strong>TP 05</strong>
            <span>Wi-Fi 6E/7 (ENACOM 756/2023), Canales, DFS, Cálculo CWNP y Espectro RF</span>
          </div>
          <div className="topic-chip">
            <strong>TP 06</strong>
            <span>IPv4, Encapsulamiento VoIP/RTP/UDP, Cabecera IP, TTL, ICMP y Wireshark</span>
          </div>
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

export function QuizPage() {
  return (
    <Gate>
      <QuizWorkspace />
    </Gate>
  )
}

function QuizWorkspace() {
  const getToken = useToken()
  const api = useMemo(() => createApi(getToken), [getToken])
  const qc = useQueryClient()

  const [selectedUnit, setSelectedUnit] = useState<string>('ALL')
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

  const units = useMemo(() => {
    const map = new Map<string, number>()
    for (const q of allQuestions) {
      map.set(q.unit, (map.get(q.unit) ?? 0) + 1)
    }
    return Array.from(map.entries())
  }, [allQuestions])

  const filteredQuestions = useMemo(() => {
    if (selectedUnit === 'ALL') return allQuestions
    return allQuestions.filter((q) => q.unit === selectedUnit)
  }, [allQuestions, selectedUnit])

  const safeIndex = Math.min(currentIndex, Math.max(0, filteredQuestions.length - 1))
  const currentQ = filteredQuestions[safeIndex]
  const myAnswers = meQuery.data?.answers ?? {}
  const currentAnswer = currentQ ? myAnswers[currentQ.id] : undefined

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

  if (!currentQ) {
    return <div className="panel-card">No hay preguntas disponibles.</div>
  }

  const letters = ['A', 'B', 'C', 'D']
  const stats = currentQ.stats

  return (
    <div className="quiz-layout">
      {/* Columna Izquierda: Perfil, Unidades y Mini Leaderboard */}
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
              <span>Respondidas</span>
              <strong>
                {meQuery.data?.answered_count ?? 0} / {allQuestions.length}
              </strong>
            </div>
            <div className="stat-box">
              <span>Precisión</span>
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

        <div className="panel-card">
          <h4 className="panel-subtitle">Filtrar por Trabajo Práctico / Lab</h4>
          <div className="unit-filter-list">
            <button
              type="button"
              className={selectedUnit === 'ALL' ? 'unit-pill active' : 'unit-pill'}
              onClick={() => {
                setSelectedUnit('ALL')
                setCurrentIndex(0)
              }}
            >
              <span>Todas las unidades</span>
              <span className="count-tag">{allQuestions.length}</span>
            </button>

            {units.map(([uName, cnt]) => (
              <button
                key={uName}
                type="button"
                className={selectedUnit === uName ? 'unit-pill active' : 'unit-pill'}
                onClick={() => {
                  setSelectedUnit(uName)
                  setCurrentIndex(0)
                }}
              >
                <span>{uName}</span>
                <span className="count-tag">{cnt}</span>
              </button>
            ))}
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

      {/* Columna Principal: Tarjeta de Pregunta y Estadísticas por Opción */}
      <section className="quiz-main">
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
                  title={`Pregunta ${idx + 1}`}
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
                📊 <strong>{stats.correct_pct}%</strong> de los participantes acertó esta pregunta ({stats.total_responses}{' '}
                {stats.total_responses === 1 ? 'respuesta' : 'respuestas'})
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
              const optPct = stats.option_pcts[idx] ?? 0
              const optCnt = stats.option_counts[idx] ?? 0

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
                    Opción {L}: <strong>{stats.option_pcts[i]}%</strong> ({stats.option_counts[i]})
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
          </div>
        </div>
      </section>
    </div>
  )
}

export function LeaderboardPage() {
  const getToken = useToken()
  const api = useMemo(() => createApi(getToken), [getToken])

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

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-header">
        <div>
          <span className="pill-badge">Actualización en tiempo real</span>
          <h1>Leaderboard General — Comunicaciones y Redes II</h1>
          <p>
            Puntuación acumulada de todos los participantes sobre los 36 ejercicios oficiales del 1er Parcial de Práctica (10 puntos por cada acierto).
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
              <th>Nota sobre Total (36)</th>
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
