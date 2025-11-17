import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useUIStore } from '../../stores/ui';
import { exportCsv, getReport, ReportFilters } from '../../services/checklists';

export function ReportsPage() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [rows, setRows] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<{ totalHours: number; avgHours: number; byVehicle: any[]; bySupplier: any[] }>({ totalHours: 0, avgHours: 0, byVehicle: [], bySupplier: [] });
  const [loading, setLoading] = useState(false);
  const pushToast = useUIStore(s => s.pushToast);

  const run = async () => {
    setLoading(true);
    try {
      const r = await getReport(filters);
      setRows(r.rows);
      setMetrics({ totalHours: r.totalHours, avgHours: r.avgHours, byVehicle: r.byVehicle, bySupplier: r.bySupplier });
    } catch (e: any) { pushToast({ title: 'Erro', message: e.message, variant: 'danger' }); }
    finally { setLoading(false); }
  };

  useEffect(() => { run(); }, []);

  return (
    <div className="space-y-3 py-3">
      <Card className="p-3 space-y-2">
        <div className="text-sm font-semibold">Filtros</div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input className="cm-input" type="date" value={filters.from || ''} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
          <input className="cm-input" type="date" value={filters.to || ''} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
          <input className="cm-input" placeholder="Veículo" value={filters.vehicle || ''} onChange={e => setFilters(f => ({ ...f, vehicle: e.target.value }))} />
          <input className="cm-input" placeholder="Fornecedor" value={filters.supplier || ''} onChange={e => setFilters(f => ({ ...f, supplier: e.target.value }))} />
          <select className="cm-input" value={filters.status || ''} onChange={e => setFilters(f => ({ ...f, status: e.target.value || undefined }))}>
            <option value="">Status</option>
            <option value="rascunho">Rascunho</option>
            <option value="em_andamento">Em andamento</option>
            <option value="finalizado">Finalizado</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button onClick={run} disabled={loading}>Aplicar</Button>
          {rows.length ? <Button variant="outline" onClick={() => exportCsv(rows, 'checklists.csv')}>Exportar CSV</Button> : null}
        </div>
      </Card>

      <Card className="p-3">
        <div className="text-sm font-semibold mb-2">Relatório</div>
        {rows.length ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left">
                <th className="p-2">Seq</th>
                <th className="p-2">Placa</th>
                <th className="p-2">Fornecedor</th>
                <th className="p-2">Início</th>
                <th className="p-2">Fim</th>
                <th className="p-2">Tempo (h)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">{r.seq}</td>
                  <td className="p-2">{r.plate}</td>
                  <td className="p-2">{r.supplier}</td>
                  <td className="p-2">{r.start}</td>
                  <td className="p-2">{r.end}</td>
                  <td className="p-2">{r.hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="text-xs text-gray-500">Sem dados para o filtro.</div>}
      </Card>

      <Card className="p-3 space-y-2">
        <div className="text-sm font-semibold">Métricas</div>
        <div className="text-xs">Total de horas: {metrics.totalHours}</div>
        <div className="text-xs">Tempo médio: {metrics.avgHours}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <div className="text-xs font-semibold">Média por veículo</div>
            <ul className="text-xs">
              {metrics.byVehicle.map((x, i) => (<li key={i}>{x.key}: {x.avgHours} h</li>))}
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold">Média por fornecedor</div>
            <ul className="text-xs">
              {metrics.bySupplier.map((x, i) => (<li key={i}>{x.key}: {x.avgHours} h</li>))}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}