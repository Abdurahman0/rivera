import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FiArchive,
  FiArrowRight,
  FiBell,
  FiBriefcase,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiClock,
  FiDollarSign,
  FiDownload,
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiGrid,
  FiLock,
  FiLogOut,
  FiMenu,
  FiPackage,
  FiPlus,
  FiRefreshCcw,
  FiSearch,
  FiSettings,
  FiShoppingBag,
  FiSliders,
  FiSun,
  FiTrash2,
  FiUser,
  FiUsers,
  FiX,
  FiMoon,
} from 'react-icons/fi';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  applyDesignVariant,
  designVariants,
  getStoredDesignVariant,
  persistDesignVariant,
  type DesignVariant,
} from '../lib/design-system';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n';
import { navItems } from '../data/navigation';
import {
  ACCENT_STORAGE_KEY,
  BACKGROUND_COLOR_PRESETS,
  COLOR_PALETTES,
  DEFAULT_BACKGROUND_ACCENT,
  THEME_STORAGE_KEY,
  applyColorPalette,
} from '../data/ui-config';
import type {
  CategoryDatum,
  Client,
  EntityId,
  EntityKind,
  FinanceEntry,
  Material,
  ModalState,
  Order,
  PageId,
  PieceworkRecord,
  Product,
  ProductCategory,
  ProductionBatch,
  ProductionRecord,
  StaffMember,
  StatusTone,
  StockMovement,
} from '../types/crm';
import {
  calculateInventory,
  getPageFromPath,
  hexToRgba,
  normalizeCategoryCode,
  orderStatusTone,
  statusTone,
  unitLabel,
} from '../utils/crm';
import {
  Brand,
  DesignSwitch,
  Field,
  IconButton,
  LanguageSwitch,
  SelectField,
  StatusBadge,
} from '../components/ui';

const DashboardPage = lazy(() => import('../pages/CrmPages').then(module => ({ default: module.DashboardPage })));
const ClientsPage = lazy(() => import('../pages/CrmPages').then(module => ({ default: module.ClientsPage })));
const OrdersPage = lazy(() => import('../pages/CrmPages').then(module => ({ default: module.OrdersPage })));
const ProductionPage = lazy(() => import('../pages/CrmPages').then(module => ({ default: module.ProductionPage })));
const MaterialsPage = lazy(() => import('../pages/CrmPages').then(module => ({ default: module.MaterialsPage })));
const StaffPage = lazy(() => import('../pages/CrmPages').then(module => ({ default: module.StaffPage })));
const ProductsPage = lazy(() => import('../pages/CrmPages').then(module => ({ default: module.ProductsPage })));
const WarehousePage = lazy(() => import('../pages/CrmPages').then(module => ({ default: module.WarehousePage })));
const FinancePage = lazy(() => import('../pages/CrmPages').then(module => ({ default: module.FinancePage })));

function getPageFromLocation(): PageId {
  if (typeof window === 'undefined') return 'dashboard';
  return getPageFromPath(window.location.pathname);
}

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function getInitialAccent() {
  if (typeof window === 'undefined') return DEFAULT_BACKGROUND_ACCENT;
  try {
    return window.localStorage.getItem(ACCENT_STORAGE_KEY) || DEFAULT_BACKGROUND_ACCENT;
  } catch {
    return DEFAULT_BACKGROUND_ACCENT;
  }
}

function initAccentOnLoad() {
  const accent = getInitialAccent();
  const theme = (typeof window !== 'undefined' && window.localStorage.getItem('rivera-theme')) === 'dark' ? 'dark' : 'light';
  applyColorPalette(accent, theme as 'light' | 'dark');
  return accent;
}

function App() {
  const { t, i18n } = useTranslation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activePage, setActivePage] = useState<PageId>(getPageFromLocation);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeDesign, setActiveDesign] = useState<DesignVariant>(getStoredDesignVariant);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(getInitialTheme);
  const [backgroundAccent, setBackgroundAccent] = useState(initAccentOnLoad);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ModalState | null>(null);
  const [createdCategories, setCreatedCategories] = useState<ProductCategory[]>([]);
  const [editedCategories, setEditedCategories] = useState<Record<string, ProductCategory>>({});
  const [deletedItems, setDeletedItems] = useState<Record<EntityKind, EntityId[]>>({
    client: [],
    staff: [],
    product: [],
    category: [],
    order: [],
  });

  const rawClients = readObjects<Client>(t, 'mock.clients');
  const rawStaff = readObjects<StaffMember>(t, 'mock.staff');
  const rawProducts = readObjects<Product>(t, 'mock.products');
  const rawOrders = readObjects<Order>(t, 'mock.orders');
  const rawProductCategories = readObjects<ProductCategory>(t, 'mock.productCategories');
  const stockIn = readObjects<StockMovement>(t, 'mock.stockIn');
  const stockOut = readObjects<StockMovement>(t, 'mock.stockOut');
  const movementHistory = readObjects<StockMovement>(t, 'mock.movementHistory');
  const revenueEntries = readObjects<FinanceEntry>(t, 'mock.revenueEntries');
  const expenseEntries = readObjects<FinanceEntry>(t, 'mock.expenseEntries');
  const productionRecords = readObjects<ProductionRecord>(t, 'mock.productionRecords');
  const rawMaterials = readObjects<Material>(t, 'mock.materials');
  const pieceworkRecords = readObjects<PieceworkRecord>(t, 'mock.pieceworkRecords');
  const productionBatches = readObjects<ProductionBatch>(t, 'mock.productionBatches');
  const mergedProductCategories = rawProductCategories
    .map(category => editedCategories[category.id] ?? category)
    .concat(createdCategories.map(category => editedCategories[category.id] ?? category));
  const clients = rawClients.filter(client => !deletedItems.client.includes(client.id));
  const staff = rawStaff.filter(member => !deletedItems.staff.includes(member.id));
  const orders = rawOrders.filter(order => !deletedItems.order.includes(order.id));
  const productCategories = mergedProductCategories.filter(category => !deletedItems.category.includes(category.id));
  const inventoryByProduct = calculateInventory(stockIn, stockOut);
  const products = rawProducts
    .filter(product => !deletedItems.product.includes(product.id))
    .map(product => ({ ...product, stock: inventoryByProduct[product.name] ?? product.stock }));
  const categoryAnalytics = readObjects<CategoryDatum>(t, 'mock.categoryAnalytics');
  const months = readObjects<string>(t, 'mock.months');
  const weekDays = readObjects<string>(t, 'mock.weekDays');

  const money = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ', {
        maximumFractionDigits: 0,
      }),
    [i18n.language],
  );

  const totalOrderRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const revenueWeights = [0.12, 0.14, 0.13, 0.16, 0.19, 0.26];
  const revenueData = months.map((month, index) => ({
    month,
    revenue: Math.round(totalOrderRevenue * revenueWeights[index]),
    orders: Math.max(1, Math.round(orders.length * (index + 1) * 0.8)),
  }));

  const staffFlow = weekDays.map((day, index) => ({
    day,
    came: [22, 24, 23, 25, 24][index],
    late: [3, 2, 4, 1, 2][index],
    left: [20, 23, 22, 24, 21][index],
  }));

  const totalStock = products.reduce((sum, product) => sum + product.stock, 0);
  const lowStockCount = products.filter(product => product.stock <= product.minStock).length;
  const pipelineValue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const onDutyCount = staff.filter(member => member.statusKey !== 'leftEarly').length;
  const activeMeta = navItems.find(item => item.id === activePage) ?? navItems[0];

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // Keep in-memory theme switching if storage is unavailable.
    }
    applyColorPalette(backgroundAccent, themeMode);
  }, [themeMode, backgroundAccent]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ACCENT_STORAGE_KEY, backgroundAccent);
    } catch {
      // Keep in-memory accent switching if storage is unavailable.
    }
    applyColorPalette(backgroundAccent, themeMode);
  }, [backgroundAccent, themeMode]);

  useEffect(() => {
    function handleLocationChange() {
      setActivePage(getPageFromLocation());
    }

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isLoginPath = window.location.pathname.replace(/\/+$/, '') === '/login';

    if (!isAuthenticated && !isLoginPath) {
      window.history.replaceState(null, '', '/login');
      return;
    }

    if (isAuthenticated && isLoginPath) {
      window.history.replaceState(null, '', `/${activePage}`);
    }
  }, [activePage, isAuthenticated]);

  const shellBackgroundStyle = useMemo(
    () => ({
      backgroundImage:
        themeMode === 'dark'
          ? [
              `radial-gradient(circle at 12% -6%, ${hexToRgba(backgroundAccent, 0.34)}, transparent 28%)`,
              `radial-gradient(circle at 86% 8%, ${hexToRgba(backgroundAccent, 0.24)}, transparent 24%)`,
              `radial-gradient(circle at 50% 100%, ${hexToRgba(backgroundAccent, 0.14)}, transparent 34%)`,
              'linear-gradient(180deg, rgba(4,8,15,0.98), rgba(8,12,20,0.96) 52%, rgba(6,10,18,0.98))',
            ].join(', ')
          : [
              `radial-gradient(circle at 10% -10%, ${hexToRgba(backgroundAccent, 0.24)}, transparent 30%)`,
              `radial-gradient(circle at 92% 6%, ${hexToRgba(backgroundAccent, 0.18)}, transparent 26%)`,
              `radial-gradient(circle at 50% 100%, ${hexToRgba(backgroundAccent, 0.12)}, transparent 38%)`,
              'linear-gradient(180deg, rgba(248,250,252,0.98), rgba(241,245,249,0.96) 54%, rgba(236,242,248,0.98))',
            ].join(', '),
    }),
    [backgroundAccent, themeMode],
  );

  function formatMoney(value: number) {
    return `${money.format(value)} ${t('common.sum')}`;
  }

  function handleDesignChange(nextDesign: DesignVariant) {
    setActiveDesign(nextDesign);
    applyDesignVariant(nextDesign);
    persistDesignVariant(nextDesign);
  }

  function handleLanguageChange(nextLanguage: SupportedLanguage) {
    void i18n.changeLanguage(nextLanguage);
  }

  function navigate(page: PageId) {
    setActivePage(page);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `/${page}`);
    }
    setSidebarOpen(false);
  }

  function openCreateModal() {
    if (activePage === 'dashboard' || activePage === 'warehouse' || activePage === 'finance' || activePage === 'materials' || activePage === 'production') return;
    const kind: EntityKind =
      activePage === 'staff'
        ? 'staff'
        : activePage === 'products'
          ? 'product'
          : activePage === 'orders'
            ? 'order'
            : 'client';
    setModal({ kind, mode: 'create' });
  }

  if (!isAuthenticated) {
    return (
      <LoginPage
        activeDesign={activeDesign}
        onDesignChange={handleDesignChange}
        onLanguageChange={handleLanguageChange}
        onLogin={() => {
          setIsAuthenticated(true);
          setActivePage('dashboard');
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', '/dashboard');
          }
        }}
        formatMoney={formatMoney}
      />
    );
  }

  return (
    <div className="app-shell--nova relative flex h-dvh w-full overflow-hidden bg-background-default" style={shellBackgroundStyle}>
      <div
        className={[
          'fixed inset-0 z-40 bg-background-overlay transition-opacity duration-200 min-[960px]:hidden',
          sidebarOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={[
          'app-sidebar--nova fixed inset-y-0 left-0 z-50 flex w-[84vw] max-w-sidebar flex-col overflow-hidden px-3 pb-4 pt-4 text-text-primary transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'min-[960px]:sticky min-[960px]:top-0 min-[960px]:h-dvh min-[960px]:w-sidebar min-[960px]:max-w-none min-[960px]:shrink-0 min-[960px]:translate-x-0',
        ].join(' ')}
      >
        <div className="flex min-h-topbar items-center justify-between gap-3 py-3">
          <Brand />
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface-card/80 text-text-secondary min-[960px]:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label={t('common.closeNavigation')}
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 pt-4">
          <p className="mb-2 mt-1 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted/90">
            {t('navigation.group')}
          </p>
          <nav className="grid gap-1.5">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = item.id === activePage;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  className={[
                    'group block rounded-xl px-3 py-2.5 text-left text-text-secondary transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25',
                    isActive ? 'bg-primary/10 text-text-accent shadow-sm ring-1 ring-primary/20' : 'hover:bg-surface-card/85 hover:text-text-primary',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-3">
                    <span className={['inline-flex h-9 min-w-9 items-center justify-center rounded-lg transition', isActive ? 'bg-primary/20 text-text-accent' : 'bg-background-elevated/90 text-text-secondary group-hover:bg-primary/10'].join(' ')}>
                      <Icon className="h-[17px] w-[17px]" />
                    </span>
                    <span className="grid min-w-0 gap-[3px]">
                      <span className="font-semibold">{t(`navigation.${item.id}.label`)}</span>
                      <small className="text-[11px] tracking-[0.02em] text-text-muted">
                        {t(`navigation.${item.id}.caption`)}
                      </small>
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>

          <section className="mt-5 grid gap-2 min-[960px]:hidden">
            <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted/90">
              {t('common.actions')}
            </p>
            <div className="grid gap-2 rounded-2xl bg-surface-card/70 p-2 ring-1 ring-border-soft/40">
              <LanguageSwitch onLanguageChange={handleLanguageChange} />
              <button className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-text-secondary transition hover:bg-primary/10 hover:text-text-primary" onClick={() => setIsCustomizeOpen(true)}>
                <FiSettings className="h-4 w-4" />
                {t('customize.button')}
              </button>
              <button className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-text-secondary transition hover:bg-primary/10 hover:text-text-primary" onClick={() => setThemeMode(current => current === 'dark' ? 'light' : 'dark')}>
                {themeMode === 'dark' ? <FiMoon className="h-4 w-4" /> : <FiSun className="h-4 w-4" />}
                {t('theme.toggle')}
              </button>
              <button className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-text-secondary transition hover:bg-primary/10 hover:text-text-primary" onClick={() => window.location.reload()}>
                <FiRefreshCcw className="h-4 w-4" />
                {t('common.refresh')}
              </button>
              <button className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-text-secondary transition hover:bg-primary/10 hover:text-text-primary" onClick={() => window.alert(t('common.noNotifications'))}>
                <FiBell className="h-4 w-4" />
                {t('common.notifications')}
              </button>
              <button className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary-strong" onClick={openCreateModal}>
                <FiPlus className="h-4 w-4" />
                {t('common.create')}
              </button>
              <button className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-danger transition hover:bg-danger-bg" onClick={() => setIsAuthenticated(false)}>
                <FiLogOut className="h-4 w-4" />
                {t('common.logout')}
              </button>
            </div>
          </section>
        </div>

        <div className="app-card--nova mt-4 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-text-muted">
            {t('dashboard.metrics.pipeline')}
          </p>
          <p className="mt-2 text-2xl font-extrabold text-text-primary">{formatMoney(pipelineValue)}</p>
          <p className="mt-1 text-sm text-text-secondary">{t('dashboard.metrics.pipelineCaption')}</p>
        </div>
      </aside>

      <div className="relative flex h-dvh min-w-0 flex-1 flex-col overflow-hidden">
        <header className="app-topbar--nova sticky top-0 z-30 flex min-h-topbar items-center justify-between gap-3 px-5 py-3 max-[760px]:flex-wrap min-[960px]:px-7">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface-card text-text-primary min-[960px]:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label={t('common.openNavigation')}
            >
              <FiMenu className="h-[18px] w-[18px]" />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-accent">{t('app.workspace')}</p>
              <h2 className="truncate font-display text-xl font-extrabold text-text-primary min-[640px]:text-2xl">
                {t(`navigation.${activeMeta.id}.label`)}
              </h2>
            </div>
          </div>
          <div className="hidden items-center justify-end gap-2 min-[960px]:flex">
            <LanguageSwitch onLanguageChange={handleLanguageChange} />
            <IconButton label={t('customize.button')} onClick={() => setIsCustomizeOpen(true)}><FiSettings /></IconButton>
            <IconButton label={t('theme.toggle')} onClick={() => setThemeMode(current => current === 'dark' ? 'light' : 'dark')}>
              {themeMode === 'dark' ? <FiMoon /> : <FiSun />}
            </IconButton>
            <IconButton label={t('common.refresh')} onClick={() => window.location.reload()}><FiRefreshCcw /></IconButton>
            <IconButton label={t('common.notifications')} onClick={() => window.alert(t('common.noNotifications'))}><FiBell /></IconButton>
            <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary-strong" onClick={openCreateModal}>
              <FiPlus className="h-4 w-4" />
              <span className="hidden sm:inline">{t('common.create')}</span>
            </button>
            <IconButton label={t('common.logout')} onClick={() => setIsAuthenticated(false)}><FiLogOut /></IconButton>
          </div>
        </header>

        <main className="relative flex-1 overflow-y-auto px-3 pb-5 pt-3 min-[640px]:px-4 min-[960px]:px-7 min-[960px]:pb-8">
          <div className="mx-auto w-full max-w-page">
            <Suspense fallback={<div className="app-card--nova p-5 text-sm font-semibold text-text-secondary">{t('common.loading')}</div>}>
            {activePage === 'dashboard' && (
              <DashboardPage
                clients={clients}
                products={products}
                materials={rawMaterials}
                staff={staff}
                categoryAnalytics={categoryAnalytics}
                revenueData={revenueData}
                totalStock={totalStock}
                lowStockCount={lowStockCount}
                pipelineValue={pipelineValue}
                onDutyCount={onDutyCount}
                staffTotal={staff.length}
                formatMoney={formatMoney}
                openModal={setModal}
              />
            )}
            {activePage === 'clients' && (
              <ClientsPage clients={clients} formatMoney={formatMoney} openModal={setModal} openDelete={setPendingDelete} />
            )}
            {activePage === 'orders' && (
              <OrdersPage orders={orders} productionRecords={productionRecords} formatMoney={formatMoney} openModal={setModal} openDelete={setPendingDelete} />
            )}
            {activePage === 'production' && (
              <ProductionPage batches={productionBatches} products={products} materials={rawMaterials} formatMoney={formatMoney} />
            )}
            {activePage === 'materials' && (
              <MaterialsPage materials={rawMaterials} formatMoney={formatMoney} />
            )}
            {activePage === 'staff' && (
              <StaffPage staff={staff} staffFlow={staffFlow} pieceworkRecords={pieceworkRecords} formatMoney={formatMoney} openModal={setModal} openDelete={setPendingDelete} />
            )}
            {activePage === 'products' && (
              <ProductsPage
                products={products}
                categoryAnalytics={categoryAnalytics}
                categories={productCategories}
                totalStock={totalStock}
                lowStockCount={lowStockCount}
                formatMoney={formatMoney}
                openModal={setModal}
                openDelete={setPendingDelete}
              />
            )}
            {activePage === 'warehouse' && (
              <WarehousePage
                products={products}
                stockIn={stockIn}
                stockOut={stockOut}
                movementHistory={movementHistory}
                totalStock={totalStock}
                lowStockCount={lowStockCount}
                formatMoney={formatMoney}
              />
            )}
            {activePage === 'finance' && (
              <FinancePage revenueEntries={revenueEntries} expenseEntries={expenseEntries} revenueData={revenueData} formatMoney={formatMoney} />
            )}
            </Suspense>
          </div>
        </main>
      </div>

      {modal ? (
        <EntityModal
          modal={modal}
          onClose={() => setModal(null)}
          formatMoney={formatMoney}
          categories={productCategories}
          onSaveCategory={(category) => {
            const exists = mergedProductCategories.some(item => item.id === category.id);
            if (exists) {
              setEditedCategories(current => ({ ...current, [category.id]: category }));
            } else {
              setCreatedCategories(current => [...current, category]);
            }
          }}
          onEdit={(nextModal) => setModal(nextModal)}
          onDelete={(nextModal) => setPendingDelete(nextModal)}
        />
      ) : null}
      {pendingDelete ? (
        <DeleteConfirmDialog
          modal={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            if (pendingDelete.item) {
              setDeletedItems(current => ({
                ...current,
                [pendingDelete.kind]: [...current[pendingDelete.kind], pendingDelete.item!.id],
              }));
            }
            setPendingDelete(null);
            setModal(null);
          }}
        />
      ) : null}
      {isCustomizeOpen ? (
        <CustomizePanel
          accent={backgroundAccent}
          onAccentChange={setBackgroundAccent}
          onClose={() => setIsCustomizeOpen(false)}
        />
      ) : null}
    </div>
  );
}

function LoginPage({ activeDesign, onDesignChange, onLanguageChange, onLogin, formatMoney }: {
  activeDesign: DesignVariant;
  onDesignChange: (design: DesignVariant) => void;
  onLanguageChange: (language: SupportedLanguage) => void;
  onLogin: () => void;
  formatMoney: (value: number) => string;
}) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const isNovaDesign = activeDesign === 'nova';

  const designStyles = isNovaDesign
    ? {
        pageBackground: '#0a0e17',
        orbOne: 'rgba(99, 102, 241, 0.32)',
        orbTwo: 'rgba(244, 114, 182, 0.18)',
        orbThree: 'rgba(34, 211, 238, 0.15)',
        cardBackground: '#0a0e17',
        cardBorder: '1px solid rgba(35, 44, 64, 0.95)',
        cardShadow: '0 24px 60px rgba(0,0,0,.55), 0 8px 24px rgba(0,0,0,.36)',
        eyebrowColor: '#9aa6bd',
        titleColor: '#eef2f9',
        subtitleColor: '#9aa6bd',
        labelColor: '#9aa6bd',
        fieldBackground: '#1a2234',
        fieldBorder: '#232c40',
        fieldIcon: '#66718a',
        inputText: '#eef2f9',
        ctaBackground: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 46%, #22d3ee 100%)',
        ctaShadow: '0 16px 28px -18px rgba(99, 102, 241, 0.58)',
        footerColor: '#66718a',
        selectorWrapBackground: '#141a28',
        selectorWrapBorder: 'rgba(35, 44, 64, 1)',
        selectorActiveBackground: 'linear-gradient(135deg, rgba(99, 102, 241, 0.16), rgba(34, 211, 238, 0.09) 60%, rgba(244, 114, 182, 0.08))',
        selectorActiveBorder: 'rgba(99, 102, 241, 0.5)',
        selectorInactiveBorder: 'rgba(35, 44, 64, 1)',
        artPanelBackground: 'linear-gradient(150deg, #0b1020, #131a2e 60%, #0e1424)',
      }
    : {
        pageBackground: 'radial-gradient(130% 120% at 0% 0%, #e8f5e9 0%, #f1f8f5 48%, #ebf5f0 100%)',
        orbOne: 'rgba(34, 139, 34, 0.13)',
        orbTwo: 'rgba(60, 179, 113, 0.11)',
        orbThree: 'rgba(34, 139, 34, 0.11)',
        cardBackground: '#ffffff',
        cardBorder: '1px solid rgba(144, 238, 144, 0.4)',
        cardShadow: '0 34px 72px -40px rgba(34, 139, 34, 0.52), 0 14px 24px -22px rgba(15, 23, 42, 0.26)',
        eyebrowColor: '#2d6b2d',
        titleColor: '#228b22',
        subtitleColor: '#67768e',
        labelColor: '#334155',
        fieldBackground: '#f8fdf8',
        fieldBorder: '#b3e5b3',
        fieldIcon: '#4a8f4a',
        inputText: '#0f172a',
        ctaBackground: 'linear-gradient(102deg, #228b22 0%, #1e7b1e 54%, #155015 100%)',
        ctaShadow: '0 18px 34px -20px rgba(34, 139, 34, 0.78)',
        footerColor: '#6b7280',
        selectorWrapBackground: 'rgba(240, 250, 242, 0.88)',
        selectorWrapBorder: 'rgba(179, 229, 179, 0.85)',
        selectorActiveBackground: 'linear-gradient(135deg, rgba(34, 139, 34, 0.12), rgba(144, 238, 144, 0.18))',
        selectorActiveBorder: 'rgba(34, 139, 34, 0.35)',
        selectorInactiveBorder: 'rgba(179, 229, 179, 0.5)',
        artPanelBackground: '',
      };

  return (
    <main
      className={[
        'relative min-h-screen overflow-hidden',
        isNovaDesign ? 'grid items-stretch' : 'flex items-center justify-center px-4 py-8 sm:px-6',
      ].join(' ')}
      style={{ background: isNovaDesign ? '#0a0e17' : designStyles.pageBackground }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className={[
            'rounded-full blur-3xl',
            isNovaDesign ? 'absolute -right-28 -top-32 h-[34rem] w-[34rem]' : 'absolute -top-24 -left-16 h-72 w-72',
          ].join(' ')}
          style={{ background: designStyles.orbOne }}
        />
        <div
          className={[
            'rounded-full blur-3xl',
            isNovaDesign ? 'absolute -bottom-40 left-[8%] h-[28rem] w-[28rem]' : 'absolute -bottom-24 -right-20 h-80 w-80',
          ].join(' ')}
          style={{ background: designStyles.orbTwo }}
        />
        <div
          className={[
            'rounded-full blur-3xl',
            isNovaDesign ? 'absolute right-[22%] top-[52%] h-60 w-60' : 'absolute left-1/2 top-[14%] h-52 w-52 -translate-x-1/2',
          ].join(' ')}
          style={{ background: designStyles.orbThree }}
        />
      </div>

      <section
        className={[
          'relative z-10 w-full',
          isNovaDesign ? 'grid min-h-screen grid-cols-1 lg:grid-cols-2' : '',
        ].join(' ')}
        style={{ maxWidth: isNovaDesign ? 'none' : '430px' }}
      >
        {isNovaDesign ? (
          <aside
            className="relative hidden overflow-hidden px-10 py-14 lg:flex lg:flex-col lg:justify-center xl:px-14"
            style={{ background: designStyles.artPanelBackground }}
          >
            <div className="relative z-10 max-w-[28rem]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: designStyles.eyebrowColor }}>
                {t('login.eyebrow')}
              </p>
              <h1 className="mt-8 font-display text-[2.45rem] font-extrabold leading-[1.08] tracking-[-0.04em]" style={{ color: '#ffffff' }}>
                {t('login.title')}
              </h1>
              <p className="mt-5 max-w-[33rem] text-[15px] leading-7" style={{ color: designStyles.subtitleColor }}>
                {t('login.description')}
              </p>
              <div className="mt-10 grid grid-cols-3 gap-3">
                {[
                  [t('login.metricOrders'), '138'],
                  [t('login.metricStock'), `40 400 ${t('common.meters')}`],
                  [t('login.metricOutput'), formatMoney(389000000)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
                    <p className="text-lg font-bold text-white">{value}</p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        ) : null}

        <div
          className={[
            'relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6',
            isNovaDesign ? 'lg:bg-[#0a0e17]' : '',
          ].join(' ')}
        >
          <form
            className="w-full rounded-[28px] p-7 sm:p-8"
            style={{
              maxWidth: '430px',
              background: designStyles.cardBackground,
              border: designStyles.cardBorder,
              boxShadow: designStyles.cardShadow,
            }}
            onSubmit={(event) => {
              event.preventDefault();
              onLogin();
            }}
          >
            <div className="mb-7 flex items-center justify-between gap-3">
              <Brand tone={isNovaDesign ? 'dark' : 'light'} />
              <LanguageSwitch tone={isNovaDesign ? 'dark' : 'light'} onLanguageChange={onLanguageChange} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: designStyles.eyebrowColor }}>
                {t('login.eyebrow')}
              </p>
              <h1 className="mt-3 font-display text-[2rem] font-extrabold leading-tight tracking-[-0.04em]" style={{ color: designStyles.titleColor }}>
                {t('login.cardTitle')}
              </h1>
              <p className="mt-2 text-sm leading-6" style={{ color: designStyles.subtitleColor }}>
                {t('login.cardSubtitle')}
              </p>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm font-semibold" style={{ color: designStyles.labelColor }}>
                {t('common.email')}
                <span className="relative">
                  <FiUser className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: designStyles.fieldIcon }} />
                  <input
                    className="h-12 w-full rounded-2xl border pl-10 pr-3 text-sm font-medium outline-none transition focus:ring-4 focus:ring-primary/15"
                    placeholder={t('login.emailPlaceholder')}
                    style={{ background: designStyles.fieldBackground, borderColor: designStyles.fieldBorder, color: designStyles.inputText }}
                    type="email"
                  />
                </span>
              </label>
              <label className="grid gap-2 text-sm font-semibold" style={{ color: designStyles.labelColor }}>
                {t('common.password')}
                <span className="relative">
                  <FiLock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: designStyles.fieldIcon }} />
                  <input
                    className="h-12 w-full rounded-2xl border pl-10 pr-11 text-sm font-medium outline-none transition focus:ring-4 focus:ring-primary/15"
                    placeholder={t('login.passwordPlaceholder')}
                    style={{ background: designStyles.fieldBackground, borderColor: designStyles.fieldBorder, color: designStyles.inputText }}
                    type={showPassword ? 'text' : 'password'}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg"
                    onClick={() => setShowPassword(current => !current)}
                    aria-label={t('common.password')}
                    style={{ color: designStyles.fieldIcon }}
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </span>
              </label>
            </div>

            <button
              className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white transition hover:scale-[1.01]"
              style={{ background: designStyles.ctaBackground, boxShadow: designStyles.ctaShadow }}
            >
              {t('login.submit')}
              <FiArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-4 text-center text-xs leading-5" style={{ color: designStyles.footerColor }}>
              {t('login.hint')}
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}

function EntityModal({ modal, onClose, formatMoney, categories, onSaveCategory, onEdit, onDelete }: { modal: ModalState; onClose: () => void; formatMoney: (value: number) => string; categories: ProductCategory[]; onSaveCategory: (category: ProductCategory) => void; onEdit: (modal: ModalState) => void; onDelete: (modal: ModalState) => void }) {
  const { t } = useTranslation();
  const namespace =
    modal.kind === 'client'
      ? 'clients'
      : modal.kind === 'staff'
        ? 'staff'
        : modal.kind === 'category'
          ? 'products.categoryModal'
          : modal.kind === 'order'
            ? 'orders'
            : 'products';
  const title = t(`${namespace}.modal.${modal.mode}Title`);
  const summary = t(`${namespace}.modal.summary`);
  const nextStep = t(`${namespace}.modal.nextStep`);
  const formRows = getFormRows(modal, formatMoney, t);
  const [categoryDraft, setCategoryDraft] = useState<ProductCategory | null>(null);

  useEffect(() => {
    if (modal.kind !== 'category' || modal.mode === 'view') {
      setCategoryDraft(null);
      return;
    }

    const item = modal.item as ProductCategory | undefined;
    setCategoryDraft(item ?? {
      id: `cat-${Date.now()}`,
      name: '',
      code: '',
      description: '',
      sortOrder: categories.length + 1,
    });
  }, [categories.length, modal]);

  return (
    <div
      className="client-drawer-overlay--nova fixed inset-0 z-[150] flex justify-end bg-background-overlay/72 backdrop-blur-[3px]"
      role="presentation"
      onClick={onClose}
    >
      <aside
        className="client-drawer-panel--nova h-full w-full max-w-[780px] overflow-y-auto bg-background-subtle p-4 shadow-xl ring-1 ring-border-soft/50 min-[641px]:p-5"
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="mb-4 rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                {modal.mode === 'view' ? t('common.view') : modal.mode === 'edit' ? t('common.edit') : t('common.create')}
              </p>
              <h3 className="mt-1 font-display text-[1.45rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-text-primary">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{summary}</p>
            </div>
            <button className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-subtle text-text-secondary transition duration-fast hover:bg-surface-muted hover:text-text-primary" onClick={onClose} aria-label={t('common.close')}>
              <FiX className="h-4 w-4" />
            </button>
          </div>
        </header>

        {modal.mode === 'view' && modal.item ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {detailRows(modal, formatMoney, t).map(row => (
              <div key={row.label} className="rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/40">
                <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{row.label}</p>
                <p className="mt-1 text-sm font-semibold text-text-primary [overflow-wrap:anywhere]">{row.value}</p>
              </div>
            ))}
            <div className="rounded-xl bg-primary/10 p-4 text-sm font-semibold leading-6 text-text-secondary ring-1 ring-primary/15 sm:col-span-2">{nextStep}</div>
          </div>
        ) : modal.kind === 'product' ? (
          <ProductEditPanel product={modal.item as Product | undefined} categories={categories} />
        ) : modal.kind === 'category' ? (
          <CategoryEditPanel category={categoryDraft ?? (modal.item as ProductCategory | undefined)} onChange={setCategoryDraft} />
        ) : (
          <div className="rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/40">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {formRows.map(row => (
              <Field key={row.label} label={row.label} placeholder={t('common.notRequired')} defaultValue={row.value} />
            ))}
          </div>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          {modal.mode === 'view' && modal.item ? (
            <>
              <button className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-surface-card px-4 text-sm font-semibold text-text-secondary ring-1 ring-border-soft/60 transition hover:bg-primary/10 hover:text-text-primary" onClick={() => onEdit({ ...modal, mode: 'edit' })}>
                <FiEdit2 className="h-4 w-4" />
                {t('common.edit')}
              </button>
              <button className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-danger-bg px-4 text-sm font-semibold text-danger ring-1 ring-danger/15 transition hover:bg-danger/10" onClick={() => onDelete(modal)}>
                <FiTrash2 className="h-4 w-4" />
                {t('common.delete')}
              </button>
            </>
          ) : null}
          <button className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl bg-surface-card px-4 text-sm font-semibold text-text-secondary ring-1 ring-border-soft/60 transition hover:bg-surface-muted hover:text-text-primary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          {modal.mode !== 'view' ? (
            <button className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-accent" onClick={() => {
              if (modal.kind === 'category' && categoryDraft) {
                onSaveCategory(categoryDraft);
              }
              onClose();
            }}>
              {t('common.save')}
            </button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function DeleteConfirmDialog({ modal, onCancel, onConfirm }: { modal: ModalState; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useTranslation();
  const itemName =
    modal.kind === 'client'
      ? (modal.item as Client | undefined)?.name
      : modal.kind === 'staff'
        ? (modal.item as StaffMember | undefined)?.name
        : modal.kind === 'category'
          ? (modal.item as ProductCategory | undefined)?.name
          : modal.kind === 'order'
            ? (modal.item as Order | undefined)?.orderId
            : (modal.item as Product | undefined)?.name;

  return (
    <div
      className="fixed inset-0 z-[180] grid place-items-center bg-background-overlay/72 px-3 backdrop-blur-[3px]"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section className="w-full max-w-[420px] rounded-[28px] bg-surface-card p-5 shadow-[0_40px_110px_-42px_rgba(15,23,42,0.62)] ring-1 ring-border-soft/55">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-danger-bg text-danger">
            <FiTrash2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-danger">{t('deleteDialog.eyebrow')}</p>
            <h3 className="mt-1 font-display text-xl font-extrabold text-text-primary">{t('deleteDialog.title')}</h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{t('deleteDialog.description', { item: itemName ?? t('common.notRequired') })}</p>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl bg-surface-subtle px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-muted hover:text-text-primary" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl bg-danger px-4 text-sm font-semibold text-white transition hover:opacity-90" onClick={onConfirm}>
            {t('common.delete')}
          </button>
        </div>
      </section>
    </div>
  );
}

function CustomizePanel({ accent, onAccentChange, onClose }: { accent: string; onAccentChange: (accent: string) => void; onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 z-[160] bg-background-overlay/58 backdrop-blur-sm"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="fixed inset-x-3 bottom-3 rounded-[28px] bg-surface-card p-5 shadow-[0_40px_110px_-42px_rgba(15,23,42,0.62)] ring-1 ring-border-soft/55 sm:inset-auto sm:right-6 sm:top-[84px] sm:w-[390px]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{t('customize.title')}</p>
            <p className="mt-1 text-sm text-text-secondary">{t('customize.subtitle')}</p>
          </div>
          <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-subtle text-text-secondary transition duration-fast hover:bg-surface-muted hover:text-text-primary" onClick={onClose} aria-label={t('common.close')}>
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{t('customize.colorSection')}</p>
          <div className="grid grid-cols-3 gap-2">
            {BACKGROUND_COLOR_PRESETS.map(option => {
              const isActive = option.value.toLowerCase() === accent.toLowerCase();
              const palette = COLOR_PALETTES[option.value];
              const lightPrimary = palette ? `rgb(${palette.light.primary})` : option.value;
              const darkPrimary = palette ? `rgb(${palette.dark.primary})` : option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onAccentChange(option.value)}
                  className={[
                    'group relative flex flex-col items-center gap-2.5 rounded-2xl border p-3 text-center transition duration-fast',
                    isActive
                      ? 'border-primary/40 bg-primary/8 shadow-sm'
                      : 'border-border-soft/60 bg-surface-subtle hover:border-border-soft hover:bg-surface-card',
                  ].join(' ')}
                >
                  <span className="flex w-full items-center justify-center gap-1">
                    <span className="h-6 w-6 rounded-lg shadow-sm" style={{ backgroundColor: lightPrimary }} />
                    <span className="h-6 w-6 rounded-lg shadow-sm" style={{ backgroundColor: darkPrimary }} />
                  </span>
                  <span className="text-[11px] font-bold text-text-secondary">{t(`customize.presets.${option.key}`)}</span>
                  {isActive && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-extrabold text-primary-foreground">✓</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-1 rounded-xl bg-surface-subtle p-3 text-xs text-text-muted">
            <span className="mr-1 inline-block h-3 w-3 rounded-sm align-middle" style={{ backgroundColor: 'rgb(var(--color-primary))' }} />
            Hozirgi rang: <span className="font-bold text-text-primary">{t(`customize.presets.${BACKGROUND_COLOR_PRESETS.find(p => p.value === accent)?.key ?? 'indigo'}`)}</span>
            &nbsp;·&nbsp;Tugmalar, havolalar va faol elementlarga qo'llaniladi
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button type="button" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl bg-surface-subtle px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-muted hover:text-text-primary" onClick={() => onAccentChange(DEFAULT_BACKGROUND_ACCENT)}>
            {t('customize.reset')}
          </button>
          <button type="button" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-accent" onClick={onClose}>
            {t('customize.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

function detailRows(modal: ModalState, formatMoney: (value: number) => string, t: ReturnType<typeof useTranslation>['t']) {
  if (modal.kind === 'client') {
    const item = modal.item as Client;
    return [
      { label: t('clients.columns.client'), value: item.name },
      { label: t('clients.columns.fabric'), value: item.fabric },
      { label: t('clients.columns.status'), value: item.status },
      { label: t('clients.columns.manager'), value: item.manager },
      { label: t('clients.columns.value'), value: formatMoney(item.value) },
      { label: t('clients.columns.lastContact'), value: item.lastContact },
    ];
  }

  if (modal.kind === 'staff') {
    const item = modal.item as StaffMember;
    return [
      { label: t('staff.columns.staff'), value: item.name },
      { label: t('staff.columns.shift'), value: item.shift },
      { label: t('staff.columns.arrival'), value: item.arrival },
      { label: t('staff.columns.leaving'), value: item.leaving },
      { label: t('staff.columns.status'), value: item.status },
      { label: t('staff.columns.attendance'), value: `${item.attendance}%` },
    ];
  }

  if (modal.kind === 'category') {
    const item = modal.item as ProductCategory;
    return [
      { label: t('products.categoryColumns.category'), value: item.name },
      { label: t('products.categoryColumns.code'), value: item.code },
      { label: t('products.categoryColumns.description'), value: item.description },
      { label: t('products.categoryColumns.sortOrder'), value: String(item.sortOrder) },
    ];
  }

  if (modal.kind === 'order') {
    const item = modal.item as Order;
    return [
      { label: t('orders.columns.orderId'), value: item.orderId },
      { label: t('orders.columns.client'), value: item.client },
      { label: t('orders.columns.product'), value: item.product },
      { label: t('orders.columns.quantity'), value: item.quantity },
      { label: t('orders.form.unitPrice'), value: formatMoney(item.unitPrice) },
      { label: t('orders.columns.total'), value: formatMoney(item.totalAmount) },
      { label: t('orders.columns.manager'), value: item.manager },
      { label: t('orders.columns.deliveryDate'), value: item.deliveryDate },
      { label: t('orders.columns.status'), value: item.status },
      { label: t('orders.form.notes'), value: item.notes },
    ];
  }

  const item = modal.item as Product;
  return [
    { label: t('products.columns.product'), value: item.name },
    { label: t('products.columns.category'), value: item.category },
    { label: t('products.columns.sku'), value: item.sku },
    { label: t('products.form.supplier'), value: item.supplier },
    { label: t('products.form.warehouse'), value: item.warehouse },
    { label: t('products.form.composition'), value: item.composition },
    { label: t('products.form.color'), value: item.color },
    { label: t('products.form.gsm'), value: `${item.gsm} GSM` },
    { label: t('products.form.width'), value: item.width },
    { label: t('products.form.price'), value: formatMoney(item.price) },
    { label: t('products.columns.stock'), value: `${item.stock.toLocaleString()} ${unitLabel(item.unit, t)}` },
    { label: t('products.columns.sold'), value: `${item.sold.toLocaleString()} ${unitLabel(item.unit, t)}` },
    { label: t('products.columns.revenue'), value: formatMoney(item.revenue) },
    { label: t('products.columns.trend'), value: `${item.trend > 0 ? '+' : ''}${item.trend}%` },
  ];
}

function getFormRows(modal: ModalState, formatMoney: (value: number) => string, t: ReturnType<typeof useTranslation>['t']) {
  if (modal.kind === 'client') {
    const item = modal.item as Client | undefined;
    return [
      { label: t('clients.columns.client'), value: item?.name ?? '' },
      { label: t('common.email'), value: item?.phone ?? '' },
      { label: t('clients.columns.fabric'), value: item?.fabric ?? '' },
      { label: t('clients.columns.value'), value: item ? formatMoney(item.value) : '' },
    ];
  }

  if (modal.kind === 'staff') {
    const item = modal.item as StaffMember | undefined;
    return [
      { label: t('staff.columns.staff'), value: item?.name ?? '' },
      { label: t('staff.columns.shift'), value: item?.shift ?? '' },
      { label: t('staff.columns.arrival'), value: item?.arrival ?? '' },
      { label: t('staff.columns.leaving'), value: item?.leaving ?? '' },
    ];
  }

  if (modal.kind === 'category') {
    const item = modal.item as ProductCategory | undefined;
    return [
      { label: t('products.categoryColumns.category'), value: item?.name ?? '' },
      { label: t('products.categoryColumns.code'), value: item?.code ?? '' },
      { label: t('products.categoryColumns.description'), value: item?.description ?? '' },
      { label: t('products.categoryColumns.sortOrder'), value: item ? String(item.sortOrder) : '' },
    ];
  }

  if (modal.kind === 'order') {
    const item = modal.item as Order | undefined;
    return [
      { label: t('orders.columns.client'), value: item?.client ?? '' },
      { label: t('orders.columns.product'), value: item?.product ?? '' },
      { label: t('orders.columns.quantity'), value: item?.quantity ?? '' },
      { label: t('orders.form.unitPrice'), value: item ? String(item.unitPrice) : '' },
      { label: t('orders.columns.deliveryDate'), value: item?.deliveryDate ?? '' },
      { label: t('orders.form.notes'), value: item?.notes ?? '' },
    ];
  }

  const item = modal.item as Product | undefined;
  return [
    { label: t('products.columns.product'), value: item?.name ?? '' },
    { label: t('products.columns.sku'), value: item?.sku ?? '' },
    { label: t('products.columns.stock'), value: item ? `${item.stock.toLocaleString()} ${unitLabel(item.unit, t)}` : '' },
    { label: t('products.columns.revenue'), value: item ? formatMoney(item.revenue) : '' },
  ];
}

function CategoryEditPanel({ category, onChange }: { category?: ProductCategory; onChange: (category: ProductCategory) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [sortOrder, setSortOrder] = useState(category?.sortOrder ? String(category.sortOrder) : '');
  const generatedCode = normalizeCategoryCode(name || category?.code || '');

  useEffect(() => {
    onChange({
      id: category?.id ?? `cat-${Date.now()}`,
      name,
      code: generatedCode,
      description,
      sortOrder: Number(sortOrder) || 1,
    });
  }, [category?.id, description, generatedCode, name, onChange, sortOrder]);

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/40">
        <div className="mb-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{t('products.categoryModal.form.details')}</p>
          <p className="mt-1 text-sm text-text-secondary">{t('products.categoryModal.form.detailsHint')}</p>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="form-field--nova grid min-w-0 gap-1.5 rounded-xl bg-surface-subtle p-3 text-sm font-bold text-text-secondary ring-1 ring-border-soft/45">
            {t('products.categoryColumns.category')}
            <input
              className="form-field__input--nova h-11 w-full rounded-xl border border-border-soft/60 bg-surface-card px-3 text-sm font-medium text-text-primary placeholder:text-text-muted outline-none transition duration-fast focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              placeholder={t('products.form.categoryPlaceholder')}
              value={name}
              onChange={event => setName(event.target.value)}
            />
          </label>
          <label className="form-field--nova grid min-w-0 gap-1.5 rounded-xl bg-surface-subtle p-3 text-sm font-bold text-text-secondary ring-1 ring-border-soft/45">
            {t('products.categoryColumns.code')}
            <input
              className="form-field__input--nova h-11 w-full rounded-xl border border-border-soft/60 bg-surface-card px-3 text-sm font-medium text-text-primary outline-none transition duration-fast focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              value={generatedCode}
              readOnly
            />
          </label>
          <label className="form-field--nova grid min-w-0 gap-1.5 rounded-xl bg-surface-subtle p-3 text-sm font-bold text-text-secondary ring-1 ring-border-soft/45 sm:col-span-2">
            {t('products.categoryColumns.description')}
            <textarea
              className="form-field__input--nova min-h-28 w-full resize-none rounded-xl border border-border-soft/60 bg-surface-card px-3 py-3 text-sm font-medium text-text-primary placeholder:text-text-muted outline-none transition duration-fast focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              placeholder={t('common.notRequired')}
              value={description}
              onChange={event => setDescription(event.target.value)}
            />
          </label>
          <label className="form-field--nova grid min-w-0 gap-1.5 rounded-xl bg-surface-subtle p-3 text-sm font-bold text-text-secondary ring-1 ring-border-soft/45">
            {t('products.categoryColumns.sortOrder')}
            <input
              className="form-field__input--nova h-11 w-full rounded-xl border border-border-soft/60 bg-surface-card px-3 text-sm font-medium text-text-primary placeholder:text-text-muted outline-none transition duration-fast focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              placeholder="1"
              type="number"
              value={sortOrder}
              onChange={event => setSortOrder(event.target.value)}
            />
          </label>
        </div>
      </section>
    </div>
  );
}

function ProductEditPanel({ product, categories }: { product?: Product; categories: ProductCategory[] }) {
  const { t } = useTranslation();
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? categories[0]?.id ?? '');
  const [draftCategory, setDraftCategory] = useState('');
  const selectedCategory = categoryOptions.find(category => category.id === categoryId) ?? categoryOptions[0];
  const gallery = product?.gallery?.length ? product.gallery : product?.imageUrl ? [product.imageUrl] : [];

  function addCategory() {
    const name = draftCategory.trim();
    if (!name) return;
    const nextCategory: ProductCategory = {
      id: `cat-${Date.now()}`,
      name,
      code: normalizeCategoryCode(name),
      description: t('products.form.customCategory'),
      sortOrder: categoryOptions.length + 1,
    };
    setCategoryOptions(current => [...current, nextCategory]);
    setCategoryId(nextCategory.id);
    setDraftCategory('');
  }

  return (
    <div className="grid gap-4">
      <section className="overflow-hidden rounded-2xl bg-surface-card shadow-sm ring-1 ring-border-soft/40">
        <div className="relative h-52 bg-surface-muted">
          {product?.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center bg-primary/8 text-primary">
              <FiPackage className="h-10 w-10" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">{product?.sku ?? t('products.form.newSku')}</p>
            <h4 className="mt-1 text-lg font-extrabold text-white">{product?.name ?? t('products.form.newProduct')}</h4>
          </div>
        </div>
        <div className="grid gap-3 p-4">
          <div className="grid grid-cols-3 gap-2">
            {gallery.slice(0, 3).map(image => (
              <button key={image} type="button" className="h-20 overflow-hidden rounded-xl ring-1 ring-border-soft/50 transition hover:-translate-y-0.5 hover:ring-primary/40" onClick={() => window.open(image, '_blank', 'noopener,noreferrer')}>
                <img src={image} alt={product?.name ?? t('products.form.gallery')} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <button type="button" className="inline-flex h-10 items-center justify-center rounded-xl bg-primary/10 px-3 text-xs font-extrabold text-text-accent ring-1 ring-primary/15 transition hover:bg-primary/15" onClick={() => product?.imageUrl && window.open(product.imageUrl, '_blank', 'noopener,noreferrer')}>
              {t('products.form.primaryImage')}
            </button>
            <button type="button" className="inline-flex h-10 items-center justify-center rounded-xl bg-surface-subtle px-3 text-xs font-extrabold text-text-secondary ring-1 ring-border-soft/50 transition hover:bg-primary/10 hover:text-text-primary" onClick={() => window.alert(t('products.form.galleryAction'))}>
              {t('products.form.addGallery')}
            </button>
            <button type="button" className="inline-flex h-10 items-center justify-center rounded-xl bg-danger-bg px-3 text-xs font-extrabold text-danger ring-1 ring-danger/15 transition hover:bg-danger/10" onClick={() => window.alert(t('products.form.removeImageAction'))}>
              {t('products.form.removeImage')}
            </button>
          </div>
          <p className="text-xs font-semibold text-text-muted">{t('products.form.imageHint')}</p>
        </div>
      </section>

      <section className="rounded-2xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/40">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{t('products.form.details')}</p>
            <p className="mt-1 text-sm text-text-secondary">{t('products.form.detailsHint')}</p>
          </div>
          <StatusBadge tone={product?.stock && product.stock <= product.minStock ? 'warning' : 'success'}>
            {product?.status ?? t('products.form.active')}
          </StatusBadge>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <Field label={t('products.columns.product')} placeholder={t('common.notRequired')} defaultValue={product?.name ?? ''} />
          <Field label={t('products.columns.sku')} placeholder={t('products.form.newSku')} defaultValue={product?.sku ?? ''} />
          <Field label={t('products.form.price')} placeholder="0" type="number" defaultValue={product ? String(product.price) : ''} />
          <Field label={t('products.columns.stock')} placeholder="0" type="number" defaultValue={product ? String(product.stock) : ''} />
          <Field label={t('products.form.minStock')} placeholder="0" type="number" defaultValue={product ? String(product.minStock) : ''} />
          <Field label={t('products.form.supplier')} placeholder={t('common.notRequired')} defaultValue={product?.supplier ?? ''} />
          <Field label={t('products.form.warehouse')} placeholder={t('common.notRequired')} defaultValue={product?.warehouse ?? ''} />
          <Field label={t('products.form.color')} placeholder={t('common.notRequired')} defaultValue={product?.color ?? ''} />
          <Field label={t('products.form.composition')} placeholder={t('common.notRequired')} defaultValue={product?.composition ?? ''} />
          <Field label={t('products.form.gsm')} placeholder="120" type="number" defaultValue={product ? String(product.gsm) : ''} />
          <Field label={t('products.form.width')} placeholder="160 cm" defaultValue={product?.width ?? ''} />
          <SelectField
            label={t('products.columns.category')}
            value={categoryId}
            onChange={setCategoryId}
            options={categoryOptions.map(category => ({ value: category.id, label: category.name }))}
            stretch
          />
          <div className="min-w-0 sm:col-span-2">
            <TextAreaField label={t('products.form.description')} placeholder={t('common.notRequired')} defaultValue={product?.description ?? selectedCategory?.description ?? ''} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/40">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{t('products.form.categories')}</p>
            <p className="mt-1 text-sm text-text-secondary">{t('products.form.categoriesHint')}</p>
          </div>
        </div>
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            {categoryOptions.map(category => (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id)}
                className={[
                  'rounded-pill px-3 py-1.5 text-xs font-extrabold ring-1 transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-26px_rgb(var(--color-primary)/0.55)]',
                  categoryId === category.id ? 'bg-primary text-primary-foreground ring-primary/30' : 'bg-surface-subtle text-text-secondary ring-border-soft/60 hover:bg-primary/10 hover:text-text-primary',
                ].join(' ')}
              >
                {category.name}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={draftCategory}
              onChange={event => setDraftCategory(event.target.value)}
              placeholder={t('products.form.categoryPlaceholder')}
              className="h-11 flex-1 rounded-xl border border-border-soft/60 bg-surface-card px-3 text-sm font-medium text-text-primary placeholder:text-text-muted outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
            <button type="button" onClick={addCategory} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary-strong">
              <FiPlus className="h-4 w-4" />
              {t('products.form.addCategory')}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/40 sm:grid-cols-2">
        <SwitchRow label={t('products.form.isActive')} defaultChecked={product?.isActive ?? true} />
        <SwitchRow label={t('products.form.isRecommended')} defaultChecked={product?.isRecommended ?? false} />
      </section>
    </div>
  );
}

function TextAreaField({ label, placeholder, defaultValue = '' }: { label: string; placeholder: string; defaultValue?: string }) {
  return (
    <label className="form-field--nova grid min-w-0 gap-1.5 rounded-xl bg-surface-subtle p-3 text-sm font-bold text-text-secondary ring-1 ring-border-soft/45">
      {label}
      <textarea className="form-field__input--nova min-h-28 w-full resize-none rounded-xl border border-border-soft/60 bg-surface-card px-3 py-3 text-sm font-medium text-text-primary placeholder:text-text-muted outline-none transition duration-fast focus:border-primary/50 focus:ring-2 focus:ring-primary/20" placeholder={placeholder} defaultValue={defaultValue} />
    </label>
  );
}

function SwitchRow({ label, defaultChecked }: { label: string; defaultChecked: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <button type="button" onClick={() => setChecked(current => !current)} className="flex items-center justify-between gap-4 rounded-xl bg-surface-subtle px-3 py-3 text-left ring-1 ring-border-soft/45 transition hover:bg-primary/8">
      <span className="text-sm font-bold text-text-primary">{label}</span>
      <span className={['relative h-7 w-12 rounded-pill p-1 transition', checked ? 'bg-primary' : 'bg-surface-muted'].join(' ')}>
        <span className={['block h-5 w-5 rounded-full bg-white shadow-sm transition', checked ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
      </span>
    </button>
  );
}

function toneClasses(tone: StatusTone) {
  const classes: Record<StatusTone, string> = {
    success: 'bg-success-bg text-success',
    warning: 'bg-warning-bg text-warning',
    danger: 'bg-danger-bg text-danger',
    info: 'bg-info-bg text-info',
    neutral: 'bg-surface-muted text-text-secondary',
  };
  return classes[tone];
}

function trendToneClasses(tone: StatusTone) {
  const classes: Record<StatusTone, string> = {
    success: 'border-success/10 bg-success-bg text-success',
    warning: 'border-warning/10 bg-warning-bg text-warning',
    danger: 'border-danger/10 bg-danger-bg text-danger',
    info: 'border-info/10 bg-info-bg text-info',
    neutral: 'border-neutral/10 bg-neutral-bg text-neutral',
  };
  return classes[tone];
}

function readObjects<T>(t: ReturnType<typeof useTranslation>['t'], key: string): T[] {
  return t(key, { returnObjects: true }) as T[];
}

export default App;
