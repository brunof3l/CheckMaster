import React from 'react';

type CardProps = React.PropsWithChildren<{ className?: string; title?: string; actions?: React.ReactNode }>;

export function Card({ className = '', title, actions, children }: CardProps) {
  return (
    <div className={["cm-card", "animate-fade-in", className].filter(Boolean).join(' ')}>
      {(title || actions) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h3 className="text-sm font-semibold">{title}</h3>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}