import { useState } from 'react';
import { useUIStore } from '../stores/ui';
import { getCnpjData } from './supabase/rpc';

type CnpjResult = {
  cnpj: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  endereco?: { logradouro?: string };
  telefone?: string;
  email?: string;
};

const onlyDigits = (s: string) => (s || '').replace(/\D/g, '');

export function useCnpjService() {
  const [loading, setLoading] = useState(false);

  const lookup = async (cnpj: string): Promise<CnpjResult | null> => {
    const digits = onlyDigits(cnpj);
    if (digits.length !== 14) return null;
    setLoading(true);
    try {
      // Prefer BrasilAPI (CORS-enabled) and fallback to Supabase RPC cache/mock
      const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (resp.ok) {
        const data = await resp.json();
        const enderecoStr = [
          data.descricao_tipo_de_logradouro,
          data.logradouro,
          data.numero ? `, ${data.numero}` : '',
          data.bairro ? ` - ${data.bairro}` : '',
          data.municipio ? `, ${data.municipio}` : '',
          data.uf ? ` - ${data.uf}` : '',
          data.cep ? `, CEP ${data.cep}` : '',
        ].filter(Boolean).join(' ').replace(/\s+,/g, ',').trim();

        const result: CnpjResult = {
          cnpj: digits,
          razaoSocial: data.razao_social,
          nomeFantasia: data.nome_fantasia,
          endereco: { logradouro: enderecoStr },
          telefone: data.ddd_telefone_1 || data.ddd_telefone_2 || undefined,
          email: data.email || undefined,
        };
        return result;
      }
      // Fallback: Supabase RPC (cache / mock)
      const cached = await getCnpjData(digits);
      return cached as CnpjResult;
    } catch (e: any) {
      // Em alguns navegadores (Android/Chrome) uma violação de CSP/Network
      // causa exceção em fetch. Tentar fallback via RPC antes de falhar.
      try {
        const cached = await getCnpjData(digits);
        if (cached) return cached as CnpjResult;
      } catch {}
      useUIStore.getState().pushToast({ title: 'Erro CNPJ', message: e?.message || 'Falha ao consultar CNPJ', variant: 'danger' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { lookup, loading };
}