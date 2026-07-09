import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FiAlertTriangle, FiHelpCircle, FiInfo } from 'react-icons/fi';

type AlertOptions = { title?: string; message: string; okLabel?: string };
type ConfirmOptions = { title?: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type PromptOptions = {
  title?: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  inputType?: 'text' | 'number' | 'month';
  min?: number;
  confirmLabel?: string;
  cancelLabel?: string;
  required?: boolean;
};

type DialogRequest =
  | ({ kind: 'alert' } & AlertOptions & { resolve: (value: void) => void })
  | ({ kind: 'confirm' } & ConfirmOptions & { resolve: (value: boolean) => void })
  | ({ kind: 'prompt' } & PromptOptions & { resolve: (value: string | null) => void });

type DialogContextValue = {
  alert: (options: AlertOptions | string) => Promise<void>;
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  prompt: (options: PromptOptions | string) => Promise<string | null>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) throw new Error('useDialog must be used within DialogProvider');
  return context;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [request, setRequest] = useState<DialogRequest | null>(null);

  const alert = useCallback((options: AlertOptions | string) => {
    const opts = typeof options === 'string' ? { message: options } : options;
    return new Promise<void>(resolve => setRequest({ kind: 'alert', ...opts, resolve }));
  }, []);

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const opts = typeof options === 'string' ? { message: options } : options;
    return new Promise<boolean>(resolve => setRequest({ kind: 'confirm', ...opts, resolve }));
  }, []);

  const prompt = useCallback((options: PromptOptions | string) => {
    const opts = typeof options === 'string' ? { message: options } : options;
    return new Promise<string | null>(resolve => setRequest({ kind: 'prompt', ...opts, resolve }));
  }, []);

  const value = useMemo(() => ({ alert, confirm, prompt }), [alert, confirm, prompt]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      {request ? <DialogHost request={request} onClose={() => setRequest(null)} t={t} /> : null}
    </DialogContext.Provider>
  );
}

function DialogHost({ request, onClose, t }: { request: DialogRequest; onClose: () => void; t: ReturnType<typeof useTranslation>['t'] }) {
  const [value, setValue] = useState(request.kind === 'prompt' ? (request.defaultValue ?? '') : '');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isPrompt = request.kind === 'prompt';
  const canConfirm = !isPrompt || !request.required || value.trim().length > 0;

  function settle(result: boolean | string | null) {
    if (request.kind === 'alert') request.resolve();
    else if (request.kind === 'confirm') request.resolve(Boolean(result));
    else request.resolve(typeof result === 'string' ? result : null);
    onClose();
  }

  function handleConfirm() {
    if (request.kind === 'prompt') {
      if (!canConfirm) return;
      settle(value);
    } else if (request.kind === 'confirm') {
      settle(true);
    } else {
      settle(null);
    }
  }

  function handleCancel() {
    if (request.kind === 'confirm') settle(false);
    else settle(null);
  }

  const icon = request.kind === 'alert' ? <FiInfo className="h-5 w-5" /> : request.kind === 'confirm' ? <FiAlertTriangle className="h-5 w-5" /> : <FiHelpCircle className="h-5 w-5" />;
  const tone = request.kind === 'confirm' && request.danger ? 'bg-danger-bg text-danger' : 'bg-primary/10 text-primary';

  return (
    <div
      className="fixed inset-0 z-[190] grid place-items-center bg-background-overlay/72 px-3 backdrop-blur-[3px]"
      onMouseDown={event => {
        if (event.target === event.currentTarget) handleCancel();
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') handleCancel();
        if (event.key === 'Enter' && (request.kind !== 'prompt' || request.inputType !== 'text')) handleConfirm();
      }}
    >
      <section role="dialog" aria-modal="true" className="w-full max-w-[420px] rounded-[28px] bg-surface-card p-5 shadow-[0_40px_110px_-42px_rgba(15,23,42,0.62)] ring-1 ring-border-soft/55">
        <div className="flex items-start gap-4">
          <span className={['inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', tone].join(' ')}>{icon}</span>
          <div className="min-w-0 flex-1">
            {request.title ? <h3 className="m-0 font-display text-xl font-extrabold text-text-primary">{request.title}</h3> : null}
            {request.kind !== 'prompt' || request.message ? (
              <p className={['text-sm leading-6 text-text-secondary', request.title ? 'mt-2' : 'mt-1'].join(' ')}>{request.message}</p>
            ) : null}
            {request.kind === 'prompt' ? (
              <input
                ref={inputRef}
                autoFocus
                type={request.inputType ?? 'text'}
                min={request.min}
                value={value}
                placeholder={request.placeholder}
                onChange={event => setValue(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleConfirm();
                  }
                }}
                className="mt-3 h-11 w-full rounded-xl border border-border-soft/60 bg-surface-subtle px-3 text-sm font-medium text-text-primary outline-none transition duration-fast focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            ) : null}
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl bg-surface-subtle px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-muted hover:text-text-primary" onClick={handleCancel}>
            {request.kind === 'alert' ? (request.okLabel ?? t('common.close')) : (request.cancelLabel ?? t('common.cancel'))}
          </button>
          {request.kind !== 'alert' ? (
            <button
              disabled={!canConfirm}
              className={[
                'inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50',
                request.kind === 'confirm' && request.danger ? 'bg-danger hover:opacity-90' : 'bg-primary hover:opacity-90',
              ].join(' ')}
              onClick={handleConfirm}
            >
              {request.kind === 'confirm' ? (request.confirmLabel ?? t('common.confirm')) : (request.confirmLabel ?? t('common.save'))}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
