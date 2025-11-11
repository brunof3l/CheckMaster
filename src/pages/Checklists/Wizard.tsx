import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Wizard } from '../../components/Wizard';
import imageCompression from 'browser-image-compression';
import { useState } from 'react';

const schema = z.object({
  plateId: z.string().min(1),
  odometer: z.number().min(0),
  supplierId: z.string().min(1),
  responsible: z.string().min(1),
  notes: z.string().optional(),
  defectItems: z.array(z.object({ itemId: z.string(), name: z.string(), note: z.string().optional() })).default([]),
  media: z.array(z.instanceof(File)).default([]),
  budget: z.object({ items: z.array(z.object({ desc: z.string(), qty: z.number(), unitPrice: z.number() })).default([]), total: z.number().default(0), currency: z.literal('BRL') }).default({ items: [], total: 0, currency: 'BRL' }),
  fuelGas: z.object({ entries: z.array(z.object({ qty: z.number(), unit: z.enum(['kg','L']), at: z.string(), note: z.string().optional() })).default([]), exits: z.array(z.object({ qty: z.number(), unit: z.enum(['kg','L']), at: z.string(), note: z.string().optional() })).default([]) }).default({ entries: [], exits: [] })
});
type FormData = z.infer<typeof schema>;

export function ChecklistWizard({ mode }: { mode: 'new' | 'edit' }) {
  const { register, control, handleSubmit, setValue, watch } = useForm<FormData>({ resolver: zodResolver(schema) });
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const onFinish = handleSubmit(async (data) => {
    alert(`${mode === 'new' ? 'Checklist criado' : 'Checklist atualizado'}!`);
  });

  const Steps = [
    (
      <section className="space-y-2">
        <div className="text-xs text-gray-500">Seq. autogerada via Cloud Function ao salvar</div>
        <select {...register('plateId')} className="w-full border rounded px-3 py-2">
          <option value="">Placa</option>
          <option value="veh_1">ABC1D23</option>
        </select>
        <input {...register('odometer', { valueAsNumber: true })} type="number" className="w-full border rounded px-3 py-2" placeholder="KM" />
        <input {...register('supplierId')} className="w-full border rounded px-3 py-2" placeholder="Fornecedor (autocomplete)" />
        <input {...register('responsible')} className="w-full border rounded px-3 py-2" placeholder="Responsável" />
        <textarea {...register('notes')} className="w-full border rounded px-3 py-2" placeholder="Observações" />
      </section>
    ),
    (
      <section className="space-y-2">
        <div className="text-xs text-gray-500">Selecione itens com defeito</div>
        <div className="grid grid-cols-2 gap-2">
          {['Freio','Pneu','Luz','Óleo'].map((name, idx) => (
            <label key={idx} className="border rounded px-3 py-2 flex items-center gap-2">
              <input type="checkbox" onChange={(e) => {
                const arr = watch('defectItems');
                if (e.target.checked) setValue('defectItems', [...arr, { itemId: `item_${idx}`, name }]);
                else setValue('defectItems', arr.filter(x => x.itemId !== `item_${idx}`));
              }} />
              <span>{name}</span>
            </label>
          ))}
        </div>
      </section>
    ),
    (
      <section className="space-y-2">
        <Controller control={control} name="media" render={({ field }) => (
          <input type="file" accept="image/*" capture="environment" multiple onChange={async (e) => {
            const files = Array.from(e.target.files || []);
            const compressed: File[] = [];
            for (const f of files) {
              const c = await imageCompression(f, { maxSizeMB: 0.8, maxWidthOrHeight: 1600, useWebWorker: true });
              compressed.push(c as File);
            }
            field.onChange(compressed);
          }} />
        )} />
        {watch('media')?.length ? (
          <div className="grid grid-cols-3 gap-2">
            {watch('media').map((f, i) => (
              <div key={i} className="text-xs">{(f as any).name}</div>
            ))}
          </div>
        ) : null}
        {uploadProgress > 0 && <div className="text-xs">Upload: {uploadProgress}%</div>}
      </section>
    ),
    (
      <section className="space-y-2">
        <div className="text-sm font-semibold">Orçamento</div>
        <div className="grid grid-cols-3 gap-2">
          <input className="border rounded px-2 py-1" placeholder="Descrição" />
          <input className="border rounded px-2 py-1" placeholder="Qtd" />
          <input className="border rounded px-2 py-1" placeholder="Unitário (BRL)" />
        </div>
        <div className="text-sm font-semibold">Gás/Combustível</div>
        <div className="grid grid-cols-2 gap-2">
          <input className="border rounded px-2 py-1" placeholder="Entrada (kg|L)" />
          <input className="border rounded px-2 py-1" placeholder="Saída (kg|L)" />
        </div>
      </section>
    )
  ];

  return (
    <div className="py-3">
      <Wizard steps={Steps} onFinish={onFinish} />
    </div>
  );
}