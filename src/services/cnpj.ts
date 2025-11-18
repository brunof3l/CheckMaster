import { useState } from 'react';
import { useUIStore } from '../stores/ui';
import { getCnpjData } from './supabase/rpc';
import { supabase } from '../config/supabase';

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
      // 1) Preferir proxy via Supabase Edge Function (consistente em Android/iOS)
      try {
        const { data: proxied, error } = await supabase.functions.invoke('cnpj-proxy', { body: { cnpj: digits } });
        if (!error && proxied) {
          return proxied as CnpjResult;
        }
      } catch {}

      // 2) Tentar BrasilAPI diretamente (em dev pode ser suficiente)
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

      // 3) Fallback final: Supabase RPC (cache/mock do servidor)
      const cached = await getCnpjData(digits);
      return cached as CnpjResult;
    } catch (e: any) {
      // Em caso de erro geral, ainda tentar o fallback RPC e evitar toasts duplicados.
      try {
        const cached = await getCnpjData(digits);
        if (cached) return cached as CnpjResult;
      } catch {}
      // Registrar no console para diagnóstico sem poluir UI com toasts duplicados
      console.warn('CNPJ lookup falhou:', e?.message || e);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { lookup, loading };
}