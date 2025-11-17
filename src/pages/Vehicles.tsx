import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { listVehicles, insertVehicle } from '../services/supabase/db';
import { Car, Save } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useUIStore } from '../stores/ui';

export function VehiclesPage() {
  const { register, handleSubmit, reset } = useForm();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState('');
  const pushToast = useUIStore(s => s.pushToast);
  const fetchList = async () => {
    setLoading(true);
    try {
      const { data, error } = await listVehicles();
      if (error) throw error;
      setItems(data || []);
    } catch (e: any) { pushToast({ title: 'Erro ao carregar', message: e.message, variant: 'danger' }); } finally { setLoading(false); }
  };
  useEffect(() => { fetchList(); }, []);
  const onSubmit = handleSubmit(async (data: any) => {
    try {
      if (!data.plate) { pushToast({ title: 'Placa inválida', message: 'Informe uma placa válida.', variant: 'warning' }); return; }
      const { error } = await insertVehicle({
        plate: (data.plate || '').trim().toUpperCase(),
        model: data.model || '',
        brand: data.brand || '',
        year: Number(data.year) || null,
      });
      if (error) throw error;
      reset();
      fetchList();
      pushToast({ title: 'Veículo salvo', message: 'Cadastro realizado com sucesso.', variant: 'success' });
    } catch (e: any) { pushToast({ title: 'Erro ao salvar', message: e.message, variant: 'danger' }); }
  });
  return (
    <div className="space-y-3 py-3">
      <Card title={<span className="inline-flex items-center gap-2"><Car size={16} /> Cadastrar veículo</span> as any}>
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Input {...register('plate')} placeholder="ABC1D23" label="Placa (única)" />
          <Input {...register('model')} placeholder="Modelo" label="Modelo" />
          <Input {...register('brand')} placeholder="Marca" label="Marca" />
          <Input {...register('year')} type="number" placeholder="Ano" label="Ano" />
          <Input {...register('type')} placeholder="Tipo" label="Tipo" />
          <Button type="submit" block className="md:self-end fx-push">
            <span className="inline-flex items-center gap-2"><Save size={16} /> Salvar</span>
          </Button>
        </form>
      </Card>
      <Card title="Veículos">
        {loading ? <div className="cm-skeleton h-8" /> : (
          items.length ? (
            (() => {
              const q = query.trim().toLowerCase();
              const filtered = items.filter(v => {
                if (!q) return true;
                const plate = String(v.plate || '').toLowerCase();
                const model = String(v.model || '').toLowerCase();
                const brand = String(v.brand || '').toLowerCase();
                return plate.includes(q) || model.includes(q) || brand.includes(q);
              });
              const visible = filtered.slice(0, showAll ? filtered.length : 5);
              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      className="cm-input text-xs"
                      placeholder="Filtrar por placa, modelo ou marca"
                    />
                    <div className="text-xs text-gray-500">{showAll ? `Exibindo todos (${filtered.length})` : `Exibindo primeiros 5 de ${filtered.length}`}</div>
                    <Button size="sm" variant="outline" onClick={() => setShowAll(s => !s)}>
                      {showAll ? 'Mostrar menos' : 'Mostrar todos'}
                    </Button>
                  </div>
                  <ul className="divide-y">
                    {visible.map(v => (
                      <li key={v.id} className="py-2 text-xs">{v.plate} • {v.model} • {v.brand} • {v.year} • {v.type}</li>
                    ))}
                  </ul>
                </div>
              );
            })()
          ) : <div className="text-xs text-gray-500">Sem veículos cadastrados.</div>
        )}
      </Card>
    </div>
  );
}