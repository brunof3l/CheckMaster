import { supabase } from '../../config/supabase';

export async function uploadPhoto(chkId: string, file: File) {
  const ext = file.name.split('.').pop() || 'bin';
  const name = `${chkId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('checklists').upload(name, file);
  if (error) throw error;
  const { data } = await supabase.storage.from('checklists').createSignedUrl(name, 3600);
  return { path: name, url: data?.signedUrl };
}