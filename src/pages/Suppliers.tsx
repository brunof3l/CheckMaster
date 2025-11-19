import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useCnpjService } from '../services/cnpj';
import { listSuppliers, insertSupplier } from '../services/supabase/db';
import { Store, Save } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useUIStore } from '../stores/ui';

export function SuppliersPage() {
  const { register, watch, setValue, handleSubmit, reset } = useForm();
  const location = useLocation();
  const nav = useNavigate();
  const cnpj = watch('cnpj') || '';
  const { lookup, loading } = useCnpjService();
  const [items, setItems] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [lastLookedCnpj, setLastLookedCnpj] = useState<string>('');
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const pushToast = useUIStore(s => s.pushToast);
  const handleLookup = async () => {
    const data = await lookup(cnpj);
    if (data) {
      setValue('razaoSocial', data.razaoSocial || '');
      setValue('nomeFantasia', data.nomeFantasia || '');
      setValue('endereco', data.endereco?.logradouro || '');
      if (data.telefone) setValue('telefone', data.telefone);
      if (data.email) setValue('email', data.email);
      setLastLookedCnpj((cnpj || '').replace(/\D/g, ''));
      pushToast({ title: 'Dados preenchidos', message: 'Importados via CNPJ.', variant: 'info' });
    } else {
      pushToast({ title: 'CNPJ não encontrado', message: 'Verifique o número informado.', variant: 'warning' });
    }
  };
  const fetchList = async () => {
    setListLoading(true);
    try {
      const { data, error } = await listSuppliers();
      if (error) throw error;
      setItems(data || []);
    } catch (e: any) { pushToast({ title: 'Erro ao carregar', message: e.message, variant: 'danger' }); } finally { setListLoading(false); }
  };
  useEffect(() => { fetchList(); }, []);
  // Prefill from navigation state (coming from Wizard)
  useEffect(() => {
    const state: any = location.state || {};
    if (state?.suggestedName) {
      setValue('razaoSocial', state.suggestedName);
      setValue('nomeFantasia', state.suggestedName);
    }
  }, [location.state]);
  // Auto lookup when CNPJ is válido (14 dígitos) e ainda não consultado
  useEffect(() => {
    const digits = (cnpj || '').replace(/\D/g, '');
    if (digits.length === 14 && digits !== lastLookedCnpj && !loading) {
      handleLookup();
    }
  }, [cnpj]);
  const onSubmit = handleSubmit(async (data: any) => {
    try {
      const nomeFinal = (data.nomeFantasia || data.razaoSocial || '').trim();
      const razaoFinal = (data.razaoSocial || data.nomeFantasia || '').trim();
      if (!nomeFinal && !razaoFinal) {
        pushToast({ title: 'Nome obrigatório', message: 'Informe Razão Social ou Nome Fantasia.', variant: 'warning' });
        return;
      }
      const { data: created, error } = await insertSupplier({
        cnpj: data.cnpj,
        razaoSocial: razaoFinal,
        nome: nomeFinal,
        telefone: data.telefone,
        email: data.email,
      } as any);
      if (error) throw error;
      reset();
      fetchList();
      pushToast({ title: 'Fornecedor salvo', message: 'Cadastro realizado com sucesso.', variant: 'success' });
      // If coming from Wizard, return back with the created supplier
      const state: any = location.state || {};
      if (state?.returnTo) {
        const createdName = (created as any)?.nome || (created as any)?.razaoSocial || (created as any)?.razaosocial || '';
        nav(state.returnTo, { state: { selectedSupplierId: (created as any)?.id, selectedSupplierName: createdName } });
      }
    } catch (e: any) { pushToast({ title: 'Erro ao salvar', message: e.message, variant: 'danger' }); }
  });
  const getSupplierName = (s: any) => {
    const candidates = [s.nome, s.razaosocial, s.razaoSocial, s.razao_social, s.name, s.nomeFantasia, s['nome_fantasia']];
    for (const v of candidates) {
      if (typeof v === 'string' && v.trim().length) return v.trim();
    }
    return '';
  };
  const toWhatsLink = (tel: any) => {
    const digits = String(tel || '').replace(/\D/g, '');
    if (!digits) return '';
    const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
    return `https://wa.me/${withCountry}`;
  };
  return (
    <div className="space-y-3 py-3">
      <Card title={<span className="inline-flex items-center gap-2"><Store size={16} /> Cadastrar fornecedor</span> as any}>
        <form onSubmit={onSubmit} className="space-y-2">
          <Input {...register('cnpj')} placeholder="CNPJ" label="CNPJ" />
          <Input {...register('razaoSocial')} placeholder="Razão Social" label="Razão Social" />
          <Input {...register('nomeFantasia')} placeholder="Nome Fantasia" label="Nome Fantasia" />
          <Input {...register('endereco')} placeholder="Endereço" label="Endereço" />
          <div className="grid grid-cols-2 gap-2">
            <Input {...register('telefone')} placeholder="Telefone" label="Telefone" />
            <Input {...register('email')} placeholder="E-mail" label="E-mail" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input {...register('responsavel')} placeholder="Responsável" label="Responsável" />
            <Input {...register('observacoes')} placeholder="Observações" label="Observações" />
          </div>
          <Button type="submit"><span className="inline-flex items-center gap-2"><Save size={16} /> Salvar</span></Button>
        </form>
      </Card>
      <Card title="Fornecedores">
        {listLoading ? <div className="cm-skeleton h-8" /> : (
          items.length ? (
            (() => {
              const q = query.trim().toLowerCase();
              const filtered = items.filter(s => {
                if (!q) return true;
                const name = String(getSupplierName(s) || '').toLowerCase();
                const cnpj = String(s.cnpj || '').toLowerCase();
                const tel = String(s.telefone || '').toLowerCase();
                return name.includes(q) || cnpj.includes(q) || tel.includes(q);
              });
              const visible = filtered.slice(0, showAll ? filtered.length : 5);
              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      className="cm-input text-xs"
                      placeholder="Filtrar por nome, CNPJ ou telefone"
                    />
                    <div className="text-xs text-gray-500">{showAll ? `Exibindo todos (${filtered.length})` : `Exibindo primeiros 5 de ${filtered.length}`}</div>
                    <Button size="sm" variant="outline" onClick={() => setShowAll(s => !s)}>
                      {showAll ? 'Mostrar menos' : 'Mostrar todos'}
                    </Button>
                  </div>
                  <ul className="divide-y">
                    {visible.map(s => (
                      <li key={s.id} className="py-2 text-xs">
                        {getSupplierName(s) || 'Sem nome'} • {(s.cnpj || '—')}{s.telefone ? (
                          <>
                            {' • '}
                            <a href={toWhatsLink(s.telefone)} target="_blank" rel="noreferrer" title="Abrir no WhatsApp">
                              {String(s.telefone)}
                            </a>
                          </>
                        ) : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()
          ) : <div className="text-xs text-gray-500">Sem fornecedores cadastrados.</div>
        )}
      </Card>
    </div>
  );
}