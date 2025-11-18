import { supabase } from '../../config/supabase';
import { sanitizeText } from '../../utils/sanitize';

// Checklists
export async function listChecklists() {
  return supabase.from('checklists').select('*').order('created_at', { ascending: false });
}

export async function insertChecklist(d: any) {
  // Evita duplicidade: não permitir checklist em aberto para a mesma placa
  const plate = (d.plate || '').toString().trim().toUpperCase();
  if (plate) {
    const dup = await supabase.from('checklists')
      .select('id,status')
      .eq('plate', plate)
      .in('status', ['rascunho', 'em_andamento'])
      .limit(1);
    if (dup.error) throw dup.error;
    if ((dup.data || []).length) throw new Error('Já existe checklist em aberto para este veículo.');
  }
  // Registra o criador quando disponível para suportar RLS por ownership
  const { data: authInfo } = await supabase.auth.getUser();
  const createdBy = authInfo?.user?.id || null;
  const { data, error } = await supabase.from('checklists').insert([{ ...d, plate, created_by: createdBy }]).select().single();
  if (error) throw error;
  if (!data) throw new Error('Falha ao criar checklist');
  return data;
}

export async function updateChecklist(id: string, patch: any) {
  return supabase.from('checklists').update(patch).eq('id', id);
}

export async function deleteChecklist(id: string) {
  // Primeiro remove registros dependentes na tabela de auditoria
  const auditRes = await supabase.from('checklist_audit').delete().eq('checklist_id', id);
  // Se a tabela não existir, ignore; caso contrário, propague o erro
  if (auditRes.error && !/relation "checklist_audit" does not exist/i.test(auditRes.error.message)) {
    return auditRes;
  }
  // Agora remove o checklist
  return supabase.from('checklists').delete().eq('id', id);
}

// Suppliers
export async function listSuppliers() {
  return supabase.from('suppliers').select('*').order('created_at', { ascending: false });
}

export async function insertSupplier(d: any) {
  // Normaliza valores: strings vazias viram null para evitar salvar "" e aparecer como Sem nome
  const norm = (v: any) => {
    if (v === undefined || v === null) return null;
    if (typeof v === 'string') {
      // Sanitiza para remover tags/atributos potencialmente maliciosos e normaliza espaços
      const t = sanitizeText(v).trim();
      return t.length ? t : null;
    }
    return v;
  };

  // CNPJ: manter somente dígitos para facilitar comparação de duplicidade
  const cnpjDigits = norm((d.cnpj || '')?.toString().replace(/\D/g, ''));

  // Verificação de duplicidade por CNPJ (se houver)
  if (cnpjDigits) {
    const dup = await supabase.from('suppliers').select('id').eq('cnpj', cnpjDigits).limit(1);
    if (dup.error) throw dup.error;
    if ((dup.data || []).length) throw new Error('Fornecedor já cadastrado com este CNPJ.');
  }

  // Verificação de duplicidade por nome quando CNPJ não informado
  const nameCandidate = norm(d.nome ?? d.razaoSocial ?? d.razaosocial);
  if (!cnpjDigits && nameCandidate) {
    // Busca por nome exato em quaisquer das colunas de nome
    const byNome = await supabase.from('suppliers').select('id').eq('nome', nameCandidate).limit(1);
    if (byNome.error) throw byNome.error;
    if ((byNome.data || []).length) throw new Error('Fornecedor já cadastrado com este nome.');
    const byRazao = await supabase.from('suppliers').select('id').eq('razaosocial', nameCandidate).limit(1);
    if (byRazao.error) throw byRazao.error;
    if ((byRazao.data || []).length) throw new Error('Fornecedor já cadastrado com este nome.');
    // Alguns bancos não possuem a coluna camelCase; se não existir, ignore o erro
    const byRazaoCamel = await supabase.from('suppliers').select('id').eq('razaoSocial', nameCandidate).limit(1);
    if (byRazaoCamel.error) {
      const msg = byRazaoCamel.error.message || '';
      // Ignora apenas erro de coluna inexistente; demais erros são propagados
      if (!/column\s+\"?razaoSocial\"?\s+does\s+not\s+exist/i.test(msg)) {
        throw byRazaoCamel.error;
      }
    } else if ((byRazaoCamel.data || []).length) {
      throw new Error('Fornecedor já cadastrado com este nome.');
    }
  }

  // Monta payload completo em uma única inserção para evitar UPDATE pós-inserção,
  // que pode ser bloqueado por RLS para papéis sem privilégio de edição.
  const payload: any = {
    cnpj: cnpjDigits,
    telefone: norm(d.telefone),
    email: norm(d.email),
    // O schema padrão usa camelCase `razaoSocial` e também possui `nome`.
    // Preenche ambos quando disponíveis para maximizar compatibilidade sem precisar de UPDATE.
    razaoSocial: norm(d.razaoSocial ?? d.razaosocial ?? d.nome ?? nameCandidate),
    nome: norm(d.nome ?? d.razaoSocial ?? d.razaosocial ?? nameCandidate)
  };

  // Remove chaves com null para evitar conflitos em bancos sem determinadas colunas
  Object.keys(payload).forEach(k => { if (payload[k] === null) delete payload[k]; });

  const res = await supabase.from('suppliers').insert([payload]).select().single();
  // Fallback: alguns bancos usam snake_case "razaosocial" ou o cache de schema pode não conhecer "razaoSocial"
  const msg = res.error?.message || '';
  const schemaCacheErr = /could not find the 'razaoSocial' column of 'suppliers' in the schema cache/i.test(msg);
  const pgNoColumnErr = /column\s+"?razaoSocial"?\s+.*does\s+not\s+exist/i.test(msg);
  if (res.error && (schemaCacheErr || pgNoColumnErr)) {
    const { razaoSocial, ...rest } = payload as any;
    const altPayload: any = { ...rest };
    if (razaoSocial !== undefined && razaoSocial !== null) {
      altPayload.razaosocial = razaoSocial;
    }
    return await supabase.from('suppliers').insert([altPayload]).select().single();
  }
  return res;
}

export async function deleteSupplier(id: string) {
  return supabase.from('suppliers').delete().eq('id', id);
}

// Vehicles
export async function listVehicles() {
  return supabase.from('vehicles').select('*');
}

export async function insertVehicle(d: any) {
  const plate = (d.plate || '').toString().trim().toUpperCase();
  if (!plate) throw new Error('Placa é obrigatória.');
  // Verificação de duplicidade (há UNIQUE na tabela, mas trazemos validação amigável)
  const dup = await supabase.from('vehicles').select('id').eq('plate', plate).limit(1);
  if (dup.error) throw dup.error;
  if ((dup.data || []).length) throw new Error('Veículo já cadastrado com esta placa.');
  // Tenta inserir com todos os campos; se coluna "type" não existir, faz retry sem ela
  const payload = { ...d, plate };
  let res = await supabase.from('vehicles').insert([payload]).select().single();
  // Captura tanto erro do Postgres (column does not exist) quanto do cache de schema do Supabase
  const msg = res.error?.message || '';
  const schemaCacheErr = /could not find the 'type' column of 'vehicles' in the schema cache/i.test(msg);
  const pgNoColumnErr = /column\s+"type"\s+.*does not exist/i.test(msg);
  if (res.error && (pgNoColumnErr || schemaCacheErr)) {
    const { type, ...withoutType } = payload as any;
    res = await supabase.from('vehicles').insert([withoutType]).select().single();
  }
  return res;
}

export async function deleteVehicle(id: string) {
  return supabase.from('vehicles').delete().eq('id', id);
}

// Check items
export async function listCheckItems() {
  return supabase.from('check_items').select('*').order('order_n', { ascending: true });
}

// Users (app profile)
export async function listAppUsers(includeInactive = false) {
  // Tenta filtrar por is_active; se a coluna não existir (migração não aplicada), faz fallback sem filtro.
  try {
    let q = supabase.from('users').select('*').order('created_at', { ascending: false });
    if (!includeInactive) q = q.eq('is_active', true) as any;
    const res = await q;
    // Se sucesso ou erro não relacionado à coluna, retorna o resultado padrão
    const msg = res.error?.message || '';
    const noColumn = /column\s+users\.is_active\s+does\s+not\s+exist/i.test(msg) || /column\s+"?is_active"?\s+does\s+not\s+exist/i.test(msg);
    if (!res.error || !noColumn) return res;
    // Fallback: sem filtro
    return await supabase.from('users').select('*').order('created_at', { ascending: false });
  } catch (e: any) {
    // Fallback final em caso de erro inesperado
    return await supabase.from('users').select('*').order('created_at', { ascending: false });
  }
}

export async function setUserRole(userId: string, role: 'admin' | 'editor' | 'visualizador') {
  try {
    const res = await supabase.rpc('set_user_role', { target: userId, new_role: role });
    // Se a função não existir ainda, faz fallback para update direto
    if (res.error && /function\s+set_user_role.*does not exist/i.test(res.error.message)) {
      return await supabase.from('users').update({ role }).eq('id', userId);
    }
    return res;
  } catch (e: any) {
    // Fallback em caso de erro inesperado na RPC
    return await supabase.from('users').update({ role }).eq('id', userId);
  }
}

export async function deactivateUser(userId: string) {
  // Primeiro tenta desativar (soft delete). Se a coluna não existir, faz hard delete.
  const res = await supabase.from('users').update({ is_active: false }).eq('id', userId);
  const msg = res.error?.message || '';
  const noColumn = /column\s+users\.is_active\s+does\s+not\s+exist/i.test(msg) || /column\s+"?is_active"?\s+does\s+not\s+exist/i.test(msg);
  if (res.error && noColumn) {
    return await supabase.from('users').delete().eq('id', userId);
  }
  return res;
}