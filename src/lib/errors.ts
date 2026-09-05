/**
 * Turn a thrown value into something worth showing a user.
 *
 * Firebase errors arrive as `{ code, message }` where the message is a wall of
 * SDK prose. The codes below are the ones this app can realistically hit, so
 * they get a plain-English replacement that says what to actually do.
 */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!err) return fallback

  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : ''

  switch (code) {
    case 'permission-denied':
    case 'firestore/permission-denied':
      return "You don't have permission to do that. If this keeps happening, your session may have expired — try signing out and back in."
    case 'unauthenticated':
    case 'firestore/unauthenticated':
      return 'Your session expired. Please sign in again.'
    case 'unavailable':
    case 'firestore/unavailable':
      return "Can't reach the server. Check your connection and try again."
    case 'deadline-exceeded':
      return 'That took too long. Please try again.'
    case 'resource-exhausted':
      return 'Too many requests right now. Wait a moment and try again.'
    default:
      break
  }

  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err) return err
  return fallback
}
