import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getFirebaseApp } from '../services/firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { generateChecklistPdf } from '../services/pdf';

export function Home() {
  const [showExport, setShowExport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Array<{ id: string; seq?: string; plate?: string; status?: string }>>([]);
  const openExport = async () => {
    setShowExport(true);
  };
  useEffect(() => {
    const fetchData = async () => {
      const app = getFirebaseApp();
      if (!app) return;
      setLoading(true);
      try {
        const db = getFirestore(app);
        const snap = await getDocs(collection(db, 'checklists'));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setItems(list);
      } catch (_) { /* silencioso */ } finally { setLoading(false); }
    };
    if (showExport) fetchData();
  }, [showExport]);

  const handleExport = async (id: string) => {
    try {
      const url = await generateChecklistPdf(id);
      window.open(url, '_blank');
      setShowExport(false);
    } catch (e: any) {
      alert(e?.message || 'Falha ao gerar PDF');
    }
  };
  return (
    <div className="space-y-4 py-3">
      <div className="grid grid-cols-3 gap-2">
        <Card title="Abertos" value="12" />
        <Card title="Em andamento" value="5" />
        <Card title="Finalizados" value="28" />
      </div>
      <div className="flex gap-2">
        <input className="flex-1 border rounded px-3 py-2" placeholder="Buscar…" />
        <button className="px-3 py-2 border rounded">Filtros</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Link to="/checklists/new" className="py-3 text-center bg-blue-600 text-white rounded">Iniciar checklist</Link>
        <button className="py-3 text-center border rounded" onClick={openExport}>Exportar checklist</button>
      </div>
      <Link to="/suppliers" className="block py-3 text-center border rounded">Cadastrar fornecedor</Link>

      {showExport && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end">
          <div className="bg-white dark:bg-brand w-full rounded-t-xl p-3 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">Escolha o checklist para exportar</div>
              <button className="text-xs px-2 py-1 border rounded" onClick={() => setShowExport(false)}>Fechar</button>
            </div>
            {loading ? <div className="text-xs">Carregando…</div> : (
              items.length ? (
                <ul className="divide-y">
                  {items.map(it => (
                    <li key={it.id} className="py-2 flex items-center justify-between">
                      <div className="text-xs">{it.seq || it.id} • {it.plate || ''} • {it.status || ''}</div>
                      <button className="text-xs px-2 py-1 border rounded" onClick={() => handleExport(it.id)}>Exportar</button>
                    </li>
                  ))}
                </ul>
              ) : <div className="text-xs">Nenhum checklist encontrado.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="border rounded p-3 text-center">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}