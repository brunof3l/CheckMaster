import { supabase } from '../../config/supabase';
import { safeUuid } from '../../utils/id';

export async function uploadPhoto(chkId: string, file: File) {
  const ext = file.name.split('.').pop() || 'bin';
  const name = `${chkId}/${safeUuid()}.${ext}`;
  const { error } = await supabase.storage.from('checklists').upload(name, file);
  if (error) throw error;
  const { data } = await supabase.storage.from('checklists').createSignedUrl(name, 3600);
  return { path: name, url: data?.signedUrl };
}

export async function uploadChecklistMedia(chkId: string, files: File[], existing: any[] = []) {
  const next = [...(existing || [])];
  let uploaded = 0;
  for (const f of files) {
    const mime = f.type || '';
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowed.includes(mime)) {
      continue;
    }
    const ext = f.name.split('.').pop() || 'bin';
    const name = `${chkId}/${safeUuid()}.${ext}`;
    const up = await supabase.storage.from('checklists').upload(name, f);
    if (up.error) throw up.error;
    uploaded++;
    let url: string | undefined;
    try {
      const { data: signed } = await supabase.storage.from('checklists').createSignedUrl(name, 3600);
      url = signed?.signedUrl;
    } catch {}
    next.push({ type: 'photo', path: name, url, created_at: new Date().toISOString() });
  }
  const { error } = await supabase.from('checklists').update({ media: next }).eq('id', chkId);
  if (error) throw error;
  return { uploaded, media: next };
}
