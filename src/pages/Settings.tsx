import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export function SettingsPage() {
  const user = useAuthStore(s => s.user);
  const role = useAuthStore(s => s.role);
  const signOut = useAuthStore(s => s.signOut);
  const refreshRole = useAuthStore(s => s.refreshRole);
  const pushToast = useUIStore(s => s.pushToast);

  const handleRefreshRole = async () => {
    await refreshRole();
    const newRole = (useAuthStore.getState().role || '—') as any;
    pushToast({ title: 'Papel atualizado', message: `Atual: ${newRole}`, variant: 'info' });
  };
  return (
    <div className="space-y-3 py-3">
      <Card
        title="Perfil"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs">{role}</span>
            <Button variant="outline" size="sm" onClick={handleRefreshRole}>Atualizar papel</Button>
          </div>
        }
      >
        <div className="text-xs">{user?.email}</div>
        {user?.uid && (<div className="text-[10px] text-gray-500">UID: {user.uid}</div>)}
        <Button className="mt-2" variant="outline" onClick={signOut}>Sair</Button>
      </Card>
      <Card>
        <div className="text-xs">RBAC: admin, editor, visualizador • Rotas protegidas</div>
      </Card>
    </div>
  );
}