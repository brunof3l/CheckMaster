import { useState } from 'react';
import { useUIStore } from '../stores/ui';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { Menu, Home, ListChecks, Car, Store, Settings } from 'lucide-react';

export function Header() {
  const toggleSidebar = useUIStore(s => s.toggleSidebar);
  const loc = useLocation();
  const user = useAuthStore(s => s.user);
  const isConfigured = useAuthStore(s => s.isConfigured);
  const isAuthScreen = loc.pathname === '/' || loc.pathname === '/login' || loc.pathname.startsWith('/auth');
  const canToggleSidebar = !!user && !isAuthScreen;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 backdrop-blur border-b border-white/10 bg-black/40">
      {/* Header com container centralizado para alinhar com o conteúdo */}
      <div className="container-m h-12 flex items-center justify-between relative">
        <div className="flex items-center gap-2">
          {canToggleSidebar && (
            <button aria-label="Abrir menu" className="cm-btn cm-btn-outline cm-btn-sm inline-flex md:hidden" onClick={() => setMobileMenuOpen(v => !v)}>
              <Menu size={16} aria-hidden />
            </button>
          )}
          {/* Remover nomes dos menus; deixar apenas a logo para voltar ao menu */}
          <Link to="/home" aria-label="Voltar ao menu" className="inline-flex items-center">
            <img src="/favicon.svg" alt="CheckMaster" className="h-6 w-6" />
          </Link>
        </div>
        {/* Tema único escuro: remover botão de alternância */}
        <div />
        {/* Dropdown de navegação no mobile */}
        {canToggleSidebar && mobileMenuOpen && (
          <div className="absolute left-0 right-0 top-full mt-2 md:hidden z-50">
            <div className="cm-card p-2 shadow-xl w-full">
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
        <div className="text-xs">
          <div className="container-m py-1"><span className="cm-badge cm-badge-warning">Firebase não configurado</span></div>
        </div>
      )}
    </header>
  );
}