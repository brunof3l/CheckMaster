import { useForm } from 'react-hook-form';
import { useCnpjService } from '../services/cnpj';

export function SuppliersPage() {
  const { register, watch, setValue } = useForm();
  const cnpj = watch('cnpj') || '';
  const { lookup, loading } = useCnpjService();
  const handleLookup = async () => {
    const data = await lookup(cnpj);
    if (data) {
      setValue('razaoSocial', data.razaoSocial);
      setValue('nomeFantasia', data.nomeFantasia);
      setValue('endereco', data.endereco?.logradouro);
    }
  };
  return (
    <div className="space-y-3 py-3">
      <div className="grid grid-cols-2 gap-2">
        <input {...register('cnpj')} className="border rounded px-3 py-2" placeholder="CNPJ" />
        <button className="py-2 border rounded" onClick={handleLookup} disabled={loading}>Preencher via CNPJ</button>
      </div>
      <input {...register('razaoSocial')} className="border rounded px-3 py-2" placeholder="Razão Social" />
      <input {...register('nomeFantasia')} className="border rounded px-3 py-2" placeholder="Nome Fantasia" />
      <input {...register('endereco')} className="border rounded px-3 py-2" placeholder="Endereço" />
      <button className="py-2 px-3 border rounded">Salvar</button>
      <div className="text-xs text-gray-500">Validação, máscaras e autocomplete serão conectados ao Firestore/CF.</div>
    </div>
  );
}