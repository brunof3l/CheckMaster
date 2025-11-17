import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../stores/auth';
import { supabase } from '../config/supabase';
import { useUIStore } from '../stores/ui';

export function ProtectedRoute({ children, requireAdmin = false, requireVerifiedEmail = true }: { children: React.ReactNode; requireAdmin?: boolean; requireVerifiedEmail?: boolean }) {
  const user = useAuthStore(s => s.user);
  const role = useAuthStore(s => s.role);
  const loading = useAuthStore(s => s.loading);
  const loc = useLocation();
  const pushToast = useUIStore(s => s.pushToast);
  const [verified, setVerified] = useState<boolean | null>(null);
  const alertedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    let mounted = true;
    if (!requireVerifiedEmail) { setVerified(true); return; }
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setVerified(!!data.user?.email_confirmed_at);
    }).catch(() => { if (mounted) setVerified(false); });
    return () => { mounted = false; };
  }, [requireVerifiedEmail]);

  // Determina motivo de negação (se houver)
  const denialReason = !user
    ? 'no_user'
    : (requireVerifiedEmail && !verified)
    ? 'email_not_verified'
    : (requireAdmin && String(role || '').toLowerCase() !== 'admin')
    ? 'not_admin'
    : null;

  // Estado de carregamento (mantém ordem de hooks consistente)
  const isLoading = loading || (requireVerifiedEmail && verified === null) || (requireAdmin && user && role == null);

  // Dispara toast apenas uma vez por razão+rota
  useEffect(() => {
    if (!denialReason) return;
    const key = `${denialReason}:${loc.pathname}`;
    if (alertedKeyRef.current === key) return;
    alertedKeyRef.current = key;
    if (denialReason === 'no_user') {
      pushToast({ title: 'Sessão necessária', message: 'Faça login para continuar.', variant: 'warning' });
    } else if (denialReason === 'email_not_verified') {
      pushToast({ title: 'E-mail não verificado', message: 'Verifique seu e-mail para acessar.', variant: 'warning' });
    } else if (denialReason === 'not_admin') {
      pushToast({ title: 'Acesso restrito', message: 'Apenas administradores podem acessar esta área.', variant: 'danger' });
    }
  }, [denialReason, loc.pathname, pushToast]);
  if (isLoading) return <div className="p-4">Carregando…</div>;
  if (denialReason === 'no_user') return <Navigate to="/" state={{ from: loc }} replace />;
  if (denialReason === 'email_not_verified') return <Navigate to="/" state={{ reason: 'email_not_verified', from: loc }} replace />;
  if (denialReason === 'not_admin') return <Navigate to="/home" state={{ reason: 'not_admin' }} replace />;
  return <>{children}</>;
}