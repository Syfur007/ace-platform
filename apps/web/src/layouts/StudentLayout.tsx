import { Link, NavLink, Outlet } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/student/dashboard', label: 'Dashboard' },
  { to: '/student/courses', label: 'Courses' },
  { to: '/student/practice', label: 'Practice' },
  { to: '/student/tests', label: 'Tests' },
  { to: '/student/study-plan', label: 'Study Plan' },
  { to: '/student/profile', label: 'Profile' },
] as const

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'rounded px-2 py-1 text-sm',
          isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50',
        ].join(' ')
      }
      end
    >
      {label}
    </NavLink>
  )
}

export function StudentLayout() {
  return (
    <div className="min-h-dvh bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/student/dashboard" className="font-semibold">
            ACE
          </Link>

          <nav className="hidden flex-wrap items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.to} to={item.to} label={item.label} />
            ))}
          </nav>

          <div className="text-xs text-slate-500">Student</div>
        </div>

        <nav className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4 pb-3 md:hidden">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} to={item.to} label={item.label} />
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-slate-500">ACE Web • Student</div>
      </footer>
    </div>
  )
}
