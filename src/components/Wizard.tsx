import { useState } from 'react';
import { Button } from './ui/Button';

export function Wizard({ steps, onFinish, busy }: { steps: React.ReactNode[]; onFinish: () => void; busy?: boolean }) {
  const [index, setIndex] = useState(0);
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;
  return (
    <div>
      <div className="flex gap-1 mb-3">
        {steps.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded ${i <= index ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`} />
        ))}
      </div>
      <div>{steps[index]}</div>
      <div className="mt-3">
        <div className="flex gap-2">
          <Button className="flex-1" size="md" variant="outline" disabled={isFirst || !!busy} onClick={() => setIndex(i => i - 1)}>Voltar</Button>
          {isLast ? (
            <Button className="flex-1" size="md" onClick={onFinish} disabled={!!busy}>{busy ? 'Finalizando…' : 'Finalizar'}</Button>
          ) : (
            <Button className="flex-1" size="md" onClick={() => setIndex(i => i + 1)} disabled={!!busy}>Avançar</Button>
          )}
        </div>
      </div>
    </div>
  );
}