import { supabase } from '../../config/supabase';

export async function getNextChecklistSeq() {
  const { data, error } = await supabase.rpc('get_next_checklist_seq');
  if (error) throw error;
  return data as string;
}

export async function getCnpjData(cnpj: string) {
  // A função SQL define o parâmetro como p_cnpj; usar o mesmo nome evita erro de argumento.
  const { data, error } = await supabase.rpc('getCnpjData', { p_cnpj: cnpj });
  if (error) throw error;
  return data;
}