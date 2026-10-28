import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useAuth,
  useUser,
} from '@clerk/clerk-react'
import type { ReactNode } from 'react'

const KEY = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined)?.trim()
// Sin clave de Clerk => modo demo (igual que en taller-jcsa-2026). Es constante en tiempo de build.
export const DEMO = !KEY

export function AuthProvider({ children }: { children: ReactNode }) {
  if (DEMO) return <>{children}</>
  return (
    <ClerkProvider publishableKey={KEY!} afterSignOutUrl="/">
      {children}
    </ClerkProvider>
  )
}

export function useToken(): () => Promise<string | null> {
  if (DEMO) return async () => 'demo'
  return useAuth().getToken
}

export function useParticipantInfo(): { displayName: string; username: string } {
  if (DEMO) {
    return { displayName: 'Usuario Demo', username: 'demo' }
  }
  const { user } = useUser()
  const emailPrefix = user?.primaryEmailAddress?.emailAddress?.split('@')[0]
  const username = user?.username || emailPrefix || user?.id?.slice(-6) || 'estudiante'
  const displayName =
    user?.fullName ||
    user?.firstName ||
    user?.username ||
    emailPrefix ||
    'Participante'
  return { displayName, username }
}

export function Gate({ children }: { children: ReactNode }) {
  if (DEMO) return <>{children}</>
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <div className="auth-wrapper">
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <span className="pill-badge">Autenticación con Clerk</span>
            <h2>Iniciá sesión para responder el Cuestionario</h2>
            <p>
              Ingresá con tu cuenta para guardar tu progreso, ver el porcentaje de respuestas de tus compañeros y
              sumar puntos en el <strong>Leaderboard</strong>.
            </p>
            <SignInButton mode="modal">
              <button className="btn-primary">Iniciar sesión</button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>
    </>
  )
}

export function UserMenu() {
  if (DEMO) return <span className="user-pill">sin login (modo demo)</span>
  return (
    <div className="user-menu-bar">
      <SignedOut>
        <SignInButton mode="modal">
          <button className="btn-primary">Ingresar</button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
    </div>
  )
}
