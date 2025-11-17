import { supabase } from '../../config/supabase';

export async function getNextChecklistSeq() {
  const { data, error } = await supabase.rpc('get_next_checklist_seq');
  if (error) throw error;
  return data as string;
}

export async function getCnpjData(cnpj: string) {
  const { data, error } = await supabase.rpc('getCnpjData', { cnpj });
  if (error) throw error;
  return data;
}