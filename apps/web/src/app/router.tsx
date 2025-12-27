import { createBrowserRouter, Link, Outlet, RouterProvider } from 'react-router-dom'

import { AdminPanelPage } from '@/pages/AdminPanelPage'
import { ExamSimulationPage } from '@/pages/ExamSimulationPage'
import { InstructorDashboardPage } from '@/pages/InstructorDashboardPage'
import { PackageDetailsPage } from '@/pages/PackageDetailsPage'
import { StudentDashboardPage } from '@/pages/StudentDashboardPage'

function AppShell() {
  return (
    <div className="min-h-dvh bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-semibold">
            ACE
          </Link>
          <nav className="flex gap-4 text-sm">
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
      { path: 'student', element: <StudentDashboardPage /> },
      { path: 'packages/:packageId', element: <PackageDetailsPage /> },
      { path: 'instructor', element: <InstructorDashboardPage /> },
      { path: 'admin', element: <AdminPanelPage /> },
      { path: 'exam/:sessionId', element: <ExamSimulationPage /> },
    ],
  },
])

export function AppRouterProvider() {
  return <RouterProvider router={router} />
}
