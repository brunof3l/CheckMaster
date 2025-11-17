import { create } from 'zustand';
import { supabase } from '../config/supabase';
import { signIn as sbSignIn, signUp as sbSignUp, signOut as sbSignOut, onAuthStateChange } from '../services/supabase/auth';
import { useUIStore } from './ui';

function authErrorToMessage(e: any) {
  const code = e?.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'E-mail já cadastrado. Use Entrar ou Recuperar senha.';
    case 'auth/invalid-email':
      return 'E-mail inválido.';
    case 'auth/weak-password':
      return 'Senha muito fraca. Use ao menos 6 caracteres.';
    case 'auth/user-not-found':
      return 'Usuário não encontrado. Cadastre-se antes de entrar.';
    case 'auth/wrong-password':
      return 'Senha incorreta. Tente novamente ou recupere a senha.';
    case 'auth/network-request-failed':
      return 'Falha de rede. Verifique sua conexão.';
    case 'auth/popup-closed-by-user':
      return 'Popup fechado antes de concluir. Tente novamente.';
    default:
      return e?.message || 'Erro de autenticação.';
  }
}

type Role = 'admin' | 'editor' | 'visualizador' | null;
interface AuthState {
  user: { uid: string; email?: string | null } | null;
  role: Role;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, pass: string) => Promise<boolean>;
  signUp: (email: string, pass: string, displayName?: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signInGoogle: () => Promise<boolean>;
  init: () => void;
  refreshRole: () => Promise<void>;
}

// Canal Realtime para atualizar role em tempo real
let roleChannel: any | null = null;
function subscribeRole(userId: string) {
  try {
    // Evita canais duplicados
    if (roleChannel) {
      try { supabase.removeChannel(roleChannel); } catch {}
      roleChannel = null;
    }
    roleChannel = supabase
      .channel(`role-updates-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${userId}` }, (payload: any) => {
        const newRole = (payload?.new as any)?.role;
        if (newRole) {
          (useAuthStore as any).setState({ role: newRole as Role });
        }
      })
      .subscribe();
  } catch {}
}

// Inatividade: 1 hora
const INACTIVITY_MS = 60 * 60 * 1000;
let inactivityTimer: any = null;
let activityListenersBound = false;
const LAST_ACTIVE_KEY = 'cm:last_active';

function bindActivityListeners(onActivity: () => void) {
  if (activityListenersBound) return;
  activityListenersBound = true;
  const handler = () => onActivity();
  ['mousemove','keydown','click','touchstart','scroll','visibilitychange'].forEach(evt => {
    window.addEventListener(evt as any, handler, { passive: true } as any);
  });
}

function unbindActivityListeners() {
  if (!activityListenersBound) return;
  activityListenersBound = false;
  const handler = () => {};
  ['mousemove','keydown','click','touchstart','scroll','visibilitychange'].forEach(evt => {
    try { window.removeEventListener(evt as any, handler as any); } catch {}
  });
}

function scheduleAutoLogout(signOutFn: () => Promise<void>) {
  try { if (inactivityTimer) { clearTimeout(inactivityTimer); inactivityTimer = null; } } catch {}
  const last = Number(localStorage.getItem(LAST_ACTIVE_KEY) || '0') || Date.now();
  const elapsed = Date.now() - last;
  const remaining = Math.max(0, INACTIVITY_MS - elapsed);
  inactivityTimer = setTimeout(async () => {
    await signOutFn();
    try { localStorage.removeItem(LAST_ACTIVE_KEY); } catch {}
  }, remaining);
}

function touchActivity() {
  try { localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now())); } catch {}
  // Timer será reprogramado externamente após este toque
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  loading: true,
  isConfigured: true,
  // Simple client-side rate limit for login attempts
  _attempts: 0 as number,
  _lockUntil: 0 as number,
  signIn: async (email, pass) => {
    const now = Date.now();
    const { _attempts, _lockUntil } = (useAuthStore.getState() as any);
    if (_lockUntil && now < _lockUntil) {
      useUIStore.getState().pushToast({ title: 'Muitas tentativas', message: 'Login temporariamente bloqueado. Tente novamente em alguns minutos.', variant: 'warning' });
      return false;
    }
    set({ loading: true });
    try {
      const { data, error } = await sbSignIn(email, pass);
      if (error) throw error;
      const usr = data?.user;
      // Garante perfil na tabela public.users (id/email/display_name)
      try {
        if (usr?.id) {
          const profile = { id: usr.id, email: usr.email, display_name: (usr.user_metadata as any)?.displayName || (usr.email || '')?.split('@')[0] } as any;
          // Upsert com conflito em id; se update não for permitido, insert garantirá novo registro
          const up = await supabase.from('users').upsert(profile, { onConflict: 'id' });
          const msg = up.error?.message || '';
          // Ignora erros de coluna inexistente (ex.: display_name) e segue
          if (up.error && !/column\s+"?display_name"?\s+does\s+not\s+exist/i.test(msg)) {
            throw up.error;
          }
        }
      } catch {}
      let r: Role = null;
      if (usr) {
        const { data: prof } = await supabase.from('users').select('role').eq('id', usr.id).single();
        r = (prof?.role as Role) ?? 'editor';
      }
      set({ user: usr ? { uid: usr.id, email: usr.email } : null, role: r, loading: false, _attempts: 0, _lockUntil: 0 });
      if (usr?.id) subscribeRole(usr.id);
      return !!usr;
    } catch (e: any) {
      useUIStore.getState().pushToast({ title: 'Erro de login', message: e.message || 'Erro de autenticação.', variant: 'danger' });
      const attempts = (_attempts || 0) + 1;
      const lock = attempts >= 5 ? Date.now() + 2 * 60 * 1000 : 0; // 5 tentativas → 2 min de bloqueio
      set({ loading: false, _attempts: attempts, _lockUntil: lock });
      return false;
    }
  },
  signUp: async (email, pass, displayName) => {
    set({ loading: true });
    try {
      const { data, error } = await sbSignUp(email, pass, displayName);
      if (error) throw error;
      const usr = data?.user;
      // Cria perfil imediatamente no cadastro
      try {
        if (usr?.id) {
          const profile = { id: usr.id, email: usr.email, display_name: displayName || (usr.email || '')?.split('@')[0], role: 'editor', is_active: true } as any;
          const up = await supabase.from('users').upsert(profile, { onConflict: 'id' });
          const msg = up.error?.message || '';
          // Se colunas opcionais não existirem, tenta um payload mínimo
          if (up.error && /column/i.test(msg)) {
            await supabase.from('users').upsert({ id: usr.id, email: usr.email, display_name: displayName || (usr.email || '')?.split('@')[0] }, { onConflict: 'id' });
          }
        }
      } catch {}
      set({ user: usr ? { uid: usr.id, email: usr.email } : null, role: 'editor', loading: false });
      if (usr?.id) subscribeRole(usr.id);
      return !!usr;
    } catch (e: any) {
      useUIStore.getState().pushToast({ title: 'Erro de cadastro', message: e.message || 'Erro de autenticação.', variant: 'danger' });
      set({ loading: false });
      return false;
    }
  },
  signOut: async () => {
    await sbSignOut();
    set({ user: null, role: null });
    try { if (roleChannel) { supabase.removeChannel(roleChannel); roleChannel = null; } } catch {}
    try { if (inactivityTimer) { clearTimeout(inactivityTimer); inactivityTimer = null; } } catch {}
    try { unbindActivityListeners(); } catch {}
  },
  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) { useUIStore.getState().pushToast({ title: 'Erro ao enviar', message: error.message, variant: 'danger' }); return; }
    useUIStore.getState().pushToast({ title: 'Recuperação enviada', message: 'Verifique seu e-mail.', variant: 'info' });
  },
  signInGoogle: async () => {
    useUIStore.getState().pushToast({ title: 'Indisponível', message: 'Google OAuth não configurado no Supabase.', variant: 'warning' });
    return false;
  },
  init: () => {
    set({ loading: true });
    onAuthStateChange(async (evt) => {
      const session = evt || (await supabase.auth.getSession()).data.session;
      const u = (session as any)?.user;
      if (!u) { set({ user: null, role: null, loading: false }); return; }
      // Garante perfil ao iniciar sessão
      try {
        const profile = { id: u.id, email: u.email, display_name: (u.user_metadata as any)?.displayName || (u.email || '')?.split('@')[0] } as any;
        const up = await supabase.from('users').upsert(profile, { onConflict: 'id' });
        const msg = up.error?.message || '';
        if (up.error && !/column\s+"?display_name"?\s+does\s+not\s+exist/i.test(msg)) {
          // Se falhar por outra razão, prossegue sem travar init
        }
      } catch {}
      let r: Role = null;
      const { data: prof } = await supabase.from('users').select('role').eq('id', u.id).single();
      r = (prof?.role as Role) ?? 'editor';
      set({ user: { uid: u.id, email: u.email }, role: r, loading: false });
      subscribeRole(u.id);
      // Inatividade: se já passou 1h sem atividade, deslogar; caso contrário, iniciar relógio
      const last = Number(localStorage.getItem(LAST_ACTIVE_KEY) || '0');
      if (!last) {
        touchActivity(); // considera o boot como atividade
      } else if (Date.now() - last >= INACTIVITY_MS) {
        await (useAuthStore.getState().signOut)();
        return;
      }
      bindActivityListeners(() => {
        touchActivity();
        scheduleAutoLogout(useAuthStore.getState().signOut);
      });
      scheduleAutoLogout(useAuthStore.getState().signOut);
    });
  },
  refreshRole: async () => {
    try {
      const u = useAuthStore.getState().user;
      if (!u?.uid) return;
      const { data, error } = await supabase
        .from('users')
        .select('role, email, is_active')
        .eq('id', u.uid)
        .single();
      if (error) {
        useUIStore.getState().pushToast({ title: 'Erro ao atualizar papel', message: error.message || 'Falha ao consultar perfil.', variant: 'danger' });
        return;
      }
      const r = (data?.role as Role) ?? null;
      if (r) set({ role: r });
      else {
        useUIStore.getState().pushToast({ title: 'Papel não encontrado', message: 'Perfil sem role. Usando editor.', variant: 'warning' });
      }
      try { console.log('refreshRole result', data); } catch {}
    } catch {}
  }
}));