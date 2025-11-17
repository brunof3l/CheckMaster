import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { listChecklists } from '../services/supabase/db';
import { supabase } from '../config/supabase';
import { generateChecklistPdf } from '../services/pdf';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useUIStore } from '../stores/ui';
import { Clock, FileDown } from 'lucide-react';

export function Home() {
  const [showExport, setShowExport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Array<{ id: string; seq?: string; plate?: string; status?: string }>>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [openCount, setOpenCount] = useState(0);
  const [inProgressCount, setInProgressCount] = useState(0);
  const [finishedCount, setFinishedCount] = useState(0);
  const [over48hCount, setOver48hCount] = useState(0);
  const pushToast = useUIStore(s => s.pushToast);
  const openExport = async () => {
    setShowExport(true);
  };
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data, error } = await listChecklists();
        if (error) throw error;
        setItems(data || []);
      } catch (_) { /* silencioso */ } finally { setLoading(false); }
    };
    if (showExport) fetchData();
  }, [showExport]);

  useEffect(() => {
    const fetchCounts = async () => {
      const { data } = await supabase.from('checklists').select('status, started_at');
      const arr = data || [];
      const open = arr.filter((x: any) => x.status === 'rascunho').length;
      const prog = arr.filter((x: any) => x.status === 'em_andamento').length;
      const fin = arr.filter((x: any) => x.status === 'finalizado').length;
      const over48 = arr.filter((x: any) => x.status === 'em_andamento' && x.started_at && ((Date.now() - new Date(x.started_at).getTime()) / 3600000) > 48).length;
      setOpenCount(open); setInProgressCount(prog); setFinishedCount(fin); setOver48hCount(over48);
    };
    fetchCounts();
  }, []);

  const handleExport = async (id: string) => {
    try {
      const url = await generateChecklistPdf(id);
      window.open(url, '_blank');
      setShowExport(false);
    } catch (e: any) {
      pushToast({ title: 'Falha no PDF', message: e?.message || 'Falha ao gerar PDF', variant: 'danger' });
    }
  };
  return (
    <div className="space-y-4 py-3">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card>
          <div className="text-xs text-gray-500 dark:text-white/60">Abertos</div>
          <div className="text-3xl font-bold">{openCount}</div>
        </Card>
        <Card>
          <div className="flex flex-col h-full">
            <div className="text-xs text-gray-500 dark:text-white/60">Em andamento</div>
            <div className="text-3xl font-bold">{inProgressCount}</div>
            <div className="mt-2">
              <span className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-red-500/15 text-red-400 ring-1 ring-red-500/25">
                <Clock size={14} aria-hidden />
                <span>Acima de 48h</span>
                <span className="inline-grid place-items-center w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-semibold">{over48hCount}</span>
              </span>
            </div>
            <div className="mt-auto pt-3"><Link to="/checklists/in-progress" className="cm-btn cm-btn-primary cm-btn-sm w-fit">Ver lista</Link></div>
          </div>
        </Card>
        <Card>
          <div className="flex flex-col h-full">
            <div className="text-xs text-gray-500 dark:text-white/60">Finalizados</div>
            <div className="text-3xl font-bold">{finishedCount}</div>
            <div className="mt-auto pt-3"><Link to="/checklists/finished" className="cm-btn cm-btn-primary cm-btn-sm w-fit">Ver lista</Link></div>
          </div>
        </Card>
      </div>
      {/* Removido: campo de busca sem utilidade no dashboard */}
      <Card title="Ações rápidas">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Link to="/checklists/new" className="cm-btn cm-btn-primary cm-btn-md cm-btn-block fx-push text-center">Iniciar checklist</Link>
          <Link to="/suppliers" className="cm-btn cm-btn-primary cm-btn-md cm-btn-block fx-push text-center">Cadastrar fornecedor</Link>
          <Button variant="primary" size="md" block className="fx-push" onClick={() => setShowExport(true)}>
            <span className="inline-flex items-center gap-2"><FileDown size={16} /> Exportar PDF</span>
          </Button>
        </div>
      </Card>

      {showExport && (
        <div className="cm-modal-backdrop flex items-end">
          <div className="cm-modal max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-white">Escolha o checklist para exportar</div>
              <Button size="sm" variant="outline" onClick={() => setShowExport(false)}>Fechar</Button>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <input type="search" aria-label="Buscar checklist" className="cm-input flex-1" placeholder="Buscar por seq/placa/status" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="cm-input !w-40 shrink-0" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Todos</option>
                <option value="rascunho">Rascunho</option>
                <option value="em_andamento">Em andamento</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </div>
            {loading ? <div className="text-xs text-gray-100">Carregando…</div> : (
              items.length ? (
                (() => {
                  const normalized = (s: string) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
                  const cleaned = (s: string) => normalized(s).replace(/[^a-z0-9]/g, '');
                  const filtered = items.filter(it => {
                    const matchSearch = !search
                      || normalized(it.seq || it.id).includes(normalized(search))
                      || normalized(it.plate || '').includes(normalized(search))
                      || normalized(it.status || '').includes(normalized(search))
                      || cleaned(it.seq || it.id).includes(cleaned(search));
                    const matchStatus = !statusFilter || it.status === statusFilter;
                    return matchSearch && matchStatus;
                  });
                  const tooMany = items.length > 100 && !search && !statusFilter;
                  const list = tooMany ? filtered.slice(0, 50) : filtered;
                  return (
                    <>
                      {tooMany && (
                        <div className="text-xs text-gray-300 mb-2">Muitos registros ({items.length}). Use os filtros para localizar. Exibindo 50 primeiros.</div>
                      )}
                      <ul className="divide-y divide-white/10">
                        {list.map(it => (
                          <li key={it.id} className="py-2 flex items-center justify-between">
                            <div className="text-xs text-gray-100">
                              <span className="font-mono">{it.seq || it.id}</span> • <span>{it.plate || '-'}</span> • <span className="uppercase">{it.status || '-'}</span>
                            </div>
                            <Button size="sm" variant="primary" onClick={() => handleExport(it.id)}>
                              <span className="inline-flex items-center gap-2"><FileDown size={14} /> Exportar PDF</span>
                            </Button>
                          </li>
                        ))}
                      </ul>
                      {!list.length && <div className="text-xs text-gray-100">Nenhum checklist encontrado para os filtros.</div>}
                    </>
                  );
                })()
              ) : <div className="text-xs text-gray-100">Nenhum checklist encontrado.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
