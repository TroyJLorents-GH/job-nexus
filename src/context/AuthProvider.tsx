import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react'
import type { User, UserCredential } from 'firebase/auth'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  loginWithGoogle: () => Promise<UserCredential>
  loginWithEmail: (email: string, password: string) => Promise<UserCredential>
  signUpWithEmail: (email: string, password: string) => Promise<UserCredential>
  sendEmailLink: (email: string) => Promise<void>
  signOut: () => Promise<void>
  getToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Handle email link sign-in callback
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem('emailForSignIn')
      if (!email) {
        email = window.prompt('Please provide your email for confirmation')
      }
      if (email) {
        signInWithEmailLink(auth, email, window.location.href)
          .then(() => window.localStorage.removeItem('emailForSignIn'))
          .catch((err) => console.error('Email link sign-in error:', err))
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,

    loginWithGoogle: () => signInWithPopup(auth, googleProvider),

    loginWithEmail: (email: string, password: string) =>
      signInWithEmailAndPassword(auth, email, password),

    signUpWithEmail: (email: string, password: string) =>
      createUserWithEmailAndPassword(auth, email, password),

    sendEmailLink: async (email: string) => {
      await sendSignInLinkToEmail(auth, email, {
        url: window.location.origin,
        handleCodeInApp: true,
      })
      window.localStorage.setItem('emailForSignIn', email)
    },

    signOut: () => firebaseSignOut(auth),

    getToken: async () => {
      if (auth.currentUser) {
        return auth.currentUser.getIdToken()
      }
      return null
    },
  }), [user, loading])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
