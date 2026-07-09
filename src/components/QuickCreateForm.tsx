import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';
import type { ResourceField } from './ApiResourceManager';
import { Dropdown, DatePicker, type DropdownOption } from './FormControls';
import { useToast } from './ToastProvider';

const inputClass = 'h-11 w-full rounded-xl border border-border-soft bg-surface-card px-3 text-sm text-text-primary outline-none focus:border-primary/50';

/** Generic create-only form driven by the same field definitions used in the
 *  admin Operations panel (data/resource-config.ts), for embedding a "quick add"
 *  action directly on a polished page (e.g. adding a delivery from the Clients page). */
export function QuickCreateForm({ resource, fields, extraPayload, defaults, onSaved, onCancel, submitLabel }: {
  resource: string;
  fields: ResourceField[];
  extraPayload?: Record<string, unknown>;
  defaults?: Record<string, string>;
  onSaved: () => void;
  onCancel: () => void;
  submitLabel?: string;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const visibleFields = fields.filter(field => !field.readOnly && !(extraPayload && field.name in extraPayload));
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(visibleFields.map(field => [field.name, defaults?.[field.name] ?? ''])));
  const [lookups, setLookups] = useState<Record<string, DropdownOption[]>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const lookupFields = visibleFields.filter(field => field.lookup);
    if (!lookupFields.length) return;
    let cancelled = false;
    void Promise.all(lookupFields.map(field =>
      api.list<Record<string, unknown>>(field.lookup!.resource).then(rows => [
        field.name,
        rows.map(row => ({
          value: String(row.id),
          label: field.lookup!.secondary ? `${String(row[field.lookup!.label])} · ${String(row[field.lookup!.secondary])}` : String(row[field.lookup!.label]),
        })),
      ] as const),
    )).then(entries => { if (!cancelled) setLookups(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource]);

  function setValue(name: string, value: string) {
    setValues(current => ({ ...current, [name]: value }));
  }

  async function handleSubmit() {
    const missing = visibleFields.find(field => field.required && !values[field.name]);
    if (missing) {
      toast(t('admin.ui.requiredFieldsMissing'), 'danger');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...extraPayload };
      visibleFields.forEach(field => {
        const value = values[field.name];
        payload[field.name] = value === '' && field.nullable ? null : value;
      });
      await api.create(resource, payload);
      toast(t('admin.ui.savedOk'), 'success');
      onSaved();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : t('admin.ui.requestFailed'), 'danger');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-3">
      {visibleFields.map(field => (
        <label key={field.name} className="grid gap-1.5 text-sm font-bold text-text-secondary">
          {t(field.label)}
          {field.type === 'select' || field.lookup ? (
            <Dropdown
              value={values[field.name]}
              onChange={value => setValue(field.name, value)}
              required={field.required}
              options={field.options ? field.options.map(option => ({ value: option.value, label: t(option.label) })) : lookups[field.name] ?? []}
            />
          ) : field.type === 'date' || field.type === 'datetime-local' ? (
            <DatePicker value={values[field.name]} onChange={value => setValue(field.name, value)} type={field.type} />
          ) : field.type === 'textarea' ? (
            <textarea value={values[field.name]} onChange={event => setValue(field.name, event.target.value)} className={`${inputClass} min-h-20 py-3`} />
          ) : field.type === 'checkbox' ? (
            <input type="checkbox" checked={values[field.name] === 'true'} onChange={event => setValue(field.name, String(event.target.checked))} className="h-5 w-5" />
          ) : (
            <input type={field.type || 'text'} step={field.step} value={values[field.name]} onChange={event => setValue(field.name, event.target.value)} className={inputClass} />
          )}
        </label>
      ))}
      <div className="mt-1 flex gap-2">
        <button type="button" className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-surface-subtle text-sm font-semibold text-text-secondary transition hover:bg-surface-muted" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button type="button" disabled={saving} className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50" onClick={() => void handleSubmit()}>
          {saving ? t('common.loading') : (submitLabel ?? t('common.save'))}
        </button>
      </div>
    </div>
  );
}
