import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { adminLogin } from '@/api/endpoints'
import { apiFetchJson } from '@/api/http'
import { clearAccessToken, setAccessToken } from '@/auth/token'

export function AdminAuthPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (isSubmitting) return

    setError(null)
    setIsSubmitting(true)
    try {
      const res = await adminLogin({ email, password })
      setAccessToken('admin', res.accessToken)
      navigate('/admin')
    } catch (e) {
      const message = typeof e === 'object' && e && 'message' in e ? String((e as any).message) : 'Auth failed'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Admin sign in</h1>
        <p className="text-sm text-slate-600">Admin accounts are provisioned via backend bootstrap env vars in dev.</p>
      </header>

      <div className="rounded border border-slate-200 p-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
                void (async () => {
                  try {
                    await apiFetchJson('/admin/auth/logout', { method: 'POST' })
                  } catch {
                    // ignore
                  }
                  clearAccessToken('admin')
                  navigate('/')
                })()
            }}
            className="ml-auto rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-slate-600">Email</span>
            <input
              className="rounded border border-slate-200 px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              autoComplete="email"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-slate-600">Password</span>
            <input
              type="password"
              className="rounded border border-slate-200 px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>

          {error ? <div className="text-sm text-rose-700">{error}</div> : null}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={isSubmitting || !email || !password}
            className={[
              'w-full rounded border px-3 py-2 text-sm',
              isSubmitting || !email || !password
                ? 'border-slate-100 text-slate-400'
                : 'border-slate-200 hover:bg-slate-50',
            ].join(' ')}
          >
            {isSubmitting ? 'Please wait…' : 'Login'}
          </button>
        </div>
      </div>
    </div>
  )
}
