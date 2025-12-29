export type Portal = 'student' | 'instructor' | 'admin'

const LEGACY_ACCESS_TOKEN_KEY = 'ace_access_token'

function portalTokenKey(portal: Portal) {
  return `ace_access_token_${portal}`
}

export function getPortalFromPathname(pathname: string): Portal | null {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin'
  if (pathname === '/instructor' || pathname.startsWith('/instructor/')) return 'instructor'
  if (pathname === '/student' || pathname.startsWith('/student/')) return 'student'
  return null
}

export function getAccessToken(portal: Portal): string | null {
  try {
    const key = portalTokenKey(portal)
    const token = window.localStorage.getItem(key)
    if (token) return token

    // Legacy migration: old single token becomes the student token.
    if (portal === 'student') {
      const legacy = window.localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY)
      if (legacy) {
        window.localStorage.setItem(key, legacy)
        return legacy
      }
    }

    return null
  } catch {
    return null
  }
}

export function setAccessToken(portal: Portal, token: string) {
  try {
    window.localStorage.setItem(portalTokenKey(portal), token)
  } catch {
    // ignore
  }
}

export function clearAccessToken(portal: Portal) {
  try {
    window.localStorage.removeItem(portalTokenKey(portal))
  } catch {
    // ignore
  }
}

export function clearAllAccessTokens() {
  try {
    window.localStorage.removeItem(portalTokenKey('student'))
    window.localStorage.removeItem(portalTokenKey('instructor'))
    window.localStorage.removeItem(portalTokenKey('admin'))
    window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY)
  } catch {
    // ignore
  }
}

export function getActiveAccessToken(): string | null {
  const portal = getPortalFromPathname(window.location.pathname)
  if (!portal) return null
  return getAccessToken(portal)
}

export function isAuthenticated(portal: Portal) {
  return Boolean(getAccessToken(portal))
}
