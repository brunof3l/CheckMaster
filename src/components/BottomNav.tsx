import { NavLink } from 'react-router-dom';

export function BottomNav() {
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex-1 text-center py-2 text-xs ${isActive ? 'text-blue-600' : 'text-gray-500'}`;
  return (
    <nav className="fixed bottom-0 inset-x-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-brand">
      <div className="flex items-center justify-between">
        <NavLink to="/home" className={linkCls}>Home</NavLink>
        <NavLink to="/checklists" className={linkCls}>Checklists</NavLink>
        <NavLink to="/vehicles" className={linkCls}>Veículos</NavLink>
        <NavLink to="/suppliers" className={linkCls}>Fornecedores</NavLink>
        <NavLink to="/settings" className={linkCls}>Config</NavLink>
      </div>
    </nav>
  );
}