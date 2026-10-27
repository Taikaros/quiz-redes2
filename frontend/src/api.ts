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

export type AuthResponse = {
  token: string
  user: UserProfile
}

export type Api = {
  login: (username: string, password: string) => Promise<AuthResponse>
  register: (username: string, display_name: string, password: string) => Promise<AuthResponse>
  me: () => Promise<MeResponse>
  questions: () => Promise<Question[]>
  submitAnswer: (question_id: string, selected_option: number) => Promise<AnswerResponse>
  resetMyAnswers: () => Promise<{ ok: boolean }>
  leaderboard: () => Promise<LeaderboardEntry[]>
}

function resolveApiUrl(): string {
  const configured = (import.meta.env.VITE_API_URL as string | undefined)?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  if (typeof window !== 'undefined') {
    const h = window.location.hostname
    if (
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h.startsWith('192.168.') ||
      h.startsWith('10.') ||
      h.startsWith('172.')
    ) {
      return `http://${h}:8787`
    }
    // Si está desplegado en Cloudflare Workers (*.workers.dev) y no se definió VITE_API_URL,
    // infiere automáticamente el Worker de la API en el mismo subdominio:
    if (h.endsWith('.workers.dev')) {
      const parts = h.split('.')
      if (parts.length >= 4) {
        return `https://quiz-redes2-api.${parts.slice(-3).join('.')}`
      }
    }
  }
  return ''
}

export const API_BASE_URL = resolveApiUrl()

export function createApi(getToken: () => Promise<string | null>): Api {
  const call = async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const token = await getToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
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
    login: (username, password) =>
      call<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    register: (username, display_name, password) =>
      call<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, display_name, password }),
      }),
    me: () => call<MeResponse>('/api/me'),
    questions: () => call<Question[]>('/api/questions'),
    submitAnswer: (question_id, selected_option) =>
      call<AnswerResponse>('/api/answer', {
        method: 'POST',
        body: JSON.stringify({ question_id, selected_option }),
      }),
    resetMyAnswers: () =>
      call<{ ok: boolean }>('/api/reset-my-answers', {
        method: 'POST',
      }),
    leaderboard: () => call<LeaderboardEntry[]>('/api/leaderboard'),
  }
}
