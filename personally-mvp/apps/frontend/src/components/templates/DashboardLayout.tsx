import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/stores/auth';
import { AgentStatusDot } from '@/components/atoms/AgentStatusDot';
import { useAgentStatus } from '@/features/agent/hooks';
import { useUnreadCount } from '@/features/notifications/hooks';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/clients', label: 'Clientes' },
  { to: '/exercises', label: 'Ejercicios' },
  { to: '/notifications', label: 'Notificaciones', withUnreadBadge: true },
  { to: '/agent', label: 'Bot', withAgentDot: true },
  { to: '/settings', label: 'Ajustes' },
];

export function DashboardLayout() {
  const { user, loading, init, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: agentStatus } = useAgentStatus();
  const unread = useUnreadCount();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true });
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="font-heading font-semibold tracking-tight">
            Personally
          </Link>
          <nav className="hidden md:flex items-center gap-4 text-sm">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5',
                    isActive && 'text-foreground font-medium',
                  )
                }
              >
                {item.label}
                {item.withAgentDot && agentStatus && (
                  <AgentStatusDot state={agentStatus.state} />
                )}
                {item.withUnreadBadge && unread > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-semibold">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={() => signOut()}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Salir
          </button>
        </div>
      </header>
      <main className="flex-1 container py-8">
        <Outlet />
      </main>
    </div>
  );
}
