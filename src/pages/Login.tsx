import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../stores/auth';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useUIStore } from '../stores/ui';
import { Eye, EyeOff } from 'lucide-react';

// Para login, não exigir complexidade de senha — apenas campo obrigatório
const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Informe sua senha')
}).passthrough();
type FormData = z.infer<typeof schema> & { displayName?: string; confirmPassword?: string };

export function Login() {
  const { register, handleSubmit, formState } = useForm<FormData>({ resolver: zodResolver(schema) });
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const signIn = useAuthStore(s => s.signIn);
  const signUp = useAuthStore(s => s.signUp);
  const signInGoogle = useAuthStore(s => s.signInGoogle);
  const resetPassword = useAuthStore(s => s.resetPassword);
  const isConfigured = useAuthStore(s => s.isConfigured);
  const navigate = useNavigate();
  const loc = useLocation();
  const pushToast = useUIStore(s => s.pushToast);

  const onSubmit = async (d: FormData) => {
    if (mode === 'signup') {
      const nameOk = !!(d.displayName && d.displayName.trim().length >= 2);
      const confirmOk = d.password === d.confirmPassword;
      const strong = d.password.length >= 8 && /[A-Za-z]/.test(d.password) && /\d/.test(d.password);
      if (!nameOk || !confirmOk) {
        pushToast({ title: 'Cadastro inválido', message: !nameOk ? 'Informe seu nome' : 'Senhas diferentes', variant: 'warning' });
        return;
      }
      if (!strong) {
        pushToast({ title: 'Senha inválida', message: 'Mínimo 8 caracteres, com letras e números.', variant: 'warning' });
        return;
      }
    }
    const ok = mode === 'login' ? await signIn(d.email, d.password) : await signUp(d.email, d.password, d.displayName);
    // Após login/cadastro, sempre redirecionar para o dashboard
    if (ok) navigate('/home', { replace: true });
  };

  const onInvalid = (errors: any) => {
    // Em login, pode aparecer erro de e-mail ou senha vazia
    if (mode === 'login') {
      const emailMsg = errors?.email?.message as string | undefined;
      const passMsg = errors?.password?.message as string | undefined;
      const msg = emailMsg || passMsg;
      if (msg) pushToast({ title: 'Dados inválidos', message: msg, variant: 'warning' });
      return;
    }
    // No cadastro, tratamos mensagens de validação adicionais no onSubmit
  };

  return (
    <div className="min-h-[calc(100vh-3rem)] grid place-items-center px-3">
      <Card className="w-full max-w-sm">
        <div className="text-center mb-4">
          <img src="/favicon.svg" alt="CheckMaster" className="mx-auto h-12 w-12" />
          <h1 className="text-lg font-semibold">CheckMaster</h1>
          {!isConfigured && (
            <p className="text-xs text-amber-600 mt-2">Configurar .env com credenciais do Firebase para autenticar.</p>
          )}
        </div>
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-3">
          {mode === 'signup' && (
            <Input {...register('displayName')} type="text" placeholder="Seu nome" label="Nome" />
          )}
          <Input {...register('email')} type="email" placeholder="nome@empresa.com" label="E-mail" />
          <Input
            {...register('password')}
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••"
            label="Senha"
            suffixNode={
              <button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={() => setShowPassword(v => !v)} className="p-1">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />
          {mode === 'signup' && (
            <Input
              {...register('confirmPassword')}
              type={showConfirm ? 'text' : 'password'}
              placeholder="••••••"
              label="Confirmar senha"
              suffixNode={
                <button type="button" aria-label={showConfirm ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => setShowConfirm(v => !v)} className="p-1">
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
          )}
          <Button type="submit" block variant="primary">{mode === 'login' ? 'Entrar' : 'Cadastrar'}</Button>
        </form>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => signInGoogle()}>Entrar com Google</Button>
          <Button variant="outline" onClick={() => resetPassword(prompt('E-mail para recuperar senha?') || '')}>Recuperar senha</Button>
        </div>
        <p className="text-xs text-center mt-3">
          {mode === 'login' ? (
            <>Sem conta? <Link to="#" onClick={() => setMode('signup')}>Cadastre-se</Link></>
          ) : (
            <>Já tem conta? <Link to="#" onClick={() => setMode('login')}>Entrar</Link></>
          )}
        </p>
      </Card>
    </div>
  );
}