import React from 'react';

type BadgeProps = { children: React.ReactNode; variant?: 'success' | 'warning' | 'danger' | 'info' } & React.HTMLAttributes<HTMLSpanElement>;

export function Badge({ children, variant = 'info', className = '', ...rest }: BadgeProps) {
  const cls = [
    'cm-badge',
    variant === 'success' && 'cm-badge-success',
    variant === 'warning' && 'cm-badge-warning',
    variant === 'danger' && 'cm-badge-danger',
    variant === 'info' && 'cm-badge-info',
    className
  ].filter(Boolean).join(' ');
  return <span className={cls} {...rest}>{children}</span>;
}