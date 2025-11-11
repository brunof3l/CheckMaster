import { create } from 'zustand';
import { getFirebaseApp } from '../services/firebase/app';
import { getAuth, GoogleAuthProvider, signInWithEmailAndPassword, signOut as fbSignOut, sendPasswordResetEmail, signInWithPopup, createUserWithEmailAndPassword, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

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
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  loading: false,
  isConfigured: !!getFirebaseApp(),
  signIn: async (email, pass) => {
    const app = getFirebaseApp();
    if (!app) { alert('Firebase não configurado'); return false; }
    set({ loading: true });
    try {
      const auth = getAuth(app);
      const res = await signInWithEmailAndPassword(auth, email, pass);
      // Carrega papel (role) do Firestore, se existir
      const db = getFirestore(app);
      let role: Role = 'editor';
      try {
        const udoc = await getDoc(doc(db, 'users', res.user.uid));
        role = (udoc.exists() ? (udoc.data() as any).role : 'editor');
      } catch (_) {
        // Sem permissões nas regras -> usa papel padrão e segue login
        role = 'editor';
      }
      set({ user: { uid: res.user.uid, email: res.user.email }, role, loading: false });
      return true;
    } catch (e: any) {
      alert(authErrorToMessage(e));
      set({ loading: false });
      return false;
    }
  },
  signUp: async (email, pass, displayName) => {
    const app = getFirebaseApp();
    if (!app) { alert('Firebase não configurado'); return false; }
    set({ loading: true });
    try {
      const auth = getAuth(app);
      const db = getFirestore(app);
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      if (displayName) {
        await updateProfile(res.user, { displayName });
      }
      await setDoc(doc(db, 'users', res.user.uid), {
        displayName: res.user.displayName || displayName || '',
        email: res.user.email,
        role: 'editor'
      }, { merge: true });
      set({ user: { uid: res.user.uid, email: res.user.email }, role: 'editor', loading: false });
      return true;
    } catch (e: any) {
      alert(authErrorToMessage(e));
      set({ loading: false });
      return false;
    }
  },
  signOut: async () => {
    const app = getFirebaseApp();
    if (!app) return;
    const auth = getAuth(app);
    await fbSignOut(auth);
    set({ user: null, role: null });
  },
  resetPassword: async (email) => {
    const app = getFirebaseApp();
    if (!app) { alert('Firebase não configurado'); return; }
    const auth = getAuth(app);
    await sendPasswordResetEmail(auth, email);
    alert('E-mail de recuperação enviado');
  },
  signInGoogle: async () => {
    const app = getFirebaseApp();
    if (!app) { alert('Firebase não configurado'); return false; }
    const auth = getAuth(app);
    const db = getFirestore(app);
    const provider = new GoogleAuthProvider();
    try {
      const res = await signInWithPopup(auth, provider);
      // Garante doc em users com role padrão
      const uref = doc(db, 'users', res.user.uid);
      let role: Role = 'editor';
      try {
        const snap = await getDoc(uref);
        if (!snap.exists()) {
          await setDoc(uref, { displayName: res.user.displayName || '', email: res.user.email, role: 'editor' });
        }
        role = (snap.exists() ? (snap.data() as any).role : 'editor');
      } catch (_) {
        role = 'editor';
      }
      set({ user: { uid: res.user.uid, email: res.user.email }, role });
      return true;
    } catch (e: any) { alert(authErrorToMessage(e)); return false; }
  },
  init: () => {
    const app = getFirebaseApp();
    if (!app) return;
    const auth = getAuth(app);
    const db = getFirestore(app);
    set({ loading: true });
    onAuthStateChanged(auth, async (usr) => {
      if (!usr) { set({ user: null, role: null, loading: false }); return; }
      let role: Role = 'editor';
      try {
        const udoc = await getDoc(doc(db, 'users', usr.uid));
        role = (udoc.exists() ? (udoc.data() as any).role : 'editor');
      } catch (_) {
        role = 'editor';
      }
      set({ user: { uid: usr.uid, email: usr.email }, role, loading: false });
    });
  }
}));