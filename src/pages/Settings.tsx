import { useAuthStore } from '../stores/auth';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export function SettingsPage() {
  const user = useAuthStore(s => s.user);
  const role = useAuthStore(s => s.role);
  const signOut = useAuthStore(s => s.signOut);
  // Removido: ação de atualizar papel para evitar confusão
  return (
    <div className="space-y-3 py-3">
      <Card
        title="Perfil"
      >
        <div className="text-xs">{user?.email}</div>
        <div className="text-xs">Papel: {role || '—'}</div>
        {user?.uid && (<div className="text-[10px] text-gray-500">UID: {user.uid}</div>)}
        <Button className="mt-2" variant="outline" onClick={signOut}>Sair</Button>
      </Card>
      <Card>
        <div className="text-xs">RBAC: admin, editor, visualizador • Rotas protegidas</div>
      </Card>
    </div>
  );
}