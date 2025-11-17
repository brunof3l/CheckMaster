import { NavLink } from 'react-router-dom';
import { Home, ListChecks, Car, Store, Settings, Search, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../stores/auth';

export function Sidebar() {
  const role = useAuthStore(s => s.role);
  const listItemCls = ({ isActive }: { isActive: boolean }) => [
    'flex items-center gap-2 pl-0 pr-3 py-2 rounded-lg text-sm',
    isActive
      ? 'bg-[var(--cm-primary)] text-white'
      : 'text-black dark:text-white hover:bg-white/5'
  ].join(' ');

  const iconProps = { size: 18, strokeWidth: 2, 'aria-hidden': true } as const;

  return (
    <aside className="hidden md:block w-64 border-r border-white/10 sticky top-12 h-[calc(100vh-3rem)]">
      <div className="h-full p-3 flex flex-col gap-3">
        <div className="relative">
          <input className="cm-input cm-input--with-icon h-9 text-sm" placeholder="Buscar" />
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden />
        </div>
        <nav className="space-y-1">
          <NavLink to="/home" className={listItemCls}><Home {...iconProps} /> <span>Home</span></NavLink>
          <NavLink to="/checklists" className={listItemCls}><ListChecks {...iconProps} /> <span>Checklists</span></NavLink>
          <NavLink to="/vehicles" className={listItemCls}><Car {...iconProps} /> <span>Veículos</span></NavLink>
          <NavLink to="/suppliers" className={listItemCls}><Store {...iconProps} /> <span>Fornecedores</span></NavLink>
          {String(role || '').toLowerCase() === 'admin' && (
            <NavLink to="/admin" className={listItemCls}><ShieldAlert {...iconProps} /> <span>Admin</span></NavLink>
          )}
          <NavLink to="/settings" className={listItemCls}><Settings {...iconProps} /> <span>Configurações</span></NavLink>
        </nav>
        <div className="mt-auto text-xs text-gray-500 dark:text-white/50">CheckMaster</div>
      </div>
    </aside>
  );
}