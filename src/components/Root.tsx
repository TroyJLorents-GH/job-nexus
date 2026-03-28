import { Outlet, Link } from '@tanstack/react-router'
import { Briefcase, Home, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'

export function Root() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Briefcase className="h-8 w-8 text-blue-600" />
              <h1 className="ml-2 text-xl font-semibold text-gray-900">
                Job Nexus
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              {/* Auth status */}
              <div className="flex items-center space-x-2 text-sm">
                {user ? (
                  <div className="flex items-center space-x-2">
                    <span className="hidden sm:inline text-gray-600">
                      {user.displayName || user.email}
                    </span>
                    <button
                      onClick={() => signOut()}
                      className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="hidden sm:inline">Sign out</span>
                    </button>
                  </div>
                ) : (
                  <Link
                    to="/login"
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Sign in
                  </Link>
                )}
              </div>

              <nav className="flex space-x-2">
                <Link
                  to="/"
                  className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  activeProps={{
                    className:
                      'flex items-center px-3 py-2 rounded-md text-sm font-medium text-blue-600 bg-blue-50',
                  }}
                >
                  <Home className="h-4 w-4 mr-1" />
                  Home
                </Link>
              </nav>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 w-full overflow-hidden">
        <Outlet />
      </main>

      <footer className="bg-white border-t py-4 text-center text-sm text-gray-500">
        Job Nexus &copy; {new Date().getFullYear()}
      </footer>
    </div>
  )
}
