import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useUIStore } from '../stores/ui';
import { listVehicles, listSuppliers, listChecklists, deleteVehicle, deleteSupplier, deleteChecklist, insertVehicle, listAppUsers, setUserRole, deactivateUser } from '../services/supabase/db';
import { supabase } from '../config/supabase';
import { ShieldAlert, Trash2 } from 'lucide-react';

type Row = { id: string } & Record<string, any>;

export function AdminPage() {
  const [vehicles, setVehicles] = useState<Row[]>([]);
  const [suppliers, setSuppliers] = useState<Row[]>([]);
  const [checklists, setChecklists] = useState<Row[]>([]);
  const [users, setUsers] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDetails, setImportDetails] = useState<{ ok: number; dup: number; fail: number; errors: Array<{ plate: string; message: string }> } | null>(null);
  const [vehShowAll, setVehShowAll] = useState(false);
  const [vehQuery, setVehQuery] = useState('');
  const [supShowAll, setSupShowAll] = useState(false);
  const [chkShowAll, setChkShowAll] = useState(false);
  const [usrShowAll, setUsrShowAll] = useState(false);
  const pushToast = useUIStore(s => s.pushToast);

  const loadAll = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([listVehicles(), listSuppliers(), listChecklists(), listAppUsers()]);
      const [vRes, sRes, cRes, uRes] = results;
      if (vRes.status === 'fulfilled') {
        const r = vRes.value as any; if (!r.error) setVehicles(r.data || []); else pushToast({ title: 'Veículos', message: r.error.message, variant: 'danger' });
      } else {
        pushToast({ title: 'Veículos', message: (vRes.reason?.message || 'Falha ao carregar'), variant: 'danger' });
      }
      if (sRes.status === 'fulfilled') {
        const r = sRes.value as any; if (!r.error) setSuppliers(r.data || []); else pushToast({ title: 'Fornecedores', message: r.error.message, variant: 'danger' });
      } else {
        pushToast({ title: 'Fornecedores', message: (sRes.reason?.message || 'Falha ao carregar'), variant: 'danger' });
      }
      if (cRes.status === 'fulfilled') {
        const r = cRes.value as any; if (!r.error) setChecklists(r.data || []); else pushToast({ title: 'Checklists', message: r.error.message, variant: 'danger' });
      } else {
        pushToast({ title: 'Checklists', message: (cRes.reason?.message || 'Falha ao carregar'), variant: 'danger' });
      }
      if (uRes.status === 'fulfilled') {
        const r = uRes.value as any; if (!r.error) setUsers(r.data || []); else pushToast({ title: 'Usuários', message: r.error.message, variant: 'danger' });
      } else {
        pushToast({ title: 'Usuários', message: (uRes.reason?.message || 'Falha ao carregar'), variant: 'danger' });
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  const getSupplierName = (s: any) => {
    const candidates = [s.nome, s.razaosocial, s.razaoSocial, s.razao_social, s.name, s.nomeFantasia, s['nome_fantasia']];
    for (const v of candidates) {
      if (typeof v === 'string' && v.trim().length) return v.trim();
    }
    return '';
  };

  const confirmDelete = async (kind: 'vehicle' | 'supplier' | 'checklist', id: string) => {
    const label = kind === 'vehicle' ? 'veículo' : kind === 'supplier' ? 'fornecedor' : 'checklist';
    if (!confirm(`Excluir ${label}? Esta ação não pode ser desfeita.`)) return;
    try {
      const res = kind === 'vehicle' ? await deleteVehicle(id)
        : kind === 'supplier' ? await deleteSupplier(id)
        : await deleteChecklist(id);
      if (res.error) throw res.error;
      pushToast({ title: 'Excluído', message: `${label} removido com sucesso.`, variant: 'success' });
      loadAll();
    } catch (e: any) {
      pushToast({ title: 'Erro ao excluir', message: e.message, variant: 'danger' });
    }
  };

  const parseVehicles = (text: string) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length);
    // Remove possible header labels if present
    const headerLabels = ['placa', 'marca', 'modelo', 'ano', 'tipo'];
    const lower = lines.map(l => l.toLowerCase());
    // Drop leading header block
    while (lower.length >= 5 && headerLabels.every((h, i) => lower[i] === h)) {
      lines.splice(0, 5); lower.splice(0, 5);
    }
    const items: Array<{ plate: string; brand: string; model: string; year: number | null; type?: string }> = [];
    const toYear = (s: string): number | null => {
      const m = s.match(/(\d{4})/);
      return m ? Number(m[1]) : null;
    };
    for (let i = 0; i + 4 < lines.length; i += 5) {
      const plate = lines[i];
      const brand = lines[i + 1];
      const model = lines[i + 2];
      const yearStr = lines[i + 3];
      const type = lines[i + 4];
      // Basic sanity checks; adjust stride if unexpected blanks found
      const okPlate = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(plate) || /^[A-Z]{3}[0-9]{4}$/.test(plate);
      const okType = /^(carro|moto|van|implemento)$/i.test(type);
      if (!okPlate) { continue; }
      items.push({ plate, brand, model, year: toYear(yearStr), type });
    }
    return items;
  };

  const normalizeKey = (s: string) => (s || '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');

  const pickDelimiter = (headerLine: string) => {
    const commas = (headerLine.match(/,/g) || []).length;
    const semis = (headerLine.match(/;/g) || []).length;
    return semis > commas ? ';' : ',';
  };

  const parseCsv = (text: string) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length);
    if (!lines.length) return [] as Array<{ plate: string; brand: string; model: string; year: number | null; type?: string }>;
    const delim = pickDelimiter(lines[0]);
    const header = lines[0].split(delim).map(h => normalizeKey(h));
    const idx = {
      plate: header.findIndex(h => ['placa','plate'].includes(h)),
      brand: header.findIndex(h => ['marca','brand'].includes(h)),
      model: header.findIndex(h => ['modelo','model'].includes(h)),
      year: header.findIndex(h => ['ano','year'].includes(h)),
      type: header.findIndex(h => ['tipo','type'].includes(h)),
    };
    const toYear = (s: string): number | null => {
      const m = (s || '').match(/(\d{4})/);
      return m ? Number(m[1]) : null;
    };
    const items: Array<{ plate: string; brand: string; model: string; year: number | null; type?: string }> = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delim).map(c => c.trim());
      const plate = idx.plate >= 0 ? cols[idx.plate] : '';
      if (!plate) continue;
      const brand = idx.brand >= 0 ? cols[idx.brand] : '';
      const model = idx.model >= 0 ? cols[idx.model] : '';
      const yearStr = idx.year >= 0 ? cols[idx.year] : '';
      const typeVal = idx.type >= 0 ? cols[idx.type] : '';
      items.push({ plate, brand, model, year: toYear(yearStr), type: typeVal });
    }
    return items;
  };

  const parseXlsx = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (!rows.length) return [] as Array<{ plate: string; brand: string; model: string; year: number | null; type?: string }>;
    const header = (rows[0] as string[]).map(h => normalizeKey(String(h || '')));
    const idx = {
      plate: header.findIndex(h => ['placa','plate'].includes(h)),
      brand: header.findIndex(h => ['marca','brand'].includes(h)),
      model: header.findIndex(h => ['modelo','model'].includes(h)),
      year: header.findIndex(h => ['ano','year'].includes(h)),
      type: header.findIndex(h => ['tipo','type'].includes(h)),
    };
    const toYear = (s: string): number | null => {
      const m = (s || '').match(/(\d{4})/);
      return m ? Number(m[1]) : null;
    };
    const items: Array<{ plate: string; brand: string; model: string; year: number | null; type?: string }> = [];
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i] as any[];
      if (!cols || !cols.length) continue;
      const plate = idx.plate >= 0 ? String(cols[idx.plate] || '').trim() : '';
      if (!plate) continue;
      const brand = idx.brand >= 0 ? String(cols[idx.brand] || '').trim() : '';
      const model = idx.model >= 0 ? String(cols[idx.model] || '').trim() : '';
      const yearStr = idx.year >= 0 ? String(cols[idx.year] || '').trim() : '';
      const typeVal = idx.type >= 0 ? String(cols[idx.type] || '').trim() : '';
      items.push({ plate, brand, model, year: toYear(yearStr), type: typeVal });
    }
    return items;
  };

  const doBulkInsert = async (items: Array<{ plate: string; brand: string; model: string; year: number | null; type?: string }>) => {
    if (!items.length) { pushToast({ title: 'Importação', message: 'Nenhum veículo reconhecido no texto.', variant: 'warning' }); return; }
    setImporting(true);
    let ok = 0; let dup = 0; let fail = 0;
    const errors: Array<{ plate: string; message: string }> = [];
    for (const v of items) {
      try {
        const res = await insertVehicle({ plate: v.plate, model: v.model, brand: v.brand, year: v.year ?? null, type: v.type });
        if (res.error) {
          // Friendly duplicate check or DB unique violation
          const msg = res.error.message || '';
          if (/já cadastrado/i.test(msg) || /duplicate key/i.test(msg) || /violates unique/i.test(msg)) dup++; else { fail++; errors.push({ plate: v.plate, message: msg }); }
        } else { ok++; }
      } catch (e: any) {
        const msg = e?.message || '';
        if (/já cadastrado/i.test(msg) || /duplicate key/i.test(msg) || /violates unique/i.test(msg)) dup++; else { fail++; errors.push({ plate: v.plate, message: msg || 'Erro desconhecido' }); }
      }
    }
    setImporting(false);
    pushToast({ title: 'Importação concluída', message: `Sucesso: ${ok}, Duplicados: ${dup}, Falhas: ${fail}`, variant: fail ? 'warning' : 'success' });
    setImportDetails({ ok, dup, fail, errors });
    loadAll();
  };

  const importVehicles = async () => {
    const items = parseVehicles(importText);
    await doBulkInsert(items);
  };

  const importFromFile = async () => {
    if (!importFile) { pushToast({ title: 'Arquivo', message: 'Selecione um arquivo CSV ou XLSX.', variant: 'warning' }); return; }
    try {
      const ext = (importFile.name.split('.').pop() || '').toLowerCase();
      if (ext === 'xlsx' || ext === 'xls') {
        const items = await parseXlsx(importFile);
        await doBulkInsert(items);
      } else {
        const text = await importFile.text();
        const items = parseCsv(text);
        await doBulkInsert(items);
      }
    } catch (e: any) {
      pushToast({ title: 'Falha ao importar', message: e?.message || 'Não foi possível ler o arquivo.', variant: 'danger' });
    }
  };

  return (
    <div className="space-y-3 py-3">
      <Card title={<span className="inline-flex items-center gap-2"><ShieldAlert size={16} /> Admin</span> as any} actions={<Button size="sm" variant="outline" onClick={loadAll} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar'}</Button>}>
        <div className="text-xs text-gray-400">Painel de administração: excluir qualquer registro. Use com cuidado.</div>
      </Card>

      <Card title={`Usuários (${users.length})`}>
        {loading ? <div className="cm-skeleton h-8" /> : (
          users.length ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500">{usrShowAll ? `Exibindo todos (${users.length})` : `Exibindo primeiros 5 de ${users.length}`}</div>
                <Button size="sm" variant="outline" onClick={() => setUsrShowAll(s => !s)}>
                  {usrShowAll ? 'Mostrar menos' : 'Mostrar todos'}
                </Button>
              </div>
              <ul className="divide-y">
                {(users.slice(0, usrShowAll ? users.length : 5)).map(u => (
                  <li key={u.id} className="py-2 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0 break-words">
                      {u.display_name || 'Sem nome'} • <span className="break-all">{u.email || '—'}</span>
                      <span className="ml-2 cm-badge cm-badge-outline">{String(u.role || 'editor')}</span>
                      {!u.is_active && <span className="ml-2 cm-badge cm-badge-danger">inativo</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => toggleUserRole(u)}>
                        {String(u.role || 'editor').toLowerCase() === 'admin' ? 'Rebaixar' : 'Promover'}
                      </Button>
                      {u.email && (
                        <Button size="sm" variant="outline" onClick={() => resetUserPassword(u.email)}>
                          Alterar senha
                        </Button>
                      )}
                      <Button size="sm" variant="danger" onClick={() => confirmDeactivateUser(u.id)}>
                        <Trash2 size={14} /> Excluir
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : <div className="text-xs text-gray-500">Sem usuários cadastrados.</div>
        )}
      </Card>

      <Card title={`Veículos (${vehicles.length})`}>
        {loading ? <div className="cm-skeleton h-8" /> : (
          vehicles.length ? (
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row items-stretch gap-2">
                <input
                  value={vehQuery}
                  onChange={e => setVehQuery(e.target.value)}
                  className="cm-input text-xs"
                  placeholder="Filtrar por placa, modelo ou marca"
                />
                <Button size="sm" variant="outline" onClick={() => setVehShowAll(s => !s)}>
                  {vehShowAll ? 'Mostrar menos' : 'Mostrar todos'}
                </Button>
              </div>
              <div className="text-xs text-gray-500">{vehShowAll ? `Exibindo todos (${vehicles.length})` : `Exibindo primeiros 5 de ${vehicles.length}`}</div>
              <ul className="divide-y">
                {(vehicles
                  .filter(v => {
                    const q = vehQuery.trim().toLowerCase();
                    if (!q) return true;
                    const plate = String(v.plate || '').toLowerCase();
                    const model = String(v.model || '').toLowerCase();
                    const brand = String(v.brand || '').toLowerCase();
                    return plate.includes(q) || model.includes(q) || brand.includes(q);
                  })
                  .slice(0, vehShowAll ? vehicles.length : 5))
                  .map(v => (
                  <li key={v.id} className="py-2 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0 break-words">{v.plate} • {v.model || ''} {v.brand || ''}</div>
                    <Button size="sm" variant="danger" onClick={() => confirmDelete('vehicle', v.id)}><Trash2 size={14} /> Excluir</Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : <div className="text-xs text-gray-500">Sem veículos cadastrados.</div>
        )}
      </Card>

      <Card title="Importar veículos">
        <div className="space-y-2">
          <div className="text-xs text-gray-400">Opções de importação: arquivo CSV com cabeçalho (Placa, Marca, Modelo, Ano, Tipo) ou texto colado no formato de 5 linhas por veículo.</div>
          <div className="flex flex-col md:flex-row gap-2">
            <div className="flex-1 space-y-2">
              <label className="text-xs font-semibold">Arquivo CSV/XLSX</label>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={e => setImportFile(e.target.files?.[0] || null)} className="cm-input" />
              <Button size="sm" variant="primary" onClick={importFromFile} disabled={importing || !importFile}>{importing ? 'Importando…' : 'Importar arquivo'}</Button>
              {importDetails && importDetails.fail > 0 && (
                <div className="mt-2 p-2 rounded border text-xs">
                  <div className="font-semibold mb-1">Falhas detalhadas ({importDetails.errors.length})</div>
                  <ul className="space-y-1 max-h-40 overflow-auto">
                    {importDetails.errors.slice(0, 10).map((e, i) => (
                      <li key={i}><span className="font-mono">{e.plate}</span>: {e.message}</li>
                    ))}
                  </ul>
                  {importDetails.errors.length > 10 && <div className="text-gray-500">+ {importDetails.errors.length - 10} outros…</div>}
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <label className="text-xs font-semibold">Texto colado (alternativa)</label>
              <textarea className="cm-input min-h-[140px]" value={importText} onChange={e => setImportText(e.target.value)} placeholder="Cole aqui a lista…" />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={importVehicles} disabled={importing || !importText.trim().length}>{importing ? 'Importando…' : 'Importar texto'}</Button>
                <Button size="sm" variant="ghost" onClick={() => setImportText('')} disabled={importing}>Limpar</Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card title={`Fornecedores (${suppliers.length})`}>
        {loading ? <div className="cm-skeleton h-8" /> : (
          suppliers.length ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500">{supShowAll ? `Exibindo todos (${suppliers.length})` : `Exibindo primeiros 5 de ${suppliers.length}`}</div>
                <Button size="sm" variant="outline" onClick={() => setSupShowAll(s => !s)}>
                  {supShowAll ? 'Mostrar menos' : 'Mostrar todos'}
                </Button>
              </div>
              <ul className="divide-y">
                {(suppliers.slice(0, supShowAll ? suppliers.length : 5)).map(s => (
                  <li key={s.id} className="py-2 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0 break-words">{getSupplierName(s) || 'Sem nome'} • <span className="break-all">{s.cnpj || '—'}</span></div>
                    <Button size="sm" variant="danger" onClick={() => confirmDelete('supplier', s.id)}><Trash2 size={14} /> Excluir</Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : <div className="text-xs text-gray-500">Sem fornecedores cadastrados.</div>
        )}
      </Card>

      <Card title={`Checklists (${checklists.length})`}>
        {loading ? <div className="cm-skeleton h-8" /> : (
          checklists.length ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500">{chkShowAll ? `Exibindo todos (${checklists.length})` : `Exibindo primeiros 5 de ${checklists.length}`}</div>
                <Button size="sm" variant="outline" onClick={() => setChkShowAll(s => !s)}>
                  {chkShowAll ? 'Mostrar menos' : 'Mostrar todos'}
                </Button>
              </div>
              <ul className="divide-y">
                {(checklists.slice(0, chkShowAll ? checklists.length : 5)).map(c => (
                  <li key={c.id} className="py-2 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0 break-words">{c.seq || c.id} • {c.plate || '—'} • {c.status || ''}</div>
                    <Button size="sm" variant="danger" onClick={() => confirmDelete('checklist', c.id)}><Trash2 size={14} /> Excluir</Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : <div className="text-xs text-gray-500">Sem checklists cadastrados.</div>
        )}
      </Card>
    </div>
  );
}
  const toggleUserRole = async (u: any) => {
    const cur: string = String(u.role || 'editor').toLowerCase();
    const next = cur === 'admin' ? 'editor' : 'admin';
    const { error } = await setUserRole(u.id, next as any);
    if (error) { pushToast({ title: 'Erro ao atualizar', message: error.message, variant: 'danger' }); return; }
    pushToast({ title: 'Perfil atualizado', message: `${u.email || 'Usuário'} agora é ${next}.`, variant: 'success' });
    loadAll();
  };

  const resetUserPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) { pushToast({ title: 'Erro ao enviar', message: error.message, variant: 'danger' }); return; }
    pushToast({ title: 'Recuperação enviada', message: `E-mail enviado para ${email}.`, variant: 'info' });
  };

  const confirmDeactivateUser = async (id: string) => {
    if (!confirm('Desativar usuário? Ele não poderá acessar o sistema.')) return;
    const { error } = await deactivateUser(id);
    if (error) { pushToast({ title: 'Erro ao desativar', message: error.message, variant: 'danger' }); return; }
    pushToast({ title: 'Usuário desativado', message: 'O acesso foi bloqueado.', variant: 'success' });
    loadAll();
  };