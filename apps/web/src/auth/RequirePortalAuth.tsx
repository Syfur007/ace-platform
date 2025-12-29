import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import type { Portal } from '@/auth/token'
import { isAuthenticated } from '@/auth/token'

export function RequirePortalAuth({ portal, children }: { portal: Portal; children: ReactNode }) {
  const location = useLocation()

  if (!isAuthenticated(portal)) {
    return <Navigate to={`/${portal}/auth`} replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
