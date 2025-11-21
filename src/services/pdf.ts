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

async function renderPdfFirstPage(url: string): Promise<string | null> {
  try {
    const pdfjsLib = await import('pdfjs-dist/build/pdf');
    // Worker via CDN para evitar issues de bundler
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const loadingTask = (pdfjsLib as any).getDocument({ url });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.2 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/png');
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

  // Budget attachments listing (camelCase & snake_case fallback)
  sectionTitle('Orçamento / Documentos');
  const budgets = (data as any).budgetAttachments || (data as any).budgetattachments || (data as any).budget_attachments || [];
  if (budgets.length) {
    for (const b of budgets) {
      const name = b?.name || b?.path || 'anexo';
      doc.text(`• ${name}`, margin, y);
      y += 14;
      // Tentar pré-visualização: se imagem, embutir; se PDF, renderizar primeira página
      let signedUrl: string | undefined;
      try {
        const { data: signed } = await supabase.storage.from('checklists').createSignedUrl(b.path, 3600);
        signedUrl = signed?.signedUrl;
      } catch {}
      const isPdf = /\.pdf$/i.test(b?.path || b?.name || '');
      const preview = isPdf ? (signedUrl ? await renderPdfFirstPage(signedUrl) : null) : (signedUrl ? await toDataUrl(signedUrl) : null);
      if (preview) {
        ensureSpace(240);
        try { doc.addImage(preview, 'PNG', margin, y, innerWidth, 220); } catch {
          doc.rect(margin, y, innerWidth, 220);
          doc.text('prévia do anexo', margin + innerWidth/2 - 40, y + 110);
        }
        y += 230;
      }
    }
  } else {
    line('Nenhum anexo de orçamento.', 12);
  }

  // Photos at the end with large size (camelCase & legacy fallback)
  const media = ((data as any).media || (data as any).attachments || []) as any[];
  sectionTitle('Fotos');
  if (media.length) {
    const largeW = innerWidth; // full content width
    const largeH = 300; // fixed height for readability
    for (let i = 0; i < media.length; i++) {
      ensureSpace(largeH + 24);
      const m = media[i];
      let signedUrl: string | undefined;
      try {
        const { data: signed } = await supabase.storage.from('checklists').createSignedUrl(m.path, 3600);
        signedUrl = signed?.signedUrl;
      } catch {}
      // Fallback: usar URL previamente salva se não conseguir assinar
      const candidate = signedUrl || (m?.url as string | undefined);
      const durl = candidate ? await toDataUrl(candidate) : null;
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

  // Fuel gauge photos
  const fuel = (data as any).fuelGaugePhotos || (data as any).fuel_gauge_photos || (data as any).fuelgaugephotos || {};
  sectionTitle('Marcador de combustível');
  if (fuel?.entry || fuel?.exit) {
    const toSigned = async (p?: string) => {
      if (!p) return null;
      try {
        const { data: s } = await supabase.storage.from('checklists').createSignedUrl(p, 3600);
        return s?.signedUrl || null;
      } catch { return null; }
    };
    const entryUrl = await toSigned(fuel.entry);
    const exitUrl = await toSigned(fuel.exit);
    if (entryUrl) {
      const durl = await toDataUrl(entryUrl);
      if (durl) { ensureSpace(220); try { doc.addImage(durl, 'PNG', margin, y, innerWidth, 200); } catch {} y += 210; }
    }
    if (exitUrl) {
      const durl = await toDataUrl(exitUrl);
      if (durl) { ensureSpace(220); try { doc.addImage(durl, 'PNG', margin, y, innerWidth, 200); } catch {} y += 210; }
    }
  } else {
    line('Sem fotos de combustível.', 12);
  }

  // Footer
  y += 18;
  doc.setFontSize(10);
  doc.text('Gerado por CheckMaster', margin, y);

  const url = doc.output('bloburl');
  return url;
}