import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'success' | 'warning' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
};

export function Button({ variant = 'primary', size = 'md', block, className = '', children, ...rest }: ButtonProps) {
  const cls = [
    'cm-btn',
    'fx-push',
    size === 'sm' ? 'cm-btn-sm' : size === 'lg' ? 'cm-btn-lg' : 'cm-btn-md',
    variant === 'primary' && 'cm-btn-primary',
    variant === 'outline' && 'cm-btn-outline',
    variant === 'success' && 'cm-btn-success',
    variant === 'warning' && 'cm-btn-warning',
    variant === 'danger' && 'cm-btn-danger',
    variant === 'ghost' && 'cm-btn-ghost',
    block && 'cm-btn-block',
    className
  ].filter(Boolean).join(' ');
  return (
    <button className={cls} {...rest}>{children}</button>
  );
}