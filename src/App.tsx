import { useEffect, useMemo, useRef, useState } from 'react';
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
} from './lib/design-system';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from './i18n';

type PageId = 'dashboard' | 'clients' | 'staff' | 'products';
type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
type ModalMode = 'view' | 'create' | 'edit';
type EntityKind = 'client' | 'staff' | 'product' | 'category';
type EntityId = number | string;

interface Client {
  id: number;
  name: string;
  phone: string;
  source: string;
  status: string;
  statusKey: string;
  manager: string;
  value: number;
  lastContact: string;
  fabric: string;
}

interface StaffMember {
  id: number;
  name: string;
  role: string;
  shift: string;
  arrival: string;
  leaving: string;
  status: string;
  statusKey: string;
  attendance: number;
}

interface Product {
  id: number;
  name: string;
  description: string;
  category: string;
  categoryId: string;
  sku: string;
  supplier: string;
  warehouse: string;
  color: string;
  composition: string;
  gsm: number;
  width: string;
  price: number;
  currency: string;
  imageUrl: string;
  gallery: string[];
  status: string;
  isActive: boolean;
  isRecommended: boolean;
  subsidyEnabled: boolean;
  stock: number;
  minStock: number;
  unit: 'm' | 'kg' | 'pcs';
  sold: number;
  revenue: number;
  trend: number;
}

interface CategoryDatum {
  name: string;
  value: number;
  color: string;
}

interface ProductCategory {
  id: string;
  name: string;
  code: string;
  description: string;
  sortOrder: number;
}

interface ModalState {
  mode: ModalMode;
  kind: EntityKind;
  item?: Client | StaffMember | Product | ProductCategory;
}

const navItems = [
  { id: 'dashboard' as const, icon: FiGrid },
  { id: 'clients' as const, icon: FiUsers },
  { id: 'staff' as const, icon: FiClock },
  { id: 'products' as const, icon: FiPackage },
];

function getPageFromLocation(): PageId {
  if (typeof window === 'undefined') return 'dashboard';
  const path = window.location.pathname.replace(/^\/+/, '').split('/')[0];
  return navItems.some(item => item.id === path) ? (path as PageId) : 'dashboard';
}

const THEME_STORAGE_KEY = 'rivera-theme';
const ACCENT_STORAGE_KEY = 'rivera-background-accent';
const DEFAULT_BACKGROUND_ACCENT = '#6366f1';
const BACKGROUND_COLOR_PRESETS = [
  { value: '#6366f1', key: 'indigo' },
  { value: '#0f766e', key: 'teal' },
  { value: '#059669', key: 'emerald' },
  { value: '#c2418c', key: 'fuchsia' },
  { value: '#d97706', key: 'amber' },
  { value: '#475569', key: 'slate' },
] as const;

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

function hexToRgba(hexColor: string, alpha: number): string {
  const normalized = hexColor.replace('#', '');
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function App() {
  const { t, i18n } = useTranslation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activePage, setActivePage] = useState<PageId>(getPageFromLocation);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeDesign, setActiveDesign] = useState<DesignVariant>(getStoredDesignVariant);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(getInitialTheme);
  const [backgroundAccent, setBackgroundAccent] = useState(getInitialAccent);
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
  });

  const rawClients = readObjects<Client>(t, 'mock.clients');
  const rawStaff = readObjects<StaffMember>(t, 'mock.staff');
  const rawProducts = readObjects<Product>(t, 'mock.products');
  const rawProductCategories = readObjects<ProductCategory>(t, 'mock.productCategories');
  const mergedProductCategories = rawProductCategories
    .map(category => editedCategories[category.id] ?? category)
    .concat(createdCategories.map(category => editedCategories[category.id] ?? category));
  const clients = rawClients.filter(client => !deletedItems.client.includes(client.id));
  const staff = rawStaff.filter(member => !deletedItems.staff.includes(member.id));
  const products = rawProducts.filter(product => !deletedItems.product.includes(product.id));
  const productCategories = mergedProductCategories.filter(category => !deletedItems.category.includes(category.id));
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

  const revenueData = months.map((month, index) => ({
    month,
    revenue: [224000000, 248000000, 221000000, 302000000, 356000000, 389000000][index],
    orders: [84, 91, 88, 104, 126, 138][index],
  }));

  const staffFlow = weekDays.map((day, index) => ({
    day,
    came: [22, 24, 23, 25, 24][index],
    late: [3, 2, 4, 1, 2][index],
    left: [20, 23, 22, 24, 21][index],
  }));

  const totalStock = products.reduce((sum, product) => sum + product.stock, 0);
  const lowStockCount = products.filter(product => product.stock <= product.minStock).length;
  const pipelineValue = clients.reduce((sum, client) => sum + client.value, 0);
  const onDutyCount = staff.filter(member => member.statusKey !== 'leftEarly').length;
  const activeMeta = navItems.find(item => item.id === activePage) ?? navItems[0];

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // Keep in-memory theme switching if storage is unavailable.
    }
  }, [themeMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ACCENT_STORAGE_KEY, backgroundAccent);
    } catch {
      // Keep in-memory accent switching if storage is unavailable.
    }
  }, [backgroundAccent]);

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
    const kind: EntityKind =
      activePage === 'staff' ? 'staff' : activePage === 'products' ? 'product' : 'client';
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
              <button className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-text-secondary transition hover:bg-primary/10 hover:text-text-primary">
                <FiRefreshCcw className="h-4 w-4" />
                {t('common.refresh')}
              </button>
              <button className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-text-secondary transition hover:bg-primary/10 hover:text-text-primary">
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
            <IconButton label={t('common.refresh')}><FiRefreshCcw /></IconButton>
            <IconButton label={t('common.notifications')}><FiBell /></IconButton>
            <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary-strong" onClick={openCreateModal}>
              <FiPlus className="h-4 w-4" />
              <span className="hidden sm:inline">{t('common.create')}</span>
            </button>
            <IconButton label={t('common.logout')} onClick={() => setIsAuthenticated(false)}><FiLogOut /></IconButton>
          </div>
        </header>

        <main className="relative flex-1 overflow-y-auto px-3 pb-5 pt-3 min-[640px]:px-4 min-[960px]:px-7 min-[960px]:pb-8">
          <div className="mx-auto w-full max-w-page">
            {activePage === 'dashboard' && (
              <DashboardPage
                clients={clients}
                products={products}
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
            {activePage === 'staff' && (
              <StaffPage staff={staff} staffFlow={staffFlow} openModal={setModal} openDelete={setPendingDelete} />
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

function DashboardPage({ clients, products, categoryAnalytics, revenueData, totalStock, lowStockCount, pipelineValue, onDutyCount, staffTotal, formatMoney, openModal }: {
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

function ClientsPage({ clients, formatMoney, openModal, openDelete }: { clients: Client[]; formatMoney: (value: number) => string; openModal: (modal: ModalState) => void; openDelete: (modal: ModalState) => void }) {
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

function StaffPage({ staff, staffFlow, openModal, openDelete }: { staff: StaffMember[]; staffFlow: Array<{ day: string; came: number; late: number; left: number }>; openModal: (modal: ModalState) => void; openDelete: (modal: ModalState) => void }) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow={t('staff.eyebrow')} title={t('staff.title')} description={t('staff.description')} createLabel={t('staff.create')} onCreate={() => openModal({ kind: 'staff', mode: 'create' })} />
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
    </div>
  );
}

function ProductsPage({ products, categoryAnalytics, categories, totalStock, lowStockCount, formatMoney, openModal, openDelete }: {
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
        createLabel={activeTab === 'products' ? t('products.create') : t('products.createCategory')}
        onCreate={() => openModal({ kind: activeTab === 'products' ? 'product' : 'category', mode: 'create' })}
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
            product.sku,
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

function ProductsAnalyticsPanel({ categoryAnalytics }: { products: Product[]; categoryAnalytics: CategoryDatum[]; formatMoney: (value: number) => string }) {
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

function ProductImageCell({ product }: { product: Product }) {
  return (
    <span className="flex min-w-[260px] items-center gap-3">
      <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-muted ring-1 ring-border-soft/50">
        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
      </span>
      <span className="block min-w-0">
        <span className="block max-w-[280px] truncate text-sm font-extrabold text-text-primary">{product.name}</span>
        <span className="mt-1 block max-w-[280px] truncate text-xs font-semibold text-text-muted">{product.color} · {product.composition}</span>
      </span>
    </span>
  );
}

function CategoriesTable({ categories, products, openModal, openDelete }: { categories: ProductCategory[]; products: Product[]; openModal: (modal: ModalState) => void; openDelete: (modal: ModalState) => void }) {
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

function PremiumTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number | string; color?: string; payload?: { name?: string } }>; label?: string }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-border-soft/60 bg-surface-card/95 p-3 shadow-[0_24px_50px_-30px_rgba(15,23,42,0.55)] backdrop-blur-xl">
      {label ? <p className="m-0 mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-text-muted">{label}</p> : null}
      <div className="grid gap-1.5">
        {payload.map(item => (
          <div key={`${item.name ?? item.payload?.name}-${item.value}`} className="flex min-w-[150px] items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-2 font-semibold text-text-secondary">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color ?? '#6366f1' }} />
              {item.name ?? item.payload?.name}
            </span>
            <span className="font-extrabold text-text-primary">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EntityModal({ modal, onClose, formatMoney, categories, onSaveCategory, onEdit, onDelete }: { modal: ModalState; onClose: () => void; formatMoney: (value: number) => string; categories: ProductCategory[]; onSaveCategory: (category: ProductCategory) => void; onEdit: (modal: ModalState) => void; onDelete: (modal: ModalState) => void }) {
  const { t } = useTranslation();
  const namespace = modal.kind === 'client' ? 'clients' : modal.kind === 'staff' ? 'staff' : modal.kind === 'category' ? 'products.categoryModal' : 'products';
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
          <div className="grid gap-2 sm:grid-cols-2">
            {BACKGROUND_COLOR_PRESETS.map(option => {
              const isActive = option.value.toLowerCase() === accent.toLowerCase();
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onAccentChange(option.value)}
                  className={[
                    'flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left transition duration-fast',
                    isActive
                      ? 'border-primary/45 bg-primary/8 shadow-[0_18px_36px_-28px_rgba(99,102,241,0.42)]'
                      : 'border-border-soft/60 bg-surface-subtle hover:border-primary/25 hover:bg-surface-card',
                  ].join(' ')}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="h-4 w-4 shrink-0 rounded-full ring-4 ring-white/70" style={{ backgroundColor: option.value }} />
                    <span className="truncate text-sm font-semibold text-text-primary">{t(`customize.presets.${option.key}`)}</span>
                  </span>
                  {isActive ? <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" /> : null}
                </button>
              );
            })}
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
              <button key={image} type="button" className="h-20 overflow-hidden rounded-xl ring-1 ring-border-soft/50 transition hover:-translate-y-0.5 hover:ring-primary/40">
                <img src={image} alt={product?.name ?? t('products.form.gallery')} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <button type="button" className="inline-flex h-10 items-center justify-center rounded-xl bg-primary/10 px-3 text-xs font-extrabold text-text-accent ring-1 ring-primary/15 transition hover:bg-primary/15">
              {t('products.form.primaryImage')}
            </button>
            <button type="button" className="inline-flex h-10 items-center justify-center rounded-xl bg-surface-subtle px-3 text-xs font-extrabold text-text-secondary ring-1 ring-border-soft/50 transition hover:bg-primary/10 hover:text-text-primary">
              {t('products.form.addGallery')}
            </button>
            <button type="button" className="inline-flex h-10 items-center justify-center rounded-xl bg-danger-bg px-3 text-xs font-extrabold text-danger ring-1 ring-danger/15 transition hover:bg-danger/10">
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

function normalizeCategoryCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();
}

function PageHeader({ eyebrow, title, description, createLabel, onCreate }: { eyebrow: string; title: string; description: string; createLabel?: string; onCreate?: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="page-header--nova flex flex-col justify-between gap-3 md:flex-row md:items-end">
      <div className="max-w-3xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-accent">{eyebrow}</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold leading-tight text-text-primary md:text-4xl">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary md:text-base">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {onCreate && createLabel ? (
          <button className="inline-flex h-10 w-fit items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary-strong" onClick={onCreate}>
            <FiPlus className="h-4 w-4" />
            {createLabel}
          </button>
        ) : null}
        <button className="inline-flex h-10 w-fit items-center gap-2 rounded-xl bg-surface-card px-4 text-sm font-bold text-text-primary shadow-sm ring-1 ring-border-soft/60 transition hover:bg-primary/10">
          <FiDownload className="h-4 w-4" />
          {t('common.export')}
        </button>
      </div>
    </div>
  );
}

function Brand({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { t } = useTranslation();
  const isDark = tone === 'dark';

  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <FiBriefcase className="h-[17px] w-[17px]" />
      </span>
      <div>
        <h1 className={['m-0 font-display text-[1.36rem] font-extrabold leading-none', isDark ? 'text-slate-50' : 'text-text-primary'].join(' ')}>
          {t('app.shortName')}
        </h1>
        <p className={['mt-1 text-[10px] font-bold uppercase tracking-[0.16em]', isDark ? 'text-slate-400' : 'text-text-muted'].join(' ')}>
          {t('app.module')}
        </p>
      </div>
    </div>
  );
}

function LanguageSwitch({ onLanguageChange, tone = 'light' }: { onLanguageChange: (language: SupportedLanguage) => void; tone?: 'light' | 'dark' }) {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const active = i18n.language.startsWith('ru') ? 'ru' : 'uz';
  const isDark = tone === 'dark';
  const flags: Record<SupportedLanguage, string> = {
    uz: '🇺🇿',
    ru: '🇷🇺',
  };

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div ref={menuRef} className="relative z-30">
      <button
        type="button"
        className={[
          'inline-flex h-10 items-center gap-2 rounded-pill px-3 text-xs font-bold shadow-sm transition duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25',
          isDark
            ? 'bg-slate-800/90 text-slate-300 ring-1 ring-slate-700/90 hover:bg-slate-700/90 hover:text-slate-50'
            : 'bg-surface-card text-text-secondary ring-1 ring-border-soft/40 hover:bg-primary/10 hover:text-text-primary',
        ].join(' ')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={t('common.language')}
        onClick={() => setIsOpen(current => !current)}
      >
        <span className="text-base leading-none" aria-hidden="true">{flags[active]}</span>
        <span className={['hidden text-xs font-semibold min-[760px]:inline', isDark ? 'text-slate-100' : 'text-text-primary'].join(' ')}>
          {t(`common.languages.${active}`)}
        </span>
        <FiChevronDown className={['h-4 w-4 transition duration-fast', isDark ? 'text-slate-400' : 'text-text-muted', isOpen ? `rotate-180 ${isDark ? 'text-slate-200' : 'text-text-secondary'}` : ''].join(' ')} />
      </button>

      {isOpen ? (
        <div
          className={[
            'absolute right-0 top-[calc(100%+10px)] w-[190px] overflow-hidden rounded-xl p-1.5 shadow-[0_22px_44px_-30px_rgba(25,28,30,0.38)]',
            isDark ? 'bg-slate-900 ring-1 ring-slate-700' : 'bg-surface-card ring-1 ring-border-soft/40',
          ].join(' ')}
          role="menu"
          aria-label={t('common.language')}
        >
          <div className="grid gap-1">
            {SUPPORTED_LANGUAGES.map(language => (
              <button
                key={language}
                type="button"
                className={[
                  'inline-flex min-h-9 w-full items-center justify-between rounded-lg px-3 text-left text-sm font-medium transition duration-fast',
                  active === language
                    ? isDark ? 'bg-primary/20 text-slate-50' : 'bg-primary/12 text-text-primary'
                    : isDark ? 'text-slate-300 hover:bg-slate-800 hover:text-slate-50' : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary',
                ].join(' ')}
                onClick={() => {
                  onLanguageChange(language);
                  setIsOpen(false);
                }}
                role="menuitem"
              >
                <span className="inline-flex items-center gap-2">
                  <span className="text-base leading-none" aria-hidden="true">{flags[language]}</span>
                  <span>{t(`common.languages.${language}`)}</span>
                </span>
                {active === language ? (
                  <span className="inline-flex h-2 w-2 rounded-full bg-primary" />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DesignSwitch({ activeDesign, onDesignChange }: { activeDesign: DesignVariant; onDesignChange: (design: DesignVariant) => void }) {
  const { t } = useTranslation();
  return (
    <div className="inline-flex h-10 items-center rounded-xl bg-surface-card p-1 text-xs font-bold ring-1 ring-border-soft/50" aria-label={t('common.design')}>
      {designVariants.map(design => (
        <button
          key={design}
          className={['h-8 rounded-lg px-3 transition', activeDesign === design ? 'bg-primary text-primary-foreground' : 'text-text-secondary hover:bg-primary/10'].join(' ')}
          onClick={() => onDesignChange(design)}
          type="button"
        >
          {t(`common.designs.${design}`)}
        </button>
      ))}
    </div>
  );
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface-card text-text-secondary shadow-sm ring-1 ring-border-soft/45 transition hover:bg-primary/10 hover:text-text-primary"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function MetricCard({ icon, label, value, caption, tone }: { icon: React.ReactNode; label: string; value: string; caption: string; tone: StatusTone }) {
  return (
    <article className="stat-card app-card--nova group relative flex min-h-[148px] items-start justify-between gap-3 overflow-hidden p-5 transition duration-base hover:-translate-y-1 hover:scale-[1.015] hover:shadow-[0_24px_50px_-34px_rgb(var(--color-primary)/0.5)] max-[640px]:p-4">
      <div className="grid gap-2.5">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">{label}</p>
        <p className="m-0 text-[clamp(1.7rem,3vw,2.35rem)] font-bold leading-none tracking-[-0.05em] text-text-primary">{value}</p>
        <p className="m-0 max-w-[26ch] text-[13px] leading-5 text-text-secondary">{caption}</p>
      </div>
      <span className={['inline-flex min-h-7 items-center self-start whitespace-nowrap rounded-pill border px-2.5 text-[11px] font-semibold transition duration-fast group-hover:scale-110 group-hover:shadow-sm', trendToneClasses(tone)].join(' ')}>
        {icon}
      </span>
    </article>
  );
}

function Panel({ title, action, children }: { title: string; action: string; children: React.ReactNode }) {
  return (
    <section className="app-card--nova min-w-0 p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-extrabold text-text-primary">{title}</h3>
        <button className="text-sm font-bold text-text-accent">{action}</button>
      </div>
      {children}
    </section>
  );
}

function FilterBar({ query, setQuery, placeholder }: { query: string; setQuery: (query: string) => void; placeholder: string }) {
  const { t } = useTranslation();
  return (
    <div className="filter-bar filter-bar--nova relative z-20 flex flex-wrap items-end justify-start gap-2.5 overflow-visible rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/25 backdrop-blur-[12px]">
      <div className="filter-bar__filters flex min-w-0 flex-1 flex-wrap items-end gap-3">
        <label className="grid min-w-[240px] flex-1 gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{t('common.search')}</span>
          <span className="relative">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={placeholder}
              className="h-11 w-full rounded-xl border border-border-soft bg-surface-card pl-10 pr-4 text-sm font-medium text-text-primary outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
              aria-label={t('common.search')}
            />
          </span>
        </label>
      </div>
      <div className="filter-bar__actions ml-auto flex min-w-0 flex-wrap items-center gap-2.5 max-[820px]:ml-0 max-[820px]:w-full max-[820px]:justify-start">
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-surface-card px-4 text-sm font-bold text-text-primary ring-1 ring-border-soft/55">
          <FiSliders className="h-4 w-4" />
          {t('common.filters')}
        </button>
      </div>
    </div>
  );
}

function ClientsFilterBar({
  query,
  setQuery,
  placeholder,
  statusFilter,
  setStatusFilter,
  sourceFilter,
  setSourceFilter,
  sortMode,
  setSortMode,
  statusOptions,
  sourceOptions,
}: {
  query: string;
  setQuery: (query: string) => void;
  placeholder: string;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  sourceFilter: string;
  setSourceFilter: (value: string) => void;
  sortMode: string;
  setSortMode: (value: string) => void;
  statusOptions: string[];
  sourceOptions: string[];
}) {
  const { t } = useTranslation();

  return (
    <div className="filter-bar filter-bar--nova relative z-20 flex flex-wrap items-end justify-start gap-3 overflow-visible rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/25 backdrop-blur-[12px]">
      <label className="grid w-full gap-1.5 sm:w-[280px] xl:w-[300px]">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{t('common.search')}</span>
        <span className="relative">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={placeholder}
            className="h-11 w-full rounded-xl border border-border-soft bg-surface-card pl-10 pr-4 text-sm font-medium text-text-primary outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
          />
        </span>
      </label>
      <SelectField label={t('clients.filters.status')} value={statusFilter} onChange={setStatusFilter} options={statusOptions.map(value => ({ value, label: value === 'all' ? t('clients.filters.allStatuses') : t(`statuses.${value}`) }))} />
      <SelectField label={t('clients.filters.source')} value={sourceFilter} onChange={setSourceFilter} options={sourceOptions.map(value => ({ value, label: value === 'all' ? t('clients.filters.allSources') : value }))} />
      <SelectField
        label={t('clients.filters.sort')}
        value={sortMode}
        onChange={setSortMode}
        options={[
          { value: 'valueDesc', label: t('clients.filters.valueDesc') },
          { value: 'valueAsc', label: t('clients.filters.valueAsc') },
          { value: 'nameAsc', label: t('clients.filters.nameAsc') },
          { value: 'nameDesc', label: t('clients.filters.nameDesc') },
        ]}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options, stretch = false }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; stretch?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find(option => option.value === value) ?? options[0];

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div ref={menuRef} className={['relative grid min-w-0 w-full gap-1.5', stretch ? 'sm:w-full' : 'sm:w-[190px]'].join(' ')}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</span>
      <button
        type="button"
        className={[
          'group inline-flex h-11 min-w-0 w-full items-center justify-between gap-3 rounded-xl border border-border-soft/70 bg-surface-card/90 px-3.5 text-left text-sm font-semibold text-text-primary shadow-sm transition duration-fast',
          'hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/8 hover:shadow-[0_18px_36px_-30px_rgb(var(--color-primary)/0.5)]',
          isOpen ? 'border-primary/45 bg-primary/10 ring-4 ring-primary/10' : '',
        ].join(' ')}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(current => !current)}
      >
        <span className="min-w-0 truncate pr-1">{selectedOption?.label}</span>
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-text-muted transition group-hover:bg-primary/15 group-hover:text-text-accent">
          <FiChevronDown className={['h-4 w-4 transition duration-fast', isOpen ? 'rotate-180' : ''].join(' ')} />
        </span>
      </button>

      {isOpen ? (
        <div
          className={[
            'absolute left-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-border-soft/60 bg-surface-card/95 p-1.5 shadow-[0_24px_55px_-30px_rgba(15,23,42,0.58)] backdrop-blur-xl',
            stretch ? 'w-full' : 'w-max min-w-full max-w-[280px]',
          ].join(' ')}
          role="listbox"
        >
          <div className="grid max-h-[240px] gap-1 overflow-y-auto">
            {options.map(option => {
              const selected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={[
                    'flex min-h-10 items-center justify-between gap-3 rounded-xl px-3 text-left text-sm font-semibold transition duration-fast',
                    selected
                      ? 'bg-primary/12 text-text-primary shadow-sm'
                      : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary',
                  ].join(' ')}
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {selected ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DataTable({ columns, rows, onRowClick }: { columns: string[]; rows: React.ReactNode[][]; onRowClick?: (rowIndex: number) => void }) {
  return (
    <div className="table-shell overflow-x-auto rounded-xl bg-surface-card p-2 shadow-sm ring-1 ring-border-soft/40 [-webkit-overflow-scrolling:touch]">
      <table className="data-table min-w-[620px] w-full border-separate border-spacing-y-1.5 text-left min-[768px]:min-w-[720px]">
        <thead>
          <tr>
            {columns.map(column => (
              <th key={column} className="data-table__cell data-table__cell--head bg-transparent px-4 py-3.5 text-left align-middle text-[11px] font-bold uppercase tracking-[0.12em] text-text-muted max-[640px]:px-4">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={['data-table__row bg-surface-subtle/70 transition-colors duration-fast', onRowClick ? 'data-table__row--clickable cursor-pointer' : ''].join(' ')}
              onClick={() => onRowClick?.(rowIndex)}
            >
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="data-table__cell px-4 py-3.5 align-middle text-sm text-text-primary first:rounded-l-lg last:rounded-r-lg max-[640px]:px-4">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowActions({ onView, onEdit, onDelete }: { onView: () => void; onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <TableAction label={t('common.view')} onClick={onView}><FiEye /></TableAction>
      <TableAction label={t('common.edit')} onClick={onEdit}><FiEdit2 /></TableAction>
      <TableAction label={t('common.delete')} onClick={onDelete}><FiTrash2 /></TableAction>
    </div>
  );
}

function TableAction({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface-card text-text-secondary ring-1 ring-border-soft/50 transition hover:bg-primary/10 hover:text-text-primary"
      title={label}
      aria-label={label}
      onClick={event => {
        event.stopPropagation();
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

function PrimaryCell({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <span className="block min-w-0">
      <span className="block max-w-[240px] truncate text-sm font-bold text-text-primary">{title}</span>
      <span className="block max-w-[240px] truncate text-xs text-text-muted">{subtitle}</span>
    </span>
  );
}

function StatusBadge({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return (
    <span className={['inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold', toneClasses(tone)].join(' ')}>
      {children}
    </span>
  );
}

function Field({ label, placeholder, type = 'text', defaultValue = '' }: { label: string; placeholder: string; type?: string; defaultValue?: string }) {
  return (
    <label className="form-field--nova grid min-w-0 gap-1.5 rounded-xl bg-surface-subtle p-3 text-sm font-bold text-text-secondary ring-1 ring-border-soft/45">
      {label}
      <input className="form-field__input--nova h-11 w-full rounded-xl border border-border-soft/60 bg-surface-card px-3 text-sm font-medium text-text-primary placeholder:text-text-muted outline-none transition duration-fast focus:border-primary/50 focus:ring-2 focus:ring-primary/20" placeholder={placeholder} type={type} defaultValue={defaultValue} />
    </label>
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

function statusTone(statusKey: string): StatusTone {
  if (statusKey === 'won' || statusKey === 'contract' || statusKey === 'onTime') return 'success';
  if (statusKey === 'followUp' || statusKey === 'sample' || statusKey === 'late') return 'warning';
  if (statusKey === 'leftEarly') return 'danger';
  if (statusKey === 'newLead' || statusKey === 'remote') return 'info';
  return 'neutral';
}

function unitLabel(unit: Product['unit'], t: ReturnType<typeof useTranslation>['t']) {
  if (unit === 'm') return t('common.meters');
  if (unit === 'kg') return t('common.kg');
  return t('common.pcs');
}

function readObjects<T>(t: ReturnType<typeof useTranslation>['t'], key: string): T[] {
  return t(key, { returnObjects: true }) as T[];
}

export default App;
