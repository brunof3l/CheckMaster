import { useUIStore } from '../stores/ui';
import { Link, useLocation } from 'react-router-dom';

export function Header() {
  const toggleTheme = useUIStore(s => s.toggleTheme);
  const loc = useLocation();
  const title = {
    '/': 'Login',
    '/home': 'Home',
    '/checklists': 'Checklists',
    '/checklists/new': 'Novo Checklist',
    '/vehicles': 'Veículos',
    '/suppliers': 'Fornecedores',
    '/settings': 'Configurações'
  }[loc.pathname] ?? 'CheckMaster';
  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-brand/80 backdrop-blur border-b border-gray-200 dark:border-gray-700">
      <div className="container-m h-12 flex items-center justify-between">
        <Link to="/home" className="font-semibold">{title}</Link>
        <button
          aria-label="Alternar tema"
          className="text-sm px-3 py-1 rounded border border-gray-300 dark:border-gray-600"
          onClick={toggleTheme}
        >Tema</button>
      </div>
    </header>
  );
}