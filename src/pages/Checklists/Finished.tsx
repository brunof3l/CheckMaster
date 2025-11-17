import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useUIStore } from '../../stores/ui';
import { listFinished } from '../../services/checklists';
import { useNavigate } from 'react-router-dom';

function secsToHMS(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export function FinishedPage() {
  const [items, setItems] = useState<any[]>([]);
  const [plate, setPlate] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const pushToast = useUIStore(s => s.pushToast);
  const nav = useNavigate();

  const fetchList = async () => {
    setLoading(true);
    try {
      const data = await listFinished({ plate, from, to });
      setItems(data);
    } catch (e: any) { pushToast({ title: 'Erro', message: e.message, variant: 'danger' }); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchList(); }, []);

  return (
    <div className="space-y-3 py-3">
      <Card className="p-3 space-y-2">
        <div className="text-sm font-semibold">Filtros</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input className="cm-input" value={plate} onChange={e => setPlate(e.target.value)} placeholder="Placa" />
          <input className="cm-input" type="date" value={from} onChange={e => setFrom(e.target.value)} placeholder="De" />
          <input className="cm-input" type="date" value={to} onChange={e => setTo(e.target.value)} placeholder="Até" />
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
                <th className="p-2">Finalizado</th>
                <th className="p-2">Duração</th>
                <th className="p-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => {
                const secs = it.maintenance_seconds || 0;
                return (
                  <tr key={it.id} className="border-t">
                    <td className="p-2">{it.seq || it.id}</td>
                    <td className="p-2">{it.plate || '-'}</td>
                    <td className="p-2">{(it as any).supplier_name || '-'}</td>
                    <td className="p-2">{it.finished_at ? new Date(it.finished_at).toLocaleString() : '-'}</td>
                    <td className="p-2">{secsToHMS(secs)}</td>
                    <td className="p-2 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => nav(`/checklists/${it.id}`)}>Abrir</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <div className="text-xs text-gray-500">Nenhum checklist finalizado.</div>}
      </Card>
    </div>
  );
}