import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiArchive, FiBriefcase, FiCheckCircle, FiChevronRight, FiClock, FiDollarSign, FiPackage, FiSettings, FiShoppingBag, FiUsers, FiSliders } from 'react-icons/fi';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CategoryDatum, Client, FinanceEntry, ModalState, Order, Product, ProductCategory, StaffMember, StockMovement } from '../types/crm';
import { orderStatusTone, statusTone, unitLabel } from '../utils/crm';
import { ClientsFilterBar, DataTable, MetricCard, PageHeader, Panel, PremiumTooltip, PrimaryCell, RowActions, SegmentTabs, StatusBadge } from '../components/ui';

export function DashboardPage({ clients, products, categoryAnalytics, revenueData, totalStock, lowStockCount, pipelineValue, onDutyCount, staffTotal, formatMoney, openModal }: {
  clients: Client[];
  products: Product[];
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
              <AreaChart data={revenueData}>
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
                <Line name={t('dashboard.metrics.clients')} type="monotone" dataKey="orders" stroke="#0ea5e9" strokeWidth={2} />
              </AreaChart>
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

export function StaffPage({ staff, staffFlow, openModal, openDelete }: { staff: StaffMember[]; staffFlow: Array<{ day: string; came: number; late: number; left: number }>; openModal: (modal: ModalState) => void; openDelete: (modal: ModalState) => void }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'employees' | 'attendance'>('employees');

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('staff.eyebrow')} title={t('staff.title')} description={t('staff.description')} createLabel={t('staff.create')} onCreate={() => openModal({ kind: 'staff', mode: 'create' })} />
      <SegmentTabs
        tabs={[
          { id: 'employees', label: t('staff.tabs.employees'), icon: <FiUsers className="h-4 w-4" /> },
          { id: 'attendance', label: t('staff.tabs.attendance'), icon: <FiClock className="h-4 w-4" /> },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />
      {activeTab === 'employees' ? (
        <DataTable
          columns={[t('staff.columns.staff'), t('staff.columns.position'), t('staff.columns.phone'), t('staff.columns.salary'), t('staff.columns.hireDate'), t('staff.columns.status'), t('common.actions')]}
          rows={staff.map(member => [
            <PrimaryCell title={member.name} subtitle={member.role} />,
            member.role,
            member.phone,
            member.salary.toLocaleString(),
            member.hireDate,
            <StatusBadge tone={statusTone(member.statusKey)}>{member.status}</StatusBadge>,
            <RowActions onView={() => openModal({ kind: 'staff', mode: 'view', item: member })} onEdit={() => openModal({ kind: 'staff', mode: 'edit', item: member })} onDelete={() => openDelete({ kind: 'staff', mode: 'view', item: member })} />,
          ])}
          onRowClick={(rowIndex) => openModal({ kind: 'staff', mode: 'view', item: staff[rowIndex] })}
        />
      ) : (
        <>
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={<FiCheckCircle />} label={t('staff.metrics.onTime')} value="3" caption={t('staff.metrics.onTimeCaption')} tone="success" />
        <MetricCard icon={<FiClock />} label={t('staff.metrics.late')} value="1" caption={t('staff.metrics.lateCaption')} tone="warning" />
        <MetricCard icon={<FiUsers />} label={t('staff.metrics.attendance')} value="93.4%" caption={t('staff.metrics.attendanceCaption')} tone="info" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <Panel title={t('staff.flowTitle')} action={t('common.report')}>
          <div className="h-[280px]">
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
        <DataTable
          columns={[t('staff.columns.staff'), t('staff.columns.shift'), t('staff.columns.arrival'), t('staff.columns.leaving'), t('staff.columns.status'), t('common.actions')]}
          rows={staff.map(member => [
            <PrimaryCell title={member.name} subtitle={member.role} />,
            member.shift,
            member.arrival,
            member.leaving,
            <StatusBadge tone={statusTone(member.statusKey)}>{member.status}</StatusBadge>,
            <RowActions onView={() => openModal({ kind: 'staff', mode: 'view', item: member })} onEdit={() => openModal({ kind: 'staff', mode: 'edit', item: member })} onDelete={() => openDelete({ kind: 'staff', mode: 'view', item: member })} />,
          ])}
          onRowClick={(rowIndex) => openModal({ kind: 'staff', mode: 'view', item: staff[rowIndex] })}
        />
      </div>
        </>
      )}
    </div>
  );
}

export function OrdersPage({ orders, formatMoney, openModal, openDelete }: { orders: Order[]; formatMoney: (value: number) => string; openModal: (modal: ModalState) => void; openDelete: (modal: ModalState) => void }) {
  const { t } = useTranslation();
  const delivered = orders.filter(order => order.statusKey === 'delivered').length;

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('orders.eyebrow')} title={t('orders.title')} description={t('orders.description')} createLabel={t('orders.create')} onCreate={() => openModal({ kind: 'order', mode: 'create' })} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<FiShoppingBag />} label={t('orders.metrics.total')} value={orders.length.toString()} caption={t('orders.metrics.totalCaption')} tone="info" />
        <MetricCard icon={<FiClock />} label={t('orders.metrics.pending')} value={orders.filter(order => order.statusKey === 'pending').length.toString()} caption={t('orders.metrics.pendingCaption')} tone="warning" />
        <MetricCard icon={<FiSettings />} label={t('orders.metrics.production')} value={orders.filter(order => order.statusKey === 'production').length.toString()} caption={t('orders.metrics.productionCaption')} tone="neutral" />
        <MetricCard icon={<FiCheckCircle />} label={t('orders.metrics.delivered')} value={delivered.toString()} caption={t('orders.metrics.deliveredCaption')} tone="success" />
      </div>
      <DataTable
        columns={[t('orders.columns.orderId'), t('orders.columns.client'), t('orders.columns.product'), t('orders.columns.quantity'), t('orders.columns.total'), t('orders.columns.manager'), t('orders.columns.deliveryDate'), t('orders.columns.status'), t('common.actions')]}
        rows={orders.map(order => [
          <PrimaryCell title={order.orderId} subtitle={order.notes} />,
          order.client,
          order.product,
          order.quantity,
          formatMoney(order.totalAmount),
          order.manager,
          order.deliveryDate,
          <StatusBadge tone={orderStatusTone(order.statusKey)}>{order.status}</StatusBadge>,
          <RowActions onView={() => openModal({ kind: 'order', mode: 'view', item: order })} onEdit={() => openModal({ kind: 'order', mode: 'edit', item: order })} onDelete={() => openDelete({ kind: 'order', mode: 'view', item: order })} />,
        ])}
        onRowClick={(rowIndex) => openModal({ kind: 'order', mode: 'view', item: orders[rowIndex] })}
      />
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
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products');
  const totalRevenue = products.reduce((sum, product) => sum + product.revenue, 0);

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow={t('products.eyebrow')}
        title={t('products.title')}
        description={t('products.description')}
        createLabel={activeTab === 'categories' ? t('products.createCategory') : activeTab === 'products' ? t('products.create') : undefined}
        onCreate={activeTab === 'categories' || activeTab === 'products' ? () => openModal({ kind: activeTab === 'products' ? 'product' : 'category', mode: 'create' }) : undefined}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={<FiPackage />} label={t('products.metrics.revenue')} value={formatMoney(totalRevenue)} caption={t('products.metrics.revenueCaption')} tone="success" />
        <MetricCard icon={<FiArchive />} label={t('products.metrics.stock')} value={totalStock.toLocaleString()} caption={t('products.metrics.stockCaption')} tone="info" />
        <MetricCard icon={<FiSliders />} label={t('products.metrics.lowStock')} value={lowStockCount.toString()} caption={t('products.metrics.lowStockCaption')} tone="warning" />
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl bg-surface-card p-2 shadow-sm ring-1 ring-border-soft/35">
        {(['products', 'categories'] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={[
              'inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-extrabold transition duration-fast hover:-translate-y-0.5',
              activeTab === tab
                ? 'bg-primary text-primary-foreground shadow-[0_18px_36px_-28px_rgb(var(--color-primary)/0.65)]'
                : 'bg-surface-subtle text-text-secondary hover:bg-primary/10 hover:text-text-primary',
            ].join(' ')}
          >
            {tab === 'products' ? <FiPackage className="h-4 w-4" /> : <FiArchive className="h-4 w-4" />}
            {t(`products.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {activeTab === 'products' ? (
        <DataTable
          columns={[t('products.columns.product'), t('products.columns.sku'), t('products.columns.category'), t('products.columns.stock'), t('products.columns.revenue'), t('common.actions')]}
          rows={products.map(product => [
            <ProductImageCell product={product} />,
            <SkuCell sku={product.sku} />,
            categories.find(category => category.id === product.categoryId)?.name ?? product.category,
            <span className={product.stock <= product.minStock ? 'font-bold text-warning' : 'font-bold text-text-primary'}>{product.stock.toLocaleString()} {unitLabel(product.unit, t)}</span>,
            formatMoney(product.revenue),
            <RowActions onView={() => openModal({ kind: 'product', mode: 'view', item: product })} onEdit={() => openModal({ kind: 'product', mode: 'edit', item: product })} onDelete={() => openDelete({ kind: 'product', mode: 'view', item: product })} />,
          ])}
          onRowClick={(rowIndex) => openModal({ kind: 'product', mode: 'view', item: products[rowIndex] })}
        />
      ) : (
        <CategoriesTable categories={categories} products={products} openModal={openModal} openDelete={openDelete} />
      )}

      <ProductsAnalyticsPanel products={products} categoryAnalytics={categoryAnalytics} formatMoney={formatMoney} />
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
  const [activeTab, setActiveTab] = useState<'overview' | 'stockIn' | 'stockOut' | 'history'>('overview');
  const [query, setQuery] = useState('');
  const inventoryValue = products.reduce((sum, product) => sum + product.stock * product.price, 0);
  const filteredHistory = movementHistory.filter(row =>
    `${row.product} ${row.quantity} ${row.employee} ${row.note} ${row.client ?? ''} ${row.supplier ?? ''}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('warehouse.eyebrow')} title={t('warehouse.title')} description={t('warehouse.description')} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<FiArchive />} label={t('warehouse.metrics.totalInventory')} value={totalStock.toLocaleString()} caption={t('warehouse.metrics.totalInventoryCaption')} tone="info" />
        <MetricCard icon={<FiDollarSign />} label={t('warehouse.metrics.inventoryValue')} value={formatMoney(inventoryValue)} caption={t('warehouse.metrics.inventoryValueCaption')} tone="success" />
        <MetricCard icon={<FiSliders />} label={t('warehouse.metrics.lowStock')} value={lowStockCount.toString()} caption={t('warehouse.metrics.lowStockCaption')} tone="warning" />
        <MetricCard icon={<FiClock />} label={t('warehouse.metrics.recentMovements')} value={movementHistory.length.toString()} caption={t('warehouse.metrics.recentMovementsCaption')} tone="neutral" />
      </div>
      <SegmentTabs
        tabs={[
          { id: 'overview', label: t('warehouse.tabs.overview'), icon: <FiArchive className="h-4 w-4" /> },
          { id: 'stockIn', label: t('warehouse.tabs.stockIn'), icon: <FiPackage className="h-4 w-4" /> },
          { id: 'stockOut', label: t('warehouse.tabs.stockOut'), icon: <FiShoppingBag className="h-4 w-4" /> },
          { id: 'history', label: t('warehouse.tabs.history'), icon: <FiClock className="h-4 w-4" /> },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />
      {activeTab === 'overview' ? (
        <DataTable
          columns={[t('warehouse.columns.product'), t('warehouse.columns.quantity'), t('warehouse.columns.value'), t('warehouse.columns.lowStock')]}
          rows={products.map(product => [
            <ProductImageCell product={product} />,
            <span className={product.stock <= product.minStock ? 'font-bold text-warning' : 'font-bold text-text-primary'}>{product.stock.toLocaleString()} {unitLabel(product.unit, t)}</span>,
            formatMoney(product.stock * product.price),
            product.stock <= product.minStock ? <StatusBadge tone="warning">{t('warehouse.lowStockYes')}</StatusBadge> : <StatusBadge tone="success">{t('warehouse.lowStockNo')}</StatusBadge>,
          ])}
        />
      ) : activeTab === 'stockIn' ? (
        <StockTable rows={stockIn} direction="in" />
      ) : activeTab === 'stockOut' ? (
        <StockTable rows={stockOut} direction="out" />
      ) : (
        <div className="grid gap-4">
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={t('warehouse.searchPlaceholder')}
            className="h-11 w-full rounded-xl border border-border-soft bg-surface-card px-4 text-sm font-medium text-text-primary placeholder:text-text-muted outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
          />
          <MovementTimeline rows={filteredHistory} />
        </div>
      )}
    </div>
  );
}

export function FinancePage({ revenueEntries, expenseEntries, revenueData, formatMoney }: { revenueEntries: FinanceEntry[]; expenseEntries: FinanceEntry[]; revenueData: Array<{ month: string; revenue: number; orders: number }>; formatMoney: (value: number) => string }) {
  const { t } = useTranslation();
  const revenue = revenueEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const expenses = expenseEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const financeData = revenueData.map((entry, index) => ({
    month: entry.month,
    revenue: entry.revenue,
    expenses: [142000000, 156000000, 161000000, 183000000, 194000000, 205000000][index],
    profit: entry.revenue - [142000000, 156000000, 161000000, 183000000, 194000000, 205000000][index],
  }));

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('finance.eyebrow')} title={t('finance.title')} description={t('finance.description')} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<FiDollarSign />} label={t('finance.metrics.revenue')} value={formatMoney(revenue)} caption={t('finance.metrics.revenueCaption')} tone="success" />
        <MetricCard icon={<FiArchive />} label={t('finance.metrics.expenses')} value={formatMoney(expenses)} caption={t('finance.metrics.expensesCaption')} tone="warning" />
        <MetricCard icon={<FiCheckCircle />} label={t('finance.metrics.profit')} value={formatMoney(revenue - expenses)} caption={t('finance.metrics.profitCaption')} tone="info" />
        <MetricCard icon={<FiClock />} label={t('finance.metrics.debts')} value={formatMoney(156000000)} caption={t('finance.metrics.debtsCaption')} tone="danger" />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title={t('finance.revenueTable')} action={t('common.export')}>
          <DataTable columns={[t('finance.columns.date'), t('finance.columns.client'), t('finance.columns.order'), t('finance.columns.amount')]} rows={revenueEntries.map(entry => [entry.date, entry.client, entry.order, formatMoney(entry.amount)])} />
        </Panel>
        <Panel title={t('finance.expensesTable')} action={t('common.export')}>
          <DataTable columns={[t('finance.columns.date'), t('finance.columns.category'), t('finance.columns.description'), t('finance.columns.amount')]} rows={expenseEntries.map(entry => [entry.date, entry.category, entry.description, formatMoney(entry.amount)])} />
        </Panel>
      </div>
      <Panel title={t('finance.profitAnalysis')} action={t('common.analytics')}>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={financeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border-soft))" opacity={0.55} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: 'rgb(var(--color-text-muted))', fontSize: 12, fontWeight: 700 }} />
              <YAxis tickLine={false} axisLine={false} width={70} tick={{ fill: 'rgb(var(--color-text-muted))', fontSize: 12, fontWeight: 700 }} />
              <Tooltip content={<PremiumTooltip />} cursor={false} />
              <Area name={t('finance.metrics.revenue')} type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={3} fill="#0f766e" fillOpacity={0.14} />
              <Area name={t('finance.metrics.expenses')} type="monotone" dataKey="expenses" stroke="#f59e0b" strokeWidth={3} fill="#f59e0b" fillOpacity={0.1} />
              <Line name={t('finance.metrics.profit')} type="monotone" dataKey="profit" stroke="#6366f1" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
