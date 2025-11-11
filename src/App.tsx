import { useEffect } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from './routes';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { useUIStore } from './stores/ui';
import { useAuthStore } from './stores/auth';

function LayoutWithConditionalNav() {
  const theme = useUIStore(s => s.theme);
  const initAuth = useAuthStore(s => s.init);
  const user = useAuthStore(s => s.user);
  const loc = useLocation();
  useEffect(() => { initAuth(); }, [initAuth]);
  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container-m pb-16">
          <AppRoutes />
        </main>
        {user && loc.pathname !== '/' ? <BottomNav /> : null}
      </div>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <LayoutWithConditionalNav />
    </BrowserRouter>
  );
}