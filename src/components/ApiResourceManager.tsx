import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiArchive, FiDownload, FiEdit2, FiEye, FiPlus, FiRefreshCcw, FiRotateCcw, FiSearch, FiX } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { api } from '../api/client';
import { useDialog } from './DialogProvider';
import { useToast } from './ToastProvider';
import { Dropdown, DatePicker, TimePicker } from './FormControls';
import { formatDisplayDate, formatDisplayDateTime, translateBackendMessage, trimTrailingZeros } from '../utils/crm';

export type ResourceRow = Record<string, unknown> & { id: string | number; is_archived?: boolean };

export interface ResourceOption {
  value: string;
  label: string;
}

export interface ResourceField {
  name: string;
  /** Translation key (resolved via t()), not raw display text. */
  label: string;
  /** `month` renders "Iyul 2026" from an ISO date; `money` renders a thousands-separated UZS amount. */
  type?: 'text' | 'number' | 'date' | 'time' | 'datetime-local' | 'textarea' | 'select' | 'checkbox' | 'json' | 'file' | 'password' | 'month' | 'money';
  required?: boolean;
  nullable?: boolean;
  readOnly?: boolean;
  table?: boolean;
  step?: string;
  /** Option labels are also translation keys. */
  options?: ResourceOption[];
  /** `autofill` derives other field values (e.g. price, color) from the selected lookup
   *  row — fired once when the user picks a value, never overwriting on initial mount. */
  lookup?: { resource: string; label: string; secondary?: string; autofill?: (row: ResourceRow) => Record<string, string> };
  /** Recomputes sibling field values while the user types into this one (e.g. entering a
   *  per-piece time norm fills the hourly/daily/monthly norms). The patched fields remain
   *  plain inputs, so the user can still overwrite any derived value afterwards. */
  derive?: (value: string) => Record<string, string>;
}

export interface ResourceConfig {
  resource: string;
  /** Translation keys, not raw display text. */
  title: string;
  description: string;
  fields: ResourceField[];
  readOnly?: boolean;
  /** Set to false for create-only backend resources where the API rejects PATCH/PUT (edit button hidden, create still allowed). */
  allowEdit?: boolean;
  allowArchive?: boolean;
  allowExport?: boolean;
}

export interface ResourceAction {
  /** Translation key. */
  label: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
  show?: (row: ResourceRow) => boolean;
  run: (row: ResourceRow) => Promise<unknown>;
}

/** Safely renders a single validation-error value (string, nested object, or array
 *  of either) as text — never lets a stray object reach the UI as "[object Object]". */
function stringifyErrorValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(stringifyErrorValue).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.message === 'string') return record.message;
    return Object.values(record).map(stringifyErrorValue).filter(Boolean).join(', ');
  }
  return String(value);
}

function errorMessage(t: TFunction, error: unknown) {
  if (!(error instanceof Error)) return t('admin.ui.requestFailed');
  const details = (error as Error & { details?: unknown }).details;
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    const record = details as Record<string, unknown>;
    // A top-level `detail` (DRF/SimpleJWT auth & permission errors) is already the
    // full human-readable message — ignore sibling keys like `code`/`messages`.
    if (typeof record.detail === 'string') return translateBackendMessage(t, record.detail);
    const flattened = Object.entries(record)
      .map(([key, value]) => {
        const text = stringifyErrorValue(value);
        return text ? `${key}: ${text}` : '';
      })
      .filter(Boolean)
      .join(' · ');
    if (flattened) return flattened;
  }
  return translateBackendMessage(t, error.message || t('admin.ui.requestFailed'));
}

function rawDisplayValue(t: TFunction, value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? t('admin.ui.yes') : t('admin.ui.no');
  if (typeof value === 'object') return JSON.stringify(value);
  return trimTrailingZeros(String(value)).replaceAll('_', ' ');
}

function cellValue(t: TFunction, row: ResourceRow, field: ResourceField, lookups: Record<string, Map<string, string>>) {
  const lookupLabel = lookups[field.name]?.get(String(row[field.name]));
  if (lookupLabel) return lookupLabel;
  const matchingOption = field.options?.find(option => option.value === String(row[field.name]));
  if (matchingOption) return t(matchingOption.label);
  if (field.type === 'date' && row[field.name]) return formatDisplayDate(String(row[field.name]), t);
  if (field.type === 'datetime-local' && row[field.name]) return formatDisplayDateTime(String(row[field.name]), t);
  // Backend TimeFields serialize as "08:00:00" — the seconds are never meaningful here.
  if (field.type === 'time' && row[field.name]) return String(row[field.name]).slice(0, 5);
  if (field.type === 'month' && row[field.name]) {
    const [year, month] = String(row[field.name]).split('-').map(Number);
    if (year && month) return `${t(`common.months.${month - 1}`, { defaultValue: String(month) })} ${year}`;
  }
  if (field.type === 'money' && row[field.name] !== null && row[field.name] !== undefined && row[field.name] !== '') {
    const amount = Number(row[field.name]);
    if (!Number.isNaN(amount)) return `${amount.toLocaleString()} so'm`;
  }
  return rawDisplayValue(t, row[field.name]);
}

function fieldValue(row: ResourceRow | null, field: ResourceField) {
  const value = row?.[field.name];
  if (field.type === 'checkbox') return Boolean(value);
  if (field.type === 'json') return value ? JSON.stringify(value, null, 2) : '{}';
  if (field.type === 'datetime-local' && typeof value === 'string') return value.slice(0, 16);
  if (typeof value === 'string') return trimTrailingZeros(value);
  return value === null || value === undefined ? '' : String(value);
}

export function ApiResourceManager({ config, actions = [], headerActions, extraParams, fixedValues }: {
  config: ResourceConfig;
  actions?: ResourceAction[];
  headerActions?: Array<{ label: string; run: () => Promise<unknown> }>;
  /** Extra static query params merged into the list request, e.g. `{ client: clientId }` to scope this instance to one parent. */
  extraParams?: Record<string, string>;
  /** Values auto-injected on create/update and hidden from the form, matching `extraParams` (e.g. `{ client: clientId }`). */
  fixedValues?: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const { confirm } = useDialog();
  const { toast } = useToast();
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [lookups, setLookups] = useState<Record<string, Map<string, string>>>({});
  const [lookupRowsByResource, setLookupRowsByResource] = useState<Record<string, ResourceRow[]>>({});
  const [query, setQuery] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ResourceRow | 'new' | null>(null);
  const [viewing, setViewing] = useState<ResourceRow | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const title = t(config.title);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const lookupFields = config.fields.filter(field => field.lookup);
      const uniqueResources = [...new Set(lookupFields.map(field => field.lookup!.resource))];
      const [nextRows, ...lookupRows] = await Promise.all([
        api.list<ResourceRow>(config.resource, { include_archived: includeArchived || undefined, ...extraParams }),
        ...uniqueResources.map(resource => api.list<ResourceRow>(resource)),
      ]);
      const nextLookups: Record<string, Map<string, string>> = {};
      const nextLookupRowsByResource: Record<string, ResourceRow[]> = {};
      uniqueResources.forEach((resource, index) => {
        nextLookupRowsByResource[resource] = lookupRows[index];
        const matchingFields = lookupFields.filter(field => field.lookup!.resource === resource);
        matchingFields.forEach(field => {
          nextLookups[field.name] = new Map(lookupRows[index].map(row => {
            const primary = rawDisplayValue(t, row[field.lookup!.label]);
            const secondary = field.lookup!.secondary ? rawDisplayValue(t, row[field.lookup!.secondary!]) : '';
            return [String(row.id), secondary && secondary !== '—' ? `${primary} · ${secondary}` : primary];
          }));
        });
      });
      setRows(nextRows);
      setLookups(nextLookups);
      setLookupRowsByResource(nextLookupRowsByResource);
    } catch (requestError) {
      toast(errorMessage(t, requestError), 'danger');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, includeArchived, t, toast, JSON.stringify(extraParams)]);

  useEffect(() => { void load(); }, [load]);

  const tableFields = useMemo(() => {
    const explicit = config.fields.filter(field => field.table === true);
    return explicit.length ? explicit : config.fields.filter(field => field.table !== false && field.type !== 'file' && field.type !== 'password').slice(0, 5);
  }, [config]);

  const filteredRows = useMemo(() => {
    // The archived toggle switches the view entirely: unchecked shows only live rows
    // (the backend already excludes archived), checked shows only the archive.
    const scoped = includeArchived ? rows.filter(row => Boolean(row.is_archived)) : rows;
    const needle = query.trim().toLowerCase();
    if (!needle) return scoped;
    // Lookup columns store bare ids; searching must also match their resolved labels
    // (e.g. an employee's name), not just the raw row JSON.
    return scoped.filter(row => {
      const lookupText = Object.keys(lookups).map(name => lookups[name]?.get(String(row[name])) ?? '').join(' ');
      return `${JSON.stringify(row)} ${lookupText}`.toLowerCase().includes(needle);
    });
  }, [query, rows, includeArchived, lookups]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const usesHiddenControl = (field: ResourceField) => field.type === 'select' || field.type === 'date' || field.type === 'datetime-local' || Boolean(field.lookup);
    const missingField = config.fields.find(field => {
      if (!field.required || field.readOnly || !usesHiddenControl(field)) return false;
      const element = form.elements.namedItem(field.name) as HTMLInputElement | null;
      return !element?.value;
    });
    if (missingField) {
      toast(t('admin.ui.fieldRequired', { field: t(missingField.label) }), 'danger');
      return;
    }
    setSaving(true);
    try {
      const hasFile = config.fields.some(field => field.type === 'file' && (form.elements.namedItem(field.name) as HTMLInputElement | null)?.files?.length);
      let payload: Record<string, unknown> | FormData;
      if (hasFile) {
        payload = new FormData(form);
      } else {
        payload = {};
        for (const field of config.fields) {
          if (field.readOnly || field.type === 'file') continue;
          const element = form.elements.namedItem(field.name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
          if (!element) continue;
          if (field.type === 'checkbox') {
            payload[field.name] = (element as HTMLInputElement).checked;
          } else if (field.type === 'json') {
            payload[field.name] = element.value.trim() ? JSON.parse(element.value) : {};
          } else if (field.nullable && element.value === '') {
            payload[field.name] = null;
          } else {
            payload[field.name] = element.value;
          }
        }
      }
      if (fixedValues) {
        if (payload instanceof FormData) {
          Object.entries(fixedValues).forEach(([key, value]) => (payload as FormData).set(key, String(value)));
        } else {
          Object.assign(payload, fixedValues);
        }
      }
      if (editing !== 'new' && editing) await api.update(config.resource, editing.id, payload);
      else await api.create(config.resource, payload);
      setEditing(null);
      toast(t('admin.ui.savedOk'), 'success');
      await load();
    } catch (requestError) {
      toast(errorMessage(t, requestError), 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function archive(row: ResourceRow) {
    if (!(await confirm({ message: t('admin.ui.archiveConfirm', { title }), danger: true }))) return;
    try {
      await api.remove(config.resource, row.id);
      toast(t('admin.ui.archivedOk'), 'success');
      await load();
    } catch (requestError) {
      toast(errorMessage(t, requestError), 'danger');
    }
  }

  async function restore(row: ResourceRow) {
    try {
      await api.restore(config.resource, row.id);
      toast(t('admin.ui.restoredOk'), 'success');
      await load();
    } catch (requestError) {
      toast(errorMessage(t, requestError), 'danger');
    }
  }

  function handleLookupChange(field: ResourceField, value: string) {
    const autofill = field.lookup?.autofill;
    const form = formRef.current;
    if (!autofill || !value || !form) return;
    const selectedRow = lookupRowsByResource[field.lookup!.resource]?.find(row => String(row.id) === value);
    if (!selectedRow) return;
    Object.entries(autofill(selectedRow)).forEach(([targetName, targetValue]) => {
      const element = form.elements.namedItem(targetName);
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) element.value = targetValue;
    });
  }

  function handleDerive(field: ResourceField, value: string) {
    const form = formRef.current;
    if (!field.derive || !form) return;
    Object.entries(field.derive(value)).forEach(([targetName, targetValue]) => {
      const element = form.elements.namedItem(targetName);
      if (element instanceof HTMLInputElement) element.value = targetValue;
    });
  }

  async function runAction(label: string, operation: () => Promise<unknown>) {
    try {
      await operation();
      toast(t('admin.ui.actionCompleted', { label: t(label) }), 'success');
      await load();
    } catch (requestError) {
      toast(errorMessage(t, requestError), 'danger');
    }
  }

  return (
    <section className="grid gap-4">
      <div className="app-card--nova overflow-hidden">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border-soft/30 p-4">
          <label className="relative block w-full min-w-[180px] sm:w-auto sm:flex-1 sm:max-w-md">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('admin.ui.searchPlaceholder', { title })} className="h-10 w-full rounded-xl border border-border-soft bg-surface-card pl-9 pr-3 text-sm text-text-primary outline-none focus:border-primary/50" />
          </label>
          {config.allowArchive !== false ? <label className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-bold text-text-secondary"><input type="checkbox" checked={includeArchived} onChange={event => setIncludeArchived(event.target.checked)} />{t('admin.ui.includeArchived')}</label> : null}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {headerActions?.map(action => <button key={action.label} className="inline-flex h-10 items-center rounded-xl bg-primary/10 px-3 text-xs font-bold text-primary transition hover:bg-primary/20" onClick={() => void runAction(action.label, action.run)}>{t(action.label)}</button>)}
            {config.allowExport !== false ? <button className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface-subtle text-text-secondary ring-1 ring-border-soft/40 transition hover:bg-primary/10 hover:text-text-primary" title={t('admin.ui.exportXlsx')} aria-label={t('admin.ui.exportXlsx')} onClick={() => void runAction('admin.ui.exportXlsx', () => api.export(config.resource))}><FiDownload /></button> : null}
            <button className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface-subtle text-text-secondary ring-1 ring-border-soft/40 transition hover:bg-primary/10 hover:text-text-primary" title={t('admin.ui.refresh')} aria-label={t('admin.ui.refresh')} onClick={() => void load()}><FiRefreshCcw /></button>
            {!config.readOnly ? <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary-strong" onClick={() => setEditing('new')}><FiPlus className="h-4 w-4" />{t('admin.ui.create')}</button> : null}
          </div>
        </div>
        {loading ? <div className="px-4 py-10 text-center text-sm text-text-muted">{t('admin.ui.loading')}</div> : null}
        {!loading && filteredRows.length === 0 ? <div className="px-4 py-10 text-center text-sm text-text-muted">{t('admin.ui.noRecords')}</div> : null}
        {!loading && filteredRows.length > 0 ? (
          <>
            <div className="grid gap-2 p-3 md:hidden">
              {filteredRows.map(row => (
                <div key={String(row.id)} className="grid gap-2 rounded-xl bg-surface-subtle/80 p-3 ring-1 ring-border-soft/35">
                  {tableFields.map(field => (
                    <span key={field.name} className="grid min-w-0 gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">{t(field.label)}</span>
                      <span className="min-w-0 text-sm font-semibold text-text-primary [overflow-wrap:anywhere]">{cellValue(t, row, field, lookups)}</span>
                    </span>
                  ))}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {actions.filter(action => !action.show || action.show(row)).map(action => <button key={action.label} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${action.tone === 'danger' ? 'bg-danger-bg text-danger' : action.tone === 'warning' ? 'bg-warning-bg text-warning' : action.tone === 'success' ? 'bg-success-bg text-success' : 'bg-primary/10 text-primary'}`} onClick={() => void runAction(action.label, () => action.run(row))}>{t(action.label)}</button>)}
                    <button className="rounded-lg bg-surface-muted p-2 text-text-secondary" title={t('admin.ui.view')} onClick={() => setViewing(row)}><FiEye /></button>
                    {!config.readOnly && config.allowEdit !== false && !row.is_archived ? <button className="rounded-lg bg-primary/10 p-2 text-primary" title={t('admin.ui.edit')} onClick={() => setEditing(row)}><FiEdit2 /></button> : null}
                    {row.is_archived ? <button className="rounded-lg bg-success-bg p-2 text-success" title={t('admin.ui.restore')} onClick={() => void restore(row)}><FiRotateCcw /></button> : null}
                    {!config.readOnly && config.allowArchive !== false && !row.is_archived ? <button className="rounded-lg bg-danger-bg p-2 text-danger" title={t('admin.ui.archive')} onClick={() => void archive(row)}><FiArchive /></button> : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] table-fixed text-sm">
                <thead><tr className="bg-surface-subtle text-left text-[11px] uppercase tracking-wide text-text-muted">{tableFields.map(field => <th key={field.name} className="px-4 py-3"><span className="block truncate" title={t(field.label)}>{t(field.label)}</span></th>)}<th className="w-[150px] px-4 py-3">{t('admin.ui.actions')}</th></tr></thead>
                <tbody>
                  {filteredRows.map(row => (
                    <tr key={String(row.id)} className="border-t border-border-soft/20 hover:bg-surface-subtle/50">
                      {tableFields.map(field => {
                        const value = cellValue(t, row, field, lookups);
                        return <td key={field.name} className="min-w-0 overflow-hidden px-4 py-3 text-text-secondary"><span className="block min-w-0 max-w-full truncate" title={value}>{value}</span></td>;
                      })}
                      <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">
                        {actions.filter(action => !action.show || action.show(row)).map(action => <button key={action.label} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${action.tone === 'danger' ? 'bg-danger-bg text-danger' : action.tone === 'warning' ? 'bg-warning-bg text-warning' : action.tone === 'success' ? 'bg-success-bg text-success' : 'bg-primary/10 text-primary'}`} onClick={() => void runAction(action.label, () => action.run(row))}>{t(action.label)}</button>)}
                        <button className="rounded-lg bg-surface-muted p-2 text-text-secondary" title={t('admin.ui.view')} onClick={() => setViewing(row)}><FiEye /></button>
                        {!config.readOnly && config.allowEdit !== false && !row.is_archived ? <button className="rounded-lg bg-primary/10 p-2 text-primary" title={t('admin.ui.edit')} onClick={() => setEditing(row)}><FiEdit2 /></button> : null}
                        {row.is_archived ? <button className="rounded-lg bg-success-bg p-2 text-success" title={t('admin.ui.restore')} onClick={() => void restore(row)}><FiRotateCcw /></button> : null}
                        {!config.readOnly && config.allowArchive !== false && !row.is_archived ? <button className="rounded-lg bg-danger-bg p-2 text-danger" title={t('admin.ui.archive')} onClick={() => void archive(row)}><FiArchive /></button> : null}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
        <div className="border-t border-border-soft/30 px-4 py-3 text-xs font-semibold text-text-muted">{t('admin.ui.recordsCount', { count: filteredRows.length })}</div>
      </div>

      {editing ? <div className="fixed inset-0 z-[200] flex justify-end bg-background-overlay/70" onMouseDown={event => { if (event.target === event.currentTarget) setEditing(null); }}>
        <aside className="h-full w-full max-w-[680px] overflow-y-auto bg-background-subtle p-5 shadow-xl">
          <div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-wide text-primary">{editing === 'new' ? t('admin.ui.createPanel') : t('admin.ui.editPanel')}</p><h3 className="text-2xl font-extrabold text-text-primary">{title}</h3></div><button className="rounded-xl bg-surface-muted p-3 text-text-secondary" onClick={() => setEditing(null)}><FiX /></button></div>
          <form ref={formRef} className="grid gap-4" onSubmit={submit}>
            <div className="grid gap-4 rounded-2xl bg-surface-card p-4 ring-1 ring-border-soft/40 sm:grid-cols-2">
              {config.fields.filter(field => !field.readOnly).map(field => {
                const baseClass = 'h-11 w-full rounded-xl border border-border-soft bg-surface-card px-3 text-sm text-text-primary outline-none focus:border-primary/50';
                const currentValue = String(fieldValue(editing === 'new' ? null : editing, field));
                return <label key={field.name} className={`grid gap-1.5 text-sm font-bold text-text-secondary ${field.type === 'textarea' || field.type === 'json' ? 'sm:col-span-2' : ''}`}>{t(field.label)}
                  {field.type === 'select' || field.lookup ? <Dropdown name={field.name} required={field.required} defaultValue={currentValue} onChange={field.lookup?.autofill ? value => handleLookupChange(field, value) : undefined} options={field.options?.map(option => ({ value: option.value, label: t(option.label) })) || [...(lookups[field.name]?.entries() || [])].map(([value, label]) => ({ value, label }))} />
                    : field.type === 'date' || field.type === 'datetime-local' ? <DatePicker name={field.name} required={field.required} defaultValue={currentValue} type={field.type} />
                    : field.type === 'time' ? <TimePicker name={field.name} required={field.required} defaultValue={currentValue} />
                    : field.type === 'textarea' || field.type === 'json' ? <textarea name={field.name} required={field.required} defaultValue={currentValue} className={`${baseClass} min-h-28 py-3 font-${field.type === 'json' ? 'mono' : 'sans'}`} />
                    : field.type === 'checkbox' ? <input name={field.name} type="checkbox" defaultChecked={Boolean(fieldValue(editing === 'new' ? null : editing, field))} className="h-5 w-5" />
                    : <input name={field.name} type={field.type === 'money' ? 'number' : field.type || 'text'} required={field.required} step={field.step} defaultValue={currentValue} onChange={field.derive ? event => handleDerive(field, event.target.value) : undefined} className={baseClass} />}
                </label>;
              })}
            </div>
            <div className="flex gap-2"><button type="button" className="flex-1 rounded-xl bg-surface-muted px-4 py-3 text-sm font-bold text-text-secondary" onClick={() => setEditing(null)}>{t('admin.ui.cancel')}</button><button disabled={saving} className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">{saving ? t('admin.ui.saving') : t('admin.ui.save')}</button></div>
          </form>
        </aside>
      </div> : null}

      {viewing ? <div className="fixed inset-0 z-[200] flex justify-end bg-background-overlay/70" onMouseDown={event => { if (event.target === event.currentTarget) setViewing(null); }}>
        <aside className="h-full w-full max-w-[680px] overflow-y-auto bg-background-subtle p-5 shadow-xl">
          <div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-wide text-primary">{t('admin.ui.viewPanel')}</p><h3 className="text-2xl font-extrabold text-text-primary">{title}</h3></div><button className="rounded-xl bg-surface-muted p-3 text-text-secondary" onClick={() => setViewing(null)}><FiX /></button></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {config.fields.map(field => {
              const value = cellValue(t, viewing, field, lookups);
              const isLong = field.type === 'textarea' || field.type === 'json';
              return (
                <div key={field.name} className={`rounded-xl bg-surface-card p-4 ring-1 ring-border-soft/40 ${isLong ? 'sm:col-span-2' : ''}`}>
                  <p className="m-0 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">{t(field.label)}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-text-primary [overflow-wrap:anywhere]">{value || '—'}</p>
                </div>
              );
            })}
          </div>
        </aside>
      </div> : null}
    </section>
  );
}
