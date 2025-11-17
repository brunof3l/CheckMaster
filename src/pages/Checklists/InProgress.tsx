import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useUIStore } from '../../stores/ui';
import { listInProgress, finalizeChecklist } from '../../services/checklists';
import { useAuthStore } from '../../stores/auth';
import { useNavigate } from 'react-router-dom';

function secsToHMS(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export function InProgressPage() {
  const [items, setItems] = useState<any[]>([]);
  const [plate, setPlate] = useState('');
  const [supplier, setSupplier] = useState('');
  const [minHours, setMinHours] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const pushToast = useUIStore(s => s.pushToast);
  const user = useAuthStore(s => s.user);
  const nav = useNavigate();

  const fetchList = async () => {
    setLoading(true);
    try {
      const data = await listInProgress({ plate, supplier, minHours });
      setItems(data);
    } catch (e: any) { pushToast({ title: 'Erro', message: e.message, variant: 'danger' }); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchList(); }, []);

  const handleFinalize = async (id: string) => {
    const ok = window.confirm('Finalizar este checklist?');
    if (!ok) return;
    try {
      await finalizeChecklist(id, user?.uid);
      pushToast({ title: 'Finalizado', message: 'Checklist finalizado com sucesso.', variant: 'success' });
      fetchList();
    } catch (e: any) { pushToast({ title: 'Erro', message: e.message, variant: 'danger' }); }
  };

  const badge = (started_at?: string | null) => {
    if (!started_at) return 'bg-gray-500';
    const secs = (Date.now() - new Date(started_at).getTime()) / 1000;
    if (secs < 24 * 3600) return 'bg-green-600';
    if (secs < 72 * 3600) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  return (
    <div className="space-y-3 py-3">
      <Card className="p-3 space-y-2">
        <div className="text-sm font-semibold">Filtros</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input className="cm-input" value={plate} onChange={e => setPlate(e.target.value)} placeholder="Placa" />
          <input className="cm-input" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Fornecedor" />
          <input className="cm-input" type="number" value={minHours} onChange={e => setMinHours(parseInt(e.target.value || '0'))} placeholder=">= horas" />
          <Button onClick={fetchList} disabled={loading}>Aplicar</Button>
        </div>
      </Card>

      <Card className="p-3">
        {items.length ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left">
                <th className="p-2">Seq</th>
                <th className="p-2">Placa</th>
                <th className="p-2">Fornecedor</th>
                <th className="p-2">Iniciado</th>
                <th className="p-2">Tempo</th>
                <th className="p-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => {
                const secs = it.started_at ? Math.floor((Date.now() - new Date(it.started_at).getTime()) / 1000) : 0;
                return (
                  <tr key={it.id} className="border-t">
                    <td className="p-2">{it.seq || it.id}</td>
                    <td className="p-2">{it.plate || '-'}</td>
                    <td className="p-2">{(it as any).supplier_name || '-'}</td>
                    <td className="p-2">{it.started_at ? new Date(it.started_at).toLocaleString() : '-'}</td>
                    <td className="p-2"><span className={`text-white px-2 py-1 rounded ${badge(it.started_at)}`}>{secsToHMS(secs)}</span></td>
                    <td className="p-2 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => nav(`/checklists/${it.id}`)}>Abrir</Button>
                      <Button size="sm" onClick={() => handleFinalize(it.id)}>Finalizar</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <div className="text-xs text-gray-500">Nenhum checklist em andamento.</div>}
      </Card>
    </div>
  );
}