import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiArchive, FiDownload, FiEdit2, FiPlus, FiRefreshCcw, FiRotateCcw, FiSearch, FiX } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { api } from '../api/client';
import { useDialog } from './DialogProvider';
import { useToast } from './ToastProvider';
import { Dropdown, DatePicker } from './FormControls';
import { formatDisplayDate, formatDisplayDateTime } from '../utils/crm';

export type ResourceRow = Record<string, unknown> & { id: string | number; is_archived?: boolean };

export interface ResourceOption {
  value: string;
  label: string;
}

export interface ResourceField {
  name: string;
  /** Translation key (resolved via t()), not raw display text. */
  label: string;
  type?: 'text' | 'number' | 'date' | 'time' | 'datetime-local' | 'textarea' | 'select' | 'checkbox' | 'json' | 'file' | 'password';
  required?: boolean;
  nullable?: boolean;
  readOnly?: boolean;
  table?: boolean;
  step?: string;
  /** Option labels are also translation keys. */
  options?: ResourceOption[];
  lookup?: { resource: string; label: string; secondary?: string };
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
    if (typeof record.detail === 'string') return record.detail;
    const flattened = Object.entries(record)
      .map(([key, value]) => {
        const text = stringifyErrorValue(value);
        return text ? `${key}: ${text}` : '';
      })
      .filter(Boolean)
      .join(' · ');
    if (flattened) return flattened;
  }
  return error.message || t('admin.ui.requestFailed');
}

function rawDisplayValue(t: TFunction, value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? t('admin.ui.yes') : t('admin.ui.no');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).replaceAll('_', ' ');
}

function cellValue(t: TFunction, row: ResourceRow, field: ResourceField, lookups: Record<string, Map<string, string>>) {
  const lookupLabel = lookups[field.name]?.get(String(row[field.name]));
  if (lookupLabel) return lookupLabel;
  const matchingOption = field.options?.find(option => option.value === String(row[field.name]));
  if (matchingOption) return t(matchingOption.label);
  if (field.type === 'date' && row[field.name]) return formatDisplayDate(String(row[field.name]), t);
  if (field.type === 'datetime-local' && row[field.name]) return formatDisplayDateTime(String(row[field.name]), t);
  return rawDisplayValue(t, row[field.name]);
}

function fieldValue(row: ResourceRow | null, field: ResourceField) {
  const value = row?.[field.name];
  if (field.type === 'checkbox') return Boolean(value);
  if (field.type === 'json') return value ? JSON.stringify(value, null, 2) : '{}';
  if (field.type === 'datetime-local' && typeof value === 'string') return value.slice(0, 16);
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
  const [query, setQuery] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ResourceRow | 'new' | null>(null);
  const [saving, setSaving] = useState(false);

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
      uniqueResources.forEach((resource, index) => {
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
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(row => JSON.stringify(row).toLowerCase().includes(needle));
  }, [query, rows]);

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
      <div className="app-card--nova p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary">{t('admin.ui.backendResource')}</p>
            <h3 className="mt-1 text-xl font-extrabold text-text-primary">{title}</h3>
            <p className="mt-1 text-sm text-text-muted">{t(config.description)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {headerActions?.map(action => <button key={action.label} className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground" onClick={() => void runAction(action.label, action.run)}>{t(action.label)}</button>)}
            {config.allowExport !== false ? <button className="inline-flex items-center gap-2 rounded-xl bg-surface-subtle px-3 py-2 text-xs font-bold text-text-secondary" onClick={() => void runAction('admin.ui.exportXlsx', () => api.export(config.resource))}><FiDownload />{t('admin.ui.exportXlsx')}</button> : null}
            <button className="inline-flex items-center gap-2 rounded-xl bg-surface-subtle px-3 py-2 text-xs font-bold text-text-secondary" onClick={() => void load()}><FiRefreshCcw />{t('admin.ui.refresh')}</button>
            {!config.readOnly ? <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground" onClick={() => setEditing('new')}><FiPlus />{t('admin.ui.create')}</button> : null}
          </div>
        </div>
      </div>


      <div className="app-card--nova overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border-soft/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block min-w-0 flex-1 sm:max-w-md">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('admin.ui.searchPlaceholder', { title })} className="h-10 w-full rounded-xl border border-border-soft bg-surface-card pl-9 pr-3 text-sm text-text-primary outline-none focus:border-primary/50" />
          </label>
          {config.allowArchive !== false ? <label className="inline-flex items-center gap-2 text-xs font-bold text-text-secondary"><input type="checkbox" checked={includeArchived} onChange={event => setIncludeArchived(event.target.checked)} />{t('admin.ui.includeArchived')}</label> : null}
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
          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid gap-4 rounded-2xl bg-surface-card p-4 ring-1 ring-border-soft/40 sm:grid-cols-2">
              {config.fields.filter(field => !field.readOnly).map(field => {
                const baseClass = 'h-11 w-full rounded-xl border border-border-soft bg-surface-card px-3 text-sm text-text-primary outline-none focus:border-primary/50';
                const currentValue = String(fieldValue(editing === 'new' ? null : editing, field));
                return <label key={field.name} className={`grid gap-1.5 text-sm font-bold text-text-secondary ${field.type === 'textarea' || field.type === 'json' ? 'sm:col-span-2' : ''}`}>{t(field.label)}
                  {field.type === 'select' || field.lookup ? <Dropdown name={field.name} required={field.required} defaultValue={currentValue} options={field.options?.map(option => ({ value: option.value, label: t(option.label) })) || [...(lookups[field.name]?.entries() || [])].map(([value, label]) => ({ value, label }))} />
                    : field.type === 'date' || field.type === 'datetime-local' ? <DatePicker name={field.name} required={field.required} defaultValue={currentValue} type={field.type} />
                    : field.type === 'textarea' || field.type === 'json' ? <textarea name={field.name} required={field.required} defaultValue={currentValue} className={`${baseClass} min-h-28 py-3 font-${field.type === 'json' ? 'mono' : 'sans'}`} />
                    : field.type === 'checkbox' ? <input name={field.name} type="checkbox" defaultChecked={Boolean(fieldValue(editing === 'new' ? null : editing, field))} className="h-5 w-5" />
                    : <input name={field.name} type={field.type || 'text'} required={field.required} step={field.step} defaultValue={currentValue} className={baseClass} />}
                </label>;
              })}
            </div>
            <div className="flex gap-2"><button type="button" className="flex-1 rounded-xl bg-surface-muted px-4 py-3 text-sm font-bold text-text-secondary" onClick={() => setEditing(null)}>{t('admin.ui.cancel')}</button><button disabled={saving} className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">{saving ? t('admin.ui.saving') : t('admin.ui.save')}</button></div>
          </form>
        </aside>
      </div> : null}
    </section>
  );
}
