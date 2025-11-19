import { useState } from 'react';
import { useUIStore } from '../stores/ui';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { Menu, Home, ListChecks, Car, Store, Settings, ShieldAlert } from 'lucide-react';

export function Header() {
  const toggleSidebar = useUIStore(s => s.toggleSidebar);
  const loc = useLocation();
  const user = useAuthStore(s => s.user);
  const isConfigured = useAuthStore(s => s.isConfigured);
  const role = useAuthStore(s => s.role);
  const isAuthScreen = loc.pathname === '/' || loc.pathname === '/login' || loc.pathname.startsWith('/auth');
  const canToggleSidebar = !!user && !isAuthScreen;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const handleMenuClick = () => {
    if (!canToggleSidebar) return;
    // Desktop: alterna Sidebar; Mobile: abre dropdown
    if (window.matchMedia('(min-width: 768px)').matches) {
      toggleSidebar();
    } else {
      setMobileMenuOpen(v => !v);
    }
  };
  return (
    <header className="sticky top-0 z-40 backdrop-blur border-b border-white/10 bg-black/40">
      {/* Header alinhado com o recuo da Sidebar (px-3) */}
      <div className="h-12 flex items-center justify-between px-3 relative">
        <div className="flex items-center gap-2">
          {canToggleSidebar && (
            <button
              aria-label="Abrir/fechar menu"
              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-black text-white shadow border border-white/10 hover:bg-black/80"
              onClick={handleMenuClick}
            >
              <Menu size={16} aria-hidden />
            </button>
          )}
          {/* Remover nomes dos menus; deixar apenas a logo para voltar ao menu */}
          <Link to="/home" aria-label="Voltar ao menu" className="inline-flex items-center">
            {/* Usa BASE_URL para suportar deploy em subpath (GitHub Pages) */}
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="CheckMaster" className="h-6 w-6" />
          </Link>
        </div>
        {/* Tema único escuro: remover botão de alternância */}
        <div />
        {/* Dropdown de navegação no mobile */}
        {canToggleSidebar && mobileMenuOpen && (
          <div className="absolute left-0 right-0 top-full mt-2 md:hidden z-50">
            <div className="cm-card p-2 shadow-xl w-full max-h-[50vh] overflow-auto">
              <ul className="space-y-1">
                <li>
                  <NavLink to="/home" className="cm-btn cm-btn-ghost w-full justify-start text-left" onClick={() => setMobileMenuOpen(false)}>
                    <Home size={16} className="mr-2" /> Home
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/checklists" className="cm-btn cm-btn-ghost w-full justify-start text-left" onClick={() => setMobileMenuOpen(false)}>
                    <ListChecks size={16} className="mr-2" /> Checklists
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/vehicles" className="cm-btn cm-btn-ghost w-full justify-start text-left" onClick={() => setMobileMenuOpen(false)}>
                    <Car size={16} className="mr-2" /> Veículos
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/suppliers" className="cm-btn cm-btn-ghost w-full justify-start text-left" onClick={() => setMobileMenuOpen(false)}>
                    <Store size={16} className="mr-2" /> Fornecedores
                  </NavLink>
                </li>
                {String(role || '').toLowerCase() === 'admin' && (
                  <li>
                    <NavLink to="/admin" className="cm-btn cm-btn-ghost w-full justify-start text-left" onClick={() => setMobileMenuOpen(false)}>
                      <ShieldAlert size={16} className="mr-2" /> Admin
                    </NavLink>
                  </li>
                )}
                <li>
                  <NavLink to="/settings" className="cm-btn cm-btn-ghost w-full justify-start text-left" onClick={() => setMobileMenuOpen(false)}>
                    <Settings size={16} className="mr-2" /> Configurações
                  </NavLink>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
      {!isConfigured && (
        <div className="text-xs px-3 py-1"><span className="cm-badge cm-badge-warning">Firebase não configurado</span></div>
      )}
    </header>
  );
}