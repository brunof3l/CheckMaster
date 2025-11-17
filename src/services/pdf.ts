import { supabase } from '../config/supabase';
import { getChecklist } from './checklists';

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleString() : '-';
}

async function fetchSupplierName(supplierId?: string | null) {
  if (!supplierId) return '-';
  try {
    const { data } = await supabase.from('suppliers').select('nome').eq('id', supplierId).single();
    return (data as any)?.nome || '-';
  } catch { return '-'; }
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateChecklistPdf(id: string) {
  const { jsPDF } = await import('jspdf');
  const data = await getChecklist(id);
  const supplierName = await fetchSupplierName((data as any).supplier_id);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const margin = 40;
  let y = margin;
  const pageHeight = doc.internal.pageSize.getHeight();
  const innerWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) { doc.addPage(); y = margin; }
  };
  const setPrimary = () => doc.setTextColor(45, 70, 135);
  const setNormal = () => doc.setTextColor(0, 0, 0);
  const sectionTitle = (text: string) => {
    ensureSpace(28);
    setPrimary();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(text, margin, y);
    y += 18;
    setNormal();
    // Removido: linha horizontal decorativa
    y += 6;
  };
  const line = (text: string, size = 12, bold = false) => {
    ensureSpace(size + 8);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.text(text, margin, y);
    y += size + 6;
  };
  const kv = (label: string, value: string) => {
    ensureSpace(18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 90, y);
    y += 16;
  };
  const inferImageFormat = (path: string): 'JPEG' | 'PNG' => /\.jpe?g$/i.test(path) ? 'JPEG' : 'PNG';

  // Header
  setPrimary();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(`Checklist ${data.seq || id}`, margin, y);
  y += 24;
  setNormal();
  // Removido: linha horizontal abaixo do título
  y += 8;
  kv('Placa', data.plate || '-');
  kv('Fornecedor', supplierName);
  // Fallback para serviço: tentar extrair das notas quando a coluna não existe
  const svcFromNotes = (() => {
    const n = (data as any).notes || '';
    const m = n.match(/Servi[cç]o:\s*(.+)/i);
    return m ? m[1].trim() : '-';
  })();
  kv('Serviço', (data as any).service || svcFromNotes);
  kv('Status', data.status);
  kv('Início', fmtDate(data.started_at));
  kv('Fim', fmtDate(data.finished_at));
  const durH = data.maintenance_seconds ? (data.maintenance_seconds / 3600).toFixed(2) : '0.00';
  kv('Duração (h)', durH);

  y += 4;
  sectionTitle('Observações');
  const obs = data.notes || '-';
  const obsLines = doc.splitTextToSize(obs, 515);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(obsLines, margin, y);
  y += (obsLines.length * (12 + 2)) + 12;

  // Defect items
  sectionTitle('Itens com defeito');
  const defects = (data.defect_items || []) as any[];
  if (defects.length) {
    defects.forEach((d) => {
      const txt = `• ${d?.name || d?.itemId || 'Item'}${d?.note ? ` — ${d.note}` : ''}`;
      const wrapped = doc.splitTextToSize(txt, 515);
      doc.text(wrapped, margin, y);
      y += (wrapped.length * (12 + 2));
    });
  } else {
    line('Nenhum item registrado.', 12);
  }

  // Budget attachments listing
  sectionTitle('Orçamento / Documentos');
  const budgets = (data as any).budgetAttachments || [];
  if (budgets.length) {
    budgets.forEach((b: any) => {
      const txt = `• ${b?.name || b?.path}`;
      doc.text(txt, margin, y);
      y += 14;
    });
  } else {
    line('Nenhum anexo de orçamento.', 12);
  }

  // Photos at the end with large size
  const media = (data.media || []) as any[];
  sectionTitle('Fotos');
  if (media.length) {
    const largeW = innerWidth; // full content width
    const largeH = 300; // fixed height for readability
    for (let i = 0; i < media.length; i++) {
      ensureSpace(largeH + 24);
      const m = media[i];
      const { data: signed } = await supabase.storage.from('checklists').createSignedUrl(m.path, 3600);
      const durl = signed?.signedUrl ? await toDataUrl(signed.signedUrl) : null;
      const fmt = inferImageFormat(m.path || '');
      if (durl) {
        try { doc.addImage(durl, fmt, margin, y, largeW, largeH); } catch {
          doc.rect(margin, y, largeW, largeH);
          doc.text('imagem', margin + largeW/2 - 24, y + largeH/2);
        }
      } else {
        doc.rect(margin, y, largeW, largeH);
        doc.text('imagem', margin + largeW/2 - 24, y + largeH/2);
      }
      y += largeH + 16;
    }
  } else {
    line('Nenhuma foto anexada.', 12);
  }

  // Footer
  y += 18;
  doc.setFontSize(10);
  doc.text('Gerado por CheckMaster', margin, y);

  const url = doc.output('bloburl');
  return url;
}