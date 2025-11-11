import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { PDFDocument, StandardFonts } from 'pdf-lib';

admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

export const getNextChecklistSeq = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  const id: string = data?.id;
  if (!id) throw new functions.https.HttpsError('invalid-argument', 'Missing checklist id');
  const counterRef = db.collection('counters').doc('checklist');
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const value = (snap.exists ? (snap.data() as any).value : 0) + 1;
    tx.set(counterRef, { name: 'checklist', value }, { merge: true });
    const seq = `CHK-${value.toString().padStart(6, '0')}`;
    tx.update(db.collection('checklists').doc(id), { seq });
  });
  const doc = await db.collection('checklists').doc(id).get();
  return { seq: (doc.data() as any)?.seq };
});

export const cnpjLookup = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  const cnpj: string = (data?.cnpj || '').replace(/\D/g, '');
  if (!cnpj || cnpj.length !== 14) throw new functions.https.HttpsError('invalid-argument', 'CNPJ inválido');
  const cacheRef = db.collection('cnpj_cache').doc(cnpj);
  const cache = await cacheRef.get();
  if (cache.exists) return cache.data();
  // TODO: integrar API pública de CNPJ. Mock simplificado abaixo.
  const result = {
    cnpj,
    razaoSocial: 'Empresa Exemplo LTDA',
    nomeFantasia: 'Empresa Exemplo',
    endereco: { logradouro: 'Rua Exemplo', numero: '123', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', cep: '01000-000' },
    telefone: '(11) 99999-9999',
    email: 'contato@exemplo.com'
  };
  await cacheRef.set({ ...result, cachedAt: admin.firestore.FieldValue.serverTimestamp() });
  return result;
});

export const generateChecklistPdf = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  const id: string = data?.id;
  if (!id) throw new functions.https.HttpsError('invalid-argument', 'Missing checklist id');
  const docSnap = await db.collection('checklists').doc(id).get();
  const doc = docSnap.data() || {};
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText(`Checklist ${doc.seq || id}`, { x: 50, y: 800, size: 16, font });
  page.drawText(`Placa: ${doc.plate || ''}`, { x: 50, y: 780, size: 12, font });
  page.drawText(`Status: ${doc.status || ''}`, { x: 50, y: 760, size: 12, font });
  const pdfBytes = await pdf.save();
  const filePath = `checklists/${id}/pdf/${(doc.seq || id)}.pdf`;
  const bucket = storage.bucket();
  const file = bucket.file(filePath);
  await file.save(pdfBytes, { contentType: 'application/pdf' });
  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 60 });
  await db.collection('checklists').doc(id).set({ media: admin.firestore.FieldValue.arrayUnion({ type: 'pdf', path: filePath, createdAt: Date.now() }) }, { merge: true });
  return { url };
});