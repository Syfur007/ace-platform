import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { studentLogin, studentRegister } from '@/api/endpoints'
import { clearAccessToken, setAccessToken } from '@/auth/token'

export function StudentAuthPage() {
  const navigate = useNavigate()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (isSubmitting) return

    setError(null)
    setIsSubmitting(true)
    try {
      const res = mode === 'login'
        ? await studentLogin({ email, password })
        : await studentRegister({ email, password })

      setAccessToken('student', res.accessToken)
      navigate('/student/dashboard')
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
        <h1 className="text-xl font-semibold">Student sign in</h1>
        <p className="text-sm text-slate-600">JWT stored in localStorage (dev only).</p>
      </header>

      <div className="rounded border border-slate-200 p-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={[
              'rounded border px-3 py-2 text-sm',
              mode === 'login' ? 'border-slate-300 bg-slate-50' : 'border-slate-200 hover:bg-slate-50',
            ].join(' ')}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={[
              'rounded border px-3 py-2 text-sm',
              mode === 'register' ? 'border-slate-300 bg-slate-50' : 'border-slate-200 hover:bg-slate-50',
            ].join(' ')}
          >
            Register
          </button>

          <button
            type="button"
            onClick={() => {
              clearAccessToken('student')
              navigate('/')
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
              placeholder="student@example.com"
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
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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
            {isSubmitting ? 'Please wait…' : mode === 'login' ? 'Login' : 'Register'}
          </button>
        </div>
      </div>
    </div>
  )
}
