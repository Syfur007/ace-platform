import { createBrowserRouter, Link, Navigate, Outlet, RouterProvider } from 'react-router-dom'

import { AdminPanelPage } from '@/pages/AdminPanelPage'
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

function AppShell() {
  return (
    <div className="min-h-dvh bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-semibold">
            ACE
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link to="/student/auth" className="hover:underline">
              Student Auth
            </Link>
            <Link to="/student" className="hover:underline">
              Student
            </Link>
            <Link to="/instructor" className="hover:underline">
              Instructor
            </Link>
            <Link to="/admin" className="hover:underline">
              Admin
            </Link>
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
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Adaptive Cross-Platform Exam Ecosystem</h1>
      <p className="text-sm text-slate-600">
        Role dashboards and the real-time exam simulation engine are scaffolded here.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" to="/student">
          Open Student Dashboard
        </Link>
        <Link className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" to="/instructor">
          Open Instructor Dashboard
        </Link>
        <Link className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" to="/admin">
          Open Admin Panel
        </Link>
        <Link className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" to="/exam/demo-session">
          Open Exam Simulation
        </Link>
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
          { path: 'tests', element: <StudentTestsPage /> },
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
            <InstructorDashboardPage />
          </RequirePortalAuth>
        ),
      },
      { path: 'admin/auth', element: <AdminAuthPage /> },
      {
        path: 'admin',
        element: (
          <RequirePortalAuth portal="admin">
            <AdminPanelPage />
          </RequirePortalAuth>
        ),
      },
      { path: 'exam/:sessionId', element: <ExamSimulationPage /> },
    ],
  },
])

export function AppRouterProvider() {
  return <RouterProvider router={router} />
}
