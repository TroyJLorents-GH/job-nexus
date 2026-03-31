import { auth } from '../lib/firebase'

const API_BASE = import.meta.env.PROD ? '/api' : '/api'

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers)

  const user = auth.currentUser
  if (user) {
    const token = await user.getIdToken()
    headers.set('Authorization', `Bearer ${token}`)
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  return fetch(url, { ...options, headers })
}
