import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';

export function SettingsPage() {
  const user = useAuthStore(s => s.user);
  const role = useAuthStore(s => s.role);
  const signOut = useAuthStore(s => s.signOut);
  const theme = useUIStore(s => s.theme);
  const toggleTheme = useUIStore(s => s.toggleTheme);
  return (
    <div className="space-y-3 py-3">
      <div className="border rounded p-3">
        <div className="text-sm">Perfil</div>
        <div className="text-xs">{user?.email} • {role}</div>
        <button className="mt-2 py-2 px-3 border rounded" onClick={signOut}>Sair</button>
      </div>
      <div className="border rounded p-3">
        <div className="text-sm">Tema</div>
        <div className="text-xs">Atual: {theme}</div>
        <button className="mt-2 py-2 px-3 border rounded" onClick={toggleTheme}>Alternar</button>
      </div>
      <div className="border rounded p-3 text-xs">
        RBAC: admin, editor, visualizador • Rotas protegidas
      </div>
    </div>
  );
}