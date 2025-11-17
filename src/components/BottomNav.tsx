import { NavLink } from 'react-router-dom';
import { Home, ListChecks, Car, Store, Settings, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../stores/auth';

export function BottomNav() {
  const role = useAuthStore(s => s.role);
  const linkCls = ({ isActive }: { isActive: boolean }) => [
    'flex-1 px-2 py-1 h-16',
    'flex items-center justify-center',
    'hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors',
    isActive ? 'text-[var(--cm-primary)] font-semibold bg-[var(--cm-primary)]/10' : 'text-gray-500 dark:text-white/60'
  ].join(' ');

  const iconProps = { size: 20, strokeWidth: 2, 'aria-hidden': true } as const;

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-white/10 bg-black/30 dark:bg-black/30 backdrop-blur-md">
      <div className="container-m flex items-center justify-between gap-1 pb-[env(safe-area-inset-bottom)]">
        <NavLink to="/home" className={linkCls}>
          {({ isActive }) => (
            <div className="flex flex-col items-center justify-center gap-0.5">
              <Home {...iconProps} />
              <span className={`text-[10px] leading-none ${isActive ? 'text-[var(--cm-primary)]' : ''}`}>Home</span>
            </div>
          )}
        </NavLink>
        <NavLink to="/checklists" className={linkCls}>
          {({ isActive }) => (
            <div className="flex flex-col items-center justify-center gap-0.5">
              <ListChecks {...iconProps} />
              <span className={`text-[10px] leading-none ${isActive ? 'text-[var(--cm-primary)]' : ''}`}>Checklists</span>
            </div>
          )}
        </NavLink>
        <NavLink to="/vehicles" className={linkCls}>
          {({ isActive }) => (
            <div className="flex flex-col items-center justify-center gap-0.5">
              <Car {...iconProps} />
              <span className={`text-[10px] leading-none ${isActive ? 'text-[var(--cm-primary)]' : ''}`}>Veículos</span>
            </div>
          )}
        </NavLink>
        <NavLink to="/suppliers" className={linkCls}>
          {({ isActive }) => (
            <div className="flex flex-col items-center justify-center gap-0.5">
              <Store {...iconProps} />
              <span className={`text-[10px] leading-none ${isActive ? 'text-[var(--cm-primary)]' : ''}`}>Fornecedores</span>
            </div>
          )}
        </NavLink>
        {String(role || '').toLowerCase() === 'admin' && (
          <NavLink to="/admin" className={linkCls}>
            {({ isActive }) => (
              <div className="flex flex-col items-center justify-center gap-0.5">
                <ShieldAlert {...iconProps} />
                <span className={`text-[10px] leading-none ${isActive ? 'text-[var(--cm-primary)]' : ''}`}>Admin</span>
              </div>
            )}
          </NavLink>
        )}
        <NavLink to="/settings" className={linkCls}>
          {({ isActive }) => (
            <div className="flex flex-col items-center justify-center gap-0.5">
              <Settings {...iconProps} />
              <span className={`text-[10px] leading-none ${isActive ? 'text-[var(--cm-primary)]' : ''}`}>Config</span>
            </div>
          )}
        </NavLink>
      </div>
    </nav>
  );
}