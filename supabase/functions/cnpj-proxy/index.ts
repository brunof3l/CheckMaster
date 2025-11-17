// Supabase Edge Function: CNPJ proxy via BrasilAPI
// Fetches CNPJ data and returns a minimal, unified shape with CORS enabled.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

type CnpjResult = {
  cnpj: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  endereco?: { logradouro?: string };
  telefone?: string | null;
  email?: string | null;
};

function onlyDigits(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

function corsHeaders(origin?: string) {
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": origin || "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
  } as Record<string, string>;
}

serve(async (req) => {
  const url = new URL(req.url);
  const origin = req.headers.get("origin") ?? undefined;
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) });
  }
  try {
    let cnpj = url.searchParams.get("cnpj") || null;
    if (!cnpj && req.method === "POST") {
      try { const body = await req.json(); cnpj = body?.cnpj ?? null; } catch {}
    }
    const digits = onlyDigits(cnpj);
    if (digits.length !== 14) {
      return new Response(JSON.stringify({ error: "invalid_cnpj" }), { status: 400, headers: corsHeaders(origin) });
    }
    const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    if (!resp.ok) {
      const text = await resp.text();
      return new Response(JSON.stringify({ error: "upstream_error", status: resp.status, message: text }), { status: 502, headers: corsHeaders(origin) });
    }
    const data = await resp.json();
    const enderecoStr = [
      data.descricao_tipo_de_logradouro,
      data.logradouro,
      data.numero ? `, ${data.numero}` : "",
      data.bairro ? ` - ${data.bairro}` : "",
      data.municipio ? `, ${data.municipio}` : "",
      data.uf ? ` - ${data.uf}` : "",
      data.cep ? `, CEP ${data.cep}` : "",
    ].filter(Boolean).join(" ").replace(/\s+,/g, ",").trim();

    const result: CnpjResult = {
      cnpj: digits,
      razaoSocial: data.razao_social,
      nomeFantasia: data.nome_fantasia,
      endereco: { logradouro: enderecoStr },
      telefone: data.ddd_telefone_1 || data.ddd_telefone_2 || null,
      email: data.email || null,
    };
    return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders(origin) });
  } catch (e) {
    return new Response(JSON.stringify({ error: "internal_error", message: String(e?.message || e) }), { status: 500, headers: corsHeaders(undefined) });
  }
});