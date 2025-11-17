import React from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  suffixNode?: React.ReactNode;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', suffixNode, ...rest }, ref) => {
    return (
      <div className="cm-field">
        {label && <label className="cm-label">{label}</label>}
        <div className="relative">
          <input ref={ref} className={["cm-input pr-9", className].join(' ')} {...rest} />
          {suffixNode && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
              {suffixNode}
            </div>
          )}
        </div>
        {error && <p className="cm-error">{error}</p>}
      </div>
    );
  }
);