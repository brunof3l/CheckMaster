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