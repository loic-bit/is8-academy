import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { initTracking, track } from '../lib/track.js';
import WelcomeModal from './WelcomeModal.jsx';
import BrandMark from './BrandMark.jsx';

// Five items. Calculators and quizzes live inside the Toolkit and are linked
// contextually from lessons, so the nav stays calm.
const NAV = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/course', label: 'The Course', icon: '🎓' },
  { to: '/vault', label: 'Toolkit', icon: '🧰' },
  { to: '/finder', label: 'DealFinder AI', icon: '✨', badge: 'Trial' },
  { to: '/get-help', label: 'Get Help', icon: '🤝' },
];

// Admin-only sixth item; invisible to everyone else.
const ADMIN_ITEM = { to: '/admin', label: 'Admin', icon: '📊' };

function SidebarContent({ user, onLogout, onNavigate }) {
  const items = user?.isAdmin === true ? [...NAV, ADMIN_ITEM] : NAV;
  return (
    <>
      <div className="px-6 py-5">
        <BrandMark />
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive ? 'bg-brand/10 text-brand' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            <span aria-hidden>{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className="mb-2 truncate text-sm font-medium">{user?.name}</div>
        <div className="mb-3 truncate text-xs text-slate-400">{user?.email}</div>
        <button onClick={onLogout} className="btn-ghost w-full">
          Log out
        </button>
      </div>
    </>
  );
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  // DealFinder AI renders a fullscreen embedded app, not the padded page shell.
  const fullBleed = location.pathname === '/finder';

  // Analytics boot.
  useEffect(() => {
    initTracking();
  }, []);

  // Close the mobile drawer and log a page view whenever the route changes.
  useEffect(() => {
    setOpen(false);
    track('page_view', { path: location.pathname });
  }, [location.pathname]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <>
    <WelcomeModal />
    <div className="flex min-h-full">
      {/* Static sidebar — tablet / desktop (md+) */}
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <SidebarContent user={user} onLogout={handleLogout} />
      </aside>

      {/* Mobile off-canvas drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-white shadow-xl">
            <SidebarContent
              user={user}
              onLogout={handleLogout}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar with hamburger */}
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Open menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
          <BrandMark compact />
        </header>

        <main className={`min-w-0 flex-1 ${fullBleed ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {fullBleed ? (
            <Outlet />
          ) : (
            <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:px-8 md:py-10">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
    </>
  );
}
