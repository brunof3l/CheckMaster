import React from 'react';

type StepperProps = { steps: string[]; current: number };

export function Stepper({ steps, current }: StepperProps) {
  return (
    <div className="cm-steps">
      {steps.map((s, i) => (
        <div key={i} className={["cm-step", i === current ? 'cm-step-active' : ''].join(' ')}>
          <span className="font-semibold">{i + 1}</span>
          <span>{s}</span>
        </div>
      ))}
    </div>
  );
}