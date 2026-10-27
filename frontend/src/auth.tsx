import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useAuth as useClerkAuth,
} from '@clerk/clerk-react'
import {
  createContext,
  useContext,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { createApi, type UserProfile } from './api'

const CLERK_KEY = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined)?.trim()
export const USE_CLERK = Boolean(CLERK_KEY)

const STORAGE_KEY = 'quiz_redes2_session_v1'

type LocalSession = {
  token: string
  user: UserProfile
}

type LocalAuthContextType = {
  session: LocalSession | null
  setSession: (s: LocalSession | null) => void
  logout: () => void
}

const LocalAuthContext = createContext<LocalAuthContextType>({
  session: null,
  setSession: () => {},
  logout: () => {},
})

function loadSavedSession(): LocalSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as LocalSession
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<LocalSession | null>(() => loadSavedSession())

  const setSession = (s: LocalSession | null) => {
    setSessionState(s)
    if (s) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  const logout = () => setSession(null)

  if (USE_CLERK) {
    return (
      <ClerkProvider publishableKey={CLERK_KEY!} afterSignOutUrl="/">
        {children}
      </ClerkProvider>
    )
  }

  return (
    <LocalAuthContext.Provider value={{ session, setSession, logout }}>
      {children}
    </LocalAuthContext.Provider>
  )
}

export function useToken(): () => Promise<string | null> {
  if (USE_CLERK) {
    return useClerkAuth().getToken
  }
  const { session } = useContext(LocalAuthContext)
  return async () => session?.token ?? null
}

export function useCurrentParticipant(): UserProfile | null {
  const { session } = useContext(LocalAuthContext)
  return session?.user ?? null
}

export function Gate({ children }: { children: ReactNode }) {
  if (USE_CLERK) {
    return (
      <>
        <SignedIn>{children}</SignedIn>
        <SignedOut>
          <div className="auth-card">
            <h2>Iniciá sesión para participar</h2>
            <p>Tus respuestas sumarán puntos en el Leaderboard de la clase.</p>
            <SignInButton mode="modal">
              <button className="btn-primary">Iniciar sesión con Clerk</button>
            </SignInButton>
          </div>
        </SignedOut>
      </>
    )
  }

  const { session, setSession } = useContext(LocalAuthContext)
  if (session) return <>{children}</>
  return <ParticipantAuthScreen onAuthenticated={setSession} />
}

function ParticipantAuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (s: LocalSession) => void
}) {
  const [tab, setTab] = useState<'login' | 'register'>('register')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const api = createApi(async () => null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (tab === 'register') {
        const res = await api.register(
          username.trim(),
          displayName.trim() || username.trim(),
          password,
        )
        onAuthenticated(res)
      } else {
        const res = await api.login(username.trim(), password)
        onAuthenticated(res)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo autenticar')
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = async (u: string) => {
    setError(null)
    setLoading(true)
    try {
      const res = await api.login(u, '1234')
      onAuthenticated(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en ingreso rápido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <span className="pill-badge">1er Parcial de Práctica • Jueves 29/10</span>
          <h2>Identificate para entrar al Cuestionario</h2>
          <p>
            Tu usuario guarda tu progreso, calcula tu nota sobre el banco de preguntas (TP 01 al TP 06 + Labs 01 al 04)
            y te suma al <strong>Leaderboard en vivo</strong> junto a tus compañeros.
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={tab === 'register' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => {
              setTab('register')
              setError(null)
            }}
          >
            Crear cuenta rápida
          </button>
          <button
            type="button"
            className={tab === 'login' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => {
              setTab('login')
              setError(null)
            }}
          >
            Ya tengo usuario
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {tab === 'register' && (
            <label className="field">
              <span>Nombre y Apellido (o Alias para el Ranking)</span>
              <input
                type="text"
                placeholder="Ej: Gabriel Sosa"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </label>
          )}

          <label className="field">
            <span>Nombre de usuario</span>
            <input
              type="text"
              placeholder="Ej: gabriel"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Contraseña</span>
            <input
              type="password"
              placeholder="Mínimo 3 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && <div className="error-banner">{error}</div>}

          <button type="submit" className="btn-primary full-width" disabled={loading}>
            {loading
              ? 'Ingresando...'
              : tab === 'register'
              ? 'Registrarme y empezar a responder'
              : 'Iniciar sesión'}
          </button>
        </form>

        <div className="quick-demo-box">
          <span>¿Querés probar con un participante de ejemplo? (clave: <code>1234</code>)</span>
          <div className="quick-demo-buttons">
            <button type="button" className="btn-ghost" onClick={() => quickLogin('franco')}>
              Franco H.
            </button>
            <button type="button" className="btn-ghost" onClick={() => quickLogin('sofia')}>
              Sofía M.
            </button>
            <button type="button" className="btn-ghost" onClick={() => quickLogin('valentina')}>
              Valentina R.
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function UserMenu() {
  if (USE_CLERK) {
    return (
      <>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="btn-primary">Ingresar</button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </>
    )
  }

  const { session, logout } = useContext(LocalAuthContext)
  if (!session) {
    return <span className="user-pill">Sin sesión</span>
  }
  return (
    <div className="user-menu-bar">
      <span className="user-pill">
        <strong>{session.user.display_name}</strong> <small>@{session.user.username}</small>
      </span>
      <button type="button" className="btn-ghost-sm" onClick={logout}>
        Salir
      </button>
    </div>
  )
}
