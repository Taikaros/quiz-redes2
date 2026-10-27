import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { AuthProvider } from './auth'
import { Home, Layout, LeaderboardPage, QuizPage } from './pages'
import './styles.css'

const rootRoute = createRootRoute({ component: Layout })
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Home })
const quizRoute = createRoute({ getParentRoute: () => rootRoute, path: '/quiz', component: QuizPage })
const leaderboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/leaderboard',
  component: LeaderboardPage,
})

const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, quizRoute, leaderboardRoute]),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthProvider>
  </StrictMode>,
)
