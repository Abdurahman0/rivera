import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi';

type ToastTone = 'success' | 'danger' | 'info';
type Toast = { id: number; message: string; tone: ToastTone };

type ToastContextValue = {
  toast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

const TONE_STYLES: Record<ToastTone, { ring: string; bg: string; text: string; icon: ReactNode }> = {
  success: { ring: 'ring-success/20', bg: 'bg-success-bg', text: 'text-success', icon: <FiCheckCircle className="h-4 w-4" /> },
  danger: { ring: 'ring-danger/20', bg: 'bg-danger-bg', text: 'text-danger', icon: <FiAlertTriangle className="h-4 w-4" /> },
  info: { ring: 'ring-primary/20', bg: 'bg-primary/10', text: 'text-primary', icon: <FiInfo className="h-4 w-4" /> },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts(current => current.filter(item => item.id !== id));
  }, []);

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = nextId.current++;
    setToasts(current => [...current, { id, message, tone }]);
    window.setTimeout(() => dismiss(id), 3500);
  }, [dismiss]);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[200] flex flex-col items-center gap-2 px-3 sm:items-end sm:px-6">
        {toasts.map(item => {
          const style = TONE_STYLES[item.tone];
          return (
            <div
              key={item.id}
              className={['pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl p-4 text-sm font-semibold shadow-[0_24px_60px_-24px_rgba(15,23,42,0.55)] ring-1 backdrop-blur-xl', style.bg, style.text, style.ring].join(' ')}
            >
              <span className="mt-0.5 shrink-0">{style.icon}</span>
              <span className="flex-1">{item.message}</span>
              <button type="button" className="shrink-0 opacity-60 transition hover:opacity-100" onClick={() => dismiss(item.id)}>
                <FiX className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
