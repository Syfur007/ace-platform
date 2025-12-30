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
  const portals = getPortalsWithTokens()
  return portals.length === 1 ? portals[0] : null
}

export function normalizeAccessTokens(preferredPortal: Portal | null) {
  try {
    const portals = getPortalsWithTokens()
    if (portals.length <= 1) return

    // If we're currently in a portal and have that token, keep it.
    if (preferredPortal) {
      const preferredToken = window.localStorage.getItem(portalTokenKey(preferredPortal))
      if (preferredToken) {
        clearOtherAccessTokens(preferredPortal)
        window.localStorage.setItem(ACTIVE_PORTAL_KEY, preferredPortal)
        return
      }
    }

    // Otherwise keep the last active portal if possible.
    const lastActive = window.localStorage.getItem(ACTIVE_PORTAL_KEY) as Portal | null
    if (lastActive && (lastActive === 'student' || lastActive === 'instructor' || lastActive === 'admin')) {
      const lastActiveToken = window.localStorage.getItem(portalTokenKey(lastActive))
      if (lastActiveToken) {
        clearOtherAccessTokens(lastActive)
        window.localStorage.setItem(ACTIVE_PORTAL_KEY, lastActive)
        return
      }
    }

    // Fallback: keep admin > instructor > student.
    const fallbackOrder: Portal[] = ['admin', 'instructor', 'student']
    for (const portal of fallbackOrder) {
      const token = window.localStorage.getItem(portalTokenKey(portal))
      if (token) {
        clearOtherAccessTokens(portal)
        window.localStorage.setItem(ACTIVE_PORTAL_KEY, portal)
        return
      }
    }
  } catch {
    // ignore
  }
}

export function setAccessToken(portal: Portal, token: string) {
  try {
    clearOtherAccessTokens(portal)
    window.localStorage.setItem(portalTokenKey(portal), token)
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
  const portal = getPortalFromPathname(window.location.pathname)
  if (!portal) return null
  normalizeAccessTokens(portal)
  return getAccessToken(portal)
}

export function isAuthenticated(portal: Portal) {
  return Boolean(getAccessToken(portal))
}
