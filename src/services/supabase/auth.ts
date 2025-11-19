import { supabase } from '../../config/supabase';

export async function signUp(email: string, password: string, displayName?: string) {
  const res = await supabase.auth.signUp({ email, password });
  const user = res.data.user;
  if (user) {
    await supabase.from('users').insert({ id: user.id, email, display_name: displayName || '' });
  }
  return res;
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export function onAuthStateChange(callback: (session: any) => void) {
  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return sub;
}
