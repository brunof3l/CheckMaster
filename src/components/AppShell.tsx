import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { useUIStore } from '../stores/ui';
import { useAuthStore } from '../stores/auth';
import { ToastContainer } from './ui/Toast';

export function AppShell({ children }: { children: React.ReactNode }) {
  const theme = useUIStore(s => s.theme);
  const sidebarOpen = useUIStore(s => s.sidebarOpen);
  const initAuth = useAuthStore(s => s.init);
  const user = useAuthStore(s => s.user);
  const loc = useLocation();
  // Segurança: nunca mostrar menus em rotas de autenticação
  const isAuthScreen = loc.pathname === '/' || loc.pathname === '/login' || loc.pathname.startsWith('/auth');
  const showSidebar = !!user && !isAuthScreen && sidebarOpen;
  const showBottomNav = !!user && !isAuthScreen; // Reintroduz BottomNav em mobile
  useEffect(() => { initAuth(); }, [initAuth]);
  useEffect(() => {
    // Aplicar tema diretamente no elemento html para compatibilidade com darkMode:'class'
    document.documentElement.classList.toggle('dark', theme === 'dark');
    // Também manter data-theme para CSS variables em globals.css
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <div>
      {/* Restaurar camada visual anterior com fundo da classe cm-app */}
      <div
        className="cm-app min-h-screen flex flex-col"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(${import.meta.env.BASE_URL}bg-dark.jpg)`
        }}
      >
        <Header />
        <div className={`flex-1 pb-16 md:pb-0`}> {/* espaço para bottom nav em mobile */}
          {/* Remover container no wrapper para encostar a Sidebar na borda esquerda */}
          <div className="flex gap-4">
            {showSidebar ? (
              <div className="hidden md:block">
                <Sidebar />
              </div>
            ) : null}
            <main className="flex-1 animate-fade-in py-3">
              {/* Aplicar container somente no conteúdo principal */}
              <div className="container-m px-3 md:px-4 lg:px-6">
                {children}
              </div>
            </main>
          </div>
        </div>
        <ToastContainer />
        {showBottomNav ? <BottomNav /> : null}
      </div>
    </div>
  );
}