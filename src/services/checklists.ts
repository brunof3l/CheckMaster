import { supabase } from '../config/supabase';
import { sanitizeText } from '../utils/sanitize';

export type Checklist = {
  id: string;
  seq?: string | null;
  plate?: string | null;
  supplier_id?: string | null;
  service?: string | null;
  defect_items?: any[];
  media?: any[];
  budgetAttachments?: any[];
  fuelGaugePhotos?: any;
  status?: 'rascunho' | 'em_andamento' | 'finalizado';
  started_at?: string | null;
  finished_at?: string | null;
  maintenance_seconds?: number | null;
  is_locked?: boolean | null;
  notes?: string | null;
  created_at?: string;
};

export async function getChecklist(id: string) {
  const { data, error } = await supabase.from('checklists').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Checklist;
}

export async function setInProgress(id: string) {
  // When opening a draft, move to in_progress and set started_at
  const { error } = await supabase.from('checklists').update({ status: 'em_andamento', started_at: new Date().toISOString(), is_locked: false }).eq('id', id);
  if (error) throw error;
}

export async function saveChecklist(id: string, patch: Partial<Checklist>) {
  const sanitized = { ...patch } as Partial<Checklist>;
  if (typeof sanitized.notes === 'string') {
    sanitized.notes = sanitizeText(sanitized.notes);
  }
  const { error } = await supabase.from('checklists').update(sanitized).eq('id', id);
  if (error) throw error;
}

export async function finalizeChecklist(id: string, userId?: string) {
  try {
    const { data, error } = await supabase.rpc('finalize_checklist', { chk_id: id, user_id: userId || null });
    if (error) throw error;
    return data as { success: boolean; maintenance_seconds: number };
  } catch (e: any) {
    const msg = (e?.message || '').toLowerCase();
    const rpcMissing = msg.includes('function finalize_checklist') || msg.includes('does not exist');
    const permission = msg.includes('permission denied') || msg.includes('row-level security');
    if (rpcMissing || permission) {
      // Fallback: tentar finalizar via UPDATE respeitando a policy de is_locked=false
      const row = await supabase.from('checklists').select('started_at, is_locked').eq('id', id).single();
      if (row.error) throw row.error;
      const started = row.data?.started_at ? new Date(row.data.started_at).getTime() : Date.now();
      const secs = Math.max(0, Math.floor((Date.now() - started) / 1000));

      // 1) Primeiro, atualiza status/tempos sem alterar is_locked para passar no WITH CHECK
      const up1 = await supabase.from('checklists').update({
        finished_at: new Date().toISOString(),
        status: 'finalizado',
        maintenance_seconds: secs,
      }).eq('id', id);
      if (up1.error) {
        // Se ainda falhar por RLS/permission, propaga o mesmo erro do RPC
        throw up1.error;
      }

      // 2) Em seguida, tenta marcar is_locked=true (pode falhar por RLS; UI já bloqueia por status)
      try {
        await supabase.from('checklists').update({ is_locked: true }).eq('id', id);
      } catch {}

      return { success: true, maintenance_seconds: secs };
    }
    throw e;
  }
}

export async function reopenChecklist(id: string, userId?: string) {
  const { data, error } = await supabase.rpc('reopen_checklist', { chk_id: id, user_id: userId || null });
  if (error) throw error;
  return data as { success: boolean };
}

export async function listInProgress(filters?: { plate?: string; supplier?: string; minHours?: number }) {
  let q = supabase.from('checklists').select('*').eq('status', 'em_andamento').order('started_at', { ascending: false });
  if (filters?.plate) q = q.ilike('plate', `%${filters.plate}%`);
  if (filters?.supplier) q = q.ilike('supplier_name', `%${filters.supplier}%` as any); // optional column
  const { data, error } = await q;
  if (error) throw error;
  const items = (data || []) as Checklist[];
  if (filters?.minHours) {
    const cutoff = filters.minHours * 3600;
    return items.filter(it => it.started_at ? ((Date.now() - new Date(it.started_at).getTime()) / 1000) >= cutoff : false);
  }
  return items;
}

export async function listFinished(filters?: { plate?: string; from?: string; to?: string }) {
  let q = supabase.from('checklists').select('*').eq('status', 'finalizado').order('finished_at', { ascending: false });
  if (filters?.plate) q = q.ilike('plate', `%${filters.plate}%`);
  if (filters?.from) q = q.gte('finished_at', filters.from);
  if (filters?.to) q = q.lte('finished_at', filters.to);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as Checklist[];
}

export type ReportFilters = { from?: string; to?: string; vehicle?: string; supplier?: string; status?: string };
export async function getReport(filters: ReportFilters) {
  let q = supabase.from('checklists').select('*').order('created_at', { ascending: false });
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.vehicle) q = q.ilike('plate', `%${filters.vehicle}%`);
  if (filters.supplier) q = q.ilike('supplier_name', `%${filters.supplier}%` as any);
  if (filters.from) q = q.gte('created_at', filters.from);
  if (filters.to) q = q.lte('created_at', filters.to);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data || []) as Checklist[];
  const toHours = (secs?: number | null) => secs ? +(secs / 3600).toFixed(2) : 0;
  const table = rows.map(r => ({
    seq: r.seq || r.id,
    plate: r.plate || '-',
    supplier: (r as any).supplier_name || '-',
    start: r.started_at || '-',
    end: r.finished_at || '-',
    hours: toHours(r.maintenance_seconds)
  }));
  // metrics
  const total = rows.reduce((acc, r) => acc + (r.maintenance_seconds || 0), 0);
  const avg = rows.length ? total / rows.length : 0;
  const byVehicle = aggregateAvg(rows, r => r.plate || '-');
  const bySupplier = aggregateAvg(rows, r => (r as any).supplier_name || '-');
  return { rows: table, totalHours: toHours(total), avgHours: toHours(avg), byVehicle, bySupplier };
}

function aggregateAvg(rows: Checklist[], keyFn: (r: Checklist) => string) {
  const map = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    const k = keyFn(r);
    const cur = map.get(k) || { total: 0, count: 0 };
    map.set(k, { total: cur.total + (r.maintenance_seconds || 0), count: cur.count + 1 });
  }
  return Array.from(map.entries()).map(([k, v]) => ({ key: k, avgHours: +(v.total / v.count / 3600).toFixed(2) }));
}

export function exportCsv(rows: any[], filename = 'report.csv') {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0] || {});
  const lines = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify((r as any)[h] ?? '')).join(','))];
  const csv = '\uFEFF' + lines.join('\r\n'); // BOM for Excel, CRLF line endings
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}