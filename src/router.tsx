import { createRouter, createRoute, createRootRoute } from '@tanstack/react-router'
import { Root } from './components/Root'
import { Landing } from './components/Landing'
import { Login } from './components/Login'
import { JobList } from './components/JobList'
import { JobDetail } from './components/JobDetail'
import { JobForm } from './components/JobForm'
import { Discover } from './components/Discover'
import { ResumePipeline } from './components/ResumePipeline'
import { Chat } from './components/Chat'
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

const DiscoverRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/discover',
  component: Discover,
})

// --- Protected routes ---
const JobsIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/jobs',
  component: withAuth(JobList),
})

const JobDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/jobs/$jobId',
  component: withAuth(JobDetail),
})

const NewJobRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/jobs/new',
  component: withAuth(JobForm),
})

const EditJobRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/jobs/$jobId/edit',
  component: withAuth(JobForm),
})

const ResumePipelineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/resume-pipeline',
  component: withAuth(ResumePipeline),
})

const ChatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chat',
  component: withAuth(Chat),
})

// --- Route tree ---
const routeTree = rootRoute.addChildren([
  LandingRoute,
  LoginRoute,
  DiscoverRoute,
  JobsIndexRoute,
  NewJobRoute,
  JobDetailRoute,
  EditJobRoute,
  ResumePipelineRoute,
  ChatRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
