import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user);
  const loading = useAuthStore(s => s.loading);
  const loc = useLocation();
  if (loading) return <div className="p-4">Carregando…</div>;
  if (!user) return <Navigate to="/" state={{ from: loc }} replace />;
  return <>{children}</>;
}