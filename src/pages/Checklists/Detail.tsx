import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useUIStore } from '../../stores/ui';
import { useAuthStore } from '../../stores/auth';
import { finalizeChecklist, getChecklist, saveChecklist, setInProgress } from '../../services/checklists';
import { supabase } from '../../config/supabase';

function secsToHMS(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export function ChecklistDetail() {
  const { id } = useParams();
  const pushToast = useUIStore(s => s.pushToast);
  const role = useAuthStore(s => s.role);
  const user = useAuthStore(s => s.user);
  const [item, setItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [mediaSelection, setMediaSelection] = useState<File[]>([]);
  const [supplierName, setSupplierName] = useState<string>('');
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [budgetUrls, setBudgetUrls] = useState<Record<string, string>>({});
  const [fuelUrls, setFuelUrls] = useState<Record<string, string>>({});

  const locked = item?.is_locked || item?.status === 'finalizado';

  const elapsed = useMemo(() => {
    if (!item?.started_at) return 0;
    const diff = (Date.now() - new Date(item.started_at).getTime()) / 1000;
    return Math.max(0, Math.floor(diff));
  }, [item?.started_at]);

  useEffect(() => {
    let timer: any;
    const tick = async () => {
      // refresh elapsed via state change
      setItem(it => ({ ...(it || {}), __tick: Date.now() }));
    };
    timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getChecklist(id);
      setItem(data);
      setNotes(data?.notes || '');
      // supplier name (fetch separately to avoid broken joins)
      try {
        if (data?.supplier_id) {
          const { data: sup } = await supabase.from('suppliers').select('nome').eq('id', data.supplier_id).single();
          setSupplierName((sup as any)?.nome || '');
        } else {
          setSupplierName('');
        }
      } catch { setSupplierName(''); }
      // Refresh signed URLs for storage paths
      try {
        const newMediaUrls: Record<string, string> = {};
        for (const m of (data?.media || [])) {
          if (m?.path) {
            const { data: signed } = await supabase.storage.from('checklists').createSignedUrl(m.path, 3600);
            if (signed?.signedUrl) newMediaUrls[m.path] = signed.signedUrl;
          }
        }
        setMediaUrls(newMediaUrls);
        const newBudgetUrls: Record<string, string> = {};
        for (const b of (data?.budgetAttachments || [])) {
          if (b?.path) {
            const { data: signed } = await supabase.storage.from('checklists').createSignedUrl(b.path, 3600);
            if (signed?.signedUrl) newBudgetUrls[b.path] = signed.signedUrl;
          }
        }
        setBudgetUrls(newBudgetUrls);
        const newFuelUrls: Record<string, string> = {};
        if (data?.fuelGaugePhotos?.entry) {
          const { data: signed } = await supabase.storage.from('checklists').createSignedUrl(data.fuelGaugePhotos.entry, 3600);
          if (signed?.signedUrl) newFuelUrls['entry'] = signed.signedUrl;
        }
        if (data?.fuelGaugePhotos?.exit) {
          const { data: signed } = await supabase.storage.from('checklists').createSignedUrl(data.fuelGaugePhotos.exit, 3600);
          if (signed?.signedUrl) newFuelUrls['exit'] = signed.signedUrl;
        }
        setFuelUrls(newFuelUrls);
      } catch {}
      // Move draft -> in progress on open
      if (data?.status === 'rascunho') {
        await setInProgress(id);
        const updated = await getChecklist(id);
        setItem(updated);
      }
    } catch (e: any) {
      pushToast({ title: 'Erro', message: e.message, variant: 'danger' });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      if (item?.status === 'finalizado') {
        pushToast({ title: 'Edição bloqueada', message: 'Checklist finalizado não aceita novos uploads.', variant: 'warning' });
        setSaving(false);
        return;
      }
      await saveChecklist(id, { notes });
      // upload selected media
      for (const f of mediaSelection) {
        const allowed = ['image/jpeg', 'image/png'];
        if (!allowed.includes(f.type)) { throw new Error('Apenas imagens JPEG/PNG são permitidas.'); }
        if (f.size > 5 * 1024 * 1024) { throw new Error('Arquivo excede 5MB.'); }
        const ext = f.name.split('.').pop() || 'jpg';
        const name = `${id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('checklists').upload(name, f);
        if (error) throw error;
        const { data } = await supabase.storage.from('checklists').createSignedUrl(name, 3600);
        const media = [ ...(item?.media || []), { type: 'photo', path: name, url: data?.signedUrl, createdAt: Date.now() } ];
        await saveChecklist(id, { media });
      }
      setMediaSelection([]);
      pushToast({ title: 'Salvo', message: 'Alterações salvas com sucesso.', variant: 'success' });
      await load();
    } catch (e: any) {
      pushToast({ title: 'Erro ao salvar', message: e.message, variant: 'danger' });
    } finally { setSaving(false); }
  };

  const handleFinalize = async () => {
    if (!id) return;
    const ok = window.confirm('Finalizar checklist? Esta ação bloqueará edições.');
    if (!ok) return;
    try {
      const res = await finalizeChecklist(id, user?.uid);
      pushToast({ title: 'Checklist finalizado', message: `Tempo de manutenção: ${secsToHMS(res.maintenance_seconds)}`, variant: 'success' });
      await load();
    } catch (e: any) {
      pushToast({ title: 'Erro ao finalizar', message: e.message, variant: 'danger' });
    }
  };

  const badgeColor = (() => {
    if (!elapsed) return 'bg-gray-500';
    if (elapsed < 24 * 3600) return 'bg-green-600';
    if (elapsed < 72 * 3600) return 'bg-yellow-600';
    return 'bg-red-600';
  })();

  // Fallback: extrai "Serviço" das notas quando a coluna não existe
  const serviceText = useMemo(() => {
    if (item?.service) return item.service;
    const n = item?.notes || '';
    const m = n.match(/Servi[cç]o:\s*(.+)/i);
    return m ? m[1].trim() : '-';
  }, [item?.service, item?.notes]);

  return (
    <div className="space-y-3 py-3">
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
          <div>
            <div className="text-sm font-semibold">Checklist</div>
            <div className="text-xs text-gray-500">{item?.seq || item?.id}</div>
          </div>
          <div className="text-xs">
            <div>Placa: <span className="font-mono">{item?.plate || '-'}</span></div>
            <div>Fornecedor: {supplierName || '-'}</div>
            <div>Serviço: {serviceText}</div>
            <div>Status: {item?.status || '-'}</div>
          </div>
          <div className="flex md:justify-end">
            <div className={`text-xs px-2 py-1 rounded text-white ${badgeColor}`}>{secsToHMS(elapsed)}</div>
          </div>
        </div>
      </Card>

      <Card className="p-3 space-y-2">
        <div className="text-sm font-semibold">Dados</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          <div>Iniciado: {item?.started_at ? new Date(item.started_at).toLocaleString() : '-'}</div>
          <div>Finalizado: {item?.finished_at ? new Date(item.finished_at).toLocaleString() : '-'}</div>
          <div>Duração: {secsToHMS(item?.maintenance_seconds || 0)}</div>
        </div>
        <textarea className="cm-input" value={notes} onChange={e => setNotes(e.target.value)} disabled={locked} placeholder="Observações" />
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={locked} onClick={() => mediaInputRef.current?.click()}>Adicionar fotos</Button>
          <input ref={mediaInputRef} type="file" className="hidden" accept="image/*" multiple onChange={(e) => {
            const files = Array.from(e.target.files || []);
            setMediaSelection(prev => ([...prev, ...files]));
            (e.target as HTMLInputElement).value = '';
          }} />
          {mediaSelection.length ? <div className="text-xs">{mediaSelection.length} arquivo(s) para enviar</div> : <div className="text-xs text-gray-500">Nenhum arquivo para enviar</div>}
        </div>
        {mediaSelection.length ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {mediaSelection.map((f, i) => (
              <div key={i} className="text-xs cm-card p-2 flex items-center justify-between gap-2">
                <span className="truncate">{f.name}</span>
                <Button size="sm" variant="ghost" onClick={() => {
                  setMediaSelection(prev => prev.filter((_, idx) => idx !== i));
                }}>Remover</Button>
              </div>
            ))}
          </div>
        ) : null}
        {!locked && <Button onClick={handleSave} disabled={saving}>Salvar alterações</Button>}
      </Card>

      <Card className="p-3 space-y-2">
        <div className="text-sm font-semibold">Itens com defeito</div>
        {item?.defect_items?.length ? (
          <ul className="text-xs divide-y">
            {item.defect_items.map((d: any, idx: number) => (
              <li key={idx} className="py-1 flex items-center justify-between">
                <span>{d?.name || d?.itemId || 'Item'}</span>
                {d?.note ? <span className="text-gray-500">{d.note}</span> : null}
              </li>
            ))}
          </ul>
        ) : <div className="text-xs text-gray-500">Nenhum item registrado.</div>}
      </Card>

      <Card className="p-3 space-y-2">
        <div className="text-sm font-semibold">Anexos</div>
        <div className="text-xs text-gray-500">Fotos do checklist</div>
        {item?.media?.length ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {item.media.map((m: any, idx: number) => (
              <a key={idx} className="block" href={mediaUrls[m?.path] || m?.url || '#'} target="_blank" rel="noreferrer">
                <img className="w-full h-24 object-cover rounded" src={mediaUrls[m?.path] || m?.url} alt={m?.path} />
              </a>
            ))}
          </div>
        ) : <div className="text-xs text-gray-500">Nenhuma foto anexada.</div>}
        <div className="text-xs text-gray-500 mt-2">Orçamento / Documentos</div>
        {item?.budgetAttachments?.length ? (
          <ul className="text-xs divide-y">
            {item.budgetAttachments.map((b: any, idx: number) => (
              <li key={idx} className="py-1 flex items-center justify-between">
                <span>{b?.name || b?.path}</span>
                <a className="cm-btn cm-btn-outline cm-btn-xs" href={budgetUrls[b?.path] || '#'} target="_blank" rel="noreferrer">Abrir</a>
              </li>
            ))}
          </ul>
        ) : <div className="text-xs text-gray-500">Nenhum anexo de orçamento.</div>}
      </Card>

      <Card className="p-3 space-y-2">
        <div className="text-sm font-semibold">Marcador de combustível</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <div className="text-xs text-gray-500">Entrada</div>
            {fuelUrls['entry'] ? (
              <a href={fuelUrls['entry']} target="_blank" rel="noreferrer"><img className="w-full h-24 object-cover rounded" src={fuelUrls['entry']} /></a>
            ) : <div className="text-xs text-gray-500">Sem foto</div>}
          </div>
          <div>
            <div className="text-xs text-gray-500">Saída</div>
            {fuelUrls['exit'] ? (
              <a href={fuelUrls['exit']} target="_blank" rel="noreferrer"><img className="w-full h-24 object-cover rounded" src={fuelUrls['exit']} /></a>
            ) : <div className="text-xs text-gray-500">Sem foto</div>}
          </div>
        </div>
      </Card>

      <Card className="p-3 space-y-2">
        <div className="text-sm font-semibold">Ações</div>
        {locked ? (
          <div className="text-xs">Finalizado em: {item?.finished_at ? new Date(item.finished_at).toLocaleString() : '-'}</div>
        ) : (
          <Button onClick={handleFinalize} variant="default">Finalizar checklist</Button>
        )}
        {locked && role === 'admin' && (
          <div className="text-xs text-gray-500">Apenas admin pode reabrir (RPC configurada).</div>
        )}
      </Card>
    </div>
  );
}