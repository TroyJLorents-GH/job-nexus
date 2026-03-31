import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../context/AuthProvider'
import { Briefcase, Mail, Link as LinkIcon } from 'lucide-react'

type Mode = 'main' | 'email' | 'emailLink'

export function Login() {
  const { user, loginWithGoogle, loginWithEmail, signUpWithEmail, sendEmailLink } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('main')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Redirect to home when user signs in
  useEffect(() => {
    if (user) navigate({ to: '/' })
  }, [user, navigate])

  const reset = () => { setError(''); setSuccess('') }

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault()
    reset()
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password)
      } else {
        await loginWithEmail(email, password)
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      const msg =
        code === 'auth/user-not-found' ? 'No account found. Try signing up.' :
        code === 'auth/wrong-password' ? 'Incorrect password.' :
        code === 'auth/weak-password' ? 'Password must be at least 6 characters.' :
        code === 'auth/email-already-in-use' ? 'Account already exists. Try signing in.' :
        code === 'auth/invalid-credential' ? 'Invalid email or password.' :
        (err as Error).message
      setError(msg)
    }
  }

  const handleEmailLink = async (e: FormEvent) => {
    e.preventDefault()
    reset()
    try {
      await sendEmailLink(email)
      setSuccess('Sign-in link sent! Check your email.')
    } catch (err: unknown) {
      setError((err as Error).message)
    }
  }

  const handleGoogle = async () => {
    reset()
    try {
      await loginWithGoogle()
    } catch (err: unknown) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Briefcase className="h-10 w-10 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Sign in to <span className="text-blue-600">Job Nexus</span>
          </h1>
          <p className="text-sm text-gray-500">
            Track jobs, match resumes, and get AI-powered career guidance.
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {/* Main options */}
        {mode === 'main' && (
          <div className="space-y-3">
            <button
              onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              <GoogleIcon />
              Sign in with Google
            </button>
            <button
              onClick={() => { setMode('email'); reset() }}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              <Mail className="h-4 w-4" />
              Sign in with Email
            </button>
            <button
              onClick={() => { setMode('emailLink'); reset() }}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              <LinkIcon className="h-4 w-4" />
              Sign in with Email Link
            </button>
          </div>
        )}

        {/* Email / Password */}
        {mode === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              {isSignUp ? 'Create Account' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="w-full text-sm text-blue-600 hover:text-blue-800"
            >
              {isSignUp ? 'Already have an account? Sign in' : "No account? Create one"}
            </button>
            <button
              type="button"
              onClick={() => { setMode('main'); reset() }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Back
            </button>
          </form>
        )}

        {/* Email Link (passwordless) */}
        {mode === 'emailLink' && (
          <form onSubmit={handleEmailLink} className="space-y-4">
            <p className="text-sm text-gray-500">
              Enter your email and we'll send a sign-in link. No password needed.
            </p>
            <div>
              <label htmlFor="link-email" className="block text-sm font-medium text-gray-700">Email</label>
              <input
                id="link-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              Send Sign-in Link
            </button>
            <button
              type="button"
              onClick={() => { setMode('main'); reset() }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}
