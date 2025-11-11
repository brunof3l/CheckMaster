import { useForm } from 'react-hook-form';

export function VehiclesPage() {
  const { register } = useForm();
  return (
    <div className="space-y-3 py-3">
      <div className="text-sm font-semibold">Cadastrar veículo</div>
      <div className="grid grid-cols-2 gap-2">
        <input {...register('plate')} className="border rounded px-3 py-2" placeholder="Placa (única)" />
        <input {...register('model')} className="border rounded px-3 py-2" placeholder="Modelo" />
        <input {...register('brand')} className="border rounded px-3 py-2" placeholder="Marca" />
        <input {...register('year')} type="number" className="border rounded px-3 py-2" placeholder="Ano" />
        <input {...register('color')} className="border rounded px-3 py-2" placeholder="Cor" />
      </div>
      <button className="py-2 px-3 border rounded">Salvar</button>
      <div className="text-xs text-gray-500">CRUD completo será conectado ao Firestore.</div>
    </div>
  );
}