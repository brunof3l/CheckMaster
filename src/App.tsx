import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes';
import { AppShell } from './components/AppShell';
import { useAuthStore } from './stores/auth';

function LayoutWithShell() { return <AppShell><AppRoutes /></AppShell>; }

export function App() {
  const initAuth = useAuthStore(s => s.init);
  const refreshRole = useAuthStore(s => s.refreshRole);
  useEffect(() => {
    initAuth();
    // Garante sincronização da role no boot (fallback ao Realtime)
    refreshRole();
  }, [initAuth, refreshRole]);
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL} future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    }}>
      <LayoutWithShell />
    </BrowserRouter>
  );
}