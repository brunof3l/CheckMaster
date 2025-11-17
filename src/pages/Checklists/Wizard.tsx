import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Wizard } from '../../components/Wizard';
import { Stepper } from '../../components/ui/Stepper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import imageCompression from 'browser-image-compression';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { insertChecklist, updateChecklist, listVehicles, listSuppliers } from '../../services/supabase/db';
import { setInProgress } from '../../services/checklists';
import { useAuthStore } from '../../stores/auth';
import { useLocation, useNavigate } from 'react-router-dom';
import { getNextChecklistSeq } from '../../services/supabase/rpc';
import { Store, PlusCircle, X } from 'lucide-react';
import { isValidUUID } from '../../utils/validators';
// Use native crypto.randomUUID for unique filenames
import { useUIStore } from '../../stores/ui';

const schema = z.object({
  plateId: z.string().min(1),
  service: z.enum(['Revisão', 'Revisão Geral', 'Corretiva', 'Preventiva']),
  notes: z.string().optional(),
  odometer: z.number().min(0),
  supplierId: z.string().min(1),
  responsible: z.string().min(1),
  defectItems: z.array(z.object({ itemId: z.string(), name: z.string(), note: z.string().optional() })).default([]),
  // Campo livre para "Outros" em vez de checkbox
  otherDefects: z.string().optional(),
  media: z.array(z.instanceof(File)).default([]),
  budgetFiles: z.array(z.instanceof(File)).default([]),
  fuelGaugeEntry: z.instanceof(File).optional(),
  fuelGaugeExit: z.instanceof(File).optional(),
  budget: z.object({ items: z.array(z.object({ desc: z.string(), qty: z.number(), unitPrice: z.number() })).default([]), total: z.number().default(0), currency: z.literal('BRL') }).default({ items: [], total: 0, currency: 'BRL' }),
  fuelGas: z.object({ entries: z.array(z.object({ qty: z.number(), unit: z.enum(['kg','L']), at: z.string(), note: z.string().optional() })).default([]), exits: z.array(z.object({ qty: z.number(), unit: z.enum(['kg','L']), at: z.string(), note: z.string().optional() })).default([]) }).default({ entries: [], exits: [] })
});
type FormData = z.infer<typeof schema>;

export function ChecklistWizard({ mode }: { mode: 'new' | 'edit' }) {
  const { register, control, handleSubmit, setValue, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      defectItems: [],
      otherDefects: '',
      media: [],
      budgetFiles: [],
      fuelGas: { entries: [], exits: [] }
    }
  });
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const pushToast = useUIStore(s => s.pushToast);
  const user = useAuthStore(s => s.user);
  const nav = useNavigate();
  const location = useLocation();
  const budgetInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const fuelEntryRef = useRef<HTMLInputElement>(null);
  const fuelExitRef = useRef<HTMLInputElement>(null);
  const supplierBoxRef = useRef<HTMLDivElement>(null);
  const plateBoxRef = useRef<HTMLDivElement>(null);
  const [vehicles, setVehicles] = useState<Array<{ id: string; plate: string }>>([]);
  const [vehLoading, setVehLoading] = useState<boolean>(false);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; nome: string }>>([]);
  const [supLoading, setSupLoading] = useState<boolean>(false);
  const [supplierQuery, setSupplierQuery] = useState<string>('');
  const [supplierOpen, setSupplierOpen] = useState<boolean>(false);
  const [plateQuery, setPlateQuery] = useState<string>('');
  const [plateOpen, setPlateOpen] = useState<boolean>(false);

  // Fechar autocomplete ao clicar fora do box ou pressionar ESC
  useEffect(() => {
    function handleDocMouseDown(ev: MouseEvent) {
      if (!supplierOpen) return;
      const el = supplierBoxRef.current;
      if (el && ev.target instanceof Node && !el.contains(ev.target)) {
        setSupplierOpen(false);
      }
    }
    function handleKey(ev: KeyboardEvent) {
      if (supplierOpen && ev.key === 'Escape') setSupplierOpen(false);
    }
    document.addEventListener('mousedown', handleDocMouseDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDocMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [supplierOpen]);

  // Fechar autocomplete de placa ao clicar fora do box ou pressionar ESC
  useEffect(() => {
    function handleDocMouseDown(ev: MouseEvent) {
      if (!plateOpen) return;
      const el = plateBoxRef.current;
      if (el && ev.target instanceof Node && !el.contains(ev.target)) {
        setPlateOpen(false);
      }
    }
    function handleKey(ev: KeyboardEvent) {
      if (plateOpen && ev.key === 'Escape') setPlateOpen(false);
    }
    document.addEventListener('mousedown', handleDocMouseDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDocMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [plateOpen]);

  const loadVehicles = async () => {
    setVehLoading(true);
    try {
      const { data, error } = await listVehicles();
      if (error) throw error;
      setVehicles((data || []).map((v: any) => ({ id: v.id, plate: v.plate })));
    } catch (_) { /* silencioso */ } finally { setVehLoading(false); }
  };

  useEffect(() => {
    loadVehicles();
    const chan = supabase
      .channel('vehicles-insert')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vehicles' }, (payload) => {
        const v = (payload as any)?.new;
        if (v?.id && v?.plate) {
          setVehicles(prev => {
            if (prev.some(p => p.id === v.id)) return prev;
            return [{ id: v.id, plate: v.plate }, ...prev];
          });
        } else {
          loadVehicles();
        }
      })
      .subscribe();
    return () => { try { supabase.removeChannel(chan); } catch {} };
  }, []);

  // Carregar fornecedores para autocomplete
  useEffect(() => {
    const load = async () => {
      setSupLoading(true);
      try {
        const { data, error } = await listSuppliers();
        if (error) throw error;
        const rows = (data || []).map((s: any) => ({ id: s.id, nome: s.nome || s.razaoSocial || '', cnpj: s.cnpj || '' }));
        setSuppliers(rows);
      } catch (_) { /* silencioso */ } finally { setSupLoading(false); }
    };
    load();
  }, []);

  // Se retornou da tela de fornecedores após criar, preencher seleção
  useEffect(() => {
    const state: any = location.state || {};
    if (state?.selectedSupplierId) {
      setValue('supplierId', state.selectedSupplierId);
      setSupplierQuery(state.selectedSupplierName || '');
      setSupplierOpen(false);
    }
  }, [location.state]);

  const onFinish = handleSubmit(async (data) => {
    setSubmitting(true);
    pushToast({ title: 'Salvando checklist', message: 'Processando dados e anexos…', variant: 'info' });
    try {
      const supplierUuid = isValidUUID(data.supplierId || '') ? data.supplierId : null;
      // Alguns ambientes não possuem a coluna 'service' em 'checklists'.
      // Para evitar erro de schema, persistimos o valor de serviço dentro de 'notes'.
      const combinedNotes = (() => {
        const base = (data.notes || '').trim();
        const svcLine = `Serviço: ${data.service}`;
        return base ? `${base}\n${svcLine}` : svcLine;
      })();
      // Agrega "Outros" ao array de itens com a nota digitada
      const defects = (() => {
        const base = [...(data.defectItems || [])];
        const text = (data.otherDefects || '').trim();
        if (text) base.push({ itemId: 'outros', name: 'Outros', note: text });
        return base;
      })();

      const checklist = await insertChecklist({
        seq: null,
        plate: data.plateId,
        supplier_id: supplierUuid,
        // service: data.service, // removido para evitar erro quando coluna não existe
        defect_items: defects,
        media: [],
        status: 'rascunho',
        notes: combinedNotes,
      });
      const id = checklist.id as string;
      let idx = 0;
      const mediaItems: any[] = [];
      for (const f of data.media || []) {
        const allowed = ['image/jpeg', 'image/png'];
        if (!allowed.includes((f as File).type)) throw new Error('Apenas imagens JPEG/PNG são permitidas.');
        if ((f as File).size > 5 * 1024 * 1024) throw new Error('Arquivo excede 5MB.');
        let toUpload: File = f as File;
        try {
          const blob = await imageCompression(f as File, { maxSizeMB: 0.8, maxWidthOrHeight: 1600, useWebWorker: true });
          toUpload = new File([blob as Blob], (f as File).name, { type: (blob as Blob).type || (f as File).type });
        } catch {}
        const ext = (toUpload.name.split('.').pop() || 'jpg');
      const name = `${id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('checklists').upload(name, toUpload);
        if (error) throw error;
        const { data: signed } = await supabase.storage.from('checklists').createSignedUrl(name, 3600);
        mediaItems.push({ type: 'photo', path: name, url: signed?.signedUrl, createdAt: Date.now() });
        idx++;
        setUploadProgress(Math.round((idx / (data.media.length || 1)) * 100));
      }
      await updateChecklist(id, { media: mediaItems });
      // anexos de orçamento (PDF/imagens)
      const budgetAttachments: any[] = [];
      for (const f of (data as any).budgetFiles || []) {
        const mime = (f as File).type || '';
        const allowedBudget = ['application/pdf','image/jpeg','image/png'];
        if (!allowedBudget.includes(mime)) throw new Error('Anexos permitidos: PDF/JPEG/PNG.');
        if ((f as File).size > 5 * 1024 * 1024) throw new Error('Anexo excede 5MB.');
        const name = (f as File)?.name || 'anexo';
        const ext = name.includes('.') ? name.split('.').pop() : 'bin';
      const path = `${id}/budget-${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('checklists').upload(path, f as File);
        if (error) throw error;
        budgetAttachments.push({ type: 'budget', path, name, createdAt: Date.now() });
      }
      if (budgetAttachments.length) await updateChecklist(id, { budgetAttachments });
      // fotos do marcador de combustível (entrada/saída)
      const fuelGaugePhotos: any = {};
      if ((data as any).fuelGaugeEntry) {
      const entryF = (data as any).fuelGaugeEntry as File;
      if (!['image/jpeg','image/png'].includes(entryF.type) || entryF.size > 5 * 1024 * 1024) throw new Error('Foto de combustível inválida.');
      const path = `${id}/fuel-entry-${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from('checklists').upload(path, entryF);
        if (error) throw error;
        fuelGaugePhotos.entry = path;
      }
      if ((data as any).fuelGaugeExit) {
      const exitF = (data as any).fuelGaugeExit as File;
      if (!['image/jpeg','image/png'].includes(exitF.type) || exitF.size > 5 * 1024 * 1024) throw new Error('Foto de combustível inválida.');
      const path = `${id}/fuel-exit-${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from('checklists').upload(path, exitF);
        if (error) throw error;
        fuelGaugePhotos.exit = path;
      }
      if (Object.keys(fuelGaugePhotos).length) await updateChecklist(id, { fuelGaugePhotos });
      // sequência via RPC
      try {
        const seq = await getNextChecklistSeq();
        await updateChecklist(id, { seq });
      } catch { /* silencioso */ }
      // mover para em andamento para iniciar contagem do tempo
      try {
        await setInProgress(id);
      } catch {}
      // aviso somente: checklist aberto e ação necessária de finalizar
      pushToast({ title: 'Checklist aberto', message: 'Checklist foi aberto e está em andamento.', variant: 'info' });
      pushToast({ title: 'Ação necessária', message: 'Finalize o checklist na página de detalhes quando concluir.', variant: 'warning' });
      // navegar para a página de detalhes
      nav(`/checklists/${id}`);
    } catch (e: any) { pushToast({ title: 'Erro ao salvar', message: e.message, variant: 'danger' }); }
    finally { setSubmitting(false); }
  });

  const Steps = [
    (
      <section className="space-y-2">
        <div className="text-xs text-gray-500">Seq. autogerada via Cloud Function ao salvar</div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1" ref={plateBoxRef}>
            <input type="hidden" {...register('plateId')} />
            <input
              value={plateQuery}
              onChange={(e) => { const v = e.target.value; setPlateQuery(v); setPlateOpen(true); setValue('plateId', v); }}
              onFocus={() => setPlateOpen(true)}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setPlateOpen(false); } }}
              placeholder="Placa (autocomplete)"
              className="cm-input pr-9 font-mono"
            />
            {plateQuery && (
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70" onClick={() => { setPlateQuery(''); setValue('plateId', ''); }}>
                <X size={16} />
              </button>
            )}
            {plateOpen && (
              <div className="absolute left-0 right-0 mt-1 z-20">
                <div className="cm-card max-h-48 overflow-auto">
                  {vehLoading ? (
                    <div className="p-2 text-xs text-gray-400">Carregando placas…</div>
                  ) : (
                    (() => {
                      const q = plateQuery.trim().toLowerCase();
                      const items = vehicles.filter(v => !q || (v.plate || '').toLowerCase().includes(q));
                      return items.length ? (
                        <ul>
                          {items.map(v => (
                            <li key={v.id}>
                              <button type="button" className="w-full text-left px-3 py-2 hover:bg-white/5" onClick={() => { setValue('plateId', v.plate); setPlateQuery(v.plate); setPlateOpen(false); }}>
                                <span className="inline-flex items-center gap-2 font-mono">{v.plate}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="p-2 text-xs text-gray-400">Nenhuma placa encontrada.</div>
                      );
                    })()
                  )}
                </div>
              </div>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={loadVehicles} disabled={vehLoading}>{vehLoading ? 'Atualizando…' : 'Atualizar'}</Button>
        </div>
        <select {...register('service')} className="cm-input" defaultValue="">
          <option value="" disabled hidden>Serviço</option>
          <option value="Revisão">Revisão</option>
          <option value="Revisão Geral">Revisão Geral</option>
          <option value="Corretiva">Corretiva</option>
          <option value="Preventiva">Preventiva</option>
        </select>
        <textarea {...register('notes')} className="cm-input" placeholder="Observação" />
        <input {...register('odometer', { valueAsNumber: true })} type="number" className="cm-input" placeholder="KM" />
        {/* Fornecedor autocomplete */}
        <div className="cm-field">
          <div className="relative" ref={supplierBoxRef}>
            <input type="hidden" {...register('supplierId')} />
            <input
              value={supplierQuery}
              onChange={(e) => { setSupplierQuery(e.target.value); setSupplierOpen(true); }}
              onFocus={() => setSupplierOpen(true)}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setSupplierOpen(false); } }}
              placeholder="Fornecedor (autocomplete)"
              className="cm-input pr-9"
            />
            {supplierQuery && (
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70" onClick={() => { setSupplierQuery(''); setValue('supplierId', ''); }}>
                <X size={16} />
              </button>
            )}
            {supplierOpen && (
              <div className="absolute left-0 right-0 mt-1 z-20">
                <div className="cm-card max-h-48 overflow-auto">
                  {supLoading ? (
                    <div className="p-2 text-xs text-gray-400">Carregando fornecedores…</div>
                  ) : (
                    (() => {
                      const q = supplierQuery.trim().toLowerCase();
                      const items = suppliers.filter(s => {
                        const name = ((s.nome || s.razaoSocial || (s as any).razaosocial || '') as string).toLowerCase();
                        const c = (s.cnpj || '').toLowerCase();
                        return !q || name.includes(q) || c.includes(q);
                      });
                      return items.length ? (
                        <ul>
                          {items.map(s => (
                            <li key={s.id}>
                              <button type="button" className="w-full text-left px-3 py-2 hover:bg-white/5" onClick={() => { const n = s.nome || (s as any).razaosocial || s.razaoSocial || ''; setValue('supplierId', s.id); setSupplierQuery(n); setSupplierOpen(false); }}>
                                <span className="inline-flex items-center gap-2"><Store size={14} /> {(s.nome || (s as any).razaosocial || s.razaoSocial || '')} • {s.cnpj}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="p-2 text-xs">
                          <div className="text-gray-400">Nenhum fornecedor encontrado.</div>
                          <button type="button" className="cm-btn cm-btn-sm cm-btn-primary mt-2" onClick={() => nav('/suppliers', { state: { returnTo: '/checklists/new', suggestedName: supplierQuery } })}>
                            <span className="inline-flex items-center gap-2"><PlusCircle size={14} /> Cadastrar novo fornecedor</span>
                          </button>
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <input {...register('responsible')} className="cm-input" placeholder="Responsável" />
      </section>
    ),
    (
      <section className="space-y-2">
        <div className="text-xs text-gray-500">Selecione itens com defeito</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            'Farol Esq.', 'Farol Dir.', 'Pisca Esq.', 'Pisca Dir.', 'Lanterna Esq.', 'Lanterna Dir.', 'Luz Freio', 'Luz Placa', 'Buzina',
            'Ar condicionado', 'Retrovisor Interno', 'Retrovisor Esq.', 'Retrovisor Dir.',
            'Nível de Óleo Motor', 'Nível Óleo Hidráulico', 'Nível Água Parabrisa', 'Nível Fluído de Freio', 'Nível Líq. Arrefecimento',
            'Limpador Parabrisa', 'Vidros Laterais', 'Parabrisa Traseiro', 'Parabrisa Dianteiro', 'Vidros Elétricos',
            'Rádio', 'Estofamento Bancos', 'Tapetes Internos', 'Forro Interno',
            'Macaco', 'Chave de Roda', 'Estepe', 'Triângulo', 'Extintor', 'Bateria', 'Indicadores Painel', 'Documento Veicular', 'Maca e Salão Atend',
            'Portas traseiras', 'Aspecto Geral', 'Cartão Estacionamento', 'GPS', 'Cintos de segurança', 'Limpeza Interior', 'Limpeza Exterior', 'Chave Ignição'
          ].map((name, idx) => (
            <label key={idx} className="cm-card px-3 py-2 flex items-center gap-2">
              <input type="checkbox" onChange={(e) => {
                const arr = watch('defectItems') || [];
                const id = `item_${idx}`;
                if (e.target.checked) setValue('defectItems', [...arr, { itemId: id, name }]);
                else setValue('defectItems', arr.filter(x => x.itemId !== id));
              }} />
              <span>{name}</span>
            </label>
          ))}
        </div>
        <div className="space-y-1">
          <div className="text-xs text-gray-500">Outros defeitos (descreva)</div>
          <textarea {...register('otherDefects')} className="cm-input" placeholder="Ex.: barulho na suspensão, vazamento, etc." />
        </div>
      </section>
    ),
    (
      <section className="space-y-2">
        <Card className="p-3 space-y-2">
          <div className="text-sm font-semibold">Fotos</div>
          <div className="text-xs text-gray-500">Anexe fotos; compactamos para reduzir tamanho.</div>
          <Controller control={control} name="media" defaultValue={[]} render={({ field }) => (
            <input ref={mediaInputRef} type="file" className="hidden" accept="image/*" capture="environment" multiple onChange={(e) => {
              const files = Array.from(e.target.files || []);
              const current = (watch('media') || []) as File[];
              field.onChange([ ...current, ...files ]);
              (e.target as HTMLInputElement).value = '';
            }} />
          )} />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => mediaInputRef.current?.click()}>Adicionar fotos</Button>
            {watch('media')?.length ? (
              <div className="text-xs">{watch('media').length} foto(s) selecionada(s)</div>
            ) : (
              <div className="text-xs text-gray-500">Nenhuma foto selecionada</div>
            )}
          </div>
          {watch('media')?.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {watch('media').map((f, i) => (
                <div key={i} className="text-xs cm-card p-2 flex items-center justify-between gap-2">
                  <span className="truncate">{(f as any).name}</span>
                  <Button size="sm" variant="ghost" onClick={() => {
                    const arr = (watch('media') || []) as File[];
                    const next = arr.filter((_, idx) => idx !== i);
                    setValue('media', next);
                  }}>Remover</Button>
                </div>
              ))}
            </div>
          ) : null}
          {uploadProgress > 0 && <div className="text-xs">Upload: {uploadProgress}%</div>}
        </Card>
      </section>
    ),
    (
      <section className="space-y-2">
        <Card className="p-3 space-y-2">
          <div className="text-sm font-semibold">Orçamento / Anexos</div>
          <div className="text-xs text-gray-500">Anexe PDFs ou imagens do orçamento.</div>
          <Controller control={control} name="budgetFiles" defaultValue={[]} render={({ field }) => (
            <input ref={budgetInputRef} type="file" className="hidden" accept=".pdf,image/*" multiple onChange={(e) => {
              const files = Array.from(e.target.files || []);
              field.onChange(files);
            }} />
          )} />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => budgetInputRef.current?.click()}>Selecionar arquivos</Button>
            {watch('budgetFiles')?.length ? (
              <div className="text-xs">{watch('budgetFiles').length} arquivo(s) selecionado(s)</div>
            ) : (
              <div className="text-xs text-gray-500">Nenhum arquivo selecionado</div>
            )}
          </div>
        </Card>
        <Card className="p-3 space-y-2">
          <div className="text-sm font-semibold">Marcador de combustível</div>
          <div className="text-xs text-gray-500">Registre fotos do marcador na entrada e na saída.</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="text-xs text-gray-500">Entrada</div>
              <Controller control={control} name="fuelGaugeEntry" defaultValue={undefined} render={({ field }) => (
                <input ref={fuelEntryRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => {
                  const f = e.target.files?.[0];
                  field.onChange(f || undefined);
                }} />
              )} />
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => fuelEntryRef.current?.click()}>Anexar foto de entrada</Button>
                {watch('fuelGaugeEntry') ? (
                  <div className="text-xs">{(watch('fuelGaugeEntry') as File)?.name || '1 foto selecionada'}</div>
                ) : (
                  <div className="text-xs text-gray-500">Nenhuma foto</div>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-gray-500">Saída</div>
              <Controller control={control} name="fuelGaugeExit" defaultValue={undefined} render={({ field }) => (
                <input ref={fuelExitRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => {
                  const f = e.target.files?.[0];
                  field.onChange(f || undefined);
                }} />
              )} />
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => fuelExitRef.current?.click()}>Anexar foto de saída</Button>
                {watch('fuelGaugeExit') ? (
                  <div className="text-xs">{(watch('fuelGaugeExit') as File)?.name || '1 foto selecionada'}</div>
                ) : (
                  <div className="text-xs text-gray-500">Nenhuma foto</div>
                )}
              </div>
            </div>
          </div>
        </Card>
      </section>
    )
  ];

  return (
    <div className="py-3">
      <div className="space-y-3">
        <Stepper steps={["Dados", "Defeitos", "Fotos", "Custos"]} current={0} />
        <Card>
          <Wizard steps={Steps} onFinish={onFinish} busy={submitting} />
        </Card>
      </div>
    </div>
  );
}