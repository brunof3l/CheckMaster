import { useForm } from 'react-hook-form';

export function ChecklistsList() {
  const { register } = useForm();
  return (
    <div className="space-y-3 py-3">
      <div className="grid grid-cols-2 gap-2">
        <input {...register('plate')} className="border rounded px-3 py-2" placeholder="Placa" />
        <input {...register('supplier')} className="border rounded px-3 py-2" placeholder="Fornecedor" />
        <select {...register('status')} className="border rounded px-3 py-2">
          <option value="">Status</option>
          <option value="rascunho">Rascunho</option>
          <option value="em_andamento">Em andamento</option>
          <option value="finalizado">Finalizado</option>
        </select>
        <input {...register('date')} type="date" className="border rounded px-3 py-2" />
      </div>
      <div className="text-xs text-gray-500">Paginação e filtros serão aplicados via Firestore com índices.</div>
      <ul className="divide-y">
        {[1,2,3].map(i => (
          <li key={i} className="py-2">CHK-00000{i} • ABC1{i}23 • Fornecedor {i} • rascunho</li>
        ))}
      </ul>
    </div>
  );
}