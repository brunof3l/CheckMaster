import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../config/supabase';
import { Search } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useUIStore } from '../../stores/ui';

export function ChecklistsList() {
  const { register, watch } = useForm();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const pushToast = useUIStore(s => s.pushToast);
  const plate = watch('plate') || '';
  const supplier = watch('supplier') || '';
  const status = watch('status') || '';
  const date = watch('date') || '';
  const fetchPage = async (reset = true) => {
    setLoading(true);
    try {
      const pageIndex = reset ? 0 : page + 1;
      let query = supabase
        .from('checklists')
        .select('id, seq, plate, status, created_at, supplier_id, media')
        .order('created_at', { ascending: false })
        .range(pageIndex * 10, pageIndex * 10 + 9);
      if (plate) query = query.eq('plate', plate);
      if (status) query = query.eq('status', status);
      // Temporariamente removido: filtro por nome do fornecedor exigia join.
      // Em breve, substituiremos por autocomplete que usa o supplier_id.
      const { data, error } = await query;
      if (error) throw error;
      const normalized = (data || []).map((d: any) => {
        const photoCount = Array.isArray((d as any)?.media) ? ((d as any).media.filter((m: any) => m?.type === 'photo').length) : 0;
        try { console.log('[DEBUG CM] list row.media =', (d as any)?.media, 'photoCount=', photoCount, 'id=', d.id); } catch {}
        return {
          ...d,
          supplierName: '-',
          photoCount,
        };
      });
      setPage(pageIndex);
      setItems(reset ? normalized : [...items, ...normalized]);
    } catch (e: any) { pushToast({ title: 'Erro ao carregar', message: e.message, variant: 'danger' }); } finally { setLoading(false); }
  };
  useEffect(() => { fetchPage(true); }, [plate, supplier, status, date]);
  return (
    <div className="space-y-3 py-3">
      <Card title="Filtros">
        <div className="grid grid-cols-2 gap-2">
          <input {...register('plate')} className="cm-input" placeholder="Placa" />
          <input {...register('supplier')} className="cm-input" placeholder="Fornecedor" />
          <select {...register('status')} className="cm-input">
            <option value="">Status</option>
            <option value="rascunho">Rascunho</option>
            <option value="em_andamento">Em andamento</option>
            <option value="finalizado">Finalizado</option>
          </select>
          <input {...register('date')} type="date" className="cm-input" />
        </div>
      </Card>
      {loading ? <div className="cm-skeleton h-8" /> : (
        items.length ? (
          <div className="overflow-x-auto">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xs text-gray-500">{showAll ? `Exibindo todos (${items.length})` : `Exibindo primeiros 5 de ${items.length}`}</div>
              <Button size="sm" variant="outline" onClick={() => setShowAll(s => !s)}>
                {showAll ? 'Mostrar menos' : 'Mostrar todos'}
              </Button>
            </div>
            <table className="cm-table">
              <thead>
                <tr className="text-left">
                  <th className="p-2">Seq</th>
                  <th className="p-2">Placa</th>
                  <th className="p-2">Fornecedor</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Fotos</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, showAll ? items.length : 5).map(it => (
                  <tr key={it.id}>
                    <td className="p-2">{it.seq || it.id}</td>
                    <td className="p-2">{it.plate || '-'}</td>
                    <td className="p-2">{it.supplierName || '-'}</td>
                    <td className="p-2">{it.status ? <Badge variant={it.status === 'finalizado' ? 'success' : it.status === 'em_andamento' ? 'warning' : 'info'}>{it.status}</Badge> : '-'}</td>
                    <td className="p-2">{it.photoCount || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="text-xs text-gray-500">Sem checklists — crie o primeiro.</div>
      )}
      <Button variant="outline" onClick={() => fetchPage(false)} disabled={loading}><span className="inline-flex items-center gap-2"><Search size={16} /> Carregar mais</span></Button>
    </div>
  );
}