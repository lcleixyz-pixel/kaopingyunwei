import { useCallback, useState } from 'react';

interface ConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'default' | 'danger' | 'warning';
  inputLabel?: string;
  inputPlaceholder?: string;
  inputRequired?: boolean;
}

type PendingConfirm = ConfirmOptions & {
  resolve: (value: boolean | string | null) => void;
};

const confirmButtonClass: Record<NonNullable<ConfirmOptions['tone']>, string> = {
  default: 'bg-blue-600 hover:bg-blue-700 text-white',
  warning: 'bg-amber-600 hover:bg-amber-700 text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
};

export function useConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [inputValue, setInputValue] = useState('');

  const open = useCallback((options: ConfirmOptions) => {
    setInputValue('');
    return new Promise<boolean | string | null>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const confirm = useCallback(async (options: ConfirmOptions): Promise<boolean> => {
    return (await open(options)) === true;
  }, [open]);

  const prompt = useCallback(async (options: ConfirmOptions): Promise<string | null> => {
    const result = await open({ ...options, inputRequired: options.inputRequired ?? true });
    return typeof result === 'string' ? result : null;
  }, [open]);

  const close = (value: boolean | string | null) => {
    if (!pending) return;
    pending.resolve(value);
    setPending(null);
    setInputValue('');
  };

  const dialog = pending ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 id="confirm-dialog-title" className="text-lg font-bold text-slate-900">{pending.title}</h3>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{pending.description}</p>
        {pending.inputLabel && (
          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">{pending.inputLabel}</span>
            <textarea
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder={pending.inputPlaceholder}
              className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </label>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => close(null)}
          >
            {pending.cancelText || '取消'}
          </button>
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${confirmButtonClass[pending.tone || 'default']}`}
            disabled={Boolean(pending.inputLabel && pending.inputRequired && !inputValue.trim())}
            onClick={() => close(pending.inputLabel ? inputValue.trim() : true)}
          >
            {pending.confirmText || '确认'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, prompt, confirmDialog: dialog };
}
