import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useQuery } from '@tanstack/react-query'

import type { Portal } from '@/auth/token'
import { setAccessToken } from '@/auth/token'
import { adminGetMe, instructorGetMe, studentGetMe } from '@/api/endpoints'

export function RequirePortalAuth({ portal, children }: { portal: Portal; children: ReactNode }) {
  const location = useLocation()

  const meQuery = useQuery({
    queryKey: ['me', portal],
    queryFn: () => (portal === 'student' ? studentGetMe() : portal === 'instructor' ? instructorGetMe() : adminGetMe()),
    retry: false,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    // Maintain a portal hint in localStorage for navigation.
    // Must not conditionally call hooks, so guard the body instead.
    if (!meQuery.isSuccess) return
    setAccessToken(portal, '')
  }, [portal, meQuery.isSuccess])

  if (meQuery.isLoading) {
    return <div className="text-sm text-slate-600">Checking session…</div>
  }

  if (meQuery.isError) {
    return <Navigate to={`/${portal}/auth`} replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
