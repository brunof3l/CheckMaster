import { useState } from 'react';

export function Wizard({ steps, onFinish }: { steps: React.ReactNode[]; onFinish: () => void }) {
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
      <div className="fixed bottom-16 inset-x-0 p-3 bg-gradient-to-t from-white dark:from-brand">
        <div className="container-m flex gap-2">
          <button className="flex-1 py-2 border rounded" disabled={isFirst} onClick={() => setIndex(i => i - 1)}>Voltar</button>
          {isLast ? (
            <button className="flex-1 py-2 border rounded bg-blue-600 text-white" onClick={onFinish}>Finalizar</button>
          ) : (
            <button className="flex-1 py-2 border rounded bg-blue-600 text-white" onClick={() => setIndex(i => i + 1)}>Avançar</button>
          )}
        </div>
      </div>
    </div>
  );
}