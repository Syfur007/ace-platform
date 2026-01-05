import { useEffect } from 'react'
import { createBrowserRouter, Link, Navigate, Outlet, RouterProvider, useLocation, useNavigate } from 'react-router-dom'

import { ExamSimulationPage } from '@/pages/ExamSimulationPage'
import { InstructorDashboardPage } from '@/pages/InstructorDashboardPage'
import { PackageDetailsPage } from '@/pages/PackageDetailsPage'
import { StudentDashboardPage } from '@/pages/StudentDashboardPage'
import { RequirePortalAuth } from '@/auth/RequirePortalAuth'
import { StudentLayout } from '@/layouts/StudentLayout'
import { AdminAuthPage } from '@/pages/admin/AdminAuthPage'
import { InstructorAuthPage } from '@/pages/instructor/InstructorAuthPage'
import { StudentAuthPage } from '@/pages/student/StudentAuthPage'
import { StudentCoursesPage } from '@/pages/student/StudentCoursesPage'
import { StudentPracticePage } from '@/pages/student/StudentPracticePage'
import { StudentPracticeSessionPage } from '@/pages/student/StudentPracticeSessionPage'
import { StudentProfilePage } from '@/pages/student/StudentProfilePage'
import { StudentStudyPlanPage } from '@/pages/student/StudentStudyPlanPage'
import { StudentTestsPage } from '@/pages/student/StudentTestsPage'
import { clearAllAccessTokens, getAuthenticatedPortal, getPortalFromPathname, normalizeAccessTokens } from '@/auth/token'
import { apiFetchJson } from '@/api/http'
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage'
import { AdminExamIntegrityPage } from '@/pages/admin/AdminExamIntegrityPage'
import { AdminPracticeTemplatesPage } from '@/pages/admin/AdminPracticeTemplatesPage'
import { AdminQuestionBankPage } from '@/pages/admin/AdminQuestionBankPage'
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage'
import { InstructorPracticeTemplatesPage } from '@/pages/instructor/InstructorPracticeTemplatesPage'
import { AdminPackagesPage } from '@/pages/admin/AdminPackagesPage'
import { InstructorPackagesPage } from '@/pages/instructor/InstructorPackagesPage'

function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    normalizeAccessTokens(getPortalFromPathname(location.pathname))
  }, [location.pathname])

  const currentPortal = getPortalFromPathname(location.pathname)
  const authenticatedPortal = getAuthenticatedPortal()

  return (
    <div className="min-h-dvh bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-semibold">
            ACE
          </Link>
          <nav className="flex gap-4 text-sm">
            {authenticatedPortal ? (
              <>
                <Link
                  to={authenticatedPortal === 'student' ? '/student' : authenticatedPortal === 'instructor' ? '/instructor' : '/admin'}
                  className="hover:underline"
                >
                  {authenticatedPortal === 'student'
                    ? 'Student'
                    : authenticatedPortal === 'instructor'
                      ? 'Instructor'
                      : 'Admin'}
                </Link>
                <button
                  type="button"
                  className="hover:underline"
                  onClick={() => {
                    void (async () => {
                      const portal = getPortalFromPathname(window.location.pathname)
                      if (portal) {
                        try {
                          await apiFetchJson(`/${portal}/auth/logout`, { method: 'POST' })
                        } catch {
                          // ignore
                        }
                      }
                      clearAllAccessTokens()
                      const nextPortal = currentPortal
                      if (nextPortal) navigate(`/${nextPortal}/auth`)
                      else navigate('/')
                    })()
                  }}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/student/auth" className="hover:underline">
                  Student sign in
                </Link>
                <Link to="/instructor/auth" className="hover:underline">
                  Instructor sign in
                </Link>
                <Link to="/admin/auth" className="hover:underline">
                  Admin sign in
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-slate-500">ACE Web</div>
      </footer>
    </div>
  )
}

function Home() {
  const authenticatedPortal = getAuthenticatedPortal()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Adaptive Cross-Platform Exam Ecosystem</h1>
      <p className="text-sm text-slate-600">
        Role dashboards and the real-time exam simulation engine are scaffolded here.
      </p>
      <div className="flex flex-wrap gap-3">
        {authenticatedPortal === 'student' ? (
          <Link className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" to="/student">
            Continue as Student
          </Link>
        ) : (
          <Link className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" to="/student/auth">
            Student sign in
          </Link>
        )}

        {authenticatedPortal === 'instructor' ? (
          <Link className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" to="/instructor">
            Continue as Instructor
          </Link>
        ) : (
          <Link className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" to="/instructor/auth">
            Instructor sign in
          </Link>
        )}

        {authenticatedPortal === 'admin' ? (
          <Link className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" to="/admin">
            Continue as Admin
          </Link>
        ) : (
          <Link className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" to="/admin/auth">
            Admin sign in
          </Link>
        )}

        {authenticatedPortal === 'student' ? (
          <Link
            className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            to="/student/test/demo-session"
          >
            Open Exam Simulation
          </Link>
        ) : null}
      </div>
    </div>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      { path: 'auth', element: <Navigate to="/student/auth" replace /> },
      {
        path: 'student',
        element: (
          <RequirePortalAuth portal="student">
            <StudentLayout />
          </RequirePortalAuth>
        ),
        children: [
          { index: true, element: <StudentDashboardPage /> },
          { path: 'dashboard', element: <StudentDashboardPage /> },
          { path: 'courses', element: <StudentCoursesPage /> },
          { path: 'practice', element: <StudentPracticePage /> },
          { path: 'practice/session/:sessionId', element: <StudentPracticeSessionPage /> },
          { path: 'test', element: <StudentTestsPage /> },
          { path: 'test/:testId', element: <ExamSimulationPage /> },
          { path: 'study-plan', element: <StudentStudyPlanPage /> },
          { path: 'profile', element: <StudentProfilePage /> },
        ],
      },
      { path: 'student/auth', element: <StudentAuthPage /> },
      { path: 'packages/:packageId', element: <PackageDetailsPage /> },
      { path: 'instructor/auth', element: <InstructorAuthPage /> },
      {
        path: 'instructor',
        element: (
          <RequirePortalAuth portal="instructor">
            <Outlet />
          </RequirePortalAuth>
        ),
        children: [
          { index: true, element: <InstructorDashboardPage /> },
          { path: 'packages', element: <InstructorPackagesPage /> },
          { path: 'practice-templates', element: <InstructorPracticeTemplatesPage /> },
        ],
      },
      { path: 'admin/auth', element: <AdminAuthPage /> },
      {
        path: 'admin',
        element: (
          <RequirePortalAuth portal="admin">
            <Outlet />
          </RequirePortalAuth>
        ),
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: 'dashboard', element: <AdminDashboardPage /> },
          { path: 'packages', element: <AdminPackagesPage /> },
          { path: 'question-bank', element: <AdminQuestionBankPage /> },
          { path: 'practice-templates', element: <AdminPracticeTemplatesPage /> },
          { path: 'users', element: <AdminUsersPage /> },
          { path: 'exam-integrity', element: <AdminExamIntegrityPage /> },
        ],
      },
    ],
  },
])

export function AppRouterProvider() {
  return <RouterProvider router={router} />
} 
