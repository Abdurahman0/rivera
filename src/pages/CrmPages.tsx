import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiAlertTriangle, FiArchive, FiBriefcase, FiCheckCircle, FiChevronRight, FiClock, FiCpu, FiDollarSign, FiLayers, FiPackage, FiSettings, FiShoppingBag, FiTool, FiUsers, FiSliders } from 'react-icons/fi';
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CategoryDatum, Client, FinanceEntry, Material, ModalState, Order, PieceworkRecord, Product, ProductCategory, ProductionBatch, ProductionRecord, StaffMember, StockMovement } from '../types/crm';
import { materialStatusTone, orderStatusTone, statusTone, unitLabel } from '../utils/crm';
import { ClientsFilterBar, DataTable, MetricCard, PageHeader, Panel, PremiumTooltip, PrimaryCell, RowActions, SegmentTabs, StatusBadge } from '../components/ui';

export function DashboardPage({ clients, products, materials, staff, categoryAnalytics, revenueData, totalStock, lowStockCount, pipelineValue, onDutyCount, staffTotal, formatMoney, openModal }: {
  clients: Client[];
  products: Product[];
  materials: Material[];
  staff: StaffMember[];
  categoryAnalytics: CategoryDatum[];
  revenueData: Array<{ month: string; revenue: number; orders: number }>;
  totalStock: number;
  lowStockCount: number;
  pipelineValue: number;
  onDutyCount: number;
  staffTotal: number;
  formatMoney: (value: number) => string;
  openModal: (modal: ModalState) => void;
}) {
  const { t } = useTranslation();
  const lowStockMaterials = materials.filter(m => m.stock <= m.minStock);

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('dashboard.eyebrow')} title={t('dashboard.title')} description={t('dashboard.description')} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<FiBriefcase />} label={t('dashboard.metrics.pipeline')} value={formatMoney(pipelineValue)} caption={t('dashboard.metrics.pipelineCaption')} tone="success" />
        <MetricCard icon={<FiUsers />} label={t('dashboard.metrics.clients')} value={clients.length.toString()} caption={t('dashboard.metrics.clientsCaption')} tone="info" />
        <MetricCard icon={<FiClock />} label={t('dashboard.metrics.staff')} value={`${onDutyCount}/${staffTotal}`} caption={t('dashboard.metrics.staffCaption')} tone="warning" />
        <MetricCard icon={<FiArchive />} label={t('dashboard.metrics.stock')} value={totalStock.toLocaleString()} caption={t('dashboard.metrics.stockCaption', { count: lowStockCount })} tone="danger" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Panel title={t('dashboard.revenueTitle')} action={t('common.export')}>
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
            {clients.slice(0, 4).map(client => (
              <button
                key={client.id}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-border-soft/55 bg-surface-card/80 p-3 text-left shadow-sm transition duration-fast hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/8 hover:shadow-[0_18px_36px_-28px_rgb(var(--color-primary)/0.55)]"
                onClick={() => openModal({ kind: 'client', mode: 'view', item: client })}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                    <FiBriefcase className="h-4 w-4" />
                  </span>
                  <PrimaryCell title={client.name} subtitle={`${client.status} · ${client.manager}`} />
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
                    <p className="text-xs text-text-muted">{member.role} · {member.arrival === 'Masofadan' || member.arrival === 'Удалённо' ? member.arrival : `${member.arrival} → ${member.leaving}`}</p>
                  </div>
                  <StatusBadge tone={statusTone(member.statusKey)}>{member.status}</StatusBadge>
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
                  <StatusBadge tone="warning">{mat.status}</StatusBadge>
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

export function ClientsPage({ clients, formatMoney, openModal, openDelete }: { clients: Client[]; formatMoney: (value: number) => string; openModal: (modal: ModalState) => void; openDelete: (modal: ModalState) => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortMode, setSortMode] = useState('valueDesc');
  const statusOptions = useMemo(() => ['all', ...Array.from(new Set(clients.map(client => client.statusKey)))], [clients]);
  const sourceOptions = useMemo(() => ['all', ...Array.from(new Set(clients.map(client => client.source)))], [clients]);
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

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('clients.eyebrow')} title={t('clients.title')} description={t('clients.description')} createLabel={t('clients.create')} onCreate={() => openModal({ kind: 'client', mode: 'create' })} />
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
          <StatusBadge tone={statusTone(client.statusKey)}>{client.status}</StatusBadge>,
          client.fabric,
          formatMoney(client.value),
          <RowActions onView={() => openModal({ kind: 'client', mode: 'view', item: client })} onEdit={() => openModal({ kind: 'client', mode: 'edit', item: client })} onDelete={() => openDelete({ kind: 'client', mode: 'view', item: client })} />,
        ])}
        onRowClick={(rowIndex) => openModal({ kind: 'client', mode: 'view', item: filteredClients[rowIndex] })}
      />
    </div>
  );
}

function EmployeeGrid({ staff, pieceworkRecords, formatMoney, openModal, openDelete }: { staff: StaffMember[]; pieceworkRecords: PieceworkRecord[]; formatMoney: (v: number) => string; openModal: (m: ModalState) => void; openDelete: (m: ModalState) => void }) {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {staff.map(member => {
        const initials = member.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('');
        const isOpen = expandedId === member.id;
        const myRecords = pieceworkRecords.filter(r => r.employeeName === member.name);
        const totalEarned = myRecords.reduce((sum, r) => sum + r.quantity * r.ratePerPiece, 0);
        const totalPieces = myRecords.reduce((sum, r) => sum + r.quantity, 0);
        const hasPiecework = myRecords.length > 0;

        return (
          <article key={member.id} className={['app-card--nova flex flex-col gap-0 overflow-hidden transition-all duration-200', isOpen ? 'sm:col-span-2 xl:col-span-3' : ''].join(' ')}>
            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-start gap-4">
                <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl font-extrabold text-primary">{initials}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold text-text-primary">{member.name}</p>
                  <p className="mt-0.5 truncate text-sm text-text-muted">{member.role}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge tone={statusTone(member.statusKey)}>{member.status}</StatusBadge>
                    {hasPiecework && (
                      <span className="rounded-pill bg-success/10 px-2.5 py-0.5 text-[11px] font-bold text-success ring-1 ring-success/20">{formatMoney(totalEarned)} akkord</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-subtle p-3 text-xs">
                <div><p className="text-text-muted">{t('staff.columns.phone')}</p><p className="mt-0.5 font-semibold text-text-primary">{member.phone}</p></div>
                <div><p className="text-text-muted">{t('staff.columns.hireDate')}</p><p className="mt-0.5 font-semibold text-text-primary">{member.hireDate}</p></div>
                <div><p className="text-text-muted">{t('staff.columns.shift')}</p><p className="mt-0.5 font-semibold text-text-primary">{member.shift}</p></div>
                <div><p className="text-text-muted">{t('staff.columns.salary')}</p><p className="mt-0.5 font-bold text-success">{formatMoney(member.salary)}</p></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setExpandedId(isOpen ? null : member.id)} className={['inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-bold ring-1 transition', isOpen ? 'bg-primary text-primary-foreground ring-primary/30' : 'bg-surface-subtle text-text-secondary ring-border-soft/50 hover:bg-primary/10 hover:text-text-primary'].join(' ')}>
                  <FiChevronRight className={['h-3.5 w-3.5 transition-transform', isOpen ? 'rotate-90' : ''].join(' ')} />
                  {isOpen ? "Yopish" : "Batafsil ko'rish"}
                </button>
                <button onClick={() => openModal({ kind: 'staff', mode: 'edit', item: member })} className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-surface-subtle text-xs font-bold text-text-secondary ring-1 ring-border-soft/50 transition hover:bg-primary/10 hover:text-text-primary"><FiSettings className="h-3.5 w-3.5" /></button>
                <button onClick={() => openDelete({ kind: 'staff', mode: 'view', item: member })} className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-danger-bg text-xs font-bold text-danger ring-1 ring-danger/15 transition hover:bg-danger/15">✕</button>
              </div>
            </div>

            {isOpen && (
              <div className="border-t border-border-soft/30 bg-surface-subtle/40 p-5">
                <div className="grid gap-5 lg:grid-cols-[1fr_1.6fr]">
                  {/* Left: summary stats */}
                  <div className="grid gap-3">
                    <h4 className="text-sm font-extrabold text-text-primary">Bu oy ko'rsatkichlari</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-surface-card p-3.5 ring-1 ring-border-soft/30">
                        <p className="text-xs text-text-muted">Davomat</p>
                        <p className="mt-1 text-2xl font-extrabold text-text-primary">{member.attendance}%</p>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-surface-muted">
                          <div className={['h-full rounded-pill', member.attendance >= 90 ? 'bg-success' : member.attendance >= 75 ? 'bg-warning' : 'bg-danger'].join(' ')} style={{ width: `${member.attendance}%` }} />
                        </div>
                      </div>
                      <div className="rounded-xl bg-surface-card p-3.5 ring-1 ring-border-soft/30">
                        <p className="text-xs text-text-muted">Kelish vaqti</p>
                        <p className="mt-1 text-xl font-extrabold text-text-primary">{member.arrival}</p>
                        <p className="mt-0.5 text-xs text-text-muted">Ketish: {member.leaving}</p>
                      </div>
                      <div className="rounded-xl bg-surface-card p-3.5 ring-1 ring-border-soft/30">
                        <p className="text-xs text-text-muted">Asosiy oylik</p>
                        <p className="mt-1 text-lg font-extrabold text-text-primary">{formatMoney(member.salary)}</p>
                      </div>
                      <div className={['rounded-xl p-3.5 ring-1', hasPiecework ? 'bg-success/5 ring-success/20' : 'bg-surface-card ring-border-soft/30'].join(' ')}>
                        <p className="text-xs text-text-muted">Akkord daromad</p>
                        <p className={['mt-1 text-lg font-extrabold', hasPiecework ? 'text-success' : 'text-text-muted'].join(' ')}>{hasPiecework ? formatMoney(totalEarned) : '—'}</p>
                        {hasPiecework && <p className="mt-0.5 text-xs text-text-muted">{totalPieces.toLocaleString()} dona</p>}
                      </div>
                    </div>
                  </div>

                  {/* Right: piecework table */}
                  <div>
                    <h4 className="mb-3 text-sm font-extrabold text-text-primary">Akkord operatsiyalari</h4>
                    {!hasPiecework ? (
                      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border-soft/60 p-5 text-sm text-text-muted">
                        <FiTool className="h-4 w-4 shrink-0 opacity-50" />
                        Bu xodim uchun akkord ma'lumotlari yo'q
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl ring-1 ring-border-soft/30">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border-soft/20 bg-surface-subtle">
                              <th className="py-2.5 pl-4 pr-3 text-left text-xs font-extrabold uppercase tracking-wide text-text-muted">Operatsiya</th>
                              <th className="px-3 py-2.5 text-left text-xs font-extrabold uppercase tracking-wide text-text-muted">Mahsulot</th>
                              <th className="px-3 py-2.5 text-right text-xs font-extrabold uppercase tracking-wide text-text-muted">Dona</th>
                              <th className="px-3 py-2.5 text-right text-xs font-extrabold uppercase tracking-wide text-text-muted">Narx</th>
                              <th className="py-2.5 pl-3 pr-4 text-right text-xs font-extrabold uppercase tracking-wide text-text-muted">Jami</th>
                            </tr>
                          </thead>
                          <tbody>
                            {myRecords.map(r => (
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
                              <td colSpan={4} className="py-3 pl-4 pr-3 text-sm font-extrabold text-text-primary">Jami akkord</td>
                              <td className="py-3 pl-3 pr-4 text-right text-base font-extrabold text-success">{formatMoney(totalEarned)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function StaffPage({ staff, staffFlow, pieceworkRecords, formatMoney, openModal, openDelete }: { staff: StaffMember[]; staffFlow: Array<{ day: string; came: number; late: number; left: number }>; pieceworkRecords: PieceworkRecord[]; formatMoney: (value: number) => string; openModal: (modal: ModalState) => void; openDelete: (modal: ModalState) => void }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'employees' | 'attendance' | 'piecework'>('employees');
  const onTimeCount = staff.filter(m => m.statusKey === 'onTime').length;
  const lateCount = staff.filter(m => m.statusKey === 'late').length;
  const avgAttendance = staff.length > 0 ? (staff.reduce((sum, m) => sum + m.attendance, 0) / staff.length).toFixed(1) : '0';

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('staff.eyebrow')} title={t('staff.title')} description={t('staff.description')} createLabel={t('staff.create')} onCreate={() => openModal({ kind: 'staff', mode: 'create' })} />
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
        <EmployeeGrid staff={staff} pieceworkRecords={pieceworkRecords} formatMoney={formatMoney} openModal={openModal} openDelete={openDelete} />
      ) : activeTab === 'piecework' ? (
        <PieceworkTab staff={staff} pieceworkRecords={pieceworkRecords} formatMoney={formatMoney} />
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
    </div>
  );
}

export function OrdersPage({ orders, productionRecords, formatMoney, openModal, openDelete }: { orders: Order[]; productionRecords: ProductionRecord[]; formatMoney: (value: number) => string; openModal: (modal: ModalState) => void; openDelete: (modal: ModalState) => void }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'orders' | 'production'>('orders');
  const pending = orders.filter(o => o.statusKey === 'pending').length;
  const inProd = orders.filter(o => o.statusKey === 'production').length;
  const delivered = orders.filter(o => o.statusKey === 'delivered').length;

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('orders.eyebrow')} title={t('orders.title')} description={t('orders.description')} createLabel={activeTab === 'orders' ? t('orders.create') : undefined} onCreate={activeTab === 'orders' ? () => openModal({ kind: 'order', mode: 'create' }) : undefined} />
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
          columns={[t('orders.columns.orderId'), t('orders.columns.client'), t('orders.columns.total'), t('orders.columns.deliveryDate'), t('orders.columns.status'), t('common.actions')]}
          rows={orders.map(order => [
            <PrimaryCell title={order.orderId} subtitle={order.product} />,
            <PrimaryCell title={order.client} subtitle={order.manager} />,
            formatMoney(order.totalAmount),
            order.deliveryDate,
            <StatusBadge tone={orderStatusTone(order.statusKey)}>{order.status}</StatusBadge>,
            <RowActions onView={() => openModal({ kind: 'order', mode: 'view', item: order })} onEdit={() => openModal({ kind: 'order', mode: 'edit', item: order })} onDelete={() => openDelete({ kind: 'order', mode: 'view', item: order })} />,
          ])}
          onRowClick={(rowIndex) => openModal({ kind: 'order', mode: 'view', item: orders[rowIndex] })}
        />
      ) : (
        <ProductionTab records={productionRecords} orders={orders} />
      )}
    </div>
  );
}

function BomView({ products, formatMoney }: { products: Product[]; formatMoney: (v: number) => string }) {
  const { t } = useTranslation();
  const withRecipe = products.filter(p => p.recipe && p.recipe.length > 0);

  if (withRecipe.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-soft/60 py-16 text-center">
        <FiLayers className="h-10 w-10 text-text-muted opacity-50" />
        <p className="text-sm font-semibold text-text-muted">{t('products.bom.noRecipe')}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {withRecipe.map(product => {
        const totalQty = product.recipe!.reduce((sum, r) => sum + r.qtyPerUnit * product.sold, 0);
        return (
          <section key={product.id} className="app-card--nova overflow-hidden">
            <div className="flex items-center gap-4 border-b border-border-soft/30 p-5">
              <img src={product.imageUrl} alt={product.name} className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-border-soft/50" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-3">
                  <h3 className="text-base font-extrabold text-text-primary">{product.name}</h3>
                  <span className="rounded-pill bg-surface-subtle px-2.5 py-0.5 text-xs font-bold text-text-muted ring-1 ring-border-soft/40">{product.sku}</span>
                </div>
                <p className="mt-1 text-sm text-text-muted">
                  <span className="font-bold text-text-primary">{product.sold.toLocaleString()} {unitLabel(product.unit, t)}</span>&nbsp;{t('products.bom.produced').toLowerCase()} · {product.recipe!.length} {t('products.bom.totalCount')}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-text-muted">{t('products.metrics.revenue')}</p>
                <p className="text-lg font-extrabold text-success">{formatMoney(product.revenue)}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-border-soft/25 bg-surface-subtle">
                    <th className="py-3 pl-5 pr-3 text-left text-xs font-extrabold uppercase tracking-wide text-text-muted">{t('materials.columns.name')}</th>
                    <th className="px-3 py-3 text-right text-xs font-extrabold uppercase tracking-wide text-text-muted">{t('products.bom.perUnit')}</th>
                    <th className="px-3 py-3 text-right text-xs font-extrabold uppercase tracking-wide text-text-muted">{t('products.bom.produced')}</th>
                    <th className="py-3 pl-3 pr-5 text-right text-xs font-extrabold uppercase tracking-wide text-text-muted">{t('products.bom.totalUsed')}</th>
                  </tr>
                </thead>
                <tbody>
                  {product.recipe!.map((item, idx) => {
                    const total = item.qtyPerUnit * product.sold;
                    const pct = totalQty > 0 ? Math.round((total / totalQty) * 100) : 0;
                    return (
                      <tr key={idx} className="border-b border-border-soft/15 transition hover:bg-surface-subtle/60">
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
                        <td className="py-4 pl-3 pr-5">
                          <div className="flex flex-col items-end gap-1.5">
                            <span className="font-extrabold text-text-primary">{total.toLocaleString()} {unitLabel(item.unit, t)}</span>
                            <div className="h-1.5 w-24 overflow-hidden rounded-pill bg-surface-muted">
                              <div className="h-full rounded-pill bg-primary/70" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function ProductsPage({ products, categoryAnalytics, categories, totalStock, lowStockCount, formatMoney, openModal, openDelete }: {
  products: Product[];
  categoryAnalytics: CategoryDatum[];
  categories: ProductCategory[];
  totalStock: number;
  lowStockCount: number;
  formatMoney: (value: number) => string;
  openModal: (modal: ModalState) => void;
  openDelete: (modal: ModalState) => void;
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'products' | 'bom'>('products');
  const totalRevenue = products.reduce((sum, product) => sum + product.revenue, 0);

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow={t('products.eyebrow')}
        title={t('products.title')}
        description={t('products.description')}
        createLabel={t('products.create')}
        onCreate={() => openModal({ kind: 'product', mode: 'create' })}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={<FiPackage />} label={t('products.metrics.revenue')} value={formatMoney(totalRevenue)} caption={t('products.metrics.revenueCaption')} tone="success" />
        <MetricCard icon={<FiArchive />} label={t('products.metrics.stock')} value={totalStock.toLocaleString()} caption={t('products.metrics.stockCaption')} tone="info" />
        <MetricCard icon={<FiSliders />} label={t('products.metrics.lowStock')} value={lowStockCount.toString()} caption={t('products.metrics.lowStockCaption')} tone="warning" />
      </div>
      <SegmentTabs tabs={[{ id: 'products', label: t('products.tabs.products'), icon: <FiPackage /> }, { id: 'bom', label: t('products.tabs.bom'), icon: <FiLayers /> }]} activeTab={activeTab} onChange={(id) => setActiveTab(id as 'products' | 'bom')} />

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
          categories.find(category => category.id === product.categoryId)?.name ?? product.category,
          <span className={product.stock <= product.minStock ? 'font-bold text-warning' : 'font-bold text-text-primary'}>{product.stock.toLocaleString()} {unitLabel(product.unit, t)}</span>,
          formatMoney(product.revenue),
          <RowActions onView={() => openModal({ kind: 'product', mode: 'view', item: product })} onEdit={() => openModal({ kind: 'product', mode: 'edit', item: product })} onDelete={() => openDelete({ kind: 'product', mode: 'view', item: product })} />,
        ])}
        onRowClick={(rowIndex) => openModal({ kind: 'product', mode: 'view', item: products[rowIndex] })}
      />
      )}
      {activeTab === 'bom' && <BomView products={products} formatMoney={formatMoney} />}
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
          <PrimaryCell title={category.name} subtitle={category.id} />,
          <span className="rounded-pill bg-primary/10 px-2.5 py-1 text-xs font-extrabold text-text-accent">{category.code}</span>,
          category.description,
          <span className="font-bold text-text-primary">{count}</span>,
          category.sortOrder,
          <RowActions onView={() => openModal({ kind: 'category', mode: 'view', item: category })} onEdit={() => openModal({ kind: 'category', mode: 'edit', item: category })} onDelete={() => openDelete({ kind: 'category', mode: 'view', item: category })} />,
        ];
      })}
      columns={[
        t('products.categoryColumns.category'),
        t('products.categoryColumns.code'),
        t('products.categoryColumns.description'),
        t('products.categoryColumns.products'),
        t('products.categoryColumns.sortOrder'),
        t('common.actions'),
      ]}
      onRowClick={(rowIndex) => openModal({ kind: 'category', mode: 'view', item: categories[rowIndex] })}
    />
  );
}

export function MaterialsPage({ materials, formatMoney }: { materials: Material[]; formatMoney: (value: number) => string }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const lowStockCount = materials.filter(m => m.stock <= m.minStock).length;
  const totalValue = materials.reduce((sum, m) => sum + m.stock * m.price, 0);
  const filtered = materials.filter(m =>
    `${m.name} ${m.category} ${m.supplier}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('materials.eyebrow')} title={t('materials.title')} description={t('materials.description')} createLabel={t('materials.create')} onCreate={() => {}} />
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
        columns={[t('materials.columns.name'), t('materials.columns.category'), t('materials.columns.stock'), t('materials.columns.price'), t('materials.columns.status')]}
        rows={filtered.map(mat => {
          const pct = Math.min(100, Math.round((mat.stock / mat.minStock) * 100));
          return [
            <span className="block min-w-0">
              <span className="block max-w-[220px] truncate text-sm font-bold text-text-primary">{mat.name}</span>
              <span className="text-xs text-text-muted">{mat.supplier}</span>
            </span>,
            <span className="rounded-pill bg-surface-muted px-2.5 py-1 text-xs font-semibold text-text-secondary">{mat.category}</span>,
            <span className="block min-w-[120px]">
              <span className={['block text-sm font-bold', mat.stock <= mat.minStock ? 'text-warning' : 'text-text-primary'].join(' ')}>{mat.stock.toLocaleString()} {unitLabel(mat.unit, t)}</span>
              <div className="mt-1 h-1.5 w-full max-w-[100px] overflow-hidden rounded-pill bg-surface-muted">
                <div className={['h-full rounded-pill', mat.stock <= mat.minStock ? 'bg-warning' : 'bg-success'].join(' ')} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </span>,
            <span className="font-semibold text-text-primary">{formatMoney(mat.price)}<span className="ml-1 text-xs text-text-muted">/{unitLabel(mat.unit, t)}</span></span>,
            <StatusBadge tone={materialStatusTone(mat.statusKey)}>{mat.status}</StatusBadge>,
          ];
        })}
      />
    </div>
  );
}

const WORKING_DAYS = 26;

function PieceworkTab({ staff, pieceworkRecords, formatMoney }: { staff: StaffMember[]; pieceworkRecords: PieceworkRecord[]; formatMoney: (value: number) => string }) {
  const { t } = useTranslation();

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
                <p className="text-sm text-text-muted">{member.role} · {totalPieces.toLocaleString()} {t('staff.piecework.pieces')}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-text-muted">{t('staff.piecework.earned')}</p>
                <p className="text-xl font-extrabold text-success">{formatMoney(totalEarned)}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
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
                        <td className="px-3 py-3.5 text-right font-bold text-text-primary">{record.quantity.toLocaleString()} dona</td>
                        <td className="px-3 py-3.5 text-right text-xs font-semibold text-text-muted">{formatMoney(record.ratePerPiece)}/dona</td>
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
                    <td colSpan={4} className="py-3 pl-5 pr-3 text-sm font-extrabold text-text-primary">Jami</td>
                    <td className="py-3 pl-3 pr-5 text-right text-base font-extrabold text-success">{formatMoney(totalEarned)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
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
            <PrimaryCell title={member.name} subtitle={member.role} />,
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

function ProductionTab({ records, orders }: { records: ProductionRecord[]; orders: Order[] }) {
  const { t } = useTranslation();
  const uniqueWorkers = new Set(records.map(r => r.employee)).size;
  const inProductionOrders = orders.filter(o => o.statusKey === 'production').length;

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
        ]}
        rows={records.map(record => [
          record.date,
          <PrimaryCell title={record.employee} subtitle={record.role} />,
          record.product,
          <span className="font-bold text-text-primary">{record.quantity}</span>,
          record.orderId
            ? <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-extrabold text-text-accent">{record.orderId}</span>
            : <span className="text-text-muted">—</span>,
          record.shift,
          record.notes,
        ])}
      />
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
        row.date,
        <PrimaryCell title={row.product} subtitle={row.note} />,
        <span className={direction === 'in' ? 'font-bold text-success' : 'font-bold text-warning'}>{row.quantity}</span>,
        direction === 'in' ? row.supplier : row.client,
        row.employee,
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
              <p className="text-sm font-extrabold text-text-primary">{row.note}</p>
              <p className="mt-1 text-xs font-semibold text-text-muted">{row.date} · {row.employee} · {row.quantity}</p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function WarehousePage({ products, stockIn, stockOut, movementHistory, totalStock, lowStockCount, formatMoney }: {
  products: Product[];
  stockIn: StockMovement[];
  stockOut: StockMovement[];
  movementHistory: StockMovement[];
  totalStock: number;
  lowStockCount: number;
  formatMoney: (value: number) => string;
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
  const inventoryValue = products.reduce((sum, p) => sum + p.stock * p.price, 0);
  const allMovements = [...stockIn, ...stockOut].sort((a, b) => b.id - a.id);

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('warehouse.eyebrow')} title={t('warehouse.title')} description={t('warehouse.description')} />
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
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />
      {activeTab === 'overview' ? (
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
                <div className={['h-full rounded-pill', product.stock <= product.minStock ? 'bg-warning' : 'bg-success'].join(' ')} style={{ width: `${Math.min(100, Math.round(product.stock / product.minStock * 100))}%` }} />
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
          columns={[t('warehouse.columns.date'), t('warehouse.columns.product'), t('common.type'), t('warehouse.columns.quantity'), t('staff.columns.staff')]}
          rows={allMovements.map(row => [
            row.date,
            <span className="max-w-[180px] truncate text-sm font-semibold text-text-primary">{row.product}</span>,
            <StatusBadge tone={row.type === 'in' ? 'success' : 'warning'}>{row.type === 'in' ? '+ Kirim' : '− Chiqim'}</StatusBadge>,
            <span className={['font-bold', row.type === 'in' ? 'text-success' : 'text-warning'].join(' ')}>{row.quantity}</span>,
            row.employee,
          ])}
        />
      )}
    </div>
  );
}

export function FinancePage({ revenueEntries, expenseEntries, revenueData, formatMoney }: { revenueEntries: FinanceEntry[]; expenseEntries: FinanceEntry[]; revenueData: Array<{ month: string; revenue: number; orders: number }>; formatMoney: (value: number) => string }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'revenue' | 'expenses'>('revenue');
  const revenue = revenueEntries.reduce((sum, e) => sum + e.amount, 0);
  const expenses = expenseEntries.reduce((sum, e) => sum + e.amount, 0);
  const profit = revenue - expenses;
  const expNums = [142000000, 156000000, 161000000, 183000000, 194000000, 205000000];
  const financeData = revenueData.map((e, i) => ({ month: e.month, revenue: e.revenue, expenses: expNums[i], profit: e.revenue - expNums[i] }));

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('finance.eyebrow')} title={t('finance.title')} description={t('finance.description')} />
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
          { id: 'expenses', label: t('finance.expensesTable'), icon: <FiArchive className="h-4 w-4" /> },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />
      {activeTab === 'revenue' ? (
        <DataTable
          columns={[t('finance.columns.date'), t('finance.columns.client'), t('finance.columns.order'), t('finance.columns.amount')]}
          rows={revenueEntries.map(e => [e.date, e.client, e.order, <span className="font-bold text-success">{formatMoney(e.amount)}</span>])}
        />
      ) : (
        <DataTable
          columns={[t('finance.columns.date'), t('finance.columns.category'), t('finance.columns.description'), t('finance.columns.amount')]}
          rows={expenseEntries.map(e => [e.date, e.category, e.description, <span className="font-bold text-warning">{formatMoney(e.amount)}</span>])}
        />
      )}
    </div>
  );
}

export function ProductionPage({ batches, products, materials, formatMoney }: {
  batches: ProductionBatch[];
  products: Product[];
  materials: Material[];
  formatMoney: (v: number) => string;
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'batches' | 'stock' | 'consumption'>('batches');

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
      <PageHeader eyebrow={t('production.eyebrow')} title={t('production.title')} description={t('production.description')} createLabel={t('production.create')} onCreate={() => {}} />

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
            }));
            const visibleEmployees = batch.employees.slice(0, 3);
            const extraEmployees = batch.employees.length - 3;

            return (
              <article key={batch.id} className="app-card--nova overflow-hidden">
                {/* Card header */}
                <div className="flex flex-wrap items-start gap-4 border-b border-border-soft/25 p-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <FiCpu className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-text-muted">{batch.dateLabel}</span>
                      {batch.orderId && (
                        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-text-accent">{batch.orderId}</span>
                      )}
                    </div>
                    <p className="mt-1 text-base font-extrabold text-text-primary">{batch.product}</p>
                    {batch.notes && <p className="mt-0.5 text-xs text-text-muted">{batch.notes}</p>}
                  </div>
                  <div className="shrink-0 rounded-2xl bg-primary/8 px-4 py-3 text-right ring-1 ring-primary/15">
                    <p className="text-2xl font-extrabold text-primary">{batch.producedQty.toLocaleString()}</p>
                    <p className="mt-0.5 text-xs font-semibold text-primary/70">{unitLabel(batch.unit, t)} {t('production.batch.produced')}</p>
                  </div>
                </div>

                {/* Material consumption */}
                <div className="p-5">
                  <p className="mb-3 text-[11px] font-extrabold uppercase tracking-wide text-text-muted">{t('production.batch.materials')}</p>
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
                              <span className="font-bold text-text-primary">{item.totalUsed.toLocaleString()} {unitLabel(item.unit, t)}</span>
                              <span className="ml-1 opacity-60">({item.qtyPerUnit} × {batch.producedQty.toLocaleString()})</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer: employees + shift */}
                <div className="flex flex-wrap items-center gap-4 border-t border-border-soft/20 bg-surface-subtle/40 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <FiUsers className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                    <span className="text-xs text-text-muted">{t('production.batch.employees')}:</span>
                    <div className="flex flex-wrap gap-1">
                      {visibleEmployees.map(name => (
                        <span key={name} className="rounded-md bg-surface-card px-2 py-0.5 text-[11px] font-semibold text-text-secondary ring-1 ring-border-soft/40">{name.split(' ')[0]}</span>
                      ))}
                      {extraEmployees > 0 && <span className="rounded-md bg-surface-card px-2 py-0.5 text-[11px] font-semibold text-text-muted ring-1 ring-border-soft/40">+{extraEmployees}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-text-muted">
                    <FiClock className="h-3.5 w-3.5 shrink-0" />
                    {batch.shift}
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
            const pct = Math.min(100, Math.round((product.stock / product.minStock) * 100));
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
    </div>
  );
}
