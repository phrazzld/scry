const SESSION_TOKEN_KEY = 'scry_session_token'
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds

// Client-side cookie functions
export function setClientSessionCookie(token: string) {
  if (typeof window !== 'undefined') {
    const maxAge = SESSION_DURATION / 1000 // Convert to seconds
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${SESSION_TOKEN_KEY}=${token}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`
  }
}

export function removeClientSessionCookie() {
  if (typeof window !== 'undefined') {
    document.cookie = `${SESSION_TOKEN_KEY}=; Path=/; Max-Age=0`
  }
}

export function getSessionCookie(): string | null {
  if (typeof window === 'undefined') {
    // Server-side cookie reading is not supported in this context
    // The middleware handles server-side cookie reading
    return null
  }
  
  // Client-side cookie reading
  const cookieString = document.cookie
  const cookies = cookieString.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === SESSION_TOKEN_KEY) {
      return value
    }
  }
  return null
}