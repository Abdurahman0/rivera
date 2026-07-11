import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiActivity, FiAlertTriangle, FiArchive, FiBriefcase, FiCalendar, FiCheckCircle, FiChevronRight, FiClock, FiCpu, FiDollarSign, FiEye, FiLayers, FiPackage, FiSettings, FiShoppingBag, FiTag, FiTool, FiUserX, FiUsers, FiSliders, FiX } from 'react-icons/fi';
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CategoryDatum, Client, DashboardDateRange, EntityId, FinanceEntry, Material, ModalState, Order, PieceworkRecord, Product, ProductCategory, ProductionBatch, ProductionRecord, StaffMember, StatusTone, StockMovement } from '../types/crm';
import { apiErrorMessage, formatDisplayDate, formatDisplayDateTime, materialStatusTone, optionLabel, orderStatusTone, statusLabel, statusTone, unitLabel } from '../utils/crm';
import { translateMovementLabel } from '../lib/enumLabels';
import { BUILT_IN_CLIENT_STATUSES, hasStoredCustomClientStatuses, loadCustomClientStatuses, saveCustomClientStatuses, slugifyStatusKey, type CustomClientStatus } from '../utils/clientStatuses';
import { CATEGORY_COLOR_PALETTE, categoryColor, loadCategoryColors, saveCategoryColors } from '../utils/categoryColors';
import { ClientsFilterBar, DataTable, MetricCard, PageHeader, Panel, PremiumTooltip, PrimaryCell, RowActions, SegmentTabs, StatusBadge } from '../components/ui';
import { useDialog } from '../components/DialogProvider';
import { useToast } from '../components/ToastProvider';
import { useHasPermission } from '../components/PermissionsProvider';
import { Dropdown, DatePicker } from '../components/FormControls';
import { ApiResourceManager, type ResourceAction, type ResourceConfig } from '../components/ApiResourceManager';
import { actions, api, resources } from '../api/client';
import type { ApiApproval, ApiRecord } from '../api/types';
import { APPROVAL_ACTION_TARGETS, buildApprovalObjectLabel } from '../lib/approvalTargets';
import { operationsConfigs } from '../data/resource-config';
import { FaceEnrollDrawer } from '../components/FaceEnrollDrawer';

/** Every export button must download the real backend XLSX via GET /api/<resource>/export/ — never generate files client-side. */
function useResourceExport() {
  const { t } = useTranslation();
  const { toast } = useToast();
  return (resource: string) => {
    void api.export(resource).catch(error => {
      toast(apiErrorMessage(error, t), 'danger');
    });
  };
}

function useApprovalObjectLabels(approvals: ApiApproval[], materials: Material[], products: Product[], t: ReturnType<typeof useTranslation>['t']) {
  const [targets, setTargets] = useState<Record<string, Map<string, ApiRecord>>>({});
  const actionsKey = [...new Set(approvals.map(row => row.action))].sort().join(',');

  useEffect(() => {
    const resourcesNeeded = [...new Set(
      actionsKey.split(',').filter(Boolean).map(action => APPROVAL_ACTION_TARGETS[action]?.resource).filter((value): value is string => Boolean(value)),
    )];
    if (!resourcesNeeded.length) return;
    let cancelled = false;
    void Promise.all(resourcesNeeded.map(resource => api.list<ApiRecord>(resource).then(rows => [resource, rows] as const))).then(results => {
      if (cancelled) return;
      const next: Record<string, Map<string, ApiRecord>> = {};
      results.forEach(([resource, rows]) => {
        next[resource] = new Map(rows.map(row => [String(row.id), row]));
      });
      setTargets(next);
    });
    return () => { cancelled = true; };
  }, [actionsKey]);

  const materialsById = useMemo(() => new Map(materials.map(m => [String(m.id), m.name])), [materials]);
  const productsById = useMemo(() => new Map(products.map(p => [String(p.id), p.name])), [products]);

  return (row: ApiApproval) => {
    const config = APPROVAL_ACTION_TARGETS[row.action];
    const targetRow = config ? targets[config.resource]?.get(row.object_id) : undefined;
    return buildApprovalObjectLabel(row.action, targetRow, materialsById, productsById, t);
  };
}

export function ApprovalsPage({ approvals, materials, products, onApprove, onReject }: { approvals: ApiApproval[]; materials: Material[]; products: Product[]; onApprove: (id: string) => Promise<void>; onReject: (id: string, reason: string) => Promise<void> }) {
  const { t } = useTranslation();
  const { prompt } = useDialog();
  const exportResource = useResourceExport();
  const canManage = useHasPermission('approvals', 'manage');
  const pending = approvals.filter(row => row.status === 'pending');
  const objectLabel = useApprovalObjectLabels(approvals, materials, products, t);
  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('approvals.eyebrow')} title={t('approvals.title')} description={t('approvals.description')} onExport={() => exportResource(resources.approvals)} />
      <div className="flex flex-wrap gap-3">
        <div className="rounded-xl bg-warning-bg px-4 py-2.5 text-sm font-bold text-warning">{t('approvals.pendingCount', { count: pending.length })}</div>
        <div className="rounded-xl bg-success-bg px-4 py-2.5 text-sm font-bold text-success">{t('approvals.approvedCount', { count: approvals.filter(row => row.status === 'approved').length })}</div>
        <div className="rounded-xl bg-danger-bg px-4 py-2.5 text-sm font-bold text-danger">{t('approvals.rejectedCount', { count: approvals.filter(row => row.status === 'rejected').length })}</div>
      </div>
      <DataTable
        columns={[t('approvals.columns.page'), t('approvals.columns.action'), t('approvals.columns.object'), t('approvals.columns.created'), t('approvals.columns.status'), t('approvals.columns.actions')]}
        rows={approvals.map(row => {
          const label = objectLabel(row) ?? `#${row.object_id.slice(0, 8).toUpperCase()}`;
          return [
            optionLabel(t, 'page', row.page),
            optionLabel(t, 'approvalAction', row.action),
            <span className="block max-w-[220px] truncate" title={label}>{label}</span>,
            formatDisplayDateTime(row.created_at, t),
            <StatusBadge tone={row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'danger' : 'warning'}>{statusLabel(t, row.status)}</StatusBadge>,
            row.status === 'pending' && canManage ? (
              <div className="flex gap-2">
                <button className="rounded-lg bg-success-bg px-3 py-1.5 text-xs font-bold text-success" onClick={() => void onApprove(row.id)}>{t('approvals.approve')}</button>
                <button className="rounded-lg bg-danger-bg px-3 py-1.5 text-xs font-bold text-danger" onClick={() => {
                  void prompt({ title: t('dialog.rejectReasonTitle'), placeholder: t('dialog.rejectReasonPlaceholder'), required: true }).then(reason => {
                    if (reason?.trim()) void onReject(row.id, reason.trim());
                  });
                }}>{t('approvals.reject')}</button>
              </div>
            ) : '—',
          ];
        })}
      />
    </div>
  );
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

type DashboardRangePreset = 'today' | 'last30Days' | 'thisMonth' | 'lastMonth';

const DASHBOARD_RANGE_PRESETS: DashboardRangePreset[] = ['today', 'last30Days', 'thisMonth', 'lastMonth'];

function dashboardRangePreset(preset: DashboardRangePreset, endDateValue?: string): DashboardDateRange {
  const today = endDateValue ? new Date(`${endDateValue}T00:00:00`) : new Date();
  const safeToday = Number.isNaN(today.getTime()) ? new Date() : today;
  if (preset === 'today') return { startDate: isoDate(safeToday), endDate: isoDate(safeToday) };
  if (preset === 'last30Days') {
    const start = new Date(safeToday);
    start.setDate(start.getDate() - 29);
    return { startDate: isoDate(start), endDate: isoDate(safeToday) };
  }
  if (preset === 'lastMonth') {
    const start = new Date(safeToday.getFullYear(), safeToday.getMonth() - 1, 1);
    const end = new Date(safeToday.getFullYear(), safeToday.getMonth(), 0);
    return { startDate: isoDate(start), endDate: isoDate(end) };
  }
  return { startDate: isoDate(new Date(safeToday.getFullYear(), safeToday.getMonth(), 1)), endDate: isoDate(safeToday) };
}

function sameDashboardRange(a: DashboardDateRange, b: DashboardDateRange) {
  return a.startDate === b.startDate && a.endDate === b.endDate;
}

/** Matches the current value against a preset so the trigger button and the list can show
 *  which preset (if any) is active — a custom pick that happens to equal a preset counts. */
function matchingDashboardPreset(value: DashboardDateRange | null): DashboardRangePreset | null {
  if (!value) return null;
  return DASHBOARD_RANGE_PRESETS.find(preset => sameDashboardRange(dashboardRangePreset(preset), value)) ?? null;
}

/** Single dropdown combining quick presets (today / last 30 days / this month / last month)
 *  with a custom calendar range — every choice applies immediately, no separate "apply" step. */
function DashboardDateFilter({ value, onChange }: { value: DashboardDateRange | null; onChange: (range: DashboardDateRange | null) => void }) {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [viewDate, setViewDate] = useState(() => parseIsoDate(value?.endDate ?? '') ?? new Date());
  const menuRef = useRef<HTMLDivElement | null>(null);
  const lang = i18n.language.startsWith('ru') ? 'ru-RU' : 'uz-UZ';
  const activePreset = matchingDashboardPreset(value);

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    setDraftStart('');
    setDraftEnd('');
    setViewDate(parseIsoDate(value?.endDate ?? '') ?? new Date());
  }, [isOpen, value?.endDate]);

  const days = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ date: Date; inMonth: boolean }> = [];
    for (let i = 0; i < startOffset; i++) cells.push({ date: new Date(year, month, i - startOffset + 1), inMonth: false });
    for (let day = 1; day <= daysInMonth; day++) cells.push({ date: new Date(year, month, day), inMonth: true });
    while (cells.length % 7 !== 0 || cells.length < 42) cells.push({ date: new Date(year, month, daysInMonth + cells.length - startOffset - daysInMonth + 1), inMonth: false });
    return cells;
  }, [viewDate]);

  const monthLabel = viewDate.toLocaleDateString(lang, { month: 'long', year: 'numeric' });
  const weekdayLabels = lang === 'ru-RU' ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] : ['Du', 'Se', 'Cho', 'Pay', 'Ju', 'Sha', 'Ya'];
  const displayText = activePreset
    ? t(`dashboard.filters.${activePreset}`)
    : value
      ? `${value.startDate.split('-').reverse().join('.')} – ${value.endDate.split('-').reverse().join('.')}`
      : t('dashboard.filters.allTime');

  // While no in-progress custom pick, the calendar highlights the current value (if any).
  const highlightStart = draftStart || value?.startDate || '';
  const highlightEnd = draftStart ? draftEnd : (value?.endDate || '');

  function applyPreset(preset: DashboardRangePreset) {
    onChange(dashboardRangePreset(preset));
    setIsOpen(false);
  }

  function pickDate(iso: string) {
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(iso);
      setDraftEnd('');
      return;
    }
    const range = iso < draftStart ? { startDate: iso, endDate: draftStart } : { startDate: draftStart, endDate: iso };
    onChange(range);
    setIsOpen(false);
  }

  return (
    <div ref={menuRef} className="relative w-[210px] max-w-full">
      <button
        type="button"
        className={[
          'flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-border-soft bg-surface-card px-3 text-left text-[12px] font-bold text-text-primary outline-none transition',
          isOpen ? 'border-primary/50 ring-4 ring-primary/10' : 'hover:border-primary/35',
        ].join(' ')}
        onClick={() => setIsOpen(current => !current)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <FiCalendar className="h-3.5 w-3.5 shrink-0 text-text-muted" />
          <span className="min-w-0 truncate">{displayText}</span>
        </span>
        <FiChevronRight className={['h-3.5 w-3.5 shrink-0 text-text-muted transition-transform', isOpen ? 'rotate-90' : ''].join(' ')} />
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 flex w-[420px] max-w-[92vw] overflow-hidden rounded-2xl border border-border-soft/60 bg-surface-card shadow-[0_24px_55px_-30px_rgba(15,23,42,0.58)] backdrop-blur-xl">
          <div className="grid w-[148px] shrink-0 gap-1 border-r border-border-soft/40 p-2.5">
            <button
              type="button"
              className={['flex h-9 items-center rounded-lg px-2.5 text-left text-[12px] font-bold transition', !value ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary'].join(' ')}
              onClick={() => { onChange(null); setIsOpen(false); }}
            >
              {t('dashboard.filters.allTime')}
            </button>
            {DASHBOARD_RANGE_PRESETS.map(preset => (
              <button
                key={preset}
                type="button"
                className={['flex h-9 items-center rounded-lg px-2.5 text-left text-[12px] font-bold transition', activePreset === preset ? 'bg-primary text-primary-foreground' : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary'].join(' ')}
                onClick={() => applyPreset(preset)}
              >
                {t(`dashboard.filters.${preset}`)}
              </button>
            ))}
            <p className="mt-2 border-t border-border-soft/40 px-2.5 pt-2.5 text-[10px] font-bold uppercase tracking-wide text-text-muted">{t('dashboard.filters.customRange')}</p>
          </div>
          <div className="min-w-0 flex-1 p-3">
            <div className="mb-2 flex items-center justify-between">
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition hover:bg-surface-subtle" onClick={() => setViewDate(date => new Date(date.getFullYear(), date.getMonth() - 1, 1))}>
                <FiChevronRight className="h-4 w-4 rotate-180" />
              </button>
              <span className="text-sm font-bold capitalize text-text-primary">{monthLabel}</span>
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition hover:bg-surface-subtle" onClick={() => setViewDate(date => new Date(date.getFullYear(), date.getMonth() + 1, 1))}>
                <FiChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weekdayLabels.map(label => <span key={label} className="grid h-7 place-items-center text-[10px] font-bold uppercase text-text-muted">{label}</span>)}
              {days.map(({ date, inMonth }, index) => {
                const iso = isoDate(date);
                const isEdge = iso === highlightStart || iso === highlightEnd;
                const isBetween = Boolean(highlightStart && highlightEnd && iso > highlightStart && iso < highlightEnd);
                return (
                  <button
                    key={`${iso}-${index}`}
                    type="button"
                    className={[
                      'grid h-8 place-items-center rounded-lg text-xs font-semibold transition',
                      !inMonth ? 'text-text-muted/40 hover:bg-surface-subtle' : 'text-text-primary hover:bg-primary/10',
                      isBetween ? 'bg-primary/10 text-text-primary' : '',
                      isEdge ? 'bg-primary text-primary-foreground hover:bg-primary' : '',
                    ].join(' ')}
                    onClick={() => pickDate(iso)}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DashboardPage({ clients, priorityClients, products, materials, staff, categoryAnalytics, revenueData, totalStock, lowStockCount, pipelineValue, newClientsInPeriod, ordersInPeriod, onDutyCount, staffTotal, formatMoney, openModal, dateRange, onDateRangeChange }: {
  clients: Client[];
  priorityClients: Client[];
  products: Product[];
  materials: Material[];
  staff: StaffMember[];
  categoryAnalytics: CategoryDatum[];
  revenueData: Array<{ month: string; revenue: number; orders: number }>;
  totalStock: number;
  lowStockCount: number;
  pipelineValue: number;
  newClientsInPeriod: number;
  ordersInPeriod: number;
  onDutyCount: number;
  staffTotal: number;
  formatMoney: (value: number) => string;
  openModal: (modal: ModalState) => void;
  dateRange: DashboardDateRange | null;
  onDateRangeChange: (range: DashboardDateRange | null) => void;
}) {
  const { t } = useTranslation();
  const exportResource = useResourceExport();
  const lowStockMaterials = materials.filter(m => m.stock <= m.minStock);

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('dashboard.eyebrow')} title={t('dashboard.title')} description={t('dashboard.description')} />
      <div className="flex justify-end">
        <DashboardDateFilter value={dateRange} onChange={onDateRangeChange} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<FiBriefcase />} label={t('dashboard.metrics.pipeline')} value={formatMoney(pipelineValue)} caption={t('dashboard.metrics.pipelineCaption', { count: ordersInPeriod })} tone="success" />
        <MetricCard icon={<FiUsers />} label={t('dashboard.metrics.clients')} value={clients.length.toString()} caption={t('dashboard.metrics.clientsCaption', { count: newClientsInPeriod })} tone="info" />
        <MetricCard icon={<FiClock />} label={t('dashboard.metrics.staff')} value={`${onDutyCount}/${staffTotal}`} caption={t('dashboard.metrics.staffCaption')} tone="warning" />
        <MetricCard icon={<FiArchive />} label={t('dashboard.metrics.stock')} value={totalStock.toLocaleString()} caption={t('dashboard.metrics.stockCaption', { count: lowStockCount })} tone="danger" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Panel title={t('dashboard.revenueTitle')} action={t('common.export')} onAction={() => exportResource(resources.clientPayments)}>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={revenueData}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#0f766e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0f766e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.5} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={70} />
                <Tooltip content={<PremiumTooltip />} cursor={false} />
                <Area name={t('products.columns.revenue')} type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={3} fill="url(#revenueFill)" />
                <Line name={t('dashboard.metrics.clients')} type="monotone" dataKey="orders" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title={t('dashboard.priorityTitle')} action={t('common.viewAll')}>
          <div className="grid gap-3">
            {(priorityClients.length ? priorityClients : clients).slice(0, 4).map(client => (
              <button
                key={client.id}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-border-soft/55 bg-surface-card/80 p-3 text-left shadow-sm transition duration-fast hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/8 hover:shadow-[0_18px_36px_-28px_rgb(var(--color-primary)/0.55)]"
                onClick={() => openModal({ kind: 'client', mode: 'view', item: client })}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                    <FiBriefcase className="h-4 w-4" />
                  </span>
                  <PrimaryCell title={client.name} subtitle={`${statusLabel(t, client.statusKey)} · ${client.manager}`} />
                </span>
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-text-muted transition group-hover:bg-primary/15 group-hover:text-text-accent">
                  <FiChevronRight className="h-4 w-4" />
                </span>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="app-card--nova min-w-0 p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-extrabold text-text-primary">{t('dashboard.attendanceTitle')}</h3>
            <span className="rounded-pill bg-primary/10 px-3 py-1 text-xs font-bold text-text-accent">{onDutyCount}/{staffTotal}</span>
          </div>
          <div className="grid gap-2">
            {staff.map(member => {
              const initials = member.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('');
              return (
                <div key={member.id} className="flex items-center gap-3 rounded-xl bg-surface-subtle p-3 ring-1 ring-border-soft/35">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-extrabold text-primary">{initials}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-text-primary">{member.name}</p>
                    <p className="text-xs text-text-muted">{optionLabel(t, 'employeePosition', member.role)} · {member.arrival === 'Masofadan' || member.arrival === 'Удалённо' ? member.arrival : `${member.arrival} → ${member.leaving}`}</p>
                  </div>
                  <StatusBadge tone={statusTone(member.statusKey)}>{statusLabel(t, member.statusKey)}</StatusBadge>
                </div>
              );
            })}
          </div>
        </section>

        <section className="app-card--nova min-w-0 p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-extrabold text-text-primary">{t('dashboard.lowStockTitle')}</h3>
            {lowStockMaterials.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-warning-bg px-3 py-1 text-xs font-bold text-warning">
                <FiAlertTriangle className="h-3 w-3" />
                {lowStockMaterials.length}
              </span>
            )}
          </div>
          {lowStockMaterials.length === 0 ? (
            <div className="flex h-24 items-center justify-center rounded-xl bg-success-bg text-sm font-bold text-success">
              {t('dashboard.noLowStock')}
            </div>
          ) : (
            <div className="grid gap-2">
              {lowStockMaterials.map(mat => (
                <div key={mat.id} className="flex items-center gap-3 rounded-xl bg-warning-bg/60 p-3 ring-1 ring-warning/20">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
                    <FiLayers className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-text-primary">{mat.name}</p>
                    <p className="text-xs text-warning">{mat.stock.toLocaleString()} {unitLabel(mat.unit, t)} / min {mat.minStock.toLocaleString()}</p>
                  </div>
                  <StatusBadge tone="warning">{statusLabel(t, mat.statusKey)}</StatusBadge>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <ProductsAnalyticsPanel products={products} categoryAnalytics={categoryAnalytics} formatMoney={formatMoney} />
    </div>
  );
}

function scopedFieldConfig(base: ResourceConfig, canManage: boolean, fieldName: string): ResourceConfig {
  return {
    ...base,
    readOnly: base.readOnly || !canManage,
    fields: base.fields.map(field => (field.name === fieldName ? { ...field, readOnly: true, table: false } : field)),
  };
}

function scopedClientConfig(base: ResourceConfig, canManage: boolean): ResourceConfig {
  return scopedFieldConfig(base, canManage, 'client');
}

function ClientDetailModal({ client, onClose, canManage }: { client: Client; onClose: () => void; canManage: boolean }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'deliveries' | 'payments' | 'returns' | 'debts'>('deliveries');
  const extraParams = useMemo(() => ({ client: String(client.id) }), [client.id]);
  const fixedValues = useMemo(() => ({ client: String(client.id) }), [client.id]);
  const configs = useMemo(() => ({
    deliveries: scopedClientConfig(operationsConfigs.deliveries, canManage),
    payments: scopedClientConfig(operationsConfigs.payments, canManage),
    returns: scopedClientConfig(operationsConfigs.returns, canManage),
    debts: scopedClientConfig(operationsConfigs.debts, canManage),
  }), [canManage]);

  return (
    <div className="fixed inset-0 z-[190] grid place-items-center bg-background-overlay/72 px-3 backdrop-blur-[3px]" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" className="grid max-h-[90vh] w-full max-w-[980px] grid-rows-[auto_1fr] overflow-hidden rounded-[28px] bg-surface-card shadow-[0_40px_110px_-42px_rgba(15,23,42,0.62)] ring-1 ring-border-soft/55">
        <div className="flex items-start justify-between gap-4 border-b border-border-soft/30 p-6">
          <div className="min-w-0">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{client.phone}</p>
            <h3 className="mt-1 truncate font-display text-xl font-extrabold text-text-primary">{client.name}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge tone={statusTone(client.statusKey)}>{statusLabel(t, client.statusKey)}</StatusBadge>
              <span className="rounded-pill bg-surface-subtle px-2.5 py-0.5 text-[11px] font-bold text-text-secondary ring-1 ring-border-soft/40">{t('clients.columns.value')}: {client.value.toLocaleString()}</span>
            </div>
          </div>
          <button type="button" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-subtle text-text-secondary transition duration-fast hover:bg-surface-muted hover:text-text-primary" onClick={onClose} aria-label={t('common.close')}>
            <FiX className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-6">
          <SegmentTabs
            tabs={[
              { id: 'deliveries', label: t('admin.resources.deliveries.title'), icon: <FiPackage className="h-4 w-4" /> },
              { id: 'payments', label: t('admin.resources.payments.title'), icon: <FiDollarSign className="h-4 w-4" /> },
              { id: 'returns', label: t('admin.resources.returns.title'), icon: <FiArchive className="h-4 w-4" /> },
              { id: 'debts', label: t('admin.resources.debts.title'), icon: <FiAlertTriangle className="h-4 w-4" /> },
            ]}
            activeTab={activeTab}
            onChange={id => setActiveTab(id as typeof activeTab)}
          />
          <div className="mt-4">
            <ApiResourceManager key={`${activeTab}-${client.id}`} config={configs[activeTab]} extraParams={extraParams} fixedValues={fixedValues} />
          </div>
        </div>
      </section>
    </div>
  );
}

export function ClientsPage({ clients, formatMoney, openModal, openDelete }: { clients: Client[]; formatMoney: (value: number) => string; openModal: (modal: ModalState) => void; openDelete: (modal: ModalState) => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { confirm } = useDialog();
  const exportResource = useResourceExport();
  const canManage = useHasPermission('clients', 'manage');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortMode, setSortMode] = useState('valueDesc');
  const [viewMode, setViewMode] = useState<'clients' | 'statuses'>('clients');
  const [customStatuses, setCustomStatuses] = useState<CustomClientStatus[]>(() => {
    if (hasStoredCustomClientStatuses()) return loadCustomClientStatuses();
    // First-ever visit: seed the manageable catalog with the built-in statuses (translated),
    // so they get full edit/delete actions too instead of staying a hardcoded, immutable set.
    const seeded = BUILT_IN_CLIENT_STATUSES.map(key => ({ key, label: statusLabel(t, key), tone: statusTone(key) }));
    saveCustomClientStatuses(seeded);
    return seeded;
  });
  const [statusModal, setStatusModal] = useState<{ mode: 'create' | 'edit'; status?: CustomClientStatus } | null>(null);
  const statusOptions = useMemo(() => ['all', ...Array.from(new Set(clients.map(client => client.statusKey)))], [clients]);
  const sourceOptions = useMemo(() => ['all', ...Array.from(new Set(clients.map(client => client.source)))], [clients]);
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: clients.length };
    clients.forEach(client => { counts[client.statusKey] = (counts[client.statusKey] ?? 0) + 1; });
    return counts;
  }, [clients]);
  const allStatusKeys = useMemo(
    () => Array.from(new Set([...customStatuses.map(status => status.key), ...clients.map(client => client.statusKey)])),
    [customStatuses, clients],
  );
  const resolveStatusDisplay = (key: string): { label: string; tone: StatusTone } => {
    const custom = customStatuses.find(status => status.key === key);
    return custom ? { label: custom.label, tone: custom.tone } : { label: statusLabel(t, key), tone: statusTone(key) };
  };
  const filteredClients = useMemo(() => {
    const normalizedQuery = query.toLowerCase();
    return clients
      .filter(client => `${client.name} ${client.phone} ${client.status} ${client.fabric}`.toLowerCase().includes(normalizedQuery))
      .filter(client => statusFilter === 'all' || client.statusKey === statusFilter)
      .filter(client => sourceFilter === 'all' || client.source === sourceFilter)
      .sort((first, second) => {
        if (sortMode === 'valueAsc') return first.value - second.value;
        if (sortMode === 'nameAsc') return first.name.localeCompare(second.name);
        if (sortMode === 'nameDesc') return second.name.localeCompare(first.name);
        return second.value - first.value;
      });
  }, [clients, query, sortMode, sourceFilter, statusFilter]);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);

  function persistCustomStatuses(next: CustomClientStatus[]) {
    setCustomStatuses(next);
    saveCustomClientStatuses(next);
  }

  function handleSaveStatus(input: { key?: string; label: string; tone: StatusTone }) {
    if (input.key) {
      persistCustomStatuses(customStatuses.map(status => (status.key === input.key ? { ...status, label: input.label, tone: input.tone } : status)));
    } else {
      const key = slugifyStatusKey(input.label);
      if (allStatusKeys.includes(key)) {
        toast(t('clients.viewModes.statusExists'), 'danger');
        return;
      }
      persistCustomStatuses([...customStatuses, { key, label: input.label, tone: input.tone }]);
    }
    setStatusModal(null);
  }

  async function handleDeleteStatus(status: CustomClientStatus) {
    const confirmed = await confirm({ title: t('clients.viewModes.deleteStatusTitle'), message: t('clients.viewModes.deleteStatusMessage', { name: status.label }), danger: true });
    if (!confirmed) return;
    persistCustomStatuses(customStatuses.filter(entry => entry.key !== status.key));
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow={t('clients.eyebrow')}
        title={viewMode === 'statuses' ? t('clients.viewModes.statusesTitle') : t('clients.title')}
        description={viewMode === 'statuses' ? t('clients.viewModes.statusesDescription') : t('clients.description')}
        createLabel={canManage ? (viewMode === 'statuses' ? t('clients.viewModes.createStatus') : t('clients.create')) : undefined}
        onCreate={canManage ? (viewMode === 'statuses' ? () => setStatusModal({ mode: 'create' }) : () => openModal({ kind: 'client', mode: 'create' })) : undefined}
        onExport={viewMode === 'statuses' ? undefined : () => exportResource(resources.clients)}
      />
      <div className="flex flex-wrap gap-2">
        {(['clients', 'statuses'] as const).map(mode => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className={[
              'inline-flex h-9 items-center gap-1.5 rounded-pill px-4 text-xs font-extrabold uppercase tracking-[0.04em] transition',
              viewMode === mode
                ? 'bg-primary text-primary-foreground shadow-[0_12px_24px_-18px_rgb(var(--color-primary)/0.65)]'
                : 'bg-surface-subtle text-text-secondary ring-1 ring-border-soft/40 hover:bg-primary/10 hover:text-text-primary',
            ].join(' ')}
          >
            {t(`clients.viewModes.${mode}`)}
          </button>
        ))}
      </div>
      {viewMode === 'clients' ? (
        <>
          <ClientsFilterBar
            query={query}
            setQuery={setQuery}
            placeholder={t('clients.searchPlaceholder')}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            sourceFilter={sourceFilter}
            setSourceFilter={setSourceFilter}
            sortMode={sortMode}
            setSortMode={setSortMode}
            statusOptions={statusOptions}
            sourceOptions={sourceOptions}
          />
          <DataTable
            columns={[t('clients.columns.client'), t('clients.columns.source'), t('clients.columns.status'), t('clients.columns.fabric'), t('clients.columns.value'), t('common.actions')]}
            rows={filteredClients.map(client => [
              <PrimaryCell title={client.name} subtitle={client.phone} />,
              client.source,
              <StatusBadge tone={statusTone(client.statusKey)}>{statusLabel(t, client.statusKey)}</StatusBadge>,
              client.fabric,
              formatMoney(client.value),
              <RowActions onView={() => setViewingClient(client)} onEdit={canManage ? () => openModal({ kind: 'client', mode: 'edit', item: client }) : undefined} onDelete={canManage ? () => openDelete({ kind: 'client', mode: 'view', item: client }) : undefined} />,
            ])}
            onRowClick={(rowIndex) => setViewingClient(filteredClients[rowIndex])}
          />
        </>
      ) : (
        <DataTable
          columns={[t('clients.viewModes.statusColumn'), t('clients.viewModes.clientCountColumn'), t('common.actions')]}
          rows={allStatusKeys.map(key => {
            const display = resolveStatusDisplay(key);
            const custom = customStatuses.find(status => status.key === key);
            return [
              <StatusBadge tone={display.tone}>{display.label}</StatusBadge>,
              statusCounts[key] ?? 0,
              <RowActions
                onView={() => { setStatusFilter(key); setViewMode('clients'); }}
                onEdit={canManage && custom ? () => setStatusModal({ mode: 'edit', status: custom }) : undefined}
                onDelete={canManage && custom ? () => void handleDeleteStatus(custom) : undefined}
              />,
            ];
          })}
          onRowClick={(rowIndex) => { setStatusFilter(allStatusKeys[rowIndex]); setViewMode('clients'); }}
        />
      )}
      {viewingClient ? <ClientDetailModal client={viewingClient} canManage={canManage} onClose={() => setViewingClient(null)} /> : null}
      {statusModal ? <ClientStatusModal mode={statusModal.mode} status={statusModal.status} onSave={handleSaveStatus} onClose={() => setStatusModal(null)} /> : null}
    </div>
  );
}

const TONE_SWATCH_CLASS: Record<StatusTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-neutral',
};

function ClientStatusModal({ mode, status, onSave, onClose }: {
  mode: 'create' | 'edit';
  status?: CustomClientStatus;
  onSave: (input: { key?: string; label: string; tone: StatusTone }) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [label, setLabel] = useState(status?.label ?? '');
  const [tone, setTone] = useState<StatusTone>(status?.tone ?? 'info');

  function handleSave() {
    if (!label.trim()) {
      toast(t('admin.ui.requiredFieldsMissing'), 'danger');
      return;
    }
    onSave({ key: status?.key, label: label.trim(), tone });
  }

  return (
    <div className="fixed inset-0 z-[190] grid place-items-center bg-background-overlay/72 px-3 backdrop-blur-[3px]" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" className="w-full max-w-[420px] rounded-[28px] bg-surface-card p-5 shadow-[0_40px_110px_-42px_rgba(15,23,42,0.62)] ring-1 ring-border-soft/55">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-xl font-extrabold text-text-primary">{mode === 'edit' ? t('clients.viewModes.editStatusTitle') : t('clients.viewModes.createStatus')}</h3>
          <button type="button" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-subtle text-text-secondary transition duration-fast hover:bg-surface-muted hover:text-text-primary" onClick={onClose} aria-label={t('common.close')}>
            <FiX className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 grid gap-3">
          <label className="grid gap-1.5 text-sm font-bold text-text-secondary">
            {t('clients.viewModes.statusLabel')}
            <input value={label} onChange={event => setLabel(event.target.value)} className="h-11 w-full rounded-xl border border-border-soft bg-surface-card px-3 text-sm text-text-primary outline-none focus:border-primary/50" />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-text-secondary">
            {t('clients.viewModes.statusColor')}
            <div className="flex items-center gap-3">
              <span className={['h-9 w-9 shrink-0 rounded-full ring-2 ring-border-soft/50', TONE_SWATCH_CLASS[tone]].join(' ')} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <Dropdown
                  value={tone}
                  onChange={value => setTone(value as StatusTone)}
                  options={(['success', 'warning', 'danger', 'info', 'neutral'] as const).map(value => ({ value, label: t(`clients.viewModes.tone.${value}`) }))}
                />
              </div>
            </div>
          </label>
        </div>
        <div className="mt-5 flex gap-2">
          <button className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl bg-surface-subtle px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-muted hover:text-text-primary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90" onClick={handleSave}>
            {t('common.save')}
          </button>
        </div>
      </section>
    </div>
  );
}

function EmployeeGrid({ staff, pieceworkRecords, formatMoney, openModal, openDelete }: { staff: StaffMember[]; pieceworkRecords: PieceworkRecord[]; formatMoney: (v: number) => string; openModal: (m: ModalState) => void; openDelete: (m: ModalState) => void }) {
  const { t } = useTranslation();
  const canManage = useHasPermission('employees', 'manage');
  const [detailId, setDetailId] = useState<EntityId | null>(null);
  const detailMember = staff.find(member => member.id === detailId) ?? null;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {staff.map(member => {
          const initials = member.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('');
          const myRecords = pieceworkRecords.filter(r => r.employeeName === member.name);
          const totalEarned = myRecords.reduce((sum, r) => sum + r.quantity * r.ratePerPiece, 0);
          const hasPiecework = myRecords.length > 0;

          return (
            <article key={member.id} className="app-card--nova flex flex-col gap-4 p-5">
              <div className="flex items-start gap-4">
                <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl font-extrabold text-primary">{initials}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold text-text-primary">{member.name}</p>
                  <p className="mt-0.5 truncate text-sm text-text-muted">{optionLabel(t, 'employeePosition', member.role)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge tone={statusTone(member.statusKey)}>{statusLabel(t, member.statusKey)}</StatusBadge>
                    {hasPiecework && (
                      <span className="rounded-pill bg-success/10 px-2.5 py-0.5 text-[11px] font-bold text-success ring-1 ring-success/20">{formatMoney(totalEarned)} {t('staff.detail.pieceworkBadge')}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-subtle p-3 text-xs">
                <div><p className="text-text-muted">{t('staff.columns.phone')}</p><p className="mt-0.5 font-semibold text-text-primary">{member.phone}</p></div>
                <div><p className="text-text-muted">{t('staff.columns.hireDate')}</p><p className="mt-0.5 font-semibold text-text-primary">{formatDisplayDate(member.hireDate, t)}</p></div>
                <div><p className="text-text-muted">{t('staff.columns.shift')}</p><p className="mt-0.5 font-semibold text-text-primary">{optionLabel(t, 'salaryType', member.shift)}</p></div>
                <div><p className="text-text-muted">{t('staff.columns.salary')}</p><p className="mt-0.5 font-bold text-success">{formatMoney(member.salary)}</p></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setDetailId(member.id)} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-surface-subtle text-xs font-bold text-text-secondary ring-1 ring-border-soft/50 transition hover:bg-primary/10 hover:text-text-primary">
                  <FiChevronRight className="h-3.5 w-3.5" />
                  {t('staff.detail.toggleOpen')}
                </button>
                {canManage ? <button onClick={() => openModal({ kind: 'staff', mode: 'edit', item: member })} className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-surface-subtle text-xs font-bold text-text-secondary ring-1 ring-border-soft/50 transition hover:bg-primary/10 hover:text-text-primary"><FiSettings className="h-3.5 w-3.5" /></button> : null}
                {canManage ? <button onClick={() => openDelete({ kind: 'staff', mode: 'view', item: member })} className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-danger-bg text-xs font-bold text-danger ring-1 ring-danger/15 transition hover:bg-danger/15">✕</button> : null}
              </div>
            </article>
          );
        })}
      </div>
      {detailMember ? (
        <StaffDetailModal
          member={detailMember}
          records={pieceworkRecords.filter(r => r.employeeName === detailMember.name)}
          formatMoney={formatMoney}
          onClose={() => setDetailId(null)}
        />
      ) : null}
    </>
  );
}

function StaffDetailModal({ member, records, formatMoney, onClose }: { member: StaffMember; records: PieceworkRecord[]; formatMoney: (v: number) => string; onClose: () => void }) {
  const { t } = useTranslation();
  const canManage = useHasPermission('employees', 'manage');
  const [activeTab, setActiveTab] = useState<'overview' | 'leaveRequests' | 'terminations'>('overview');
  const initials = member.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('');
  const totalEarned = records.reduce((sum, r) => sum + r.quantity * r.ratePerPiece, 0);
  const totalPieces = records.reduce((sum, r) => sum + r.quantity, 0);
  const hasPiecework = records.length > 0;
  const extraParams = useMemo(() => ({ employee: String(member.id) }), [member.id]);
  const fixedValues = useMemo(() => ({ employee: String(member.id) }), [member.id]);
  const leaveConfig = useMemo(() => scopedFieldConfig(operationsConfigs.leaveRequests, canManage, 'employee'), [canManage]);
  const terminationConfig = useMemo(() => scopedFieldConfig(operationsConfigs.employeeTerminations, canManage, 'employee'), [canManage]);

  return (
    <div
      className="fixed inset-0 z-[190] grid place-items-center bg-background-overlay/72 px-3 backdrop-blur-[3px]"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section role="dialog" aria-modal="true" className="grid max-h-[90vh] w-full max-w-[1040px] grid-rows-[auto_1fr] overflow-hidden rounded-[28px] bg-surface-card shadow-[0_40px_110px_-42px_rgba(15,23,42,0.62)] ring-1 ring-border-soft/55">
        <div className="flex items-start justify-between gap-4 border-b border-border-soft/30 p-6">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-extrabold text-primary">{initials}</span>
            <div className="min-w-0">
              <h3 className="truncate font-display text-2xl font-extrabold text-text-primary">{member.name}</h3>
              <p className="mt-1 truncate text-sm text-text-muted">{optionLabel(t, 'employeePosition', member.role)}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge tone={statusTone(member.statusKey)}>{statusLabel(t, member.statusKey)}</StatusBadge>
                <span className="rounded-pill bg-surface-subtle px-2.5 py-0.5 text-[11px] font-bold text-text-secondary ring-1 ring-border-soft/40">{member.phone}</span>
                <span className="rounded-pill bg-surface-subtle px-2.5 py-0.5 text-[11px] font-bold text-text-secondary ring-1 ring-border-soft/40">{t('staff.columns.hireDate')}: {formatDisplayDate(member.hireDate, t)}</span>
                <span className="rounded-pill bg-surface-subtle px-2.5 py-0.5 text-[11px] font-bold text-text-secondary ring-1 ring-border-soft/40">{optionLabel(t, 'salaryType', member.shift)}</span>
              </div>
            </div>
          </div>
          <button type="button" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-subtle text-text-secondary transition duration-fast hover:bg-surface-muted hover:text-text-primary" onClick={onClose} aria-label={t('common.close')}>
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <SegmentTabs
            tabs={[
              { id: 'overview', label: t('staff.detail.overview'), icon: <FiUsers className="h-4 w-4" /> },
              { id: 'leaveRequests', label: t('admin.resources.leaveRequests.title'), icon: <FiCalendar className="h-4 w-4" /> },
              { id: 'terminations', label: t('admin.resources.employeeTerminations.title'), icon: <FiUserX className="h-4 w-4" /> },
            ]}
            activeTab={activeTab}
            onChange={id => setActiveTab(id as typeof activeTab)}
          />
          {activeTab === 'leaveRequests' ? (
            <div className="mt-4">
              <ApiResourceManager key={`leave-${member.id}`} config={leaveConfig} extraParams={extraParams} fixedValues={fixedValues} />
            </div>
          ) : activeTab === 'terminations' ? (
            <div className="mt-4">
              <ApiResourceManager key={`termination-${member.id}`} config={terminationConfig} extraParams={extraParams} fixedValues={fixedValues} />
            </div>
          ) : (
          <>
          <h4 className="mt-4 text-sm font-extrabold text-text-primary">{t('staff.detail.monthStats')}</h4>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-surface-subtle p-4 ring-1 ring-border-soft/30">
              <p className="text-xs text-text-muted">{t('staff.tabs.attendance')}</p>
              <p className="mt-1 text-2xl font-extrabold text-text-primary">{member.attendance}%</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-surface-muted">
                <div className={['h-full rounded-pill', member.attendance >= 90 ? 'bg-success' : member.attendance >= 75 ? 'bg-warning' : 'bg-danger'].join(' ')} style={{ width: `${member.attendance}%` }} />
              </div>
            </div>
            <div className="rounded-2xl bg-surface-subtle p-4 ring-1 ring-border-soft/30">
              <p className="text-xs text-text-muted">{t('staff.detail.arrivalTime')}</p>
              <p className="mt-1 text-xl font-extrabold text-text-primary">{member.arrival}</p>
              <p className="mt-0.5 text-xs text-text-muted">{t('staff.detail.leaving')}: {member.leaving}</p>
            </div>
            <div className="rounded-2xl bg-surface-subtle p-4 ring-1 ring-border-soft/30">
              <p className="text-xs text-text-muted">{t('staff.detail.baseSalary')}</p>
              <p className="mt-1 text-xl font-extrabold text-text-primary">{formatMoney(member.salary)}</p>
            </div>
            <div className={['rounded-2xl p-4 ring-1', hasPiecework ? 'bg-success/5 ring-success/20' : 'bg-surface-subtle ring-border-soft/30'].join(' ')}>
              <p className="text-xs text-text-muted">{t('staff.detail.pieceworkIncome')}</p>
              <p className={['mt-1 text-xl font-extrabold', hasPiecework ? 'text-success' : 'text-text-muted'].join(' ')}>{hasPiecework ? formatMoney(totalEarned) : '—'}</p>
              {hasPiecework && <p className="mt-0.5 text-xs text-text-muted">{totalPieces.toLocaleString()} {t('common.pcs')}</p>}
            </div>
          </div>

          <h4 className="mb-3 mt-6 text-sm font-extrabold text-text-primary">{t('staff.detail.pieceworkOperations')}</h4>
          {!hasPiecework ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border-soft/60 p-10 text-center text-sm text-text-muted">
              <FiTool className="h-6 w-6 shrink-0 opacity-50" />
              {t('staff.detail.noPieceworkData')}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl ring-1 ring-border-soft/30">
              <div className="grid gap-2 bg-surface-subtle/40 p-3 md:hidden">
                {records.map(r => (
                  <div key={r.id} className="grid gap-1.5 rounded-xl bg-surface-card p-3 ring-1 ring-border-soft/30">
                    <div className="flex items-center gap-2">
                      <FiTool className="h-3 w-3 shrink-0 text-primary" />
                      <span className="text-sm font-semibold text-text-primary">{r.operationName}</span>
                    </div>
                    <p className="text-xs text-text-muted">{r.product}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted">{r.quantity.toLocaleString()} × {formatMoney(r.ratePerPiece)}</span>
                      <span className="font-extrabold text-success">{formatMoney(r.quantity * r.ratePerPiece)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-xl bg-success/5 p-3">
                  <span className="text-sm font-extrabold text-text-primary">{t('staff.piecework.earned')}</span>
                  <span className="text-base font-extrabold text-success">{formatMoney(totalEarned)}</span>
                </div>
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-border-soft/20 bg-surface-subtle">
                      <th className="py-2.5 pl-4 pr-3 text-left text-xs font-extrabold uppercase tracking-wide text-text-muted">{t('staff.piecework.columns.operation')}</th>
                      <th className="px-3 py-2.5 text-left text-xs font-extrabold uppercase tracking-wide text-text-muted">{t('staff.piecework.columns.product')}</th>
                      <th className="px-3 py-2.5 text-right text-xs font-extrabold uppercase tracking-wide text-text-muted">{t('staff.piecework.columns.quantity')}</th>
                      <th className="px-3 py-2.5 text-right text-xs font-extrabold uppercase tracking-wide text-text-muted">{t('staff.piecework.columns.rate')}</th>
                      <th className="py-2.5 pl-3 pr-4 text-right text-xs font-extrabold uppercase tracking-wide text-text-muted">{t('staff.detail.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => (
                      <tr key={r.id} className="border-b border-border-soft/10 last:border-0">
                        <td className="py-3 pl-4 pr-3">
                          <div className="flex items-center gap-2">
                            <FiTool className="h-3 w-3 shrink-0 text-primary" />
                            <span className="font-semibold text-text-primary">{r.operationName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-text-muted">{r.product}</td>
                        <td className="px-3 py-3 text-right font-bold text-text-primary">{r.quantity.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-xs text-text-muted">{formatMoney(r.ratePerPiece)}</td>
                        <td className="py-3 pl-3 pr-4 text-right font-extrabold text-success">{formatMoney(r.quantity * r.ratePerPiece)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-success/5">
                      <td colSpan={4} className="py-3 pl-4 pr-3 text-sm font-extrabold text-text-primary">{t('staff.piecework.earned')}</td>
                      <td className="py-3 pl-3 pr-4 text-right text-base font-extrabold text-success">{formatMoney(totalEarned)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
          </>
          )}
        </div>
      </section>
    </div>
  );
}

export function StaffPage({ staff, staffFlow, pieceworkRecords, formatMoney, openModal, openDelete }: { staff: StaffMember[]; staffFlow: Array<{ day: string; came: number; late: number; left: number }>; pieceworkRecords: PieceworkRecord[]; formatMoney: (value: number) => string; openModal: (modal: ModalState) => void; openDelete: (modal: ModalState) => void }) {
  const { t } = useTranslation();
  const exportResource = useResourceExport();
  const canManage = useHasPermission('employees', 'manage');
  const [activeTab, setActiveTab] = useState<'employees' | 'attendance' | 'piecework' | 'departments'>('employees');
  const [attendanceSubTab, setAttendanceSubTab] = useState<'overview' | 'schedules' | 'devices' | 'records' | 'events'>('overview');
  const [enrolling, setEnrolling] = useState(false);
  const onTimeCount = staff.filter(m => m.statusKey === 'onTime').length;
  const lateCount = staff.filter(m => m.statusKey === 'late').length;
  const avgAttendance = staff.length > 0 ? (staff.reduce((sum, m) => sum + m.attendance, 0) / staff.length).toFixed(1) : '0';

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('staff.eyebrow')} title={t('staff.title')} description={t('staff.description')} createLabel={canManage && activeTab !== 'departments' && !(activeTab === 'attendance' && attendanceSubTab !== 'overview') ? t('staff.create') : undefined} onCreate={canManage && activeTab !== 'departments' && !(activeTab === 'attendance' && attendanceSubTab !== 'overview') ? () => openModal({ kind: 'staff', mode: 'create' }) : undefined} onExport={() => exportResource(activeTab === 'departments' ? resources.departments : activeTab === 'attendance' ? (attendanceSubTab === 'schedules' ? resources.workSchedules : attendanceSubTab === 'devices' ? resources.attendanceDevices : attendanceSubTab === 'records' ? resources.attendanceRecords : attendanceSubTab === 'events' ? resources.attendanceEvents : resources.attendanceRecords) : resources.employees)} />
      <SegmentTabs
        tabs={[
          { id: 'employees', label: t('staff.tabs.employees'), icon: <FiUsers className="h-4 w-4" /> },
          { id: 'attendance', label: t('staff.tabs.attendance'), icon: <FiClock className="h-4 w-4" /> },
          { id: 'piecework', label: t('staff.tabs.piecework'), icon: <FiTool className="h-4 w-4" /> },
          { id: 'departments', label: t('admin.resources.departments.title'), icon: <FiBriefcase className="h-4 w-4" /> },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as 'employees' | 'attendance' | 'piecework' | 'departments')}
      />
      {activeTab === 'employees' ? (
        <EmployeeGrid staff={staff} pieceworkRecords={pieceworkRecords} formatMoney={formatMoney} openModal={openModal} openDelete={openDelete} />
      ) : activeTab === 'piecework' ? (
        <PieceworkTab staff={staff} pieceworkRecords={pieceworkRecords} formatMoney={formatMoney} />
      ) : activeTab === 'departments' ? (
        <ApiResourceManager config={{ ...operationsConfigs.departments, readOnly: !canManage }} />
      ) : (
        <>
          <SegmentTabs
            tabs={[
              { id: 'overview', label: t('staff.detail.overview'), icon: <FiClock className="h-4 w-4" /> },
              { id: 'records', label: t('admin.resources.attendanceRecords.title'), icon: <FiCheckCircle className="h-4 w-4" /> },
              { id: 'events', label: t('admin.resources.attendanceEvents.title'), icon: <FiActivity className="h-4 w-4" /> },
              { id: 'schedules', label: t('admin.resources.schedules.title'), icon: <FiCalendar className="h-4 w-4" /> },
              { id: 'devices', label: t('admin.resources.devices.title'), icon: <FiCpu className="h-4 w-4" /> },
            ]}
            activeTab={attendanceSubTab}
            onChange={id => setAttendanceSubTab(id as typeof attendanceSubTab)}
          />
          {canManage ? <div className="flex justify-end"><button className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground" onClick={() => setEnrolling(true)}>{t('faceEnroll.buttonLabel')}</button></div> : null}
          {attendanceSubTab === 'schedules' ? (
            <ApiResourceManager config={{ ...operationsConfigs.schedules, readOnly: !canManage }} />
          ) : attendanceSubTab === 'devices' ? (
            <ApiResourceManager config={{ ...operationsConfigs.devices, readOnly: !canManage }} />
          ) : attendanceSubTab === 'records' ? (
            <ApiResourceManager config={{ ...operationsConfigs.attendanceRecords, readOnly: !canManage }} />
          ) : attendanceSubTab === 'events' ? (
            <ApiResourceManager config={operationsConfigs.attendanceEvents} />
          ) : (
          <>
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard icon={<FiCheckCircle />} label={t('staff.metrics.onTime')} value={String(onTimeCount)} caption={t('staff.metrics.onTimeCaption')} tone="success" />
            <MetricCard icon={<FiClock />} label={t('staff.metrics.late')} value={String(lateCount)} caption={t('staff.metrics.lateCaption')} tone="warning" />
            <MetricCard icon={<FiUsers />} label={t('staff.metrics.attendance')} value={`${avgAttendance}%`} caption={t('staff.metrics.attendanceCaption')} tone="info" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(['onTime', 'late', 'leftEarly', 'remote'] as const).map(key => {
              const toneMap = { onTime: 'success', late: 'warning', leftEarly: 'danger', remote: 'info' } as const;
              const members = staff.filter(m => m.statusKey === key);
              return (
                <div key={key} className="app-card--nova p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <StatusBadge tone={toneMap[key]}>{t(`statuses.${key}`)}</StatusBadge>
                    <span className="text-sm font-bold text-text-muted">({members.length})</span>
                  </div>
                  {members.length === 0 ? (
                    <p className="text-sm text-text-muted">—</p>
                  ) : (
                    <div className="grid gap-2">
                      {members.map(m => {
                        const initials = m.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('');
                        return (
                          <div key={m.id} className="flex items-center gap-2 rounded-xl bg-surface-subtle p-2.5">
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-extrabold text-primary">{initials}</span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-text-primary">{m.name}</p>
                              <p className="text-[10px] text-text-muted">{m.arrival} → {m.leaving}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Panel title={t('staff.flowTitle')} action={t('common.report')}>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={staffFlow} barGap={8} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border-soft))" opacity={0.55} vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: 'rgb(var(--color-text-muted))', fontSize: 12, fontWeight: 700 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: 'rgb(var(--color-text-muted))', fontSize: 12, fontWeight: 700 }} />
                  <Tooltip content={<PremiumTooltip />} cursor={false} />
                  <Bar name={t('staff.columns.arrival')} dataKey="came" fill="#6366f1" radius={[10, 10, 4, 4]}>
                    <LabelList dataKey="came" position="top" className="fill-text-secondary text-[11px] font-bold" />
                  </Bar>
                  <Bar name={t('statuses.late')} dataKey="late" fill="#f59e0b" radius={[10, 10, 4, 4]}>
                    <LabelList dataKey="late" position="top" className="fill-text-secondary text-[11px] font-bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          </>
          )}
        </>
      )}
      {enrolling ? <FaceEnrollDrawer onClose={() => setEnrolling(false)} onEnrolled={() => setEnrolling(false)} /> : null}
    </div>
  );
}

export function OrdersPage({ orders, productionRecords, formatMoney, openModal, openDelete }: { orders: Order[]; productionRecords: ProductionRecord[]; formatMoney: (value: number) => string; openModal: (modal: ModalState) => void; openDelete: (modal: ModalState) => void }) {
  const { t } = useTranslation();
  const exportResource = useResourceExport();
  const canManage = useHasPermission('clients', 'manage');
  const [activeTab, setActiveTab] = useState<'orders' | 'production'>('orders');
  const [viewingItemsFor, setViewingItemsFor] = useState<Order | null>(null);
  const pending = orders.filter(o => o.statusKey === 'draft').length;
  const inProd = orders.filter(o => o.statusKey === 'confirmed').length;
  const delivered = orders.filter(o => o.statusKey === 'completed').length;

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('orders.eyebrow')} title={t('orders.title')} description={t('orders.description')} createLabel={activeTab === 'orders' && canManage ? t('orders.create') : undefined} onCreate={activeTab === 'orders' && canManage ? () => openModal({ kind: 'order', mode: 'create' }) : undefined} onExport={() => exportResource(activeTab === 'orders' ? resources.clientOrders : resources.dailyWorkEntries)} />
      <div className="flex flex-wrap gap-3">
        {([
          { label: t('orders.metrics.total'), value: orders.length, tone: 'text-text-primary bg-surface-subtle' },
          { label: t('orders.metrics.pending'), value: pending, tone: 'text-warning bg-warning/8' },
          { label: t('orders.metrics.production'), value: inProd, tone: 'text-primary bg-primary/8' },
          { label: t('orders.metrics.delivered'), value: delivered, tone: 'text-success bg-success/8' },
        ] as const).map(chip => (
          <div key={chip.label} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ring-1 ring-border-soft/30 ${chip.tone}`}>
            <span className="text-lg font-extrabold">{chip.value}</span>
            <span className="text-xs font-semibold opacity-80">{chip.label}</span>
          </div>
        ))}
      </div>
      <SegmentTabs
        tabs={[
          { id: 'orders', label: t('orders.tabs.orders'), icon: <FiShoppingBag className="h-4 w-4" /> },
          { id: 'production', label: t('orders.tabs.production'), icon: <FiTool className="h-4 w-4" /> },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />
      {activeTab === 'orders' ? (
        <DataTable
          columns={[t('orders.columns.orderId'), t('orders.columns.client'), t('orders.columns.total'), t('orders.columns.dueDate'), t('orders.columns.status'), t('common.actions')]}
          rows={orders.map(order => [
            <PrimaryCell title={order.orderId} subtitle={formatDisplayDate(order.orderDate, t)} />,
            order.client,
            formatMoney(order.totalAmount),
            formatDisplayDate(order.dueDate, t),
            <StatusBadge tone={orderStatusTone(order.statusKey)}>{statusLabel(t, order.statusKey)}</StatusBadge>,
            <div className="flex items-center gap-2">
              <button className="rounded-lg bg-surface-subtle px-2.5 py-1.5 text-xs font-bold text-text-secondary transition hover:bg-primary/10 hover:text-text-primary" onClick={event => { event.stopPropagation(); setViewingItemsFor(order); }}>{t('orders.items')}</button>
              <RowActions onView={() => openModal({ kind: 'order', mode: 'view', item: order })} onEdit={canManage ? () => openModal({ kind: 'order', mode: 'edit', item: order }) : undefined} onDelete={canManage ? () => openDelete({ kind: 'order', mode: 'view', item: order }) : undefined} />
            </div>,
          ])}
          onRowClick={(rowIndex) => openModal({ kind: 'order', mode: 'view', item: orders[rowIndex] })}
        />
      ) : (
        <ProductionTab records={productionRecords} orders={orders} formatMoney={formatMoney} />
      )}
      {viewingItemsFor ? (
        <ScopedResourceModal
          title={viewingItemsFor.orderId}
          subtitle={t('admin.resources.orderItems.title')}
          config={{ ...operationsConfigs.orderItems, readOnly: !canManage }}
          extraParams={{ order: String(viewingItemsFor.id) }}
          fixedValues={{ order: String(viewingItemsFor.id) }}
          onClose={() => setViewingItemsFor(null)}
        />
      ) : null}
    </div>
  );
}

function BomProductSection({ product, materials, canManage, formatMoney, onChanged }: { product: Product; materials: Material[]; canManage: boolean; formatMoney: (v: number) => string; onChanged: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { confirm: confirmDialog } = useDialog();
  const [adding, setAdding] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [newMaterial, setNewMaterial] = useState('');
  const [newQty, setNewQty] = useState('');
  const [saving, setSaving] = useState(false);
  const recipe = product.recipe ?? [];
  const totalQty = recipe.reduce((sum, r) => sum + r.qtyPerUnit * product.sold, 0);
  const availableMaterials = materials.filter(m => !recipe.some(r => r.materialId === String(m.id)));

  async function addNorm() {
    if (!newMaterial || !newQty || Number(newQty) <= 0) {
      toast(t('admin.ui.requiredFieldsMissing'), 'danger');
      return;
    }
    setSaving(true);
    try {
      await api.create(resources.productMaterialNorms, { product: product.id, material: newMaterial, norm_per_unit: newQty });
      toast(t('admin.ui.savedOk'), 'success');
      setAdding(false);
      setNewMaterial('');
      setNewQty('');
      onChanged();
    } catch (error) {
      toast(apiErrorMessage(error, t), 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function removeNorm(normId: string) {
    const item = recipe.find(row => row.id === normId);
    const ok = await confirmDialog({
      title: t('deleteDialog.title'),
      message: t('products.bom.deleteConfirm', { material: item?.materialName ?? t('common.notRequired'), product: product.name }),
      confirmLabel: t('common.delete'),
      danger: true,
    });
    if (!ok) return;
    try {
      await api.remove(resources.productMaterialNorms, normId);
      toast(t('admin.ui.archivedOk'), 'success');
      onChanged();
    } catch (error) {
      toast(apiErrorMessage(error, t), 'danger');
    }
  }

  return (
    <section className="app-card--nova overflow-hidden">
      <button
        type="button"
        className={['flex w-full flex-col items-start gap-4 p-5 text-left transition hover:bg-primary/5 sm:flex-row sm:items-center', isOpen || adding ? 'border-b border-border-soft/30' : ''].join(' ')}
        onClick={() => setIsOpen(open => !open)}
        aria-expanded={isOpen || adding}
      >
        <div className="flex min-w-0 w-full items-center gap-4 sm:w-auto sm:flex-1">
          <img src={product.imageUrl} alt={product.name} className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-border-soft/50" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-3">
              <h3 className="min-w-0 truncate text-base font-extrabold text-text-primary">{product.name}</h3>
              <span className="shrink-0 rounded-pill bg-surface-subtle px-2.5 py-0.5 text-xs font-bold text-text-muted ring-1 ring-border-soft/40">{product.sku}</span>
            </div>
            <p className="mt-1 text-sm text-text-muted">
              <span className="font-bold text-text-primary">{product.sold.toLocaleString()} {unitLabel(product.unit, t)}</span>&nbsp;{t('products.bom.produced').toLowerCase()} · {recipe.length} {t('products.bom.totalCount')}
            </p>
          </div>
        </div>
        <div className="shrink-0 self-stretch text-right sm:self-auto">
          <p className="text-xs text-text-muted">{t('products.metrics.revenue')}</p>
          <p className="text-lg font-extrabold text-success">{formatMoney(product.revenue)}</p>
        </div>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-subtle text-text-secondary ring-1 ring-border-soft/45">
          <FiChevronRight className={['h-4 w-4 transition-transform', isOpen || adding ? 'rotate-90' : ''].join(' ')} />
        </span>
      </button>
      {(isOpen || adding) && recipe.length === 0 && !adding ? (
        <div className="flex flex-col items-center gap-2 p-8 text-center">
          <FiLayers className="h-6 w-6 text-text-muted opacity-50" />
          <p className="text-sm font-semibold text-text-muted">{t('products.bom.noRecipe')}</p>
        </div>
      ) : isOpen || adding ? (
        <>
          <div className="grid gap-2 bg-surface-subtle/30 p-3 md:hidden">
            {recipe.map(item => {
              const total = item.qtyPerUnit * product.sold;
              const pct = totalQty > 0 ? Math.round((total / totalQty) * 100) : 0;
              return (
                <div key={item.id} className="grid gap-2 rounded-xl bg-surface-card p-3 ring-1 ring-border-soft/30">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FiLayers className="h-3.5 w-3.5" /></span>
                      <span className="min-w-0 truncate font-semibold text-text-primary">{item.materialName}</span>
                    </div>
                    {canManage ? (
                      <button className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger-bg text-danger transition hover:bg-danger/15" title={t('common.delete')} onClick={() => void removeNorm(item.id)}>
                        <FiX className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span className="text-text-muted">{t('products.bom.perUnit')}: <span className="font-mono font-bold text-text-secondary">{item.qtyPerUnit} {unitLabel(item.unit, t)}</span></span>
                    <span className="text-text-muted">{t('products.bom.produced')}: × {product.sold.toLocaleString()}</span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted">{t('products.bom.totalUsed')}</span>
                      <span className="font-extrabold text-text-primary">{total.toLocaleString()} {unitLabel(item.unit, t)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-pill bg-surface-muted">
                      <div className="h-full rounded-pill bg-primary/70" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border-soft/25 bg-surface-subtle">
                  <th className="py-3 pl-5 pr-3 text-left text-xs font-extrabold uppercase tracking-wide text-text-muted">{t('materials.columns.name')}</th>
                  <th className="px-3 py-3 text-right text-xs font-extrabold uppercase tracking-wide text-text-muted">{t('products.bom.perUnit')}</th>
                  <th className="px-3 py-3 text-right text-xs font-extrabold uppercase tracking-wide text-text-muted">{t('products.bom.produced')}</th>
                  <th className="py-3 pl-3 pr-3 text-right text-xs font-extrabold uppercase tracking-wide text-text-muted">{t('products.bom.totalUsed')}</th>
                  {canManage ? <th className="py-3 pl-3 pr-5"></th> : null}
                </tr>
              </thead>
              <tbody>
                {recipe.map(item => {
                  const total = item.qtyPerUnit * product.sold;
                  const pct = totalQty > 0 ? Math.round((total / totalQty) * 100) : 0;
                  return (
                    <tr key={item.id} className="border-b border-border-soft/15 transition hover:bg-surface-subtle/60">
                      <td className="py-4 pl-5 pr-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FiLayers className="h-3.5 w-3.5" /></span>
                          <span className="font-semibold text-text-primary">{item.materialName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-right font-mono text-xs font-bold text-text-secondary">
                        {item.qtyPerUnit} {unitLabel(item.unit, t)}
                      </td>
                      <td className="px-3 py-4 text-right text-xs text-text-muted">
                        × {product.sold.toLocaleString()}
                      </td>
                      <td className="py-4 pl-3 pr-3">
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="font-extrabold text-text-primary">{total.toLocaleString()} {unitLabel(item.unit, t)}</span>
                          <div className="h-1.5 w-24 overflow-hidden rounded-pill bg-surface-muted">
                            <div className="h-full rounded-pill bg-primary/70" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </td>
                      {canManage ? (
                        <td className="py-4 pl-3 pr-5 text-right">
                          <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-danger-bg text-danger transition hover:bg-danger/15" title={t('common.delete')} onClick={() => void removeNorm(item.id)}>
                            <FiX className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {canManage ? (
        adding ? (
          <div className="grid gap-3 border-t border-border-soft/20 bg-surface-subtle/40 p-5 sm:grid-cols-[1fr_140px_auto_auto]">
            <Dropdown value={newMaterial} onChange={setNewMaterial} options={availableMaterials.map(m => ({ value: String(m.id), label: m.name }))} placeholder={t('admin.ui.selectPlaceholder')} />
            <input type="number" step="0.000001" min="0" value={newQty} onChange={event => setNewQty(event.target.value)} placeholder={t('admin.fields.normPerUnit')} className="h-11 w-full rounded-xl border border-border-soft bg-surface-card px-3 text-sm text-text-primary outline-none focus:border-primary/50" />
            <button disabled={saving} className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50" onClick={() => void addNorm()}>
              {saving ? t('common.loading') : t('common.save')}
            </button>
            <button className="inline-flex h-11 items-center justify-center rounded-xl bg-surface-subtle px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-muted" onClick={() => setAdding(false)}>
              {t('common.cancel')}
            </button>
          </div>
        ) : (
          <div className={['border-border-soft/20 p-4', isOpen ? 'border-t' : ''].join(' ')}>
            <button className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-text-accent transition hover:bg-primary/20" onClick={() => setAdding(true)}>
              + {t('products.bom.addMaterial')}
            </button>
          </div>
        )
      ) : null}
    </section>
  );
}

function BomView({ products, materials, canManage, formatMoney, onChanged }: { products: Product[]; materials: Material[]; canManage: boolean; formatMoney: (v: number) => string; onChanged: () => void }) {
  return (
    <div className="grid gap-5">
      {products.map(product => (
        <BomProductSection key={product.id} product={product} materials={materials} canManage={canManage} formatMoney={formatMoney} onChanged={onChanged} />
      ))}
    </div>
  );
}

export function ProductsPage({ products, categoryAnalytics, categories, materials, totalStock, lowStockCount, formatMoney, openModal, openDelete, onDataChanged }: {
  products: Product[];
  categoryAnalytics: CategoryDatum[];
  categories: ProductCategory[];
  materials: Material[];
  totalStock: number;
  lowStockCount: number;
  formatMoney: (value: number) => string;
  openModal: (modal: ModalState) => void;
  openDelete: (modal: ModalState) => void;
  onDataChanged: () => void;
}) {
  const { t } = useTranslation();
  const exportResource = useResourceExport();
  const canManage = useHasPermission('products', 'manage');
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'bom'>('products');
  const totalRevenue = products.reduce((sum, product) => sum + product.revenue, 0);
  const categoryColors = useMemo(() => loadCategoryColors(), []);

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow={t('products.eyebrow')}
        title={activeTab === 'categories' ? t('products.tabs.categories') : t('products.title')}
        description={activeTab === 'categories' ? t('products.categoryDescription') : t('products.description')}
        createLabel={canManage ? (activeTab === 'categories' ? t('products.createCategory') : t('products.create')) : undefined}
        onCreate={canManage ? (activeTab === 'categories' ? () => openModal({ kind: 'category', mode: 'create' }) : () => openModal({ kind: 'product', mode: 'create' })) : undefined}
        onExport={activeTab === 'categories' ? () => exportResource(resources.productCategories) : activeTab === 'products' ? () => exportResource(resources.products) : undefined}
      />
      {activeTab === 'products' ? (
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard icon={<FiPackage />} label={t('products.metrics.revenue')} value={formatMoney(totalRevenue)} caption={t('products.metrics.revenueCaption')} tone="success" />
          <MetricCard icon={<FiArchive />} label={t('products.metrics.stock')} value={totalStock.toLocaleString()} caption={t('products.metrics.stockCaption')} tone="info" />
          <MetricCard icon={<FiSliders />} label={t('products.metrics.lowStock')} value={lowStockCount.toString()} caption={t('products.metrics.lowStockCaption')} tone="warning" />
        </div>
      ) : null}
      <SegmentTabs
        tabs={[
          { id: 'products', label: t('products.tabs.products'), icon: <FiPackage /> },
          { id: 'categories', label: t('products.tabs.categories'), icon: <FiTag /> },
          { id: 'bom', label: t('products.tabs.bom'), icon: <FiLayers /> },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as 'products' | 'categories' | 'bom')}
      />

      {activeTab === 'categories' && <CategoriesTable categories={categories} products={products} openModal={openModal} openDelete={openDelete} />}
      {activeTab === 'products' && (<DataTable
        columns={[t('products.columns.product'), t('products.columns.sku'), t('products.columns.category'), t('products.columns.stock'), t('products.columns.revenue'), t('common.actions')]}
        rows={products.map(product => [
          <span className="flex min-w-0 max-w-full items-center gap-3">
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-surface-muted ring-1 ring-border-soft/50">
              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
            </span>
            <span className="block min-w-0">
              <span className="block max-w-[200px] truncate text-sm font-extrabold text-text-primary">{product.name}</span>
              {product.materialsUsed && product.materialsUsed.length > 0 ? (
                <span className="mt-1 flex flex-wrap gap-1">
                  {product.materialsUsed.slice(0, 2).map(mat => (
                    <span key={mat} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-text-accent">{mat}</span>
                  ))}
                </span>
              ) : <span className="block text-xs text-text-muted">{product.color} · {product.composition}</span>}
            </span>
          </span>,
          <SkuCell sku={product.sku} />,
          (() => {
            const categoryIndex = categories.findIndex(category => category.id === product.categoryId);
            const categoryName = categoryIndex >= 0 ? categories[categoryIndex].name : product.category;
            if (categoryIndex < 0) return categoryName;
            return (
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: categoryColor(String(categories[categoryIndex].id), categoryIndex, categoryColors) }} />
                {categoryName}
              </span>
            );
          })(),
          <span className={product.stock <= product.minStock ? 'font-bold text-warning' : 'font-bold text-text-primary'}>{product.stock.toLocaleString()} {unitLabel(product.unit, t)}</span>,
          formatMoney(product.revenue),
          <RowActions onView={() => openModal({ kind: 'product', mode: 'view', item: product })} onEdit={canManage ? () => openModal({ kind: 'product', mode: 'edit', item: product }) : undefined} onDelete={canManage ? () => openDelete({ kind: 'product', mode: 'view', item: product }) : undefined} />,
        ])}
        onRowClick={(rowIndex) => openModal({ kind: 'product', mode: 'view', item: products[rowIndex] })}
      />
      )}
      {activeTab === 'bom' && <BomView products={products} materials={materials} canManage={canManage} formatMoney={formatMoney} onChanged={onDataChanged} />}
    </div>
  );
}

export function ProductsAnalyticsPanel({ categoryAnalytics }: { products: Product[]; categoryAnalytics: CategoryDatum[]; formatMoney: (value: number) => string }) {
  const { t } = useTranslation();
  const topCategory = categoryAnalytics[0];

  return (
    <Panel title={t('products.categoryTitle')} action={t('common.analytics')}>
      <div className="relative h-[270px]">
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="mt-1 text-center">
            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.16em] text-text-muted">{topCategory?.name}</p>
            <p className="m-0 mt-1 text-3xl font-extrabold tracking-[-0.04em] text-text-primary">{topCategory?.value}%</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {categoryAnalytics.map(item => (
                <linearGradient key={item.name} id={`pie-${item.color.replace('#', '')}`} x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor={item.color} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={item.color} stopOpacity={0.58} />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={categoryAnalytics}
              innerRadius={68}
              outerRadius={104}
              dataKey="value"
              paddingAngle={5}
              cornerRadius={9}
              stroke="rgb(var(--color-surface-card))"
              strokeWidth={4}
            >
              {categoryAnalytics.map(item => <Cell key={item.name} fill={`url(#pie-${item.color.replace('#', '')})`} />)}
            </Pie>
            <Tooltip content={<PremiumTooltip />} cursor={false} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid gap-2.5">
        {categoryAnalytics.map(item => (
          <div key={item.name} className="group rounded-2xl border border-border-soft/50 bg-surface-card/70 p-3 shadow-sm transition duration-fast hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_18px_36px_-28px_rgb(var(--color-primary)/0.5)]">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 font-bold text-text-primary">
                <span className="h-3 w-3 shrink-0 rounded-full ring-4 ring-primary/8" style={{ backgroundColor: item.color }} />
                <span className="truncate">{item.name}</span>
              </span>
              <span className="rounded-pill bg-primary/10 px-2.5 py-1 text-xs font-extrabold text-text-accent">{item.value}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-pill bg-surface-muted">
              <div className="h-full rounded-pill" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function ProductImageCell({ product }: { product: Product }) {
  return (
    <span className="flex min-w-0 max-w-full items-center gap-3" title={product.name}>
      <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-muted ring-1 ring-border-soft/50">
        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
      </span>
      <span className="block min-w-0">
        <span className="block max-w-[260px] truncate text-sm font-extrabold text-text-primary">{product.name}</span>
        <span className="mt-1 block max-w-[260px] truncate text-xs font-semibold text-text-muted">{product.color} · {product.composition}</span>
      </span>
    </span>
  );
}

export function SkuCell({ sku }: { sku: string }) {
  return (
    <span
      className="block max-w-[130px] truncate rounded-lg bg-surface-subtle px-2.5 py-1 text-xs font-extrabold text-text-primary ring-1 ring-border-soft/45"
      title={sku}
    >
      {sku}
    </span>
  );
}

export function CategoriesTable({ categories, products, openModal, openDelete }: { categories: ProductCategory[]; products: Product[]; openModal: (modal: ModalState) => void; openDelete: (modal: ModalState) => void }) {
  const { t } = useTranslation();
  const [colors, setColors] = useState<Record<string, string>>(() => loadCategoryColors());

  function setColor(categoryId: string, color: string) {
    const next = { ...colors, [categoryId]: color };
    setColors(next);
    saveCategoryColors(next);
  }

  return (
    <DataTable
      rows={categories.map((category, index) => {
        const count = products.filter(product => product.categoryId === category.id).length;
        return [
          <span className="flex items-center gap-2.5">
            <CategoryColorPicker categoryId={String(category.id)} color={categoryColor(String(category.id), index, colors)} onPick={setColor} />
            <span className="font-semibold text-text-primary">{category.name}</span>
          </span>,
          <span className="font-bold text-text-primary">{count}</span>,
          <RowActions onView={() => openModal({ kind: 'category', mode: 'view', item: category })} onEdit={() => openModal({ kind: 'category', mode: 'edit', item: category })} onDelete={() => openDelete({ kind: 'category', mode: 'view', item: category })} />,
        ];
      })}
      columns={[
        t('products.categoryColumns.category'),
        t('products.categoryColumns.products'),
        t('common.actions'),
      ]}
      onRowClick={(rowIndex) => openModal({ kind: 'category', mode: 'view', item: categories[rowIndex] })}
    />
  );
}

function CategoryColorPicker({ categoryId, color, onPick }: { categoryId: string; color: string; onPick: (categoryId: string, color: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex" onClick={event => event.stopPropagation()}>
      <button
        type="button"
        className="h-4 w-4 shrink-0 rounded-full ring-2 ring-border-soft/40 transition hover:scale-110"
        style={{ backgroundColor: color }}
        onClick={() => setOpen(current => !current)}
        aria-label={t('products.categoryColumns.color')}
        title={t('products.categoryColumns.color')}
      />
      {open ? (
        <span className="absolute left-0 top-6 z-30 flex w-[132px] flex-wrap gap-1.5 rounded-xl bg-surface-card p-2.5 shadow-[0_18px_40px_-20px_rgba(15,23,42,0.5)] ring-1 ring-border-soft/50">
          {CATEGORY_COLOR_PALETTE.map(swatch => (
            <button
              key={swatch}
              type="button"
              className={['h-6 w-6 rounded-full ring-2 transition hover:scale-110', swatch === color ? 'ring-text-primary' : 'ring-transparent hover:ring-border-soft/60'].join(' ')}
              style={{ backgroundColor: swatch }}
              onClick={() => { onPick(categoryId, swatch); setOpen(false); }}
              aria-label={swatch}
            />
          ))}
        </span>
      ) : null}
    </span>
  );
}

function ScopedResourceModal({ title, subtitle, config, extraParams, fixedValues, onClose }: {
  title: string;
  subtitle?: string;
  config: ResourceConfig;
  extraParams: Record<string, string>;
  fixedValues: Record<string, unknown>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-[190] grid place-items-center bg-background-overlay/72 px-3 backdrop-blur-[3px]" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" className="grid max-h-[88vh] w-full max-w-[880px] grid-rows-[auto_1fr] overflow-hidden rounded-[28px] bg-surface-card shadow-[0_40px_110px_-42px_rgba(15,23,42,0.62)] ring-1 ring-border-soft/55">
        <div className="flex items-start justify-between gap-4 border-b border-border-soft/30 p-6">
          <div className="min-w-0">
            {subtitle ? <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{subtitle}</p> : null}
            <h3 className="mt-1 truncate font-display text-xl font-extrabold text-text-primary">{title}</h3>
          </div>
          <button type="button" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-subtle text-text-secondary transition duration-fast hover:bg-surface-muted hover:text-text-primary" onClick={onClose} aria-label={t('common.close')}>
            <FiX className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-6">
          <ApiResourceManager config={config} extraParams={extraParams} fixedValues={fixedValues} />
        </div>
      </section>
    </div>
  );
}

export function MaterialsPage({ materials, formatMoney, onCreate, openModal, openDelete }: { materials: Material[]; formatMoney: (value: number) => string; onCreate: () => void; openModal: (modal: ModalState) => void; openDelete: (modal: ModalState) => void }) {
  const { t } = useTranslation();
  const exportResource = useResourceExport();
  const canManage = useHasPermission('materials', 'manage');
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'materials' | 'suppliers' | 'stock'>('materials');
  const [viewingPurchasesFor, setViewingPurchasesFor] = useState<Material | null>(null);
  const lowStockCount = materials.filter(m => m.stock <= m.minStock).length;
  const totalValue = materials.reduce((sum, m) => sum + m.stock * m.price, 0);
  const filtered = materials.filter(m =>
    `${m.name} ${m.supplier}`.toLowerCase().includes(query.toLowerCase())
  );
  const purchasesConfig = useMemo(() => {
    if (!viewingPurchasesFor) return null;
    const base = operationsConfigs.materialPurchases;
    return { ...base, readOnly: !canManage, fields: base.fields.map(field => (field.name === 'material' ? { ...field, readOnly: true, table: false } : field)) };
  }, [viewingPurchasesFor, canManage]);

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('materials.eyebrow')} title={t('materials.title')} description={t('materials.description')} createLabel={canManage && activeTab === 'materials' ? t('materials.create') : undefined} onCreate={canManage && activeTab === 'materials' ? onCreate : undefined} onExport={() => exportResource(activeTab === 'suppliers' ? resources.suppliers : activeTab === 'stock' ? resources.materialStocks : resources.materials)} />
      <SegmentTabs
        tabs={[
          { id: 'materials', label: t('materials.title'), icon: <FiLayers className="h-4 w-4" /> },
          { id: 'suppliers', label: t('admin.resources.suppliers.title'), icon: <FiBriefcase className="h-4 w-4" /> },
          { id: 'stock', label: t('admin.resources.materialStocks.title'), icon: <FiArchive className="h-4 w-4" /> },
        ]}
        activeTab={activeTab}
        onChange={id => setActiveTab(id as typeof activeTab)}
      />
      {activeTab === 'suppliers' ? (
        <ApiResourceManager config={{ ...operationsConfigs.suppliers, readOnly: !canManage }} />
      ) : activeTab === 'stock' ? (
        <ApiResourceManager config={operationsConfigs.materialStocks} />
      ) : (
        <>
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-surface-subtle px-4 py-2.5 text-sm font-bold ring-1 ring-border-soft/30">
          <span className="text-lg font-extrabold text-text-primary">{materials.length}</span>
          <span className="text-xs font-semibold text-text-muted">{t('materials.metrics.total')}</span>
        </div>
        {lowStockCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-warning/8 px-4 py-2.5 text-sm font-bold ring-1 ring-warning/20">
            <FiAlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-lg font-extrabold text-warning">{lowStockCount}</span>
            <span className="text-xs font-semibold text-warning/80">{t('materials.metrics.lowStock')}</span>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-xl bg-success/8 px-4 py-2.5 text-sm font-bold ring-1 ring-success/20">
          <span className="text-lg font-extrabold text-success">{formatMoney(totalValue)}</span>
          <span className="text-xs font-semibold text-success/80">{t('materials.metrics.totalValue')}</span>
        </div>
      </div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={t('materials.searchPlaceholder')}
        className="h-11 w-full rounded-xl border border-border-soft bg-surface-card px-4 text-sm font-medium text-text-primary placeholder:text-text-muted outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
      />
      <DataTable
        columns={[t('materials.columns.name'), t('materials.columns.stock'), t('materials.columns.price'), t('materials.columns.status'), t('common.actions')]}
        rows={filtered.map(mat => {
          const pct = Math.min(100, Math.round((mat.stock / Math.max(mat.minStock, 1)) * 100));
          return [
            <span className="block min-w-0">
              <span className="block max-w-[220px] truncate text-sm font-bold text-text-primary">{mat.name}</span>
              <span className="text-xs text-text-muted">{mat.supplier}</span>
            </span>,
            <span className="block min-w-[120px]">
              <span className={['block text-sm font-bold', mat.stock <= mat.minStock ? 'text-warning' : 'text-text-primary'].join(' ')}>{mat.stock.toLocaleString()} {unitLabel(mat.unit, t)}</span>
              <div className="mt-1 h-1.5 w-full max-w-[100px] overflow-hidden rounded-pill bg-surface-muted">
                <div className={['h-full rounded-pill', mat.stock <= mat.minStock ? 'bg-warning' : 'bg-success'].join(' ')} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </span>,
            <span className="font-semibold text-text-primary">{formatMoney(mat.price)}<span className="ml-1 text-xs text-text-muted">/{unitLabel(mat.unit, t)}</span></span>,
            <StatusBadge tone={materialStatusTone(mat.statusKey)}>{statusLabel(t, mat.statusKey)}</StatusBadge>,
            <div className="flex items-center gap-2">
              <button className="rounded-lg bg-surface-subtle px-2.5 py-1.5 text-xs font-bold text-text-secondary transition hover:bg-primary/10 hover:text-text-primary" onClick={() => setViewingPurchasesFor(mat)}>{t('materials.purchases')}</button>
              <RowActions onView={() => openModal({ kind: 'material', mode: 'view', item: mat })} onEdit={canManage ? () => openModal({ kind: 'material', mode: 'edit', item: mat }) : undefined} onDelete={canManage ? () => openDelete({ kind: 'material', mode: 'view', item: mat }) : undefined} />
            </div>,
          ];
        })}
      />
        </>
      )}
      {viewingPurchasesFor && purchasesConfig ? (
        <ScopedResourceModal
          title={viewingPurchasesFor.name}
          subtitle={t('admin.resources.materialPurchases.title')}
          config={purchasesConfig}
          extraParams={{ material: String(viewingPurchasesFor.id) }}
          fixedValues={{ material: String(viewingPurchasesFor.id) }}
          onClose={() => setViewingPurchasesFor(null)}
        />
      ) : null}
    </div>
  );
}

const WORKING_DAYS = 26;

function PayrollTab() {
  const { t } = useTranslation();
  const { prompt } = useDialog();
  const canManage = useHasPermission('payroll', 'manage');
  const [reloadKey, setReloadKey] = useState(0);

  const rowActions = useMemo<ResourceAction[]>(() => {
    if (!canManage) return [];
    return [
      { label: 'admin.page.approve', tone: 'success', show: row => row.status === 'draft' || row.status === 'unlocked', run: row => actions.approvePayroll(String(row.id)) },
      { label: 'admin.page.markPaid', tone: 'primary', show: row => row.status === 'approved', run: row => actions.markPayrollPaid(String(row.id)) },
      { label: 'admin.page.unlock', tone: 'warning', show: row => row.status === 'approved' || row.status === 'paid', run: row => actions.unlockPayroll(String(row.id)) },
    ];
  }, [canManage]);

  const headerActions = useMemo(() => {
    if (!canManage) return undefined;
    return [{ label: 'admin.page.calculateMonth', run: async () => {
      const month = await prompt({ title: t('dialog.monthTitle'), message: t('admin.page.promptMonth'), defaultValue: new Date().toISOString().slice(0, 7), inputType: 'month', required: true });
      if (!month) return;
      await actions.calculatePayroll(month);
      setReloadKey(value => value + 1);
    } }];
  }, [canManage, prompt, t]);

  return <ApiResourceManager key={reloadKey} config={{ ...operationsConfigs.payrolls, readOnly: !canManage }} actions={rowActions} headerActions={headerActions} />;
}

function PieceworkTab({ staff, pieceworkRecords, formatMoney }: { staff: StaffMember[]; pieceworkRecords: PieceworkRecord[]; formatMoney: (value: number) => string }) {
  const { t } = useTranslation();
  const canManage = useHasPermission('payroll', 'manage');
  const [subTab, setSubTab] = useState<'summary' | 'operationTypes' | 'adjustments' | 'payroll' | 'workEntries' | 'workHourBreakdowns'>('summary');

  const byEmployee = staff
    .map(member => {
      const records = pieceworkRecords.filter(r => r.employeeName === member.name);
      const totalEarned = records.reduce((sum, r) => sum + r.quantity * r.ratePerPiece, 0);
      const totalPieces = records.reduce((sum, r) => sum + r.quantity, 0);
      return { member, records, totalEarned, totalPieces };
    })
    .filter(e => e.records.length > 0)
    .sort((a, b) => b.totalEarned - a.totalEarned);

  const grandTotal = byEmployee.reduce((sum, e) => sum + e.totalEarned, 0);
  const grandPieces = byEmployee.reduce((sum, e) => sum + e.totalPieces, 0);
  const topWorker = byEmployee[0];

  return (
    <div className="grid gap-5">
      <SegmentTabs
        tabs={[
          { id: 'summary', label: t('staff.piecework.tabs.summary'), icon: <FiDollarSign className="h-4 w-4" /> },
          { id: 'workEntries', label: t('admin.resources.workEntries.title'), icon: <FiCheckCircle className="h-4 w-4" /> },
          { id: 'operationTypes', label: t('admin.resources.operationTypes.title'), icon: <FiTool className="h-4 w-4" /> },
          { id: 'adjustments', label: t('admin.resources.adjustments.title'), icon: <FiSliders className="h-4 w-4" /> },
          { id: 'payroll', label: t('admin.resources.payrolls.title'), icon: <FiArchive className="h-4 w-4" /> },
          { id: 'workHourBreakdowns', label: t('admin.resources.workHourBreakdowns.title'), icon: <FiClock className="h-4 w-4" /> },
        ]}
        activeTab={subTab}
        onChange={id => setSubTab(id as typeof subTab)}
      />
      {subTab === 'operationTypes' ? (
        <ApiResourceManager config={{ ...operationsConfigs.operationTypes, readOnly: !canManage }} />
      ) : subTab === 'adjustments' ? (
        <ApiResourceManager config={{ ...operationsConfigs.adjustments, readOnly: !canManage }} />
      ) : subTab === 'payroll' ? (
        <PayrollTab />
      ) : subTab === 'workEntries' ? (
        <ApiResourceManager config={{ ...operationsConfigs.workEntries, readOnly: !canManage }} />
      ) : subTab === 'workHourBreakdowns' ? (
        <ApiResourceManager config={{ ...operationsConfigs.workHourBreakdowns, readOnly: !canManage }} />
      ) : (
      <>
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={<FiDollarSign />} label={t('staff.piecework.metrics.totalPayout')} value={formatMoney(grandTotal)} caption={t('staff.piecework.metrics.totalPayoutCaption')} tone="success" />
        <MetricCard icon={<FiPackage />} label={t('staff.piecework.metrics.totalPieces')} value={grandPieces.toLocaleString()} caption={t('staff.piecework.metrics.totalPiecesCaption')} tone="info" />
        <MetricCard icon={<FiUsers />} label={t('staff.piecework.metrics.topWorker')} value={topWorker?.member.name.split(' ')[0] ?? '—'} caption={formatMoney(topWorker?.totalEarned ?? 0)} tone="warning" />
      </div>

      {byEmployee.map(({ member, records, totalEarned, totalPieces }) => {
        const initials = member.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('');
        const maxEarned = Math.max(...records.map(r => r.quantity * r.ratePerPiece));
        return (
          <section key={member.id} className="app-card--nova overflow-hidden">
            <div className="flex flex-wrap items-center gap-4 border-b border-border-soft/30 bg-surface-subtle/50 p-5">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-extrabold text-primary">{initials}</span>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-text-primary">{member.name}</p>
                <p className="text-sm text-text-muted">{optionLabel(t, 'employeePosition', member.role)} · {totalPieces.toLocaleString()} {t('staff.piecework.pieces')}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-text-muted">{t('staff.piecework.earned')}</p>
                <p className="text-xl font-extrabold text-success">{formatMoney(totalEarned)}</p>
              </div>
            </div>
            <div className="grid gap-2 bg-surface-subtle/30 p-3 md:hidden">
              {records.map(record => {
                const earned = record.quantity * record.ratePerPiece;
                const pct = maxEarned > 0 ? Math.round((earned / maxEarned) * 100) : 0;
                return (
                  <div key={record.id} className="grid gap-1.5 rounded-xl bg-surface-card p-3 ring-1 ring-border-soft/30">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FiTool className="h-3 w-3" /></span>
                      <span className="min-w-0 truncate font-semibold text-text-primary">{record.operationName}</span>
                      <span className="ml-auto rounded-pill bg-surface-muted px-2.5 py-1 text-xs font-semibold text-text-secondary">{record.product}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted">{record.quantity.toLocaleString()} {t('common.pcs')} × {formatMoney(record.ratePerPiece)}/{t('common.pcs')}</span>
                      <span className="font-extrabold text-success">{formatMoney(earned)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-muted">
                      <div className="h-full rounded-pill bg-success/60" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between rounded-xl bg-success/5 p-3">
                <span className="text-sm font-extrabold text-text-primary">{t('staff.detail.total')}</span>
                <span className="text-base font-extrabold text-success">{formatMoney(totalEarned)}</span>
              </div>
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-border-soft/20">
                    <th className="py-3 pl-5 pr-3 text-left text-xs font-extrabold uppercase tracking-wide text-text-muted">{t('staff.piecework.columns.operation')}</th>
                    <th className="px-3 py-3 text-left text-xs font-extrabold uppercase tracking-wide text-text-muted">{t('staff.piecework.columns.product')}</th>
                    <th className="px-3 py-3 text-right text-xs font-extrabold uppercase tracking-wide text-text-muted">{t('staff.piecework.columns.quantity')}</th>
                    <th className="px-3 py-3 text-right text-xs font-extrabold uppercase tracking-wide text-text-muted">{t('staff.piecework.columns.rate')}</th>
                    <th className="py-3 pl-3 pr-5 text-right text-xs font-extrabold uppercase tracking-wide text-text-muted">{t('staff.piecework.columns.earned')}</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(record => {
                    const earned = record.quantity * record.ratePerPiece;
                    const pct = maxEarned > 0 ? Math.round((earned / maxEarned) * 100) : 0;
                    return (
                      <tr key={record.id} className="border-b border-border-soft/10 transition hover:bg-surface-subtle/50">
                        <td className="py-3.5 pl-5 pr-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FiTool className="h-3 w-3" /></span>
                            <span className="font-semibold text-text-primary">{record.operationName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="rounded-pill bg-surface-muted px-2.5 py-1 text-xs font-semibold text-text-secondary">{record.product}</span>
                        </td>
                        <td className="px-3 py-3.5 text-right font-bold text-text-primary">{record.quantity.toLocaleString()} {t('common.pcs')}</td>
                        <td className="px-3 py-3.5 text-right text-xs font-semibold text-text-muted">{formatMoney(record.ratePerPiece)}/{t('common.pcs')}</td>
                        <td className="py-3.5 pl-3 pr-5">
                          <div className="flex flex-col items-end gap-1.5">
                            <span className="font-extrabold text-success">{formatMoney(earned)}</span>
                            <div className="h-1.5 w-20 overflow-hidden rounded-pill bg-surface-muted">
                              <div className="h-full rounded-pill bg-success/60" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-success/5">
                    <td colSpan={4} className="py-3 pl-5 pr-3 text-sm font-extrabold text-text-primary">{t('staff.detail.total')}</td>
                    <td className="py-3 pl-3 pr-5 text-right text-base font-extrabold text-success">{formatMoney(totalEarned)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      </>
      )}
    </div>
  );
}

function SalaryTab({ staff, formatMoney }: { staff: StaffMember[]; formatMoney: (value: number) => string }) {
  const { t } = useTranslation();
  const totalPayroll = staff.reduce((sum, m) => sum + m.salary, 0);
  const totalNet = staff.reduce((sum, m) => sum + Math.round(m.salary * m.attendance / 100), 0);
  const avgAttendance = staff.length > 0 ? (staff.reduce((sum, m) => sum + m.attendance, 0) / staff.length).toFixed(1) : '0';

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={<FiDollarSign />} label={t('staff.salary.metrics.totalPayroll')} value={formatMoney(totalPayroll)} caption={t('staff.salary.metrics.totalPayrollCaption')} tone="info" />
        <MetricCard icon={<FiCheckCircle />} label={t('staff.salary.metrics.totalNet')} value={formatMoney(totalNet)} caption={t('staff.salary.metrics.totalNetCaption')} tone="success" />
        <MetricCard icon={<FiUsers />} label={t('staff.salary.metrics.avgAttendance')} value={`${avgAttendance}%`} caption={t('staff.salary.metrics.avgAttendanceCaption')} tone="warning" />
      </div>
      <DataTable
        columns={[
          t('staff.salary.columns.employee'),
          t('staff.salary.columns.baseSalary'),
          t('staff.salary.columns.attendance'),
          t('staff.salary.columns.workedDays'),
          t('staff.salary.columns.netSalary'),
          t('staff.salary.columns.deduction'),
        ]}
        rows={staff.map(member => {
          const attendedDays = Math.round(WORKING_DAYS * member.attendance / 100);
          const netSalary = Math.round(member.salary * member.attendance / 100);
          const deduction = member.salary - netSalary;
          return [
            <PrimaryCell title={member.name} subtitle={optionLabel(t, 'employeePosition', member.role)} />,
            formatMoney(member.salary),
            <span className={member.attendance >= 95 ? 'font-bold text-success' : member.attendance >= 85 ? 'font-bold text-warning' : 'font-bold text-danger'}>{member.attendance}%</span>,
            <span className="font-semibold text-text-primary">{attendedDays}/{WORKING_DAYS}</span>,
            <span className="font-bold text-success">{formatMoney(netSalary)}</span>,
            deduction > 0
              ? <span className="font-bold text-danger">-{formatMoney(deduction)}</span>
              : <span className="font-bold text-success">{formatMoney(0)}</span>,
          ];
        })}
      />
    </div>
  );
}

function formatProductionQuantity(record: ProductionRecord, t: (key: string) => string) {
  return `${record.quantity.toLocaleString()} ${unitLabel(record.unit, t)}`;
}

function ProductionRecordModal({ record, formatMoney, onClose }: { record: ProductionRecord; formatMoney: (value: number) => string; onClose: () => void }) {
  const { t } = useTranslation();
  const detailRows = [
    { label: t('orders.production.columns.date'), value: formatDisplayDate(record.date, t) },
    { label: t('orders.production.columns.employee'), value: record.employee },
    { label: t('orders.production.details.operation'), value: record.operation },
    { label: t('orders.production.columns.product'), value: record.product },
    { label: t('orders.production.columns.quantity'), value: formatProductionQuantity(record, t) },
    { label: t('orders.production.details.amount'), value: formatMoney(record.amount) },
    { label: t('orders.production.columns.orderId'), value: record.orderId || '—' },
    { label: t('orders.production.columns.shift'), value: record.shift || '—' },
    { label: t('orders.production.columns.notes'), value: record.notes || '—' },
    { label: t('orders.production.details.created'), value: record.api?.created_at ? formatDisplayDateTime(String(record.api.created_at), t) : '—' },
    { label: t('orders.production.details.updated'), value: record.api?.updated_at ? formatDisplayDateTime(String(record.api.updated_at), t) : '—' },
  ];

  return (
    <div
      className="client-drawer-overlay--nova fixed inset-0 z-[150] flex justify-end bg-background-overlay/72 backdrop-blur-[3px]"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="client-drawer-panel--nova h-full w-full max-w-[760px] overflow-y-auto bg-background-subtle p-4 shadow-xl ring-1 ring-border-soft/50 min-[641px]:p-5"
        role="dialog"
        aria-modal="true"
      >
        <header className="mb-4 rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary">{t('orders.production.title')}</p>
              <h3 className="mt-1 truncate font-display text-xl font-extrabold text-text-primary">{record.product}</h3>
              <p className="mt-1 text-sm font-semibold text-text-muted">{record.employee} · {formatProductionQuantity(record, t)}</p>
            </div>
            <button type="button" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-subtle text-text-secondary ring-1 ring-border-soft/50 transition hover:bg-primary/10 hover:text-text-primary" onClick={onClose} aria-label={t('common.close')}>
              <FiX className="h-4 w-4" />
            </button>
          </div>
        </header>
        <div className="grid gap-3 sm:grid-cols-2">
          {detailRows.map(row => (
            <div key={row.label} className="min-w-0 rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/40">
              <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{row.label}</p>
              <p className="mt-1 text-sm font-semibold text-text-primary [overflow-wrap:anywhere]">{row.value}</p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function ProductionTab({ records, orders, formatMoney }: { records: ProductionRecord[]; orders: Order[]; formatMoney: (value: number) => string }) {
  const { t } = useTranslation();
  const [detailRecord, setDetailRecord] = useState<ProductionRecord | null>(null);
  const uniqueWorkers = new Set(records.map(r => r.employee)).size;
  const inProductionOrders = orders.filter(o => o.statusKey === 'confirmed').length;

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={<FiTool />} label={t('orders.production.metrics.total')} value={records.length.toString()} caption={t('orders.production.metrics.totalCaption')} tone="info" />
        <MetricCard icon={<FiUsers />} label={t('orders.production.metrics.workers')} value={uniqueWorkers.toString()} caption={t('orders.production.metrics.workersCaption')} tone="success" />
        <MetricCard icon={<FiSettings />} label={t('orders.production.metrics.inProduction')} value={inProductionOrders.toString()} caption={t('orders.production.metrics.inProductionCaption')} tone="warning" />
      </div>
      <DataTable
        columns={[
          t('orders.production.columns.date'),
          t('orders.production.columns.employee'),
          t('orders.production.columns.product'),
          t('orders.production.columns.quantity'),
          t('orders.production.columns.orderId'),
          t('orders.production.columns.shift'),
          t('orders.production.columns.notes'),
          t('common.actions'),
        ]}
        rows={records.map(record => [
          formatDisplayDate(record.date, t),
          <PrimaryCell title={record.employee} subtitle={record.operation} />,
          record.product,
          <span className="font-bold text-text-primary">{formatProductionQuantity(record, t)}</span>,
          record.orderId
            ? <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-extrabold text-text-accent">{record.orderId}</span>
            : <span className="text-text-muted">—</span>,
          record.shift || '—',
          record.notes || '—',
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface-card text-text-secondary ring-1 ring-border-soft/50 transition hover:bg-primary/10 hover:text-text-primary" onClick={(event) => { event.stopPropagation(); setDetailRecord(record); }} aria-label={t('common.view')}>
            <FiEye className="h-4 w-4" />
          </button>,
        ])}
        onRowClick={(rowIndex) => setDetailRecord(records[rowIndex])}
      />
      {detailRecord ? <ProductionRecordModal record={detailRecord} formatMoney={formatMoney} onClose={() => setDetailRecord(null)} /> : null}
    </div>
  );
}

export function StockTable({ rows, direction }: { rows: StockMovement[]; direction: 'in' | 'out' }) {
  const { t } = useTranslation();
  return (
    <DataTable
      columns={[
        t('products.stockColumns.date'),
        t('products.stockColumns.product'),
        t('products.stockColumns.quantity'),
        direction === 'in' ? t('products.stockColumns.source') : t('products.stockColumns.client'),
        t('products.stockColumns.employee'),
      ]}
      rows={rows.map(row => [
        formatDisplayDate(row.date, t),
        <PrimaryCell title={row.product} subtitle={translateMovementLabel(t, row.note)} />,
        <span className={direction === 'in' ? 'font-bold text-success' : 'font-bold text-warning'}>{row.quantity}</span>,
        translateMovementLabel(t, direction === 'in' ? row.supplier : row.client),
        translateMovementLabel(t, row.employee),
      ])}
    />
  );
}

export function MovementTimeline({ rows }: { rows: StockMovement[] }) {
  const { t } = useTranslation();
  return (
    <Panel title={t('products.movementTitle')} action={t('common.report')}>
      <div className="grid gap-3">
        {rows.map(row => (
          <div key={row.id} className="flex gap-3 rounded-2xl bg-surface-subtle p-4 ring-1 ring-border-soft/45">
            <span className={['mt-1 h-3 w-3 shrink-0 rounded-full ring-4', row.type === 'in' ? 'bg-success ring-success/15' : 'bg-warning ring-warning/15'].join(' ')} />
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-text-primary">{translateMovementLabel(t, row.note)}</p>
              <p className="mt-1 text-xs font-semibold text-text-muted">{formatDisplayDate(row.date, t)} · {translateMovementLabel(t, row.employee)} · {row.quantity}</p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function WarehousePage({ products, stockIn, stockOut, movementHistory, totalStock, lowStockCount, formatMoney, onCreate }: {
  products: Product[];
  stockIn: StockMovement[];
  stockOut: StockMovement[];
  movementHistory: StockMovement[];
  totalStock: number;
  lowStockCount: number;
  formatMoney: (value: number) => string;
  onCreate: () => void;
}) {
  const { t } = useTranslation();
  const exportResource = useResourceExport();
  const canManage = useHasPermission('inventory', 'manage');
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'locations' | 'defective' | 'defectiveStock' | 'finishedStock' | 'finishedTransactions'>('overview');
  const inventoryValue = products.reduce((sum, p) => sum + p.stock * p.price, 0);
  const allMovements = [...stockIn, ...stockOut].sort((a, b) => b.id - a.id);
  const exportResourceMap = {
    overview: resources.finishedGoodsStocks, history: resources.finishedGoodsTransactions, locations: resources.warehouseLocations, defective: resources.defectiveMaterialTransactions,
    defectiveStock: resources.defectiveMaterialStocks, finishedStock: resources.finishedGoodsStocks, finishedTransactions: resources.finishedGoodsTransactions,
  } as const;

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('warehouse.eyebrow')} title={t('warehouse.title')} description={t('warehouse.description')} createLabel={canManage && (activeTab === 'overview' || activeTab === 'history') ? t('common.create') : undefined} onCreate={canManage && (activeTab === 'overview' || activeTab === 'history') ? onCreate : undefined} onExport={() => exportResource(exportResourceMap[activeTab])} />
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-surface-subtle px-4 py-2.5 ring-1 ring-border-soft/30">
          <FiArchive className="h-4 w-4 text-text-muted" />
          <span className="text-lg font-extrabold text-text-primary">{totalStock.toLocaleString()}</span>
          <span className="text-xs font-semibold text-text-muted">{t('warehouse.metrics.totalInventory')}</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-success/8 px-4 py-2.5 ring-1 ring-success/20">
          <span className="text-lg font-extrabold text-success">{formatMoney(inventoryValue)}</span>
          <span className="text-xs font-semibold text-success/80">{t('warehouse.metrics.inventoryValue')}</span>
        </div>
        {lowStockCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-warning/8 px-4 py-2.5 ring-1 ring-warning/20">
            <FiAlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-lg font-extrabold text-warning">{lowStockCount}</span>
            <span className="text-xs font-semibold text-warning/80">{t('warehouse.metrics.lowStock')}</span>
          </div>
        )}
      </div>
      <SegmentTabs
        tabs={[
          { id: 'overview', label: t('warehouse.tabs.overview'), icon: <FiArchive className="h-4 w-4" /> },
          { id: 'history', label: t('warehouse.tabs.history'), icon: <FiClock className="h-4 w-4" /> },
          { id: 'locations', label: t('admin.resources.warehouseLocations.title'), icon: <FiBriefcase className="h-4 w-4" /> },
          { id: 'defective', label: t('admin.resources.defectiveTransactions.title'), icon: <FiAlertTriangle className="h-4 w-4" /> },
          { id: 'defectiveStock', label: t('admin.resources.defectiveStocks.title'), icon: <FiAlertTriangle className="h-4 w-4" /> },
          { id: 'finishedStock', label: t('admin.resources.finishedStocks.title'), icon: <FiPackage className="h-4 w-4" /> },
          { id: 'finishedTransactions', label: t('admin.resources.finishedTransactions.title'), icon: <FiPackage className="h-4 w-4" /> },
        ]}
        activeTab={activeTab}
        onChange={id => setActiveTab(id as typeof activeTab)}
      />
      {activeTab === 'locations' ? (
        <ApiResourceManager config={{ ...operationsConfigs.warehouseLocations, readOnly: !canManage }} />
      ) : activeTab === 'defective' ? (
        <ApiResourceManager config={{ ...operationsConfigs.defectiveTransactions, readOnly: !canManage }} />
      ) : activeTab === 'defectiveStock' ? (
        <ApiResourceManager config={operationsConfigs.defectiveStocks} />
      ) : activeTab === 'finishedStock' ? (
        <ApiResourceManager config={operationsConfigs.finishedStocks} />
      ) : activeTab === 'finishedTransactions' ? (
        <ApiResourceManager config={{ ...operationsConfigs.finishedTransactions, readOnly: !canManage }} />
      ) : activeTab === 'overview' ? (
        <DataTable
          columns={[t('warehouse.columns.product'), t('warehouse.columns.quantity'), t('warehouse.columns.value'), t('warehouse.columns.lowStock')]}
          rows={products.map(product => [
            <span className="block min-w-0">
              <span className="block max-w-[220px] truncate text-sm font-bold text-text-primary">{product.name}</span>
              <span className="text-xs text-text-muted">{product.category}</span>
            </span>,
            <span className="block min-w-[120px]">
              <span className={['block text-sm font-bold', product.stock <= product.minStock ? 'text-warning' : 'text-text-primary'].join(' ')}>{product.stock.toLocaleString()} {unitLabel(product.unit, t)}</span>
              <div className="mt-1 h-1.5 w-full max-w-[90px] overflow-hidden rounded-pill bg-surface-muted">
                <div className={['h-full rounded-pill', product.stock <= product.minStock ? 'bg-warning' : 'bg-success'].join(' ')} style={{ width: `${Math.min(100, Math.round(product.stock / Math.max(product.minStock, 1) * 100))}%` }} />
              </div>
            </span>,
            formatMoney(product.stock * product.price),
            product.stock <= product.minStock
              ? <StatusBadge tone="warning">{t('warehouse.lowStockYes')}</StatusBadge>
              : <StatusBadge tone="success">{t('warehouse.lowStockNo')}</StatusBadge>,
          ])}
        />
      ) : (
        <DataTable
          columns={[t('warehouse.columns.date'), t('warehouse.columns.product'), t('warehouse.columns.type'), t('warehouse.columns.quantity'), t('staff.columns.staff')]}
          rows={allMovements.map(row => [
            formatDisplayDate(row.date, t),
            <span className="block min-w-0 max-w-[220px] truncate text-sm font-semibold text-text-primary" title={row.product}>{row.product}</span>,
            <StatusBadge tone={row.type === 'in' ? 'success' : 'warning'}>{row.type === 'in' ? t('warehouse.movementIn') : t('warehouse.movementOut')}</StatusBadge>,
            <span className={['font-bold', row.type === 'in' ? 'text-success' : 'text-warning'].join(' ')}>{row.quantity}</span>,
            <span className="block min-w-0 max-w-[180px] truncate text-sm font-semibold text-text-primary" title={translateMovementLabel(t, row.employee)}>{translateMovementLabel(t, row.employee)}</span>,
          ])}
        />
      )}
    </div>
  );
}

export function FinancePage({ revenueEntries, expenseEntries, revenueData, formatMoney, onCreate }: { revenueEntries: FinanceEntry[]; expenseEntries: FinanceEntry[]; revenueData: Array<{ month: string; revenue: number; orders: number }>; formatMoney: (value: number) => string; onCreate: () => void }) {
  const { t } = useTranslation();
  const exportResource = useResourceExport();
  const canManage = useHasPermission('clients', 'manage');
  const [activeTab, setActiveTab] = useState<'revenue' | 'expenses' | 'cashAccounts' | 'cashTransactions' | 'invoices'>('revenue');
  const revenue = revenueEntries.reduce((sum, e) => sum + e.amount, 0);
  const expenses = expenseEntries.reduce((sum, e) => sum + e.amount, 0);
  const profit = revenue - expenses;
  const financeData = revenueData.map(entry => {
    const monthExpenses = expenseEntries
      .filter(expense => expense.date.startsWith(entry.month))
      .reduce((sum, expense) => sum + expense.amount, 0);
    return { month: entry.month, revenue: entry.revenue, expenses: monthExpenses, profit: entry.revenue - monthExpenses };
  });
  const exportResourceMap = {
    revenue: resources.clientPayments, expenses: resources.expenses, cashAccounts: resources.cashAccounts, cashTransactions: resources.cashTransactions, invoices: resources.invoices,
  } as const;

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('finance.eyebrow')} title={t('finance.title')} description={t('finance.description')} createLabel={canManage && activeTab === 'revenue' ? t('common.create') : undefined} onCreate={canManage && activeTab === 'revenue' ? onCreate : undefined} onExport={() => exportResource(exportResourceMap[activeTab])} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-success/8 p-5 ring-1 ring-success/20">
          <p className="text-xs font-bold uppercase tracking-wide text-success/70">{t('finance.metrics.revenue')}</p>
          <p className="mt-2 text-2xl font-extrabold text-success">{formatMoney(revenue)}</p>
          <p className="mt-0.5 text-xs text-success/60">{t('finance.metrics.revenueCaption')}</p>
        </div>
        <div className="rounded-2xl bg-warning/8 p-5 ring-1 ring-warning/20">
          <p className="text-xs font-bold uppercase tracking-wide text-warning/70">{t('finance.metrics.expenses')}</p>
          <p className="mt-2 text-2xl font-extrabold text-warning">{formatMoney(expenses)}</p>
          <p className="mt-0.5 text-xs text-warning/60">{t('finance.metrics.expensesCaption')}</p>
        </div>
        <div className={['rounded-2xl p-5 ring-1', profit >= 0 ? 'bg-primary/8 ring-primary/20' : 'bg-danger/8 ring-danger/20'].join(' ')}>
          <p className={['text-xs font-bold uppercase tracking-wide', profit >= 0 ? 'text-primary/70' : 'text-danger/70'].join(' ')}>{t('finance.metrics.profit')}</p>
          <p className={['mt-2 text-2xl font-extrabold', profit >= 0 ? 'text-primary' : 'text-danger'].join(' ')}>{formatMoney(profit)}</p>
          <p className={['mt-0.5 text-xs', profit >= 0 ? 'text-primary/60' : 'text-danger/60'].join(' ')}>{t('finance.metrics.profitCaption')}</p>
        </div>
      </div>
      <Panel title={t('finance.profitAnalysis')} action="">
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={financeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border-soft))" opacity={0.4} vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: 'rgb(var(--color-text-muted))', fontSize: 12, fontWeight: 700 }} />
              <YAxis tickLine={false} axisLine={false} width={70} tick={{ fill: 'rgb(var(--color-text-muted))', fontSize: 11, fontWeight: 700 }} />
              <Tooltip content={<PremiumTooltip />} cursor={false} />
              <Area name={t('finance.metrics.revenue')} type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={2.5} fill="#0f766e" fillOpacity={0.12} />
              <Area name={t('finance.metrics.expenses')} type="monotone" dataKey="expenses" stroke="#f59e0b" strokeWidth={2.5} fill="#f59e0b" fillOpacity={0.08} />
              <Line name={t('finance.metrics.profit')} type="monotone" dataKey="profit" stroke="#6366f1" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <SegmentTabs
        tabs={[
          { id: 'revenue', label: t('finance.revenueTable'), icon: <FiCheckCircle className="h-4 w-4" /> },
          { id: 'expenses', label: t('admin.resources.expenses.title'), icon: <FiArchive className="h-4 w-4" /> },
          { id: 'cashAccounts', label: t('admin.resources.cashAccounts.title'), icon: <FiDollarSign className="h-4 w-4" /> },
          { id: 'cashTransactions', label: t('admin.resources.cashTransactions.title'), icon: <FiCpu className="h-4 w-4" /> },
          { id: 'invoices', label: t('admin.resources.invoices.title'), icon: <FiPackage className="h-4 w-4" /> },
        ]}
        activeTab={activeTab}
        onChange={id => setActiveTab(id as typeof activeTab)}
      />
      {activeTab === 'revenue' ? (
        <DataTable
          columns={[t('finance.columns.date'), t('finance.columns.client'), t('finance.columns.order'), t('finance.columns.amount')]}
          rows={revenueEntries.map(e => [formatDisplayDate(e.date, t), e.client, translateMovementLabel(t, e.order), <span className="font-bold text-success">{formatMoney(e.amount)}</span>])}
        />
      ) : activeTab === 'expenses' ? (
        <ApiResourceManager config={{ ...operationsConfigs.expenses, readOnly: !canManage }} />
      ) : activeTab === 'cashAccounts' ? (
        <ApiResourceManager config={{ ...operationsConfigs.cashAccounts, readOnly: !canManage }} />
      ) : activeTab === 'cashTransactions' ? (
        <ApiResourceManager config={{ ...operationsConfigs.cashTransactions, readOnly: !canManage }} />
      ) : (
        <ApiResourceManager config={{ ...operationsConfigs.invoices, readOnly: !canManage }} />
      )}
    </div>
  );
}

function AddWorkEntryModal({ batch, staff, operationTypes, onClose, onSaved }: {
  batch: ProductionBatch;
  staff: StaffMember[];
  operationTypes: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [employee, setEmployee] = useState('');
  const [operationType, setOperationType] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!employee || !operationType || !date || !quantity || Number(quantity) <= 0) {
      toast(t('admin.ui.requiredFieldsMissing'), 'danger');
      return;
    }
    setSaving(true);
    try {
      await api.create(resources.dailyWorkEntries, {
        employee, operation_type: operationType, date, quantity_done: Number(quantity), related_batch: batch.id,
      });
      toast(t('production.batch.workEntrySaved'), 'success');
      onSaved();
      onClose();
    } catch (error) {
      toast(apiErrorMessage(error, t), 'danger');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[190] grid place-items-center bg-background-overlay/72 px-3 backdrop-blur-[3px]" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" className="w-full max-w-[440px] rounded-[28px] bg-surface-card p-5 shadow-[0_40px_110px_-42px_rgba(15,23,42,0.62)] ring-1 ring-border-soft/55">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{batch.orderId || batch.product}</p>
            <h3 className="mt-1 font-display text-xl font-extrabold text-text-primary">{t('production.batch.addEmployee')}</h3>
          </div>
          <button type="button" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-subtle text-text-secondary transition duration-fast hover:bg-surface-muted hover:text-text-primary" onClick={onClose} aria-label={t('common.close')}>
            <FiX className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 grid gap-3">
          <label className="grid gap-1.5 text-sm font-bold text-text-secondary">
            {t('admin.fields.employee')}
            <Dropdown value={employee} onChange={setEmployee} options={staff.map(member => ({ value: String(member.id), label: member.name }))} placeholder={t('admin.ui.selectPlaceholder')} />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-text-secondary">
            {t('admin.fields.operation')}
            <Dropdown value={operationType} onChange={setOperationType} options={operationTypes.map(op => ({ value: op.id, label: op.name }))} placeholder={t('admin.ui.selectPlaceholder')} />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-text-secondary">
            {t('admin.fields.date')}
            <DatePicker value={date} onChange={setDate} />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-text-secondary">
            {t('admin.fields.quantity')}
            <input type="number" min="1" value={quantity} onChange={event => setQuantity(event.target.value)} className="h-11 w-full rounded-xl border border-border-soft bg-surface-card px-3 text-sm text-text-primary outline-none focus:border-primary/50" />
          </label>
        </div>
        <div className="mt-5 flex gap-2">
          <button className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl bg-surface-subtle px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-muted hover:text-text-primary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button disabled={saving} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50" onClick={() => void handleSave()}>
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </section>
    </div>
  );
}

function BatchDetailModal({ batch, canManage, onClose }: { batch: ProductionBatch; canManage: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'batchItems' | 'materialUsages'>('batchItems');
  const extraParams = useMemo(() => ({ batch: String(batch.id) }), [batch.id]);
  const fixedValues = useMemo(() => ({ batch: String(batch.id) }), [batch.id]);
  const configs = useMemo(() => ({
    batchItems: scopedFieldConfig(operationsConfigs.batchItems, canManage, 'batch'),
    materialUsages: scopedFieldConfig(operationsConfigs.materialUsages, canManage, 'batch'),
  }), [canManage]);

  return (
    <div className="fixed inset-0 z-[190] grid place-items-center bg-background-overlay/72 px-3 backdrop-blur-[3px]" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" className="grid max-h-[90vh] w-full max-w-[980px] grid-rows-[auto_1fr] overflow-hidden rounded-[28px] bg-surface-card shadow-[0_40px_110px_-42px_rgba(15,23,42,0.62)] ring-1 ring-border-soft/55">
        <div className="flex items-start justify-between gap-4 border-b border-border-soft/30 p-6">
          <div className="min-w-0">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{formatDisplayDate(batch.dateLabel, t)}</p>
            <h3 className="mt-1 truncate font-display text-xl font-extrabold text-text-primary">{batch.orderId || batch.product}</h3>
          </div>
          <button type="button" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-subtle text-text-secondary transition duration-fast hover:bg-surface-muted hover:text-text-primary" onClick={onClose} aria-label={t('common.close')}>
            <FiX className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-6">
          <SegmentTabs
            tabs={[
              { id: 'batchItems', label: t('admin.resources.batchItems.title'), icon: <FiLayers className="h-4 w-4" /> },
              { id: 'materialUsages', label: t('admin.resources.materialUsages.title'), icon: <FiPackage className="h-4 w-4" /> },
            ]}
            activeTab={activeTab}
            onChange={id => setActiveTab(id as typeof activeTab)}
          />
          <div className="mt-4">
            <ApiResourceManager key={`${activeTab}-${batch.id}`} config={configs[activeTab]} extraParams={extraParams} fixedValues={fixedValues} />
          </div>
        </div>
      </section>
    </div>
  );
}

export function ProductionPage({ batches, products, materials, staff, operationTypes, formatMoney, onCreate, openModal, openDelete, onDeliver, onWorkEntrySaved }: {
  batches: ProductionBatch[];
  products: Product[];
  materials: Material[];
  staff: StaffMember[];
  operationTypes: Array<{ id: string; name: string }>;
  formatMoney: (v: number) => string;
  onCreate: () => void;
  openModal: (modal: ModalState) => void;
  openDelete: (modal: ModalState) => void;
  onDeliver: (id: string | number) => Promise<void>;
  onWorkEntrySaved: () => void;
}) {
  const { t } = useTranslation();
  const exportResource = useResourceExport();
  const canManage = useHasPermission('production', 'manage');
  const canManageWorkEntries = useHasPermission('payroll', 'manage');
  const [activeTab, setActiveTab] = useState<'batches' | 'stock' | 'consumption'>('batches');
  const [addingEmployeeToBatch, setAddingEmployeeToBatch] = useState<ProductionBatch | null>(null);
  const [viewingBatchDetail, setViewingBatchDetail] = useState<ProductionBatch | null>(null);
  const [openBatchMaterials, setOpenBatchMaterials] = useState<Record<string, boolean>>({});

  const totalProduced = batches.reduce((sum, b) => sum + b.producedQty, 0);

  // Aggregate material consumption across all batches
  const consumptionMap: Record<string, { materialName: string; unit: 'm' | 'kg' | 'pcs'; totalUsed: number; batches: number }> = {};
  batches.forEach(batch => {
    const product = products.find(p => p.id === batch.productId);
    if (!product?.recipe) return;
    product.recipe.forEach(item => {
      const used = item.qtyPerUnit * batch.producedQty;
      if (!consumptionMap[item.materialName]) {
        consumptionMap[item.materialName] = { materialName: item.materialName, unit: item.unit, totalUsed: 0, batches: 0 };
      }
      consumptionMap[item.materialName].totalUsed += used;
      consumptionMap[item.materialName].batches += 1;
    });
  });
  const consumptionList = Object.values(consumptionMap).sort((a, b) => b.totalUsed - a.totalUsed);
  const totalMaterialTypes = consumptionList.length;

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('production.eyebrow')} title={t('production.title')} description={t('production.description')} createLabel={canManage ? t('production.create') : undefined} onCreate={canManage ? onCreate : undefined} onExport={() => exportResource(activeTab === 'stock' ? resources.finishedGoodsStocks : activeTab === 'consumption' ? resources.productionMaterialUsages : resources.productionBatches)} />

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-surface-subtle px-4 py-2.5 ring-1 ring-border-soft/30">
          <FiCpu className="h-4 w-4 text-primary" />
          <span className="text-lg font-extrabold text-text-primary">{batches.length}</span>
          <span className="text-xs font-semibold text-text-muted">{t('production.metrics.batches')}</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-primary/8 px-4 py-2.5 ring-1 ring-primary/20">
          <span className="text-lg font-extrabold text-primary">{totalProduced.toLocaleString()}</span>
          <span className="text-xs font-semibold text-primary/70">{t('production.metrics.produced')}</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-success/8 px-4 py-2.5 ring-1 ring-success/20">
          <FiLayers className="h-4 w-4 text-success" />
          <span className="text-lg font-extrabold text-success">{totalMaterialTypes}</span>
          <span className="text-xs font-semibold text-success/70">{t('production.metrics.materials')}</span>
        </div>
      </div>

      <SegmentTabs
        tabs={[
          { id: 'batches', label: t('production.tabs.batches'), icon: <FiCpu className="h-4 w-4" /> },
          { id: 'stock', label: t('production.tabs.stock'), icon: <FiPackage className="h-4 w-4" /> },
          { id: 'consumption', label: t('production.tabs.consumption'), icon: <FiLayers className="h-4 w-4" /> },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as 'batches' | 'stock' | 'consumption')}
      />

      {activeTab === 'batches' && (
        <div className="grid gap-4">
          {batches.map(batch => {
            const product = products.find(p => p.id === batch.productId);
            const recipe = product?.recipe ?? [];
            const materialRows = recipe.map(item => ({
              ...item,
              totalUsed: item.qtyPerUnit * batch.producedQty,
              plannedUsed: item.qtyPerUnit * batch.plannedQty,
              issued: batch.materialIssues.find(issue => String(issue.materialId) === String(item.materialId)),
            }));
            const visibleEmployees = batch.employees.slice(0, 3);
            const extraEmployees = batch.employees.length - 3;
            const materialsOpen = Boolean(openBatchMaterials[String(batch.id)]);
            const isCompleted = batch.shift === 'completed';
            const remainingQty = Math.max(batch.plannedQty - batch.producedQty, 0);
            const canDeliver = !isCompleted && remainingQty > 0;
            const deliverDisabledReason = isCompleted ? t('production.batch.deliverDisabledCompleted') : remainingQty <= 0 ? t('production.batch.deliverDisabledNoRemaining') : undefined;

            return (
              <article key={batch.id} className="app-card--nova overflow-hidden">
                {/* Card header */}
                <div className="flex flex-col items-start gap-4 border-b border-border-soft/25 p-5 sm:flex-row">
                  <div className="flex min-w-0 w-full items-start gap-4 sm:w-auto sm:flex-1">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <FiCpu className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-text-muted">{formatDisplayDate(batch.dateLabel, t)}</span>
                        {batch.orderId && (
                          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-text-accent">{batch.orderId}</span>
                        )}
                      </div>
                      <p className="mt-1 text-base font-extrabold text-text-primary [overflow-wrap:anywhere]">{batch.product}</p>
                      {batch.notes && <p className="mt-0.5 text-xs text-text-muted [overflow-wrap:anywhere]">{batch.notes}</p>}
                    </div>
                  </div>
                  <div className="shrink-0 self-stretch rounded-2xl bg-primary/8 px-4 py-3 text-right ring-1 ring-primary/15 sm:self-auto">
                    <p className="text-2xl font-extrabold text-primary">{batch.producedQty.toLocaleString()}</p>
                    <p className="mt-0.5 text-xs font-semibold text-primary/70">{unitLabel(batch.unit, t)} {t('production.batch.produced')}</p>
                  </div>
                </div>

                {/* Material consumption */}
                <div>
                  <button
                    type="button"
                    className={['flex w-full flex-wrap items-center justify-between gap-2 px-5 py-3 text-left transition hover:bg-primary/5', materialsOpen ? 'border-b border-border-soft/20' : ''].join(' ')}
                    onClick={() => setOpenBatchMaterials(current => ({ ...current, [String(batch.id)]: !current[String(batch.id)] }))}
                    aria-expanded={materialsOpen}
                  >
                    <span className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-text-muted">
                      <FiChevronRight className={['h-4 w-4 transition-transform', materialsOpen ? 'rotate-90' : ''].join(' ')} />
                      {t('production.batch.materials')}
                    </span>
                    <span className={[
                      'rounded-lg px-2.5 py-1 text-[11px] font-extrabold ring-1',
                      batch.materialIssueRuns > 1
                        ? 'bg-warning-bg text-warning ring-warning/15'
                        : batch.materialIssueRuns === 1
                          ? 'bg-success-bg text-success ring-success/15'
                          : 'bg-surface-subtle text-text-muted ring-border-soft/40',
                    ].join(' ')}>
                      {batch.materialIssueRuns > 0
                        ? t('production.batch.issueRuns', { count: batch.materialIssueRuns, transactions: batch.materialIssueCount })
                        : t('production.batch.notIssued')}
                    </span>
                  </button>
                  {materialsOpen ? (
                    <div className="p-5">
                      {materialRows.length === 0 ? (
                        <p className="text-sm text-text-muted">{t('production.batch.noRecipe')}</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {materialRows.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3 rounded-xl bg-surface-subtle p-3 ring-1 ring-border-soft/30">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-text-muted">
                                <FiLayers className="h-3.5 w-3.5" />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-text-primary">{item.materialName}</p>
                                <p className="mt-0.5 text-[11px] text-text-muted">
                                  {t('production.batch.plannedMaterial')}: <span className="font-bold text-text-primary">{item.plannedUsed.toLocaleString()} {unitLabel(item.unit, t)}</span>
                                  <span className="ml-1 opacity-60">({item.qtyPerUnit} × {batch.plannedQty.toLocaleString()})</span>
                                </p>
                                <p className="mt-0.5 text-[11px] text-text-muted">
                                  {t('production.batch.calculatedUsed')}: <span className="font-bold text-text-primary">{item.totalUsed.toLocaleString()} {unitLabel(item.unit, t)}</span>
                                </p>
                                <p className={['mt-1 text-[11px] font-semibold', item.issued && item.issued.quantity > item.plannedUsed ? 'text-warning' : 'text-text-muted'].join(' ')}>
                                  {t('production.batch.issued')}: <span className="font-extrabold">{(item.issued?.quantity ?? 0).toLocaleString()} {unitLabel(item.unit, t)}</span>
                                  {item.issued ? <span className="ml-1 opacity-70">({item.issued.count}x)</span> : null}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Footer: employees + shift */}
                <div className="flex flex-wrap items-center gap-4 border-t border-border-soft/20 bg-surface-subtle/40 px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <FiUsers className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                    <span className="whitespace-nowrap text-xs text-text-muted">{t('production.batch.employees')}:</span>
                    <div className="flex flex-wrap gap-1">
                      {visibleEmployees.map(name => (
                        <span key={name} className="whitespace-nowrap rounded-md bg-surface-card px-2 py-0.5 text-[11px] font-semibold text-text-secondary ring-1 ring-border-soft/40">{name.split(' ')[0]}</span>
                      ))}
                      {extraEmployees > 0 && <span className="whitespace-nowrap rounded-md bg-surface-card px-2 py-0.5 text-[11px] font-semibold text-text-muted ring-1 ring-border-soft/40">+{extraEmployees}</span>}
                    </div>
                    {canManageWorkEntries ? (
                      <button className="whitespace-nowrap rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-text-accent transition hover:bg-primary/20" onClick={() => setAddingEmployeeToBatch(batch)}>
                        + {t('production.batch.addEmployee')}
                      </button>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-text-muted">
                    <FiClock className="h-3.5 w-3.5 shrink-0" />
                    {optionLabel(t, 'productionStatus', batch.shift)}
                  </div>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <button className="rounded-lg bg-surface-subtle px-2.5 py-1.5 text-xs font-bold text-text-secondary transition hover:bg-primary/10 hover:text-text-primary" onClick={() => setViewingBatchDetail(batch)}>{t('production.batch.detail')}</button>
                    {canManage ? <button disabled={!canDeliver} title={deliverDisabledReason} className="rounded-lg bg-success-bg px-2.5 py-1.5 text-xs font-bold text-success transition disabled:cursor-not-allowed disabled:opacity-40" onClick={() => void onDeliver(batch.id)}>{t('production.batch.deliver')}</button> : null}
                    <RowActions onView={() => openModal({ kind: 'batch', mode: 'view', item: batch })} onEdit={canManage ? () => openModal({ kind: 'batch', mode: 'edit', item: batch }) : undefined} onDelete={canManage ? () => openDelete({ kind: 'batch', mode: 'view', item: batch }) : undefined} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {activeTab === 'stock' && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map(product => {
            const pct = Math.min(100, Math.round((product.stock / Math.max(product.minStock, 1)) * 100));
            const tone = product.stock === 0 ? 'danger' : product.stock <= product.minStock ? 'warning' : 'success';
            const statusLabel = product.stock === 0 ? t('production.stock.noStock') : product.stock <= product.minStock ? t('production.stock.lowStock') : t('production.stock.inStock');
            return (
              <div key={product.id} className="app-card--nova flex flex-col gap-4 p-5">
                <div className="flex items-start gap-3">
                  <img src={product.imageUrl} alt={product.name} className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-border-soft/50" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-text-primary">{product.name}</p>
                    <p className="mt-0.5 text-xs text-text-muted">{product.category}</p>
                    <div className="mt-2"><StatusBadge tone={tone}>{statusLabel}</StatusBadge></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-end justify-between text-xs text-text-muted">
                    <span>{t('production.stock.currentStock')}</span>
                    <span>{t('production.stock.minStock')}: {product.minStock.toLocaleString()}</span>
                  </div>
                  <p className={['mt-1 text-2xl font-extrabold', tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-text-primary'].join(' ')}>
                    {product.stock.toLocaleString()} <span className="text-sm font-semibold text-text-muted">{unitLabel(product.unit, t)}</span>
                  </p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-pill bg-surface-muted">
                    <div className={['h-full rounded-pill transition-all', tone === 'danger' ? 'bg-danger' : tone === 'warning' ? 'bg-warning' : 'bg-success'].join(' ')} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-surface-subtle p-3 text-xs">
                  <span className="text-text-muted">Ombordagi qiymati</span>
                  <span className="font-bold text-text-primary">{formatMoney(product.stock * product.price)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'consumption' && (
        <div className="grid gap-5">
          <p className="text-sm text-text-muted">{t('production.consumption.title')} — barcha partiyalar bo'yicha hisoblangan.</p>
          <div className="grid gap-3">
            {consumptionList.map((item, idx) => {
              const mat = materials.find(m => m.name === item.materialName);
              const remaining = mat?.stock ?? 0;
              const pct = remaining + item.totalUsed > 0 ? Math.round((item.totalUsed / (remaining + item.totalUsed)) * 100) : 0;
              return (
                <div key={idx} className="app-card--nova flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <FiLayers className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-text-primary">{item.materialName}</p>
                      <div className="mt-1.5 h-1.5 w-48 max-w-full overflow-hidden rounded-pill bg-surface-muted">
                        <div className="h-full rounded-pill bg-primary/60" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-right text-sm sm:flex sm:gap-6">
                    <div>
                      <p className="text-xs text-text-muted">{t('production.consumption.totalUsed')}</p>
                      <p className="font-extrabold text-primary">{item.totalUsed.toLocaleString()} {unitLabel(item.unit, t)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">{t('production.consumption.remaining')}</p>
                      <p className={['font-bold', remaining <= 0 ? 'text-danger' : 'text-text-primary'].join(' ')}>{remaining.toLocaleString()} {unitLabel(item.unit, t)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Ulush</p>
                      <p className="font-bold text-text-muted">{pct}% sarflandi</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {addingEmployeeToBatch ? (
        <AddWorkEntryModal
          batch={addingEmployeeToBatch}
          staff={staff}
          operationTypes={operationTypes}
          onClose={() => setAddingEmployeeToBatch(null)}
          onSaved={onWorkEntrySaved}
        />
      ) : null}
      {viewingBatchDetail ? (
        <BatchDetailModal batch={viewingBatchDetail} canManage={canManage} onClose={() => setViewingBatchDetail(null)} />
      ) : null}
    </div>
  );
}
