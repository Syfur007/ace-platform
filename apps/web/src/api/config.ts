export function getApiBaseUrl() {
  const raw = import.meta.env.VITE_API_BASE_URL
  const value = typeof raw === 'string' ? raw.trim() : ''
  return value !== '' ? value : 'http://localhost:8080'
}
