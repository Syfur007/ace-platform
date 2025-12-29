const ACCESS_TOKEN_KEY = 'ace_access_token'

export function getAccessToken(): string | null {
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAccessToken(token: string) {
  try {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token)
  } catch {
    // ignore
  }
}

export function clearAccessToken() {
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY)
  } catch {
    // ignore
  }
}

export function isAuthenticated() {
  return Boolean(getAccessToken())
}
