export type Portal = 'student' | 'instructor' | 'admin'

const LEGACY_ACCESS_TOKEN_KEY = 'ace_access_token'
const ACTIVE_PORTAL_KEY = 'ace_active_portal'

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
      // If any portal token already exists, don't migrate legacy.
      const anyPortalTokenExists =
        Boolean(window.localStorage.getItem(portalTokenKey('student'))) ||
        Boolean(window.localStorage.getItem(portalTokenKey('instructor'))) ||
        Boolean(window.localStorage.getItem(portalTokenKey('admin')))
      if (anyPortalTokenExists) return null

      const legacy = window.localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY)
      if (legacy) {
        window.localStorage.setItem(key, legacy)
        window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY)
        return legacy
      }
    }

    return null
  } catch {
    return null
  }
}

function getPortalsWithTokens(): Portal[] {
  const portals: Portal[] = []
  try {
    if (window.localStorage.getItem(portalTokenKey('student'))) portals.push('student')
    if (window.localStorage.getItem(portalTokenKey('instructor'))) portals.push('instructor')
    if (window.localStorage.getItem(portalTokenKey('admin'))) portals.push('admin')
  } catch {
    // ignore
  }
  return portals
}

function clearOtherAccessTokens(keepPortal: Portal) {
  const portals: Portal[] = ['student', 'instructor', 'admin']
  for (const portal of portals) {
    if (portal !== keepPortal) clearAccessToken(portal)
  }
}

export function getAuthenticatedPortal(): Portal | null {
  try {
    const v = window.localStorage.getItem(ACTIVE_PORTAL_KEY) as Portal | null
    if (v === 'student' || v === 'instructor' || v === 'admin') return v
  } catch {
    // ignore
  }

  // Legacy fallback: if exactly one portal token exists, keep that portal as active.
  const portals = getPortalsWithTokens()
  if (portals.length === 1) {
    try {
      window.localStorage.setItem(ACTIVE_PORTAL_KEY, portals[0])
    } catch {
      // ignore
    }
    return portals[0]
  }
  return null
}

export function normalizeAccessTokens(preferredPortal: Portal | null) {
  // Cookie-based auth: keep only a portal hint for navigation.
  try {
    if (preferredPortal) window.localStorage.setItem(ACTIVE_PORTAL_KEY, preferredPortal)

    // Best-effort cleanup of any legacy tokens.
    window.localStorage.removeItem(portalTokenKey('student'))
    window.localStorage.removeItem(portalTokenKey('instructor'))
    window.localStorage.removeItem(portalTokenKey('admin'))
    window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY)
  } catch {
    // ignore
  }
}

export function setAccessToken(portal: Portal, token: string) {
  // Backward-compatible API: callers still pass a token, but we no longer persist it.
  void token
  try {
    // Clear any legacy tokens, keep only the active portal hint.
    window.localStorage.removeItem(portalTokenKey('student'))
    window.localStorage.removeItem(portalTokenKey('instructor'))
    window.localStorage.removeItem(portalTokenKey('admin'))
    window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY)
    window.localStorage.setItem(ACTIVE_PORTAL_KEY, portal)
  } catch {
    // ignore
  }
}

export function clearAccessToken(portal: Portal) {
  try {
    window.localStorage.removeItem(portalTokenKey(portal))

    const activePortal = window.localStorage.getItem(ACTIVE_PORTAL_KEY)
    if (activePortal === portal) window.localStorage.removeItem(ACTIVE_PORTAL_KEY)
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
    window.localStorage.removeItem(ACTIVE_PORTAL_KEY)
  } catch {
    // ignore
  }
}

export function getActiveAccessToken(): string | null {
  return null
}

export function isAuthenticated(portal: Portal) {
  return getAuthenticatedPortal() === portal
}
