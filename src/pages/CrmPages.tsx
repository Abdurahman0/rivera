import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { FiActivity, FiAlertTriangle, FiArchive, FiBriefcase, FiCalendar, FiCheckCircle, FiChevronRight, FiClock, FiCpu, FiDollarSign, FiEye, FiLayers, FiPackage, FiSearch, FiSettings, FiShoppingBag, FiTag, FiTool, FiUsers, FiSliders, FiX } from 'react-icons/fi';
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AttendanceLogEntry, CategoryDatum, Client, DashboardDateRange, EntityId, FinanceEntry, FinishedVariant, Material, ModalState, Order, PieceworkRecord, Product, ProductCategory, ProductionBatch, StaffMember, StatusTone, StockMovement } from '../types/crm';
import { apiErrorMessage, formatDisplayDate, formatDisplayDateTime, materialStatusTone, optionLabel, orderStatusTone, statusLabel, statusTone, unitLabel } from '../utils/crm';
import { translateMovementLabel } from '../lib/enumLabels';
import { BUILT_IN_CLIENT_STATUSES, hasStoredCustomClientStatuses, loadCustomClientStatuses, saveCustomClientStatuses, slugifyStatusKey, type CustomClientStatus } from '../utils/clientStatuses';
import { ClientsFilterBar, DataTable, MetricCard, PageHeader, Panel, PremiumTooltip, PrimaryCell, RowActions, SegmentTabs, StatusBadge } from '../components/ui';
import { useDialog } from '../components/DialogProvider';
import { useToast } from '../components/ToastProvider';
import { useHasPermission } from '../components/PermissionsProvider';
import { Dropdown, DatePicker } from '../components/FormControls';
import { ApiResourceManager, type ResourceConfig } from '../components/ApiResourceManager';
import { actions, api, resources } from '../api/client';
import type { ApiApproval, ApiMonthlyPayroll, ApiRecord } from '../api/types';
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

type DashboardRangePreset = 'today' | 'yesterday' | 'thisWeek' | 'last30Days' | 'thisMonth' | 'lastMonth';

const DASHBOARD_RANGE_PRESETS: DashboardRangePreset[] = ['today', 'yesterday', 'thisWeek', 'last30Days', 'thisMonth', 'lastMonth'];

function dashboardRangePreset(preset: DashboardRangePreset, endDateValue?: string): DashboardDateRange {
  const today = endDateValue ? new Date(`${endDateValue}T00:00:00`) : new Date();
  const safeToday = Number.isNaN(today.getTime()) ? new Date() : today;
  if (preset === 'today') return { startDate: isoDate(safeToday), endDate: isoDate(safeToday) };
  if (preset === 'yesterday') {
    const start = new Date(safeToday);
    start.setDate(start.getDate() - 1);
    return { startDate: isoDate(start), endDate: isoDate(start) };
  }
  if (preset === 'thisWeek') {
    const start = new Date(safeToday);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return { startDate: isoDate(start), endDate: isoDate(safeToday) };
  }
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
/** Quick-preset dropdown (All time / Today / Last 30 days / This month / Last month) —
 *  applies immediately on selection. A separate, independent control from the custom
 *  calendar range picker below; picking here doesn't open or affect that one. */
function DashboardPresetDropdown({ value, onChange }: { value: DashboardDateRange | null; onChange: (range: DashboardDateRange | null) => void }) {
  const { t } = useTranslation();
  // Remember the explicitly picked preset rather than re-deriving it from the range every
  // render: some presets yield identical ranges on some days (e.g. "this week" == "today"
  // on a Monday), and matchingDashboardPreset would otherwise snap the label to the first
  // colliding preset. We only re-derive when the range changes to one the remembered preset
  // no longer produces (e.g. a custom range picked from the calendar alongside this control).
  const [preset, setPreset] = useState<DashboardRangePreset | null>(() => (value ? matchingDashboardPreset(value) : null));

  useEffect(() => {
    setPreset(prev => {
      if (prev && value && sameDashboardRange(dashboardRangePreset(prev), value)) return prev;
      return value ? matchingDashboardPreset(value) : null;
    });
  }, [value]);

  return (
    <div className="w-[168px]">
      {/* "Barcha vaqt" is not a pickable option — it's just what the empty (no filter)
          state reads as; clearing happens via the ✕ button in DateRangeControls. */}
      <Dropdown
        required
        value={preset ?? ''}
        placeholder={t('dashboard.filters.allTime')}
        onChange={selected => {
          setPreset(selected as DashboardRangePreset);
          onChange(dashboardRangePreset(selected as DashboardRangePreset));
        }}
        options={DASHBOARD_RANGE_PRESETS.map(item => ({ value: item, label: t(`dashboard.filters.${item}`) }))}
      />
    </div>
  );
}

/** The standard date-filter row: preset dropdown + custom calendar, plus a clear button
 *  that appears only while a range is active. No filter = all time. */
function DateRangeControls({ value, onChange }: { value: DashboardDateRange | null; onChange: (range: DashboardDateRange | null) => void }) {
  const { t } = useTranslation();
  return (
    <>
      <DashboardPresetDropdown value={value} onChange={onChange} />
      <DashboardCustomRangePicker value={value} onChange={onChange} />
      {value ? (
        <button
          type="button"
          className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-danger-bg px-3 text-xs font-bold text-danger transition hover:bg-danger/15"
          onClick={() => onChange(null)}
        >
          <FiX className="h-3.5 w-3.5" /> {t('common.clearFilter')}
        </button>
      ) : null}
    </>
  );
}

/** Standalone custom date-range calendar dropdown — picking a start and end date applies
 *  immediately (no separate save step) and closes. Independent from the preset dropdown. */
function DashboardCustomRangePicker({ value, onChange }: { value: DashboardDateRange | null; onChange: (range: DashboardDateRange | null) => void }) {
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

  const monthLabel = `${t(`common.months.${viewDate.getMonth()}`)} ${viewDate.getFullYear()}`;
  const weekdayLabels = lang === 'ru-RU' ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] : ['Du', 'Se', 'Cho', 'Pay', 'Ju', 'Sha', 'Ya'];
  // Only reflect the value here when it's a genuine custom pick (not a preset), so this
  // control's trigger doesn't fight with the preset dropdown over the same range.
  const displayText = value && !activePreset
    ? `${value.startDate.split('-').reverse().join('.')} – ${value.endDate.split('-').reverse().join('.')}`
    : t('dashboard.filters.customRange');

  const highlightStart = draftStart || (!activePreset ? value?.startDate ?? '' : '');
  const highlightEnd = draftStart ? draftEnd : (!activePreset ? value?.endDate ?? '' : '');

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
    <div ref={menuRef} className="relative w-[168px] max-w-full">
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
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[292px] rounded-2xl border border-border-soft/60 bg-surface-card p-3 shadow-[0_24px_55px_-30px_rgba(15,23,42,0.58)] backdrop-blur-xl">
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
      <div className="flex justify-end gap-2.5">
        <DateRangeControls value={dateRange} onChange={onDateRangeChange} />
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
  const extraParams = useMemo(() => ({ client: String(client.id) }), [client.id]);
  const fixedValues = useMemo(() => ({ client: String(client.id) }), [client.id]);
  const ordersConfig = useMemo(() => scopedClientConfig(operationsConfigs.clientOrders, canManage), [canManage]);

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
          <p className="mb-3 text-xs font-semibold text-text-muted">{t('clients.detail.ordersHint')}</p>
          <ApiResourceManager key={`orders-${client.id}`} config={ordersConfig} extraParams={extraParams} fixedValues={fixedValues} />
        </div>
      </section>
    </div>
  );
}

export function ClientsPage({ clients, formatMoney, openModal, openDelete, openClientId, onOpenClientConsumed }: { clients: Client[]; formatMoney: (value: number) => string; openModal: (modal: ModalState) => void; openDelete: (modal: ModalState) => void; openClientId?: string | null; onOpenClientConsumed?: () => void }) {
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
  const statusOptions = useMemo(
    () => ['all', ...Array.from(new Set([...customStatuses.map(status => status.key), ...clients.map(client => client.statusKey)]))],
    [customStatuses, clients],
  );
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

  useEffect(() => {
    if (!openClientId) return;
    const target = clients.find(client => String(client.id) === openClientId);
    if (!target) return;
    setViewingClient(target);
    onOpenClientConsumed?.();
  }, [openClientId, clients, onOpenClientConsumed]);

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
            statusOptions={statusOptions.map(value => ({ value, label: value === 'all' ? t('clients.filters.allStatuses') : resolveStatusDisplay(value).label }))}
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

function EmployeeGrid({ staff, pieceworkRecords, attendanceLog, formatMoney, openModal, openDelete }: { staff: StaffMember[]; pieceworkRecords: PieceworkRecord[]; attendanceLog: AttendanceLogEntry[]; formatMoney: (v: number) => string; openModal: (m: ModalState) => void; openDelete: (m: ModalState) => void }) {
  const { t } = useTranslation();
  const canManage = useHasPermission('employees', 'manage');
  const [detailId, setDetailId] = useState<EntityId | null>(null);
  const [query, setQuery] = useState('');
  const detailMember = staff.find(member => member.id === detailId) ?? null;

  const earnedByEmployee = useMemo(() => {
    const totals = new Map<string, number>();
    pieceworkRecords.forEach(record => totals.set(record.employeeName, (totals.get(record.employeeName) ?? 0) + record.quantity * record.ratePerPiece));
    return totals;
  }, [pieceworkRecords]);

  const filteredStaff = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return staff;
    return staff.filter(member => `${member.name} ${member.phone} ${optionLabel(t, 'employeePosition', member.role)}`.toLowerCase().includes(needle));
  }, [staff, query, t]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block w-full max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('staff.searchPlaceholder')} className="h-10 w-full rounded-xl border border-border-soft bg-surface-card pl-9 pr-3 text-sm text-text-primary outline-none focus:border-primary/50" />
        </label>
        <span className="text-xs font-bold text-text-muted">{t('admin.ui.recordsCount', { count: filteredStaff.length })}</span>
      </div>
      <DataTable
        columns={[t('staff.columns.staff'), t('staff.columns.phone'), t('staff.columns.salary'), t('staff.columns.hireDate'), t('staff.columns.status'), t('common.actions')]}
        rows={filteredStaff.map(member => {
          const initials = member.name.split(' ').map((word: string) => word[0]).slice(0, 2).join('');
          const earned = earnedByEmployee.get(member.name) ?? 0;
          return [
            <span className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-extrabold text-primary">{initials}</span>
              <span className="block min-w-0">
                <span className="block truncate text-sm font-extrabold text-text-primary">{member.name}</span>
                <span className="block truncate text-xs text-text-muted">{optionLabel(t, 'employeePosition', member.role)}</span>
              </span>
            </span>,
            member.phone || '—',
            <span className="block min-w-0">
              <span className="block truncate text-sm font-bold text-text-primary">{formatMoney(member.salary)}</span>
              <span className="block truncate text-xs text-text-muted">
                {optionLabel(t, 'salaryType', member.shift)}
                {earned > 0 ? <span className="font-bold text-success"> · +{formatMoney(earned)} {t('staff.detail.pieceworkBadge')}</span> : null}
              </span>
            </span>,
            formatDisplayDate(member.hireDate, t),
            <StatusBadge tone={statusTone(member.statusKey)}>{statusLabel(t, member.statusKey)}</StatusBadge>,
            <RowActions onView={() => setDetailId(member.id)} onEdit={canManage ? () => openModal({ kind: 'staff', mode: 'edit', item: member }) : undefined} onDelete={canManage ? () => openDelete({ kind: 'staff', mode: 'view', item: member }) : undefined} />,
          ];
        })}
        onRowClick={rowIndex => setDetailId(filteredStaff[rowIndex].id)}
      />
      {detailMember ? (
        <StaffDetailModal
          member={detailMember}
          records={pieceworkRecords.filter(r => r.employeeName === detailMember.name)}
          attendanceLog={attendanceLog}
          formatMoney={formatMoney}
          onClose={() => setDetailId(null)}
        />
      ) : null}
    </>
  );
}

function StaffDetailModal({ member, records, attendanceLog, formatMoney, onClose }: { member: StaffMember; records: PieceworkRecord[]; attendanceLog: AttendanceLogEntry[]; formatMoney: (v: number) => string; onClose: () => void }) {
  const { t } = useTranslation();
  const canManage = useHasPermission('employees', 'manage');
  const initials = member.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('');
  const totalEarned = records.reduce((sum, r) => sum + r.quantity * r.ratePerPiece, 0);
  const totalPieces = records.reduce((sum, r) => sum + r.quantity, 0);
  const hasPiecework = records.length > 0;
  const monthPrefix = isoDate(new Date()).slice(0, 7);
  const monthWorkedMinutes = attendanceLog
    .filter(entry => String(entry.employeeId) === String(member.id) && entry.workDate.startsWith(monthPrefix))
    .reduce((sum, entry) => sum + entry.workedMinutes, 0);

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
          <h4 className="text-sm font-extrabold text-text-primary">{t('staff.detail.monthStats')}</h4>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-2xl bg-surface-subtle p-4 ring-1 ring-border-soft/30">
              <p className="text-xs text-text-muted">{t('staff.tabs.attendance')}</p>
              <p className="mt-1 text-2xl font-extrabold text-text-primary">{member.attendance}%</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-surface-muted">
                <div className={['h-full rounded-pill', member.attendance >= 90 ? 'bg-success' : member.attendance >= 75 ? 'bg-warning' : 'bg-danger'].join(' ')} style={{ width: `${member.attendance}%` }} />
              </div>
            </div>
            <div className="rounded-2xl bg-primary/5 p-4 ring-1 ring-primary/20">
              <p className="text-xs text-text-muted">{t('staff.detail.workedHoursMonth')}</p>
              <p className="mt-1 text-xl font-extrabold text-primary">{formatWorkedHours(t, monthWorkedMinutes)}</p>
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
                        <td className="px-3 py-3 text-right font-bold text-text-primary">{r.quantity.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-xs text-text-muted">{formatMoney(r.ratePerPiece)}</td>
                        <td className="py-3 pl-3 pr-4 text-right font-extrabold text-success">{formatMoney(r.quantity * r.ratePerPiece)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-success/5">
                      <td colSpan={3} className="py-3 pl-4 pr-3 text-sm font-extrabold text-text-primary">{t('staff.piecework.earned')}</td>
                      <td className="py-3 pl-3 pr-4 text-right text-base font-extrabold text-success">{formatMoney(totalEarned)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function StaffPage({ staff, attendanceLog, pieceworkRecords, formatMoney, openModal, openDelete }: { staff: StaffMember[]; attendanceLog: AttendanceLogEntry[]; pieceworkRecords: PieceworkRecord[]; formatMoney: (value: number) => string; openModal: (modal: ModalState) => void; openDelete: (modal: ModalState) => void }) {
  const { t } = useTranslation();
  const exportResource = useResourceExport();
  const canManage = useHasPermission('employees', 'manage');
  const [activeTab, setActiveTab] = useState<'employees' | 'attendance' | 'piecework'>('employees');

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('staff.eyebrow')} title={t('staff.title')} description={t('staff.description')} createLabel={canManage && activeTab === 'employees' ? t('staff.create') : undefined} onCreate={canManage && activeTab === 'employees' ? () => openModal({ kind: 'staff', mode: 'create' }) : undefined} onExport={() => exportResource(activeTab === 'attendance' ? resources.attendanceRecords : resources.employees)} />
      <SegmentTabs
        tabs={[
          { id: 'employees', label: t('staff.tabs.employees'), icon: <FiUsers className="h-4 w-4" /> },
          { id: 'attendance', label: t('staff.tabs.attendance'), icon: <FiClock className="h-4 w-4" /> },
          { id: 'piecework', label: t('staff.tabs.piecework'), icon: <FiTool className="h-4 w-4" /> },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as 'employees' | 'attendance' | 'piecework')}
      />
      {activeTab === 'employees' ? (
        <EmployeeGrid staff={staff} pieceworkRecords={pieceworkRecords} attendanceLog={attendanceLog} formatMoney={formatMoney} openModal={openModal} openDelete={openDelete} />
      ) : activeTab === 'piecework' ? (
        <PieceworkTab staff={staff} pieceworkRecords={pieceworkRecords} formatMoney={formatMoney} />
      ) : (
        <AttendanceLogView staff={staff} attendanceLog={attendanceLog} canManage={canManage} />
      )}
    </div>
  );
}

/** Xodimlar > Davomat: a single filterable log — who checked in/out and when, by employee
 *  and by date range. Replaces the earlier 5-tab layout (overview stats, raw event log,
 *  schedules, devices) which buried this behind unnecessary sub-navigation; schedules and
 *  devices are config, not something checked daily, so they moved to Tizim > System. */
function formatWorkedHours(t: TFunction, minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return t('staff.attendance.hoursMinutes', { hours, minutes: mins });
}

function timeOfDay(iso: string | null) {
  if (!iso) return '—';
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Manual weekday names: browsers without uz locale data fall back to English otherwise.
const WEEKDAYS: Record<'uz' | 'ru', string[]> = {
  uz: ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'],
  ru: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
};

function AttendanceLogView({ staff, attendanceLog, canManage }: { staff: StaffMember[]; attendanceLog: AttendanceLogEntry[]; canManage: boolean }) {
  const { t } = useTranslation();
  const [enrolling, setEnrolling] = useState(false);
  // No filter by default (all time); pick a preset or a custom range to narrow the view.
  const [dateRange, setDateRange] = useState<DashboardDateRange | null>(null);
  const [detailEmployeeId, setDetailEmployeeId] = useState<string | null>(null);
  const employeeNames = useMemo(() => new Map(staff.map(member => [String(member.id), member.name])), [staff]);

  const rangeRows = useMemo(() => attendanceLog
    .filter(entry => !dateRange || (entry.workDate >= dateRange.startDate && entry.workDate <= dateRange.endDate))
    .sort((a, b) => b.workDate.localeCompare(a.workDate) || (employeeNames.get(String(a.employeeId)) ?? '').localeCompare(employeeNames.get(String(b.employeeId)) ?? '')),
  [attendanceLog, dateRange, employeeNames]);

  const isSingleDay = Boolean(dateRange && dateRange.startDate === dateRange.endDate);

  // Multi-day mode: one row per employee with aggregated presence.
  const aggregated = useMemo(() => {
    const byEmployee = new Map<string, { days: number; minutes: number }>();
    rangeRows.forEach(entry => {
      const key = String(entry.employeeId);
      const current = byEmployee.get(key) ?? { days: 0, minutes: 0 };
      current.days += 1;
      current.minutes += entry.workedMinutes;
      byEmployee.set(key, current);
    });
    return staff
      .map(member => ({ member, stats: byEmployee.get(String(member.id)) ?? { days: 0, minutes: 0 } }))
      .sort((a, b) => b.stats.minutes - a.stats.minutes);
  }, [rangeRows, staff]);

  const detailMember = detailEmployeeId ? staff.find(member => String(member.id) === detailEmployeeId) ?? null : null;
  if (detailMember) {
    return (
      <EmployeeAttendanceDetail
        member={detailMember}
        attendanceLog={attendanceLog}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onBack={() => setDetailEmployeeId(null)}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {canManage ? (
          <button className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground" onClick={() => setEnrolling(true)}>{t('faceEnroll.buttonLabel')}</button>
        ) : <span />}
        <div className="flex flex-wrap items-center gap-2.5">
          <DateRangeControls value={dateRange} onChange={setDateRange} />
        </div>
      </div>
      <p className="m-0 text-xs font-semibold text-text-muted">{t('staff.attendance.rowHint')}</p>

      {isSingleDay ? (
        <DataTable
          columns={[t('staff.columns.staff'), t('admin.fields.firstCheckIn'), t('admin.fields.lastCheckOut'), t('staff.attendance.hoursColumn')]}
          rows={rangeRows.map(entry => [
            <span className="font-bold text-text-primary">{employeeNames.get(String(entry.employeeId)) ?? t('staff.attendance.unknownEmployee')}</span>,
            <span className="font-bold text-success">{timeOfDay(entry.checkIn)}</span>,
            <span className="font-bold text-warning">{timeOfDay(entry.checkOut)}</span>,
            formatWorkedHours(t, entry.workedMinutes),
          ])}
          onRowClick={rowIndex => setDetailEmployeeId(String(rangeRows[rowIndex].employeeId))}
        />
      ) : (
        <DataTable
          columns={[t('staff.columns.staff'), t('staff.attendance.daysPresent'), t('staff.attendance.hoursColumn')]}
          rows={aggregated.map(({ member, stats }) => [
            <span className="font-bold text-text-primary">{member.name}</span>,
            <span className={stats.days > 0 ? 'font-bold text-text-primary' : 'font-bold text-text-muted'}>{stats.days}</span>,
            formatWorkedHours(t, stats.minutes),
          ])}
          onRowClick={rowIndex => setDetailEmployeeId(String(aggregated[rowIndex].member.id))}
        />
      )}
      {(isSingleDay ? rangeRows.length : aggregated.length) === 0 ? <p className="py-6 text-center text-sm text-text-muted">{t('admin.ui.noRecords')}</p> : null}
      {enrolling ? <FaceEnrollDrawer onClose={() => setEnrolling(false)} onEnrolled={() => setEnrolling(false)} /> : null}
    </div>
  );
}

/** Per-employee attendance view: a daily card for each day in the selected range showing
 *  arrival, leaving and worked time; past working days without a record show as absent. */
function EmployeeAttendanceDetail({ member, attendanceLog, dateRange, onDateRangeChange, onBack }: {
  member: StaffMember;
  attendanceLog: AttendanceLogEntry[];
  dateRange: DashboardDateRange | null;
  onDateRangeChange: (range: DashboardDateRange | null) => void;
  onBack: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('ru') ? 'ru-RU' : 'uz-UZ';

  const entriesByDate = useMemo(() => {
    const map = new Map<string, AttendanceLogEntry>();
    attendanceLog.filter(entry => String(entry.employeeId) === String(member.id)).forEach(entry => map.set(entry.workDate, entry));
    return map;
  }, [attendanceLog, member.id]);

  const todayIso = isoDate(new Date());
  const days = useMemo(() => {
    const list: Array<{ date: string; entry: AttendanceLogEntry | null }> = [];
    if (dateRange) {
      const end = dateRange.endDate < todayIso ? dateRange.endDate : todayIso;
      const cursor = new Date(`${dateRange.startDate}T00:00:00`);
      const endDate = new Date(`${end}T00:00:00`);
      let guard = 0;
      while (cursor <= endDate && guard < 190) {
        const iso = isoDate(cursor);
        list.push({ date: iso, entry: entriesByDate.get(iso) ?? null });
        cursor.setDate(cursor.getDate() + 1);
        guard += 1;
      }
      return list.reverse();
    }
    return [...entriesByDate.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, entry]) => ({ date, entry }));
  }, [dateRange, entriesByDate, todayIso]);

  const presentDays = days.filter(day => day.entry);
  const totalMinutes = presentDays.reduce((sum, day) => sum + (day.entry?.workedMinutes ?? 0), 0);
  const avgMinutesOf = (pick: (entry: AttendanceLogEntry) => string | null) => {
    const stamps = presentDays.map(day => pick(day.entry!)).filter((iso): iso is string => Boolean(iso)).map(iso => new Date(iso)).filter(date => !Number.isNaN(date.getTime()));
    if (!stamps.length) return null;
    const avg = stamps.reduce((sum, date) => sum + date.getHours() * 60 + date.getMinutes(), 0) / stamps.length;
    return `${String(Math.floor(avg / 60)).padStart(2, '0')}:${String(Math.round(avg % 60)).padStart(2, '0')}`;
  };
  const avgIn = avgMinutesOf(entry => entry.checkIn);
  const avgOut = avgMinutesOf(entry => entry.checkOut);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-surface-subtle px-3 text-xs font-bold text-text-secondary transition hover:bg-surface-muted hover:text-text-primary" onClick={onBack}>
            <FiChevronRight className="h-4 w-4 rotate-180" /> {t('staff.attendance.back')}
          </button>
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-extrabold text-primary">
            {member.name.split(' ').map(word => word[0]).slice(0, 2).join('')}
          </span>
          <div className="min-w-0">
            <p className="m-0 truncate text-base font-extrabold text-text-primary">{member.name}</p>
            <p className="m-0 text-xs text-text-muted">{optionLabel(t, 'employeePosition', member.role)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <DateRangeControls value={dateRange} onChange={onDateRangeChange} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-surface-subtle px-4 py-2.5 ring-1 ring-border-soft/30">
          <span className="text-lg font-extrabold text-text-primary">{presentDays.length}</span>
          <span className="text-xs font-semibold text-text-muted">{t('staff.attendance.daysPresent')}</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-primary/8 px-4 py-2.5 ring-1 ring-primary/20">
          <span className="text-lg font-extrabold text-primary">{formatWorkedHours(t, totalMinutes)}</span>
          <span className="text-xs font-semibold text-primary/70">{t('staff.attendance.hoursColumn')}</span>
        </div>
        {avgIn ? (
          <div className="flex items-center gap-2 rounded-xl bg-success/8 px-4 py-2.5 ring-1 ring-success/20">
            <span className="text-lg font-extrabold text-success">{avgIn}</span>
            <span className="text-xs font-semibold text-success/70">{t('staff.attendance.avgArrival')}</span>
          </div>
        ) : null}
        {avgOut ? (
          <div className="flex items-center gap-2 rounded-xl bg-warning/8 px-4 py-2.5 ring-1 ring-warning/20">
            <span className="text-lg font-extrabold text-warning">{avgOut}</span>
            <span className="text-xs font-semibold text-warning/70">{t('staff.attendance.avgLeaving')}</span>
          </div>
        ) : null}
      </div>

      {days.length === 0 ? (
        <p className="rounded-xl bg-surface-subtle p-6 text-center text-sm text-text-muted">{t('admin.ui.noRecords')}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {days.map(({ date, entry }) => {
            const weekday = WEEKDAYS[lang.startsWith('ru') ? 'ru' : 'uz'][new Date(`${date}T00:00:00`).getDay()];
            return entry ? (
              <div key={date} className="app-card--nova grid gap-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="m-0 text-sm font-extrabold text-text-primary">{formatDisplayDate(date, t)}</p>
                    <p className="m-0 text-[11px] capitalize text-text-muted">{weekday}</p>
                  </div>
                  <span className="rounded-pill bg-primary/10 px-2.5 py-1 text-[11px] font-extrabold text-primary">{formatWorkedHours(t, entry.workedMinutes)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-success/8 p-2.5 text-center ring-1 ring-success/15">
                    <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-success/70">{t('staff.attendance.cameAt')}</p>
                    <p className="m-0 mt-0.5 text-lg font-extrabold text-success">{timeOfDay(entry.checkIn)}</p>
                  </div>
                  <div className="rounded-xl bg-warning/8 p-2.5 text-center ring-1 ring-warning/15">
                    <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-warning/70">{t('staff.attendance.leftAt')}</p>
                    <p className="m-0 mt-0.5 text-lg font-extrabold text-warning">{timeOfDay(entry.checkOut)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div key={date} className="grid gap-1 rounded-2xl border border-dashed border-border-soft/60 bg-surface-subtle/40 p-4 opacity-75">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="m-0 text-sm font-bold text-text-secondary">{formatDisplayDate(date, t)}</p>
                    <p className="m-0 text-[11px] capitalize text-text-muted">{weekday}</p>
                  </div>
                  <span className="rounded-pill bg-surface-muted px-2.5 py-1 text-[11px] font-bold text-text-muted">{t('staff.attendance.absent')}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function OrdersPage({ orders, formatMoney, openModal, openDelete, onOpenClient, onDataChanged }: { orders: Order[]; formatMoney: (value: number) => string; openModal: (modal: ModalState) => void; openDelete: (modal: ModalState) => void; onOpenClient: (clientId: string) => void; onDataChanged?: () => void }) {
  const { t } = useTranslation();
  const exportResource = useResourceExport();
  const canManage = useHasPermission('clients', 'manage');
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const pending = orders.filter(o => o.statusKey === 'draft').length;
  const inProd = orders.filter(o => o.statusKey === 'confirmed').length;
  const delivered = orders.filter(o => o.statusKey === 'completed').length;

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('orders.eyebrow')} title={t('orders.title')} description={t('orders.description')} createLabel={canManage ? t('orders.create') : undefined} onCreate={canManage ? () => openModal({ kind: 'order', mode: 'create' }) : undefined} onExport={() => exportResource(resources.clientOrders)} />
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
      <DataTable
        columns={[t('orders.columns.orderId'), t('orders.columns.client'), t('orders.columns.product'), t('orders.columns.total'), t('orders.columns.status'), t('common.actions')]}
        rows={orders.map(order => [
          <PrimaryCell title={order.orderId} subtitle={formatDisplayDate(order.orderDate, t)} />,
          order.clientId ? (
            <button
              type="button"
              className="text-left text-sm font-bold text-text-accent underline-offset-2 transition hover:underline"
              onClick={event => { event.stopPropagation(); onOpenClient(String(order.clientId)); }}
            >
              {translateMovementLabel(t, order.client)}
            </button>
          ) : translateMovementLabel(t, order.client),
          order.items.length === 0 ? (
            <span className="text-xs text-text-muted">—</span>
          ) : (
            <span className="block" title={order.items.map(item => `${item.productName}: ${item.delivered}/${item.ordered}`).join(' · ')}>
              <span className="block text-sm">
                <span className="font-bold text-text-primary">{order.orderedQty.toLocaleString()} {t('common.pcs')}</span>
                <span className={['ml-1.5 font-bold', order.deliveredQty >= order.orderedQty ? 'text-success' : 'text-warning'].join(' ')}>· {order.deliveredQty.toLocaleString()} {t('orders.deliveredShort')}</span>
              </span>
              <span className="mt-0.5 block max-w-[200px] truncate text-[11px] text-text-muted">{order.items.map(item => item.productName).join(', ')}</span>
            </span>
          ),
          <span className="block">
            <span className="block text-sm font-bold text-text-primary">{formatMoney(order.totalAmount)}</span>
            {order.paidTotal > 0 || order.totalAmount > 0 ? (
              <span className="mt-0.5 block text-[11px] text-text-muted">
                {t('orders.paid')}: <span className={order.paidTotal >= order.totalAmount && order.totalAmount > 0 ? 'font-bold text-success' : 'font-bold text-warning'}>{formatMoney(order.paidTotal)}</span>
              </span>
            ) : null}
          </span>,
          <StatusBadge tone={orderStatusTone(order.statusKey)}>{statusLabel(t, order.statusKey)}</StatusBadge>,
          <RowActions onView={() => setViewingOrder(order)} onEdit={canManage ? () => openModal({ kind: 'order', mode: 'edit', item: order }) : undefined} onDelete={canManage ? () => openDelete({ kind: 'order', mode: 'view', item: order }) : undefined} />,
        ])}
        onRowClick={(rowIndex) => setViewingOrder(orders[rowIndex])}
      />
      {viewingOrder ? (
        <OrderDetailModal
          order={viewingOrder}
          canManage={canManage}
          formatMoney={formatMoney}
          onOpenClient={onOpenClient}
          onClose={() => { setViewingOrder(null); onDataChanged?.(); }}
        />
      ) : null}
    </div>
  );
}

function OrderDetailModal({ order, canManage, formatMoney, onOpenClient, onClose }: { order: Order; canManage: boolean; formatMoney: (value: number) => string; onOpenClient: (clientId: string) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'items' | 'deliveries' | 'payments' | 'returns'>('items');
  const orderScope = useMemo(() => ({ order: String(order.id) }), [order.id]);

  // Deliveries and returns can only concern the products this order actually contains — so
  // the product field is constrained to the order's items: hidden and auto-filled when there
  // is a single product, or a dropdown of just this order's products when there are several.
  const orderProducts = useMemo(
    () => order.items.filter(item => item.productId).map(item => ({ value: item.productId, label: item.productName })),
    [order.items],
  );
  const singleProductId = orderProducts.length === 1 ? orderProducts[0].value : null;
  const scopeProduct = useCallback((config: ResourceConfig): ResourceConfig => {
    if (orderProducts.length === 0) return config;
    if (orderProducts.length === 1) return scopedFieldConfig(config, canManage, 'product');
    return {
      ...config,
      fields: config.fields.map(field => (field.name === 'product' ? { name: 'product', label: field.label, type: 'select', required: true, table: true, options: orderProducts } : field)),
    };
  }, [orderProducts, canManage]);

  const configs = useMemo(() => ({
    items: { ...operationsConfigs.orderItems, readOnly: !canManage },
    deliveries: scopeProduct(scopedFieldConfig(scopedClientConfig(operationsConfigs.deliveries, canManage), canManage, 'order')),
    payments: scopedFieldConfig(scopedClientConfig(operationsConfigs.payments, canManage), canManage, 'order'),
    returns: scopeProduct(scopedFieldConfig(scopedClientConfig(operationsConfigs.returns, canManage), canManage, 'order')),
  }), [canManage, scopeProduct]);

  const fixedByTab = useMemo(() => {
    const base: Record<string, unknown> = order.clientId ? { order: String(order.id), client: String(order.clientId) } : { order: String(order.id) };
    const withProduct = singleProductId ? { ...base, product: singleProductId } : base;
    return { items: orderScope, deliveries: withProduct, payments: base, returns: withProduct } as Record<typeof activeTab, Record<string, unknown>>;
  }, [order.id, order.clientId, singleProductId, orderScope]);
  const remaining = order.totalAmount - order.paidTotal;

  return (
    <div className="fixed inset-0 z-[190] grid place-items-center bg-background-overlay/72 px-3 backdrop-blur-[3px]" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" className="grid max-h-[90vh] w-full max-w-[1080px] grid-rows-[auto_1fr] overflow-hidden rounded-[28px] bg-surface-card shadow-[0_40px_110px_-42px_rgba(15,23,42,0.62)] ring-1 ring-border-soft/55">
        <div className="flex items-start justify-between gap-4 border-b border-border-soft/30 p-6">
          <div className="min-w-0">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{formatDisplayDate(order.orderDate, t)}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h3 className="m-0 truncate font-display text-xl font-extrabold text-text-primary">{order.orderId}</h3>
              {order.clientId ? (
                <button type="button" className="text-sm font-bold text-text-accent underline-offset-2 transition hover:underline" onClick={() => onOpenClient(String(order.clientId))}>
                  {translateMovementLabel(t, order.client)}
                </button>
              ) : (
                <span className="text-sm font-bold text-text-secondary">{translateMovementLabel(t, order.client)}</span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge tone={orderStatusTone(order.statusKey)}>{statusLabel(t, order.statusKey)}</StatusBadge>
              <span className="rounded-pill bg-surface-subtle px-2.5 py-0.5 text-[11px] font-bold text-text-secondary ring-1 ring-border-soft/40">{t('clients.columns.ordered')}: {order.orderedQty.toLocaleString()} {t('common.pcs')}</span>
              <span className={['rounded-pill px-2.5 py-0.5 text-[11px] font-bold ring-1', order.deliveredQty >= order.orderedQty && order.orderedQty > 0 ? 'bg-success/10 text-success ring-success/20' : 'bg-warning/10 text-warning ring-warning/20'].join(' ')}>{t('clients.columns.delivered')}: {order.deliveredQty.toLocaleString()} {t('common.pcs')}</span>
              <span className="rounded-pill bg-surface-subtle px-2.5 py-0.5 text-[11px] font-bold text-text-secondary ring-1 ring-border-soft/40">{t('orders.columns.total')}: {formatMoney(order.totalAmount)}</span>
              <span className={['rounded-pill px-2.5 py-0.5 text-[11px] font-bold ring-1', order.paidTotal >= order.totalAmount && order.totalAmount > 0 ? 'bg-success/10 text-success ring-success/20' : 'bg-surface-subtle text-text-secondary ring-border-soft/40'].join(' ')}>{t('orders.paid')}: {formatMoney(order.paidTotal)}</span>
              {remaining > 0 ? (
                <span className="rounded-pill bg-warning/10 px-2.5 py-0.5 text-[11px] font-bold text-warning ring-1 ring-warning/20">{t('orders.remaining')}: {formatMoney(remaining)}</span>
              ) : null}
            </div>
          </div>
          <button type="button" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-subtle text-text-secondary transition duration-fast hover:bg-surface-muted hover:text-text-primary" onClick={onClose} aria-label={t('common.close')}>
            <FiX className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-6">
          <SegmentTabs
            tabs={[
              { id: 'items', label: t('admin.resources.orderItems.title'), icon: <FiShoppingBag className="h-4 w-4" /> },
              { id: 'deliveries', label: t('admin.resources.deliveries.title'), icon: <FiPackage className="h-4 w-4" /> },
              { id: 'payments', label: t('admin.resources.payments.title'), icon: <FiDollarSign className="h-4 w-4" /> },
              { id: 'returns', label: t('admin.resources.returns.title'), icon: <FiArchive className="h-4 w-4" /> },
            ]}
            activeTab={activeTab}
            onChange={id => setActiveTab(id as typeof activeTab)}
          />
          <div className="mt-4">
            <ApiResourceManager key={`${activeTab}-${order.id}`} config={configs[activeTab]} extraParams={orderScope} fixedValues={fixedByTab[activeTab]} />
          </div>
        </div>
      </section>
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
  const newMaterialUnit = newMaterial ? materials.find(m => String(m.id) === newMaterial)?.unit : undefined;

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
          <div className="grid gap-3 border-t border-border-soft/20 bg-surface-subtle/40 p-5 sm:grid-cols-[1fr_160px_auto_auto]">
            <Dropdown value={newMaterial} onChange={setNewMaterial} options={availableMaterials.map(m => ({ value: String(m.id), label: `${m.name} (${unitLabel(m.unit, t)})` }))} placeholder={t('admin.ui.selectPlaceholder')} />
            <div className="relative">
              <input type="number" step="0.000001" min="0" value={newQty} onChange={event => setNewQty(event.target.value)} placeholder={t('products.bom.perUnit')} className="h-11 w-full rounded-xl border border-border-soft bg-surface-card px-3 pr-16 text-sm text-text-primary outline-none focus:border-primary/50" />
              {newMaterialUnit ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">{unitLabel(newMaterialUnit, t)}/{unitLabel(product.unit, t)}</span> : null}
            </div>
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
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: categories[categoryIndex].color }} />
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

  return (
    <DataTable
      rows={categories.map(category => {
        const count = products.filter(product => product.categoryId === category.id).length;
        return [
          <span className="flex items-center gap-2.5">
            <span className="h-4 w-4 shrink-0 rounded-full ring-2 ring-border-soft/40" style={{ backgroundColor: category.color }} aria-hidden="true" />
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

/** Quick stock-in for a material: "800 bor edi, 200 keldi" — enter 200, an incoming
 *  MaterialTransaction is created and lands in Tasdiqlar; stock updates once approved. */
function AddMaterialStockModal({ material, formatMoney, onClose }: { material: Material; formatMoney: (value: number) => string; onClose: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState(String(material.price || ''));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!quantity || Number(quantity) <= 0 || !date) {
      toast(t('admin.ui.requiredFieldsMissing'), 'danger');
      return;
    }
    setSaving(true);
    try {
      await api.create(resources.materialTransactions, {
        material: material.id, transaction_type: 'in', quantity, unit_price: unitPrice || '0', date,
      });
      toast(t('materials.addStockPending'), 'success');
      onClose();
    } catch (error) {
      toast(apiErrorMessage(error, t), 'danger');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[190] grid place-items-center bg-background-overlay/72 px-3 backdrop-blur-[3px]" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" className="w-full max-w-[420px] rounded-[28px] bg-surface-card p-5 shadow-[0_40px_110px_-42px_rgba(15,23,42,0.62)] ring-1 ring-border-soft/55">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="m-0 truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{material.name}</p>
            <h3 className="mt-1 font-display text-xl font-extrabold text-text-primary">{t('materials.addStockTitle')}</h3>
            <p className="mt-1 text-sm text-text-muted">{t('materials.addStockCurrent', { stock: material.stock.toLocaleString(), unit: unitLabel(material.unit, t) })}</p>
          </div>
          <button type="button" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-subtle text-text-secondary transition duration-fast hover:bg-surface-muted hover:text-text-primary" onClick={onClose} aria-label={t('common.close')}>
            <FiX className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 grid gap-3">
          <label className="grid gap-1.5 text-sm font-bold text-text-secondary">
            {t('admin.fields.quantity')} ({unitLabel(material.unit, t)})
            <input type="number" min="0.0001" step="any" autoFocus value={quantity} onChange={event => setQuantity(event.target.value)} className="h-11 w-full rounded-xl border border-border-soft bg-surface-card px-3 text-sm text-text-primary outline-none focus:border-primary/50" />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-text-secondary">
            {t('admin.fields.unitPrice')}
            <input type="number" min="0" step="0.01" value={unitPrice} onChange={event => setUnitPrice(event.target.value)} className="h-11 w-full rounded-xl border border-border-soft bg-surface-card px-3 text-sm text-text-primary outline-none focus:border-primary/50" />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-text-secondary">
            {t('admin.fields.date')}
            <DatePicker value={date} onChange={setDate} />
          </label>
          {quantity && Number(quantity) > 0 ? (
            <p className="rounded-xl bg-primary/5 p-3 text-sm font-semibold text-text-secondary ring-1 ring-primary/15">
              {material.stock.toLocaleString()} + {Number(quantity).toLocaleString()} = <span className="font-extrabold text-primary">{(material.stock + Number(quantity)).toLocaleString()} {unitLabel(material.unit, t)}</span>
              {unitPrice && Number(unitPrice) > 0 ? <span className="ml-2 text-xs text-text-muted">({formatMoney(Number(quantity) * Number(unitPrice))})</span> : null}
            </p>
          ) : null}
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

export function MaterialsPage({ materials, formatMoney, onCreate, openModal, openDelete }: { materials: Material[]; formatMoney: (value: number) => string; onCreate: () => void; openModal: (modal: ModalState) => void; openDelete: (modal: ModalState) => void }) {
  const { t } = useTranslation();
  const exportResource = useResourceExport();
  const canManage = useHasPermission('materials', 'manage');
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'materials' | 'stock'>('materials');
  const [addingStockFor, setAddingStockFor] = useState<Material | null>(null);
  const lowStockCount = materials.filter(m => m.stock <= m.minStock).length;
  const totalValue = materials.reduce((sum, m) => sum + m.stock * m.price, 0);
  const filtered = materials.filter(m =>
    m.name.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('materials.eyebrow')} title={t('materials.title')} description={t('materials.description')} createLabel={canManage && activeTab === 'materials' ? t('materials.create') : undefined} onCreate={canManage && activeTab === 'materials' ? onCreate : undefined} onExport={() => exportResource(activeTab === 'stock' ? resources.materialStocks : resources.materials)} />
      <SegmentTabs
        tabs={[
          { id: 'materials', label: t('materials.title'), icon: <FiLayers className="h-4 w-4" /> },
          { id: 'stock', label: t('admin.resources.materialStocks.title'), icon: <FiArchive className="h-4 w-4" /> },
        ]}
        activeTab={activeTab}
        onChange={id => setActiveTab(id as typeof activeTab)}
      />
      {activeTab === 'stock' ? (
        <MaterialStockGrid materials={materials} formatMoney={formatMoney} />
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
              {canManage ? <button className="rounded-lg bg-success-bg px-2.5 py-1.5 text-xs font-bold text-success transition hover:bg-success/15" onClick={() => setAddingStockFor(mat)}>+ {t('materials.addStock')}</button> : null}
              <RowActions onView={() => openModal({ kind: 'material', mode: 'view', item: mat })} onEdit={canManage ? () => openModal({ kind: 'material', mode: 'edit', item: mat }) : undefined} onDelete={canManage ? () => openDelete({ kind: 'material', mode: 'view', item: mat }) : undefined} />
            </div>,
          ];
        })}
      />
        </>
      )}
      {addingStockFor ? <AddMaterialStockModal material={addingStockFor} formatMoney={formatMoney} onClose={() => setAddingStockFor(null)} /> : null}
    </div>
  );
}

function MaterialStockGrid({ materials, formatMoney }: { materials: Material[]; formatMoney: (value: number) => string }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const rank = (m: Material) => (m.stock === 0 ? 0 : m.stock <= m.minStock ? 1 : 2);
  const filtered = materials
    .filter(m => m.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const totalValue = filtered.reduce((sum, m) => sum + m.stock * m.price, 0);
  const lowCount = filtered.filter(m => m.stock <= m.minStock).length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block w-full max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('materials.searchPlaceholder')} className="h-10 w-full rounded-xl border border-border-soft bg-surface-card pl-9 pr-3 text-sm text-text-primary outline-none focus:border-primary/50" />
        </label>
        {lowCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-warning/8 px-3 py-2 text-xs font-bold text-warning ring-1 ring-warning/20">
            <FiAlertTriangle className="h-3.5 w-3.5" /> {t('materials.metrics.lowStock')}: {lowCount}
          </span>
        ) : null}
        <span className="ml-auto text-xs font-bold text-text-muted">{t('materials.metrics.totalValue')}: <span className="text-success">{formatMoney(totalValue)}</span></span>
      </div>
      {filtered.length === 0 ? (
        <p className="rounded-xl bg-surface-subtle p-6 text-center text-sm text-text-muted">{t('admin.ui.noRecords')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(mat => {
            const pct = Math.min(100, Math.round((mat.stock / Math.max(mat.minStock, 1)) * 100));
            const tone = mat.stock === 0 ? 'danger' : mat.stock <= mat.minStock ? 'warning' : 'success';
            const label = mat.stock === 0 ? t('production.stock.noStock') : mat.stock <= mat.minStock ? t('production.stock.lowStock') : t('production.stock.inStock');
            return (
              <div key={mat.id} className="app-card--nova flex flex-col gap-4 p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FiLayers className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-text-primary">{mat.name}</p>
                  </div>
                  <StatusBadge tone={tone}>{label}</StatusBadge>
                </div>
                <div>
                  <div className="flex items-end justify-between text-xs text-text-muted">
                    <span>{t('production.stock.currentStock')}</span>
                    <span>{t('production.stock.minStock')}: {mat.minStock.toLocaleString()}</span>
                  </div>
                  <p className={['mt-1 text-2xl font-extrabold', tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-text-primary'].join(' ')}>
                    {mat.stock.toLocaleString()} <span className="text-sm font-semibold text-text-muted">{unitLabel(mat.unit, t)}</span>
                  </p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-pill bg-surface-muted">
                    <div className={['h-full rounded-pill transition-all', tone === 'danger' ? 'bg-danger' : tone === 'warning' ? 'bg-warning' : 'bg-success'].join(' ')} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-surface-subtle p-3 text-xs">
                  <span className="text-text-muted">{t('materials.stock.value')}</span>
                  <span className="font-bold text-text-primary">{formatMoney(mat.stock * mat.price)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const WORKING_DAYS = 26;

function payrollStatusTone(status: string): StatusTone {
  if (status === 'paid') return 'success';
  if (status === 'approved') return 'info';
  if (status === 'unlocked') return 'warning';
  return 'neutral';
}

function PayrollTab({ staff, formatMoney }: { staff: StaffMember[]; formatMoney: (value: number) => string }) {
  const { t } = useTranslation();
  const { prompt } = useDialog();
  const { toast } = useToast();
  const canManage = useHasPermission('payroll', 'manage');
  const [rows, setRows] = useState<ApiMonthlyPayroll[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const employeeNames = useMemo(() => new Map(staff.map(member => [String(member.id), member.name])), [staff]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.list<ApiMonthlyPayroll>(resources.monthlyPayrolls));
    } catch (error) {
      toast(apiErrorMessage(error, t), 'danger');
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => { void load(); }, [load]);

  async function runAction(id: string, run: () => Promise<unknown>) {
    setBusyId(id);
    try {
      await run();
      await load();
    } catch (error) {
      toast(apiErrorMessage(error, t), 'danger');
    } finally {
      setBusyId(null);
    }
  }

  async function calculateMonth() {
    const month = await prompt({ title: t('dialog.monthTitle'), message: t('admin.page.promptMonth'), defaultValue: new Date().toISOString().slice(0, 7), inputType: 'month', required: true });
    if (!month) return;
    setLoading(true);
    try {
      await actions.calculatePayroll(month);
      await load();
      toast(t('admin.ui.savedOk'), 'success');
    } catch (error) {
      toast(apiErrorMessage(error, t), 'danger');
    } finally {
      setLoading(false);
    }
  }

  const monthLabel = (iso: string) => {
    const [year, month] = iso.split('-').map(Number);
    return year && month ? `${t(`common.months.${month - 1}`)} ${year}` : iso;
  };

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.month.localeCompare(a.month) || (employeeNames.get(String(a.employee)) ?? '').localeCompare(employeeNames.get(String(b.employee)) ?? '')),
    [rows, employeeNames],
  );
  const grandTotal = sorted.reduce((sum, row) => sum + Number(row.final_amount || 0), 0);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-xl bg-surface-subtle px-4 py-2.5 ring-1 ring-border-soft/30">
            <span className="text-lg font-extrabold text-text-primary">{sorted.length}</span>
            <span className="text-xs font-semibold text-text-muted">{t('admin.resources.payrolls.title')}</span>
          </span>
          {grandTotal > 0 ? (
            <span className="inline-flex items-center gap-2 rounded-xl bg-success/8 px-4 py-2.5 ring-1 ring-success/20">
              <span className="text-lg font-extrabold text-success">{formatMoney(grandTotal)}</span>
              <span className="text-xs font-semibold text-success/80">{t('staff.payroll.totalPayout')}</span>
            </span>
          ) : null}
        </div>
        {canManage ? (
          <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60" disabled={loading} onClick={() => void calculateMonth()}>
            <FiCalendar className="h-4 w-4" /> {t('admin.page.calculateMonth')}
          </button>
        ) : null}
      </div>

      <DataTable
        columns={[t('staff.columns.staff'), t('admin.fields.month'), t('staff.payroll.breakdown'), t('admin.fields.finalAmount'), t('admin.fields.status'), t('common.actions')]}
        rows={sorted.map(row => {
          // Piecework earnings are added for BOTH salary types (a fixed-daily worker who
          // also has work entries gets fixed + akkord), so the breakdown lists every
          // non-zero component instead of assuming one per type.
          const isPiece = row.salary_type === 'piece_rate';
          const pieceTotal = Number(row.piece_rate_total || 0);
          const fixedTotal = Number(row.fixed_rate_total || 0);
          const bonus = Number(row.bonus_total || 0);
          const penalty = Number(row.penalty_total || 0);
          return [
            <span className="block min-w-0">
              <span className="block truncate text-sm font-bold text-text-primary">{employeeNames.get(String(row.employee)) ?? t('staff.attendance.unknownEmployee')}</span>
              <span className="block text-xs text-text-muted">{optionLabel(t, 'salaryType', row.salary_type)}</span>
            </span>,
            <span className="text-sm font-semibold text-text-primary">{monthLabel(row.month)}</span>,
            <span className="block min-w-[190px] text-xs">
              {!isPiece || fixedTotal > 0 ? (
                <span className="block text-text-muted">
                  {t('staff.payroll.fixed')}: <span className="font-bold text-text-primary">{formatMoney(fixedTotal)}</span>
                  <span className="ml-1 opacity-70">· {t('staff.payroll.days', { count: Number(row.worked_days || 0) })}</span>
                </span>
              ) : null}
              {isPiece || pieceTotal > 0 ? (
                <span className="block text-text-muted">
                  {t('staff.payroll.piecework')}: <span className="font-bold text-text-primary">{formatMoney(pieceTotal)}</span>
                </span>
              ) : null}
              {bonus > 0 || penalty > 0 ? (
                <span className="mt-0.5 block">
                  {bonus > 0 ? <span className="mr-2 font-bold text-success">+{formatMoney(bonus)}</span> : null}
                  {penalty > 0 ? <span className="font-bold text-danger">−{formatMoney(penalty)}</span> : null}
                </span>
              ) : null}
            </span>,
            <span className="text-sm font-extrabold text-text-primary">{formatMoney(Number(row.final_amount || 0))}</span>,
            <StatusBadge tone={payrollStatusTone(row.status)}>{optionLabel(t, 'payrollStatus', row.status)}</StatusBadge>,
            canManage ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {row.status === 'draft' || row.status === 'unlocked' ? <button disabled={busyId === row.id} className="rounded-lg bg-success-bg px-2.5 py-1.5 text-xs font-bold text-success transition hover:bg-success/15 disabled:opacity-50" onClick={() => void runAction(row.id, () => actions.approvePayroll(row.id))}>{t('admin.page.approve')}</button> : null}
                {row.status === 'approved' ? <button disabled={busyId === row.id} className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/15 disabled:opacity-50" onClick={() => void runAction(row.id, () => actions.markPayrollPaid(row.id))}>{t('admin.page.markPaid')}</button> : null}
                {/* Backend only allows unlocking approved payrolls (paid ones stay locked). */}
                {row.status === 'approved' ? <button disabled={busyId === row.id} className="rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs font-bold text-warning transition hover:bg-warning/20 disabled:opacity-50" onClick={() => void runAction(row.id, () => actions.unlockPayroll(row.id))}>{t('admin.page.unlock')}</button> : null}
                {row.status === 'paid' ? <span className="text-xs text-text-muted">—</span> : null}
              </div>
            ) : <span className="text-xs text-text-muted">—</span>,
          ];
        })}
      />
      {!loading && sorted.length === 0 ? <p className="py-6 text-center text-sm text-text-muted">{t('admin.ui.noRecords')}</p> : null}
    </div>
  );
}

/** Bulk piecework entry: one employee, several work types at once. Each row carries its
 *  own optional date; rows without one fall back to the common date — so a week's mixed
 *  work can be entered in a single sitting instead of one form per (work type, day). */
function BulkWorkEntryModal({ staff, formatMoney, onClose, onSaved }: { staff: StaffMember[]; formatMoney: (value: number) => string; onClose: () => void; onSaved: (count: number) => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [operationTypes, setOperationTypes] = useState<Array<{ id: string; name: string; price: number }>>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [commonDate, setCommonDate] = useState(() => isoDate(new Date()));
  const [rows, setRows] = useState<Array<{ key: number; opType: string; qty: string; date: string }>>([{ key: 1, opType: '', qty: '', date: '' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void api.list<ApiRecord>(resources.operationTypes).then(list =>
      setOperationTypes(list.map(row => ({ id: String(row.id), name: String(row.name), price: Number(row.price_per_unit) || 0 }))),
    ).catch(() => setOperationTypes([]));
  }, []);

  const priceOf = (opType: string) => operationTypes.find(op => op.id === opType)?.price ?? 0;
  const rowTotal = (row: { opType: string; qty: string }) => priceOf(row.opType) * (Number(row.qty) || 0);
  const grandTotal = rows.reduce((sum, row) => sum + rowTotal(row), 0);
  const updateRow = (key: number, patch: Partial<{ opType: string; qty: string; date: string }>) =>
    setRows(current => current.map(row => (row.key === key ? { ...row, ...patch } : row)));

  async function save() {
    const validRows = rows.filter(row => row.opType && Number(row.qty) > 0);
    if (!employeeId || validRows.length === 0 || !commonDate) {
      toast(t('admin.ui.requiredFieldsMissing'), 'danger');
      return;
    }
    setSaving(true);
    try {
      for (const row of validRows) {
        await api.create(resources.dailyWorkEntries, {
          employee: employeeId,
          operation_type: row.opType,
          date: row.date || commonDate,
          quantity_done: Number(row.qty),
        });
      }
      toast(t('staff.bulkWork.savedCount', { count: validRows.length }), 'success');
      onSaved(validRows.length);
    } catch (error) {
      toast(apiErrorMessage(error, t), 'danger');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[190] flex justify-end bg-background-overlay/72 backdrop-blur-[3px]" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" className="grid h-full w-full max-w-[720px] grid-rows-[auto_1fr_auto] overflow-hidden bg-surface-card shadow-[-24px_0_60px_-30px_rgba(15,23,42,0.55)] ring-1 ring-border-soft/55">
        <div className="flex items-start justify-between gap-4 border-b border-border-soft/30 p-6">
          <div className="min-w-0">
            <h3 className="m-0 font-display text-xl font-extrabold text-text-primary">{t('staff.bulkWork.title')}</h3>
            <p className="mt-1 text-sm text-text-muted">{t('staff.bulkWork.subtitle')}</p>
          </div>
          <button type="button" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-subtle text-text-secondary transition hover:bg-surface-muted hover:text-text-primary" onClick={onClose} aria-label={t('common.close')}>
            <FiX className="h-4 w-4" />
          </button>
        </div>
        <div className="grid content-start gap-4 overflow-y-auto p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-bold text-text-secondary">
              {t('admin.fields.employee')}
              <Dropdown value={employeeId} onChange={setEmployeeId} options={staff.map(member => ({ value: String(member.id), label: member.name }))} placeholder={t('admin.ui.selectPlaceholder')} />
            </label>
            <label className="grid gap-1.5 text-sm font-bold text-text-secondary">
              {t('staff.bulkWork.commonDate')}
              <DatePicker value={commonDate} onChange={setCommonDate} />
            </label>
          </div>
          <div className="grid gap-2.5">
            {rows.map(row => (
              <div key={row.key} className="grid gap-2 rounded-2xl bg-surface-subtle/50 p-3 ring-1 ring-border-soft/30 sm:grid-cols-[1fr_110px_170px_auto] sm:items-center">
                <Dropdown value={row.opType} onChange={value => updateRow(row.key, { opType: value })} options={operationTypes.map(op => ({ value: op.id, label: `${op.name} · ${op.price.toLocaleString()} so'm` }))} placeholder={t('admin.fields.operation')} />
                <input type="number" min="1" value={row.qty} onChange={event => updateRow(row.key, { qty: event.target.value })} placeholder={t('admin.fields.quantity')} className="h-11 w-full rounded-xl border border-border-soft bg-surface-card px-3 text-sm text-text-primary outline-none focus:border-primary/50" />
                <DatePicker value={row.date} onChange={value => updateRow(row.key, { date: value })} />
                <div className="flex items-center justify-end gap-2">
                  <span className="whitespace-nowrap text-xs font-extrabold text-primary">{rowTotal(row) > 0 ? formatMoney(rowTotal(row)) : '—'}</span>
                  {rows.length > 1 ? (
                    <button type="button" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger-bg text-danger transition hover:bg-danger/15" onClick={() => setRows(current => current.filter(item => item.key !== row.key))} aria-label={t('common.delete')}>
                      <FiX className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <div>
            <button type="button" className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-text-accent transition hover:bg-primary/20" onClick={() => setRows(current => [...current, { key: Math.max(...current.map(item => item.key)) + 1, opType: '', qty: '', date: '' }])}>
              + {t('staff.bulkWork.addRow')}
            </button>
          </div>
          <p className="m-0 text-xs text-text-muted">{t('staff.bulkWork.dateHint')}</p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border-soft/30 p-5">
          <span className="text-sm font-bold text-text-secondary">{t('staff.bulkWork.total')}: <span className="text-lg font-extrabold text-primary">{formatMoney(grandTotal)}</span></span>
          <div className="flex gap-2">
            <button className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-surface-subtle px-5 text-sm font-semibold text-text-secondary transition hover:bg-surface-muted hover:text-text-primary" onClick={onClose}>{t('common.cancel')}</button>
            <button disabled={saving} className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60" onClick={() => void save()}>
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function PieceworkTab({ staff, pieceworkRecords, formatMoney }: { staff: StaffMember[]; pieceworkRecords: PieceworkRecord[]; formatMoney: (value: number) => string }) {
  const { t } = useTranslation();
  const canManage = useHasPermission('payroll', 'manage');
  const [subTab, setSubTab] = useState<'summary' | 'operationTypes' | 'payroll' | 'workEntries'>('summary');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [workEntriesReload, setWorkEntriesReload] = useState(0);
  // Daily / weekly / monthly view of piecework — unfiltered (all time) by default.
  const [dateRange, setDateRange] = useState<DashboardDateRange | null>(null);

  const recordsInRange = useMemo(() => pieceworkRecords
    .filter(record => !dateRange || (record.week >= dateRange.startDate && record.week <= dateRange.endDate)),
  [pieceworkRecords, dateRange]);

  const byEmployee = staff
    .map(member => {
      const records = recordsInRange.filter(r => r.employeeName === member.name);
      const totalEarned = records.reduce((sum, r) => sum + r.quantity * r.ratePerPiece, 0);
      const totalPieces = records.reduce((sum, r) => sum + r.quantity, 0);
      return { member, records, totalEarned, totalPieces };
    })
    .filter(e => e.records.length > 0)
    .sort((a, b) => b.totalEarned - a.totalEarned);

  const grandTotal = byEmployee.reduce((sum, e) => sum + e.totalEarned, 0);
  const grandPieces = byEmployee.reduce((sum, e) => sum + e.totalPieces, 0);
  const topWorker = byEmployee[0];
  const activePreset = matchingDashboardPreset(dateRange);
  const rangeLabel = activePreset
    ? t(`dashboard.filters.${activePreset}`)
    : dateRange
      ? `${formatDisplayDate(dateRange.startDate, t)} – ${formatDisplayDate(dateRange.endDate, t)}`
      : t('dashboard.filters.allTime');

  return (
    <div className="grid gap-5">
      <SegmentTabs
        tabs={[
          { id: 'summary', label: t('staff.piecework.tabs.summary'), icon: <FiDollarSign className="h-4 w-4" /> },
          { id: 'workEntries', label: t('admin.resources.workEntries.title'), icon: <FiCheckCircle className="h-4 w-4" /> },
          { id: 'operationTypes', label: t('admin.resources.operationTypes.title'), icon: <FiTool className="h-4 w-4" /> },
          { id: 'payroll', label: t('admin.resources.payrolls.title'), icon: <FiArchive className="h-4 w-4" /> },
        ]}
        activeTab={subTab}
        onChange={id => setSubTab(id as typeof subTab)}
      />
      {subTab === 'operationTypes' ? (
        <ApiResourceManager config={{ ...operationsConfigs.operationTypes, readOnly: !canManage }} />
      ) : subTab === 'payroll' ? (
        <PayrollTab staff={staff} formatMoney={formatMoney} />
      ) : subTab === 'workEntries' ? (
        <div className="grid gap-3">
          {canManage ? (
            <div className="flex justify-end">
              <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:opacity-90" onClick={() => setBulkOpen(true)}>
                <FiCheckCircle className="h-4 w-4" /> {t('staff.bulkWork.open')}
              </button>
            </div>
          ) : null}
          <ApiResourceManager key={workEntriesReload} config={{ ...operationsConfigs.workEntries, readOnly: !canManage }} />
          {bulkOpen ? (
            <BulkWorkEntryModal
              staff={staff}
              formatMoney={formatMoney}
              onClose={() => setBulkOpen(false)}
              onSaved={() => { setBulkOpen(false); setWorkEntriesReload(value => value + 1); }}
            />
          ) : null}
        </div>
      ) : (
      <>
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <DateRangeControls value={dateRange} onChange={setDateRange} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={<FiDollarSign />} label={t('staff.piecework.metrics.totalPayout')} value={formatMoney(grandTotal)} caption={rangeLabel} tone="success" />
        <MetricCard icon={<FiPackage />} label={t('staff.piecework.metrics.totalPieces')} value={grandPieces.toLocaleString()} caption={rangeLabel} tone="info" />
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
                    <td colSpan={3} className="py-3 pl-5 pr-3 text-sm font-extrabold text-text-primary">{t('staff.detail.total')}</td>
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

export function WarehousePage({ products, stockIn, stockOut, finishedVariants, totalStock, lowStockCount, formatMoney, onCreate }: {
  products: Product[];
  stockIn: StockMovement[];
  stockOut: StockMovement[];
  finishedVariants: FinishedVariant[];
  totalStock: number;
  lowStockCount: number;
  formatMoney: (value: number) => string;
  onCreate: () => void;
}) {
  const { t } = useTranslation();
  const exportResource = useResourceExport();
  const canManage = useHasPermission('inventory', 'manage');
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'defective' | 'defectiveStock'>('overview');
  const inventoryValue = products.reduce((sum, p) => sum + p.stock * p.price, 0);
  const allMovements = [...stockIn, ...stockOut].sort((a, b) => b.id - a.id);
  const exportResourceMap = {
    overview: resources.finishedGoodsStocks, history: resources.finishedGoodsTransactions, defective: resources.defectiveMaterialTransactions,
    defectiveStock: resources.defectiveMaterialStocks,
  } as const;
  const variantsByProduct = new Map<string, FinishedVariant[]>();
  finishedVariants.forEach(variant => {
    if (!variant.size && !variant.color) return;
    const key = String(variant.productId);
    variantsByProduct.set(key, [...(variantsByProduct.get(key) ?? []), variant]);
  });
  const txStatusTone = (status: string): StatusTone => status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'warning';
  const txTypeLabel = (row: StockMovement) => {
    const key = row.sourceKind === 'material' ? `admin.options.materialTxType.${row.txType}` : `admin.options.finishedTxType.${row.txType}`;
    const label = t(key);
    return label === key ? row.txType.replaceAll('_', ' ') : label;
  };

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
          { id: 'defective', label: t('admin.resources.defectiveTransactions.title'), icon: <FiAlertTriangle className="h-4 w-4" /> },
          { id: 'defectiveStock', label: t('admin.resources.defectiveStocks.title'), icon: <FiAlertTriangle className="h-4 w-4" /> },
        ]}
        activeTab={activeTab}
        onChange={id => setActiveTab(id as typeof activeTab)}
      />
      {activeTab === 'defective' ? (
        <ApiResourceManager config={{ ...operationsConfigs.defectiveTransactions, readOnly: !canManage }} />
      ) : activeTab === 'defectiveStock' ? (
        <ApiResourceManager config={operationsConfigs.defectiveStocks} />
      ) : activeTab === 'overview' ? (
        <DataTable
          columns={[t('warehouse.columns.product'), t('warehouse.columns.quantity'), t('warehouse.columns.value')]}
          rows={products.map(product => {
            const variants = variantsByProduct.get(String(product.id)) ?? [];
            return [
              <span className="block min-w-0">
                <span className="block max-w-[220px] truncate text-sm font-bold text-text-primary">{product.name}</span>
                <span className="text-xs text-text-muted">{product.category}</span>
              </span>,
              <span className="block min-w-[120px]">
                <span className={['block text-sm font-bold', product.stock <= product.minStock ? 'text-warning' : 'text-text-primary'].join(' ')}>{product.stock.toLocaleString()} {unitLabel(product.unit, t)}</span>
                <div className="mt-1 h-1.5 w-full max-w-[90px] overflow-hidden rounded-pill bg-surface-muted">
                  <div className={['h-full rounded-pill', product.stock <= product.minStock ? 'bg-warning' : 'bg-success'].join(' ')} style={{ width: `${Math.min(100, Math.round(product.stock / Math.max(product.minStock, 1) * 100))}%` }} />
                </div>
                {variants.length > 0 ? (
                  <span className="mt-1.5 flex max-w-[320px] flex-wrap gap-1">
                    {variants.map((variant, idx) => (
                      <span key={idx} className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-text-secondary">
                        {[variant.size, variant.color].filter(Boolean).join('/')}: {variant.quantity.toLocaleString()}
                      </span>
                    ))}
                  </span>
                ) : null}
              </span>,
              formatMoney(product.stock * product.price),
            ];
          })}
        />
      ) : (
        <DataTable
          columns={[t('warehouse.columns.date'), t('warehouse.columns.product'), t('warehouse.columns.type'), t('warehouse.columns.amount'), t('admin.fields.status')]}
          rows={allMovements.map(row => [
            formatDisplayDate(row.date, t),
            <span className="block min-w-0 max-w-[220px] truncate text-sm font-semibold text-text-primary" title={translateMovementLabel(t, row.product)}>{translateMovementLabel(t, row.product)}</span>,
            <span className="inline-flex items-center gap-1.5">
              <StatusBadge tone={row.type === 'in' ? 'success' : 'warning'}>{row.type === 'in' ? t('warehouse.movementIn') : t('warehouse.movementOut')}</StatusBadge>
              <span className="text-xs font-semibold text-text-muted">{txTypeLabel(row)}</span>
            </span>,
            <span className={['font-bold', row.type === 'in' ? 'text-success' : 'text-warning'].join(' ')}>{row.quantity}</span>,
            <StatusBadge tone={txStatusTone(row.status)}>{optionLabel(t, 'transactionStatus', row.status)}</StatusBadge>,
          ])}
        />
      )}
    </div>
  );
}

export function FinancePage({ revenueEntries, expenseEntries, formatMoney, onCreate }: { revenueEntries: FinanceEntry[]; expenseEntries: FinanceEntry[]; formatMoney: (value: number) => string; onCreate: () => void }) {
  const { t } = useTranslation();
  const exportResource = useResourceExport();
  const canManage = useHasPermission('clients', 'manage');
  const [activeTab, setActiveTab] = useState<'revenue' | 'expenses'>('revenue');
  // Metrics, the revenue table and the expenses list all follow this range;
  // no filter by default (all time).
  const [dateRange, setDateRange] = useState<DashboardDateRange | null>(null);
  const inRange = (date: string) => !dateRange || (date >= dateRange.startDate && date <= dateRange.endDate);
  const revenueInRange = revenueEntries.filter(e => inRange(e.date));
  const expensesInRange = expenseEntries.filter(e => inRange(e.date));
  const revenue = revenueInRange.reduce((sum, e) => sum + e.amount, 0);
  const expenses = expensesInRange.reduce((sum, e) => sum + e.amount, 0);
  const profit = revenue - expenses;
  const activePreset = matchingDashboardPreset(dateRange);
  const rangeLabel = activePreset
    ? t(`dashboard.filters.${activePreset}`)
    : dateRange
      ? `${formatDisplayDate(dateRange.startDate, t)} – ${formatDisplayDate(dateRange.endDate, t)}`
      : t('dashboard.filters.allTime');
  const expensesRangeParams = useMemo(
    () => (dateRange ? { date__gte: dateRange.startDate, date__lte: dateRange.endDate } : undefined),
    [dateRange],
  );
  const exportResourceMap = { revenue: resources.clientPayments, expenses: resources.expenses } as const;

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('finance.eyebrow')} title={t('finance.title')} description={t('finance.description')} createLabel={canManage && activeTab === 'revenue' ? t('common.create') : undefined} onCreate={canManage && activeTab === 'revenue' ? onCreate : undefined} onExport={() => exportResource(exportResourceMap[activeTab])} />
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <DateRangeControls value={dateRange} onChange={setDateRange} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-success/8 p-5 ring-1 ring-success/20">
          <p className="text-xs font-bold uppercase tracking-wide text-success/70">{t('finance.metrics.revenue')}</p>
          <p className="mt-2 text-2xl font-extrabold text-success">{formatMoney(revenue)}</p>
          <p className="mt-0.5 text-xs text-success/60">{rangeLabel}</p>
        </div>
        <div className="rounded-2xl bg-warning/8 p-5 ring-1 ring-warning/20">
          <p className="text-xs font-bold uppercase tracking-wide text-warning/70">{t('finance.metrics.expenses')}</p>
          <p className="mt-2 text-2xl font-extrabold text-warning">{formatMoney(expenses)}</p>
          <p className="mt-0.5 text-xs text-warning/60">{rangeLabel}</p>
        </div>
        <div className={['rounded-2xl p-5 ring-1', profit >= 0 ? 'bg-primary/8 ring-primary/20' : 'bg-danger/8 ring-danger/20'].join(' ')}>
          <p className={['text-xs font-bold uppercase tracking-wide', profit >= 0 ? 'text-primary/70' : 'text-danger/70'].join(' ')}>{t('finance.metrics.profit')}</p>
          <p className={['mt-2 text-2xl font-extrabold', profit >= 0 ? 'text-primary' : 'text-danger'].join(' ')}>{formatMoney(profit)}</p>
          <p className={['mt-0.5 text-xs', profit >= 0 ? 'text-primary/60' : 'text-danger/60'].join(' ')}>{t('finance.metrics.profitCaption')}</p>
        </div>
      </div>
      <SegmentTabs
        tabs={[
          { id: 'revenue', label: t('finance.revenueTable'), icon: <FiCheckCircle className="h-4 w-4" /> },
          { id: 'expenses', label: t('admin.resources.expenses.title'), icon: <FiArchive className="h-4 w-4" /> },
        ]}
        activeTab={activeTab}
        onChange={id => setActiveTab(id as typeof activeTab)}
      />
      {activeTab === 'revenue' ? (
        <>
          <DataTable
            columns={[t('finance.columns.date'), t('finance.columns.client'), t('finance.columns.order'), t('finance.columns.amount')]}
            rows={revenueInRange.map(e => [formatDisplayDate(e.date, t), translateMovementLabel(t, e.client), translateMovementLabel(t, e.order), <span className="font-bold text-success">{formatMoney(e.amount)}</span>])}
          />
          {revenueInRange.length === 0 ? <p className="py-6 text-center text-sm text-text-muted">{t('admin.ui.noRecords')}</p> : null}
        </>
      ) : (
        <ApiResourceManager config={{ ...operationsConfigs.expenses, readOnly: !canManage }} extraParams={expensesRangeParams} />
      )}
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

export function ProductionPage({ batches, products, materials, formatMoney, onCreate, openModal, openDelete, onDeliver }: {
  batches: ProductionBatch[];
  products: Product[];
  materials: Material[];
  formatMoney: (v: number) => string;
  onCreate: () => void;
  openModal: (modal: ModalState) => void;
  openDelete: (modal: ModalState) => void;
  onDeliver: (id: string | number) => Promise<void>;
}) {
  const { t } = useTranslation();
  const exportResource = useResourceExport();
  const canManage = useHasPermission('production', 'manage');
  const [activeTab, setActiveTab] = useState<'batches' | 'stock' | 'consumption'>('batches');
  const [viewingBatchDetail, setViewingBatchDetail] = useState<ProductionBatch | null>(null);
  const [openBatchMaterials, setOpenBatchMaterials] = useState<Record<string, boolean>>({});
  const [openConsumption, setOpenConsumption] = useState<Record<string, boolean>>({});
  // Date range for the consumption tab only: totals/breakdown follow the selected period
  // (by batch start date), while remaining stock always stays real-time.
  const [consumptionRange, setConsumptionRange] = useState<DashboardDateRange | null>(null);

  const totalProduced = batches.reduce((sum, b) => sum + b.producedQty, 0);

  // Aggregate material consumption across batches in the selected period, broken down per product
  const consumptionBatches = consumptionRange
    ? batches.filter(batch => batch.dateLabel >= consumptionRange.startDate && batch.dateLabel <= consumptionRange.endDate)
    : batches;
  const consumptionMap: Record<string, { materialName: string; unit: 'm' | 'kg' | 'pcs'; totalUsed: number; batches: number; products: Record<string, { productName: string; producedQty: number; used: number; batches: number }> }> = {};
  consumptionBatches.forEach(batch => {
    const product = products.find(p => p.id === batch.productId);
    if (!product?.recipe) return;
    product.recipe.forEach(item => {
      const used = item.qtyPerUnit * batch.producedQty;
      if (!consumptionMap[item.materialName]) {
        consumptionMap[item.materialName] = { materialName: item.materialName, unit: item.unit, totalUsed: 0, batches: 0, products: {} };
      }
      const entry = consumptionMap[item.materialName];
      entry.totalUsed += used;
      entry.batches += 1;
      if (!entry.products[product.name]) {
        entry.products[product.name] = { productName: product.name, producedQty: 0, used: 0, batches: 0 };
      }
      entry.products[product.name].used += used;
      entry.products[product.name].producedQty += batch.producedQty;
      entry.products[product.name].batches += 1;
    });
  });
  const consumptionList = Object.values(consumptionMap).sort((a, b) => b.totalUsed - a.totalUsed);
  // The page-level metric chip always reflects all batches, independent of the tab filter.
  const totalMaterialTypes = new Set(batches.flatMap(batch => (products.find(p => p.id === batch.productId)?.recipe ?? []).map(item => item.materialName))).size;

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
              // Consumed tracks actual delivered output (norm × delivered), so a batch that
              // delivered nothing has consumed nothing. This is per produced unit — legacy
              // full-norm issue rows from an older flow must not inflate it.
              consumed: item.qtyPerUnit * batch.producedQty,
              plannedUsed: item.qtyPerUnit * batch.plannedQty,
            }));
            const materialsOpen = Boolean(openBatchMaterials[String(batch.id)]);

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
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold text-text-primary">{item.materialName}</p>
                                <p className="mt-1 text-[11px] text-text-muted">
                                  {t('production.batch.issued')}: <span className="text-sm font-extrabold text-primary">{item.consumed.toLocaleString()} {unitLabel(item.unit, t)}</span>
                                  <span className="ml-1 opacity-70">({t('production.batch.consumedFor', { count: batch.producedQty })})</span>
                                </p>
                                <p className="mt-0.5 text-[11px] text-text-muted/80">
                                  {t('production.batch.plannedMaterial')}: {item.plannedUsed.toLocaleString()} {unitLabel(item.unit, t)}
                                  <span className="ml-1 opacity-60">({item.qtyPerUnit} × {batch.plannedQty.toLocaleString()})</span>
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Footer: status + actions */}
                <div className="flex flex-wrap items-center gap-4 border-t border-border-soft/20 bg-surface-subtle/40 px-5 py-3">
                  <div className="flex items-center gap-1.5 text-xs text-text-muted">
                    <FiClock className="h-3.5 w-3.5 shrink-0" />
                    {optionLabel(t, 'productionStatus', batch.shift)}
                  </div>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <button className="rounded-lg bg-surface-subtle px-2.5 py-1.5 text-xs font-bold text-text-secondary transition hover:bg-primary/10 hover:text-text-primary" onClick={() => setViewingBatchDetail(batch)}>{t('production.batch.detail')}</button>
                    {canManage ? <button className="rounded-lg bg-success-bg px-2.5 py-1.5 text-xs font-bold text-success transition hover:bg-success/15" onClick={() => void onDeliver(batch.id)}>{t('production.batch.deliver')}</button> : null}
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
                  <span className="text-text-muted">{t('materials.stock.value')}</span>
                  <span className="font-bold text-text-primary">{formatMoney(product.stock * product.price)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'consumption' && (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <DateRangeControls value={consumptionRange} onChange={setConsumptionRange} />
            <p className="m-0 text-sm text-text-muted">{t('production.consumption.subtitle')}</p>
          </div>
          {consumptionList.length === 0 ? (
            <p className="rounded-xl bg-surface-subtle p-6 text-center text-sm text-text-muted">{t('admin.ui.noRecords')}</p>
          ) : null}
          <div className="grid gap-3">
            {consumptionList.map(item => {
              const mat = materials.find(m => m.name === item.materialName);
              const remaining = mat?.stock ?? 0;
              const pct = remaining + item.totalUsed > 0 ? Math.round((item.totalUsed / (remaining + item.totalUsed)) * 100) : 0;
              const productRows = Object.values(item.products).sort((a, b) => b.used - a.used);
              const isOpen = Boolean(openConsumption[item.materialName]);
              return (
                <div key={item.materialName} className="app-card--nova overflow-hidden">
                  <button
                    type="button"
                    className="flex w-full flex-col gap-3 p-5 text-left transition hover:bg-primary/5 sm:flex-row sm:items-center"
                    onClick={() => setOpenConsumption(current => ({ ...current, [item.materialName]: !current[item.materialName] }))}
                    aria-expanded={isOpen}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <FiChevronRight className={['h-4 w-4 shrink-0 text-text-muted transition-transform', isOpen ? 'rotate-90' : ''].join(' ')} />
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <FiLayers className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-text-primary">{item.materialName}</p>
                        <p className="mt-0.5 text-xs text-text-muted">{t('production.consumption.productCount', { count: productRows.length })}</p>
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
                        <p className="text-xs text-text-muted">{t('production.consumption.share')}</p>
                        <p className="font-bold text-text-muted">{t('production.consumption.shareUsed', { pct })}</p>
                      </div>
                    </div>
                  </button>
                  {isOpen ? (
                    <div className="border-t border-border-soft/25 bg-surface-subtle/40 p-5">
                      <p className="mb-3 text-[11px] font-extrabold uppercase tracking-wide text-text-muted">{t('production.consumption.byProduct')}</p>
                      <div className="grid gap-2">
                        {productRows.map(row => (
                          <div key={row.productName} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-card p-3 ring-1 ring-border-soft/30">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-text-muted">
                              <FiPackage className="h-3.5 w-3.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-text-primary">{row.productName}</p>
                              <p className="mt-0.5 text-[11px] text-text-muted">
                                {t('production.consumption.producedInfo', { qty: row.producedQty.toLocaleString(), batches: row.batches })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-extrabold text-primary">{row.used.toLocaleString()} {unitLabel(item.unit, t)}</p>
                              <p className="text-[11px] text-text-muted">{t('production.consumption.usedForProduct')}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {viewingBatchDetail ? (
        <BatchDetailModal batch={viewingBatchDetail} canManage={canManage} onClose={() => setViewingBatchDetail(null)} />
      ) : null}
    </div>
  );
}
