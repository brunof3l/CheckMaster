import { useUIStore } from '../../stores/ui';
import { Button } from './Button';

export function ToastContainer() {
  const toasts = useUIStore(s => s.toasts);
  const dismiss = useUIStore(s => s.dismissToast);
  return (
    <div className="cm-toast-container">
      {toasts.map(t => {
        const borderColor = t.variant === 'success' ? 'var(--cm-success)'
          : t.variant === 'warning' ? 'var(--cm-warning)'
          : t.variant === 'danger' ? 'var(--cm-danger)'
          : t.variant === 'info' ? 'var(--cm-info)'
          : 'transparent';
        return (
          <div key={t.id} className="cm-toast border-l-4" style={{ borderLeftColor: borderColor }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                {t.title && <div className="cm-toast-title">{t.title}</div>}
                <div className="cm-toast-message">{t.message}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => dismiss(t.id)}>Fechar</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}