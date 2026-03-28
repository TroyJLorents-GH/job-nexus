import { createRouter, createRoute, createRootRoute } from '@tanstack/react-router'
import { Root } from './components/Root'
import { Landing } from './components/Landing'
import { Login } from './components/Login'
import { useAuth } from './context/AuthProvider'

const rootRoute = createRootRoute({
  component: Root,
})

// --- Auth HOC for protected pages ---
const withAuth = <P extends object>(Component: React.ComponentType<P>) =>
  (props: P) => {
    const { user, loading } = useAuth()
    if (loading) return <div className="p-6 text-center text-gray-500">Loading...</div>
    if (!user) return <Login />
    return <Component {...props} />
  }

// Keep withAuth referenced so it's available when we add protected routes
void withAuth

// --- Public routes ---
const LandingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Landing,
})

const LoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
})

// --- Route tree ---
const routeTree = rootRoute.addChildren([
  LandingRoute,
  LoginRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
