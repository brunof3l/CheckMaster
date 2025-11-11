import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../stores/auth';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';

const schema = z.object({ email: z.string().email('E-mail inválido'), password: z.string().min(6, 'Mínimo 6 caracteres') }).passthrough();
type FormData = z.infer<typeof schema> & { displayName?: string; confirmPassword?: string };

export function Login() {
  const { register, handleSubmit } = useForm<FormData>({ resolver: zodResolver(schema) });
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const signIn = useAuthStore(s => s.signIn);
  const signUp = useAuthStore(s => s.signUp);
  const signInGoogle = useAuthStore(s => s.signInGoogle);
  const resetPassword = useAuthStore(s => s.resetPassword);
  const isConfigured = useAuthStore(s => s.isConfigured);
  const navigate = useNavigate();
  const loc = useLocation();

  const onSubmit = async (d: FormData) => {
    if (mode === 'signup') {
      const nameOk = !!(d.displayName && d.displayName.trim().length >= 2);
      const confirmOk = d.password === d.confirmPassword;
      if (!nameOk || !confirmOk) {
        alert(!nameOk ? 'Informe seu nome' : 'Senhas diferentes');
        return;
      }
    }
    const ok = mode === 'login' ? await signIn(d.email, d.password) : await signUp(d.email, d.password, d.displayName);
    if (ok) navigate((loc.state as any)?.from?.pathname ?? '/home', { replace: true });
  };

  return (
    <div className="max-w-sm mx-auto py-6">
      <div className="text-center mb-4">
        <img src="/favicon.svg" alt="CheckMaster" className="mx-auto h-12 w-12" />
        <h1 className="text-lg font-semibold">CheckMaster</h1>
        {!isConfigured && (
          <p className="text-xs text-amber-600 mt-2">Configurar .env com credenciais do Firebase para autenticar.</p>
        )}
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {mode === 'signup' && (
          <input {...register('displayName')} type="text" placeholder="Nome" className="w-full border rounded px-3 py-2" />
        )}
        <input {...register('email')} type="email" placeholder="E-mail" className="w-full border rounded px-3 py-2" />
        <input {...register('password')} type="password" placeholder="Senha" className="w-full border rounded px-3 py-2" />
        {mode === 'signup' && (
          <input {...register('confirmPassword')} type="password" placeholder="Confirmar senha" className="w-full border rounded px-3 py-2" />
        )}
        <button className="w-full py-2 bg-blue-600 text-white rounded">{mode === 'login' ? 'Entrar' : 'Cadastrar'}</button>
      </form>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button className="py-2 border rounded" onClick={() => signInGoogle()}>Entrar com Google</button>
        <button className="py-2 border rounded" onClick={() => resetPassword(prompt('E-mail para recuperar senha?') || '')}>Recuperar senha</button>
      </div>
      <p className="text-xs text-center mt-3">
        {mode === 'login' ? (
          <>Sem conta? <Link to="#" onClick={() => setMode('signup')}>Cadastre-se</Link></>
        ) : (
          <>Já tem conta? <Link to="#" onClick={() => setMode('login')}>Entrar</Link></>
        )}
      </p>
    </div>
  );
}