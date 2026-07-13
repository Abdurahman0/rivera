import { forwardRef, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
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
  DashboardDateRange,
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
  StaffMember,
  StatusTone,
  StockMovement,
} from '../types/crm';
import {
  apiErrorMessage,
  calculateInventory,
  formatDisplayDate,
  getPageFromPath,
  hexToRgba,
  optionLabel,
  orderStatusTone,
  statusLabel,
  statusTone,
  trimTrailingZeros,
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
import { useDialog } from '../components/DialogProvider';
import { useToast } from '../components/ToastProvider';
import { Dropdown, DatePicker } from '../components/FormControls';
import { actions, api, ApiError, hasSession, login, logout, onSessionExpired, resources } from '../api/client';
import { EMPTY_DATA, loadAppData, type AppData } from '../api/data';
import type { ApiCurrentUser } from '../api/types';
import { PermissionsProvider } from '../components/PermissionsProvider';
import { canViewNavPage } from '../lib/permissions';
import { BUILT_IN_CLIENT_STATUSES, loadCustomClientStatuses } from '../utils/clientStatuses';
import { CATEGORY_COLOR_OPTIONS, CATEGORY_COLOR_PALETTE } from '../utils/categoryColors';

const DashboardPage = lazy(() => import('../pages/CrmPages').then(module => ({ default: module.DashboardPage })));
const ClientsPage = lazy(() => import('../pages/CrmPages').then(module => ({ default: module.ClientsPage })));
const OrdersPage = lazy(() => import('../pages/CrmPages').then(module => ({ default: module.OrdersPage })));
const ProductionPage = lazy(() => import('../pages/CrmPages').then(module => ({ default: module.ProductionPage })));
const MaterialsPage = lazy(() => import('../pages/CrmPages').then(module => ({ default: module.MaterialsPage })));
const StaffPage = lazy(() => import('../pages/CrmPages').then(module => ({ default: module.StaffPage })));
const ProductsPage = lazy(() => import('../pages/CrmPages').then(module => ({ default: module.ProductsPage })));
const WarehousePage = lazy(() => import('../pages/CrmPages').then(module => ({ default: module.WarehousePage })));
const FinancePage = lazy(() => import('../pages/CrmPages').then(module => ({ default: module.FinancePage })));
const ApprovalsPage = lazy(() => import('../pages/CrmPages').then(module => ({ default: module.ApprovalsPage })));
const SystemPage = lazy(() => import('../pages/BackendPages').then(module => ({ default: module.SystemPage })));
const AttendanceKioskPage = lazy(() => import('../pages/BackendPages').then(module => ({ default: module.AttendanceKioskPage })));

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

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isWithinDateRange(value: string | undefined, range: DashboardDateRange | null) {
  if (!range) return true;
  if (!value) return false;
  const date = value.slice(0, 10);
  return date >= range.startDate && date <= range.endDate;
}

function userInitials(user: ApiCurrentUser | null) {
  const name = user?.full_name || user?.username || '';
  const initials = name.trim().split(/\s+/).map(word => word[0]).slice(0, 2).join('').toUpperCase();
  return initials || '?';
}

/** Profile summary block reused inline in the mobile sidebar (always expanded there,
 *  since it already sits inside a slide-out overlay — a second popover would nest awkwardly). */
function ProfileSummary({ user }: { user: ApiCurrentUser | null }) {
  const { t } = useTranslation();
  const name = user?.full_name || user?.username || '—';
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-card/70 p-3 ring-1 ring-border-soft/40">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-sm font-extrabold text-primary">{userInitials(user)}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold text-text-primary">{name}</p>
        <p className="truncate text-xs text-text-muted">{user?.email || user?.username || ''}</p>
      </div>
      {user?.is_superadmin ? (
        <span className="shrink-0 rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">{t('profile.superadmin')}</span>
      ) : null}
    </div>
  );
}

/** Desktop header's profile dropdown — replaces the old bare logout icon with an avatar
 *  that opens to show who's signed in, plus logout inside instead of alongside it. */
function ProfileMenu({ user, onLogout }: { user: ApiCurrentUser | null; onLogout: () => void }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const name = user?.full_name || user?.username || '—';

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

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-surface-card pl-2 pr-3 text-sm font-bold text-text-primary shadow-sm ring-1 ring-border-soft/45 transition hover:bg-primary/10"
        onClick={() => setIsOpen(current => !current)}
        aria-label={t('profile.menuLabel')}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-xs font-extrabold text-primary">{userInitials(user)}</span>
        <span className="hidden max-w-[130px] truncate min-[1180px]:inline">{name}</span>
      </button>
      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-2xl border border-border-soft/60 bg-surface-card p-2 shadow-[0_24px_55px_-30px_rgba(15,23,42,0.58)] backdrop-blur-xl">
          <div className="flex items-center gap-3 rounded-xl p-2.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-sm font-extrabold text-primary">{userInitials(user)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-text-primary">{name}</p>
              <p className="truncate text-xs text-text-muted">{user?.email || user?.username || ''}</p>
            </div>
          </div>
          {user?.is_superadmin ? (
            <span className="mx-2.5 mb-1 mt-0.5 inline-flex items-center rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary">{t('profile.superadmin')}</span>
          ) : null}
          <div className="my-1.5 border-t border-border-soft/40" />
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-sm font-bold text-danger transition hover:bg-danger-bg"
            onClick={() => { setIsOpen(false); onLogout(); }}
          >
            <FiLogOut className="h-4 w-4" />
            {t('common.logout')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function App() {
  const { t, i18n } = useTranslation();
  const { alert, prompt } = useDialog();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(hasSession);
  const [activePage, setActivePage] = useState<PageId>(getPageFromLocation);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeDesign, setActiveDesign] = useState<DesignVariant>(getStoredDesignVariant);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(getInitialTheme);
  /** Circular reveal from the click point, via the View Transitions API. Falls back to a
   *  plain instant swap when the browser doesn't support it or the user prefers less motion. */
  const handleThemeToggle = useCallback((event?: { clientX?: number; clientY?: number }) => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startViewTransition = document.startViewTransition?.bind(document);
    if (prefersReducedMotion || !startViewTransition || typeof event?.clientX !== 'number') {
      setThemeMode(next);
      return;
    }
    const x = event.clientX;
    const y = event.clientY ?? 0;
    const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    document.documentElement.style.setProperty('--theme-toggle-x', `${x}px`);
    document.documentElement.style.setProperty('--theme-toggle-y', `${y}px`);
    document.documentElement.style.setProperty('--theme-toggle-radius', `${endRadius}px`);
    startViewTransition(() => {
      flushSync(() => setThemeMode(next));
    });
  }, [themeMode]);
  const [backgroundAccent, setBackgroundAccent] = useState(initAccentOnLoad);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ModalState | null>(null);
  // Client to auto-open on the clients page after cross-page navigation (e.g. clicking a client name on Buyurtmalar).
  const [pendingClientId, setPendingClientId] = useState<string | null>(null);
  const [appData, setAppData] = useState<AppData>(EMPTY_DATA);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [currentUser, setCurrentUser] = useState<ApiCurrentUser | null>(null);
  // No range = all time; the user opts into a period via the dashboard's date filter.
  const [dashboardDateRange, setDashboardDateRange] = useState<DashboardDateRange | null>(null);
  const dataLoadId = useRef(0);
  // Tracks whether this pageview ever had a genuinely working session, so a token
  // that's already dead on first load redirects to login silently instead of
  // announcing a "session expired" the user never experienced.
  const hadActiveSessionRef = useRef(false);
  const { clients, staff, orders, categories: productCategories, products, categoryAnalytics, stockIn, stockOut, revenueEntries, expenseEntries, materials: rawMaterials, pieceworkRecords, productionBatches, attendanceLog, approvals, operationTypeOptions, finishedVariants } = appData;

  const refreshData = useCallback(async (page: PageId = activePage) => {
    if (!isAuthenticated) return;
    const requestId = dataLoadId.current + 1;
    dataLoadId.current = requestId;
    setIsLoadingData(true);
    try {
      const nextData = await loadAppData(page, dashboardDateRange);
      if (requestId === dataLoadId.current) {
        setAppData(nextData);
        hadActiveSessionRef.current = true;
      }
    } catch (error) {
      if (requestId === dataLoadId.current && !(error instanceof ApiError && error.status === 401)) {
        toast(apiErrorMessage(error, t), 'danger');
      }
    } finally {
      if (requestId === dataLoadId.current) {
        setIsLoadingData(false);
      }
    }
  }, [activePage, isAuthenticated, t, toast, dashboardDateRange]);

  useEffect(() => {
    void refreshData(activePage);
  }, [activePage, refreshData]);

  useEffect(() => onSessionExpired(() => {
    dataLoadId.current += 1;
    setAppData(EMPTY_DATA);
    setIsAuthenticated(false);
    if (hadActiveSessionRef.current) {
      toast(t('auth.sessionExpired'), 'danger');
    }
    hadActiveSessionRef.current = false;
  }), [t, toast]);

  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentUser(null);
      return;
    }
    // Re-checks on every navigation, not just on login, so a session that died
    // server-side (expired/blacklisted token) is caught the moment the user
    // clicks anywhere instead of only on the next data-fetching action.
    void actions.authMe<ApiCurrentUser>().then(user => { hadActiveSessionRef.current = true; setCurrentUser(user); }).catch(() => setCurrentUser(null));
  }, [isAuthenticated, activePage]);

  useEffect(() => {
    if (!isAuthenticated) return;
    // Safety net for tabs left open and idle: periodically, and whenever the tab
    // regains focus, re-validate the session even without user navigation.
    const revalidate = () => { void actions.authMe<ApiCurrentUser>().catch(() => {}); };
    const intervalId = window.setInterval(revalidate, 5 * 60 * 1000);
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') revalidate(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!currentUser || canViewNavPage(currentUser, activePage)) return;
    const fallback = navItems.find(item => canViewNavPage(currentUser, item.id));
    if (fallback) navigate(fallback.id);
  }, [currentUser, activePage]);

  const money = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ', {
        maximumFractionDigits: 0,
      }),
    [i18n.language],
  );

  const dashboardClients = clients.filter(client => isWithinDateRange(String(client.api?.created_at ?? client.lastContact), dashboardDateRange));
  const dashboardOrders = orders.filter(order => isWithinDateRange(order.orderDate, dashboardDateRange));
  const revenueData = (appData.revenueSeries?.points ?? []).map(point => {
    const [year, month, day] = point.period.split('-').map(Number);
    const monthName = t(`common.months.${month - 1}`, { defaultValue: String(month) });
    return {
      month: appData.revenueSeries?.granularity === 'day' ? `${day} ${monthName}` : `${monthName} ${year}`,
      revenue: Number(point.revenue) || 0,
      orders: point.orders,
    };
  });

  const totalStock = appData.summary?.warehouse.finished_goods_total_units ?? products.reduce((sum, product) => sum + product.stock, 0);
  const lowStockCount = appData.summary?.warehouse.low_stock_materials_count ?? products.filter(product => product.stock <= product.minStock).length;
  const pipelineValue = dashboardOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const newClientsInPeriod = appData.summary?.new_in_period ?? dashboardClients.length;
  const ordersInPeriod = dashboardOrders.length;
  const onDutyCount = staff.filter(member => member.statusKey !== 'leftEarly').length;
  const priorityClients = appData.topClientIds.map(id => clients.find(client => String(client.id) === id)).filter((client): client is Client => Boolean(client));
  const activeMeta = navItems.find(item => item.id === activePage) ?? navItems[0];
  const visibleNavItems = currentUser ? navItems.filter(item => canViewNavPage(currentUser, item.id)) : navItems;

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
    const isKioskPath = window.location.pathname.replace(/\/+$/, '') === '/attendance-kiosk';

    if (!isAuthenticated && !isLoginPath && !isKioskPath) {
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

  const entityResource: Record<EntityKind, string> = {
    client: resources.clients,
    staff: resources.employees,
    product: resources.products,
    category: resources.productCategories,
    order: resources.clientOrders,
    material: resources.materials,
    batch: resources.productionBatches,
    payment: resources.clientPayments,
    stockMovement: resources.materialTransactions,
  };

  async function saveEntity(target: ModalState, payload: Record<string, unknown>) {
    const cleanPayload = { ...payload };
    if (target.kind === 'product' && !cleanPayload.category) cleanPayload.category = null;
    if (target.kind === 'staff' && !cleanPayload.daily_rate) cleanPayload.daily_rate = null;
    if ((target.kind === 'order' || target.kind === 'payment') && !cleanPayload.exchange_rate) cleanPayload.exchange_rate = null;
    if (target.kind === 'order' && !cleanPayload.due_date) cleanPayload.due_date = null;
    if (target.kind === 'stockMovement' && !cleanPayload.related_production_batch) cleanPayload.related_production_batch = null;
    if (target.mode === 'edit' && target.item) {
      await api.update(entityResource[target.kind], target.item.id, cleanPayload);
    } else if (target.kind === 'order') {
      // The create form picks the first order line (product + qty) inline; the item is
      // created right after the order so the backend computes the total from it.
      const productId = String(cleanPayload.product ?? '');
      const quantity = Number(cleanPayload.quantity ?? 0);
      delete cleanPayload.product;
      delete cleanPayload.quantity;
      const createdOrder = await api.create<{ id: string }>(entityResource.order, cleanPayload);
      if (productId && quantity > 0) {
        const product = products.find(row => String(row.id) === productId);
        await api.create(resources.clientOrderItems, {
          order: createdOrder.id,
          product: productId,
          quantity,
          unit_price: String(product?.price ?? 0),
        });
      }
    } else {
      await api.create(entityResource[target.kind], cleanPayload);
    }
    await refreshData();
  }

  async function deleteEntity(target: ModalState) {
    if (!target.item) return;
    await api.remove(entityResource[target.kind], target.item.id);
    await refreshData();
  }

  if (typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === '/attendance-kiosk') {
    return <Suspense fallback={<div className="grid min-h-screen place-items-center">Loading…</div>}><AttendanceKioskPage /></Suspense>;
  }

  if (!isAuthenticated) {
    return (
      <LoginPage
        activeDesign={activeDesign}
        onDesignChange={handleDesignChange}
        onLanguageChange={handleLanguageChange}
        onLogin={async (username, password) => {
          await login(username, password);
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
    <PermissionsProvider user={currentUser}>
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
            {visibleNavItems.map(item => {
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
              <button className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-text-secondary transition hover:bg-primary/10 hover:text-text-primary" onClick={handleThemeToggle}>
                {themeMode === 'dark' ? <FiMoon className="h-4 w-4" /> : <FiSun className="h-4 w-4" />}
                {t('theme.toggle')}
              </button>
              <button className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-text-secondary transition hover:bg-primary/10 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void refreshData()} disabled={isLoadingData}>
                <FiRefreshCcw className={['h-4 w-4', isLoadingData ? 'animate-spin' : ''].join(' ')} />
                {t('common.refresh')}
              </button>
              <button className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-text-secondary transition hover:bg-primary/10 hover:text-text-primary" onClick={() => void alert(t('common.noNotifications'))}>
                <FiBell className="h-4 w-4" />
                {t('common.notifications')}
              </button>
            </div>
            <ProfileSummary user={currentUser} />
            <button className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-danger transition hover:bg-danger-bg" onClick={() => { dataLoadId.current += 1; void logout(); setAppData(EMPTY_DATA); setIsAuthenticated(false); }}>
              <FiLogOut className="h-4 w-4" />
              {t('common.logout')}
            </button>
          </section>
        </div>

        <div className="app-card--nova mt-4 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-text-muted">
            {t('dashboard.metrics.pipeline')}
          </p>
          <p className="mt-2 text-2xl font-extrabold text-text-primary">{formatMoney(pipelineValue)}</p>
          <p className="mt-1 text-sm text-text-secondary">{t('dashboard.metrics.pipelineCaption', { count: ordersInPeriod })}</p>
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
            <IconButton label={t('theme.toggle')} onClick={handleThemeToggle}>
              {themeMode === 'dark' ? <FiMoon /> : <FiSun />}
            </IconButton>
            <IconButton label={t('common.refresh')} onClick={() => void refreshData()} disabled={isLoadingData}><FiRefreshCcw className={isLoadingData ? 'animate-spin' : ''} /></IconButton>
            <IconButton label={t('common.notifications')} onClick={() => void alert(t('common.noNotifications'))}><FiBell /></IconButton>
            <ProfileMenu user={currentUser} onLogout={() => { dataLoadId.current += 1; void logout(); setAppData(EMPTY_DATA); setIsAuthenticated(false); }} />
          </div>
          {isLoadingData ? (
            <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden" aria-hidden="true">
              <div className="h-full w-1/3 rounded-full bg-primary animate-loadingBar" />
            </div>
          ) : null}
        </header>

        <main className="relative flex-1 overflow-y-auto px-3 pb-5 pt-3 min-[640px]:px-4 min-[960px]:px-7 min-[960px]:pb-8">
          <div className="mx-auto w-full max-w-page">
            <Suspense fallback={<div className="app-card--nova p-5 text-sm font-semibold text-text-secondary">{t('common.loading')}</div>}>
            {activePage === 'dashboard' && (
              <DashboardPage
                clients={dashboardClients}
                priorityClients={priorityClients}
                products={products}
                materials={rawMaterials}
                staff={staff}
                categoryAnalytics={categoryAnalytics}
                revenueData={revenueData}
                totalStock={totalStock}
                lowStockCount={lowStockCount}
                pipelineValue={pipelineValue}
                newClientsInPeriod={newClientsInPeriod}
                ordersInPeriod={ordersInPeriod}
                onDutyCount={onDutyCount}
                staffTotal={staff.length}
                formatMoney={formatMoney}
                openModal={setModal}
                dateRange={dashboardDateRange}
                onDateRangeChange={setDashboardDateRange}
              />
            )}
            {activePage === 'clients' && (
              <ClientsPage clients={clients} formatMoney={formatMoney} openModal={setModal} openDelete={setPendingDelete} openClientId={pendingClientId} onOpenClientConsumed={() => setPendingClientId(null)} />
            )}
            {activePage === 'orders' && (
              <OrdersPage orders={orders} formatMoney={formatMoney} openModal={setModal} openDelete={setPendingDelete} onOpenClient={clientId => { setPendingClientId(clientId); navigate('clients'); }} onDataChanged={() => void refreshData()} />
            )}
            {activePage === 'production' && (
              <ProductionPage
                batches={productionBatches}
                products={products}
                materials={rawMaterials}
                formatMoney={formatMoney}
                onCreate={() => setModal({ kind: 'batch', mode: 'create' })}
                openModal={setModal}
                openDelete={setPendingDelete}
                onDeliver={async id => {
                  try {
                    const quantityText = await prompt({ title: t('dialog.deliverQuantityTitle'), message: t('dialog.deliverQuantityMessage'), placeholder: t('dialog.deliverQuantityPlaceholder'), inputType: 'number', min: 1, required: true });
                    if (!quantityText) return;
                    const quantity = Number(quantityText);
                    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(t('dialog.deliverInvalidQuantity'));
                    const result = await actions.deliverBatch<{ requested_quantity: number; delivered_quantity: number; capped_by_material: boolean }>(String(id), { quantity, date: new Date().toISOString().slice(0, 10) });
                    await refreshData();
                    if (result.capped_by_material) {
                      toast(t('dialog.deliverCappedByMaterial', { requested: result.requested_quantity, delivered: result.delivered_quantity }), 'info');
                    } else {
                      toast(t('dialog.deliverSuccess'), 'success');
                    }
                  } catch (error) {
                    toast(apiErrorMessage(error, t, 'dialog.deliverFailed'), 'danger');
                  }
                }}
              />
            )}
            {activePage === 'materials' && (
              <MaterialsPage materials={rawMaterials} formatMoney={formatMoney} onCreate={() => setModal({ kind: 'material', mode: 'create' })} openModal={setModal} openDelete={setPendingDelete} />
            )}
            {activePage === 'staff' && (
              <StaffPage staff={staff} attendanceLog={attendanceLog} pieceworkRecords={pieceworkRecords} formatMoney={formatMoney} openModal={setModal} openDelete={setPendingDelete} />
            )}
            {activePage === 'products' && (
              <ProductsPage
                products={products}
                categoryAnalytics={categoryAnalytics}
                categories={productCategories}
                materials={rawMaterials}
                totalStock={totalStock}
                lowStockCount={lowStockCount}
                formatMoney={formatMoney}
                openModal={setModal}
                openDelete={setPendingDelete}
                onDataChanged={() => void refreshData()}
              />
            )}
            {activePage === 'warehouse' && (
              <WarehousePage
                products={products}
                stockIn={stockIn}
                stockOut={stockOut}
                finishedVariants={finishedVariants}
                totalStock={totalStock}
                lowStockCount={lowStockCount}
                formatMoney={formatMoney}
                onCreate={() => setModal({ kind: 'stockMovement', mode: 'create' })}
              />
            )}
            {activePage === 'finance' && (
              <FinancePage revenueEntries={revenueEntries} expenseEntries={expenseEntries} formatMoney={formatMoney} onCreate={() => setModal({ kind: 'payment', mode: 'create' })} />
            )}
            {activePage === 'approvals' && (
              <ApprovalsPage
                approvals={approvals}
                materials={rawMaterials}
                products={products}
                onApprove={async id => {
                  try { await actions.approve(id); await refreshData(); }
                  catch (error) {
                    toast(apiErrorMessage(error, t, 'dialog.approveFailed'), 'danger');
                  }
                }}
                onReject={async (id, reason) => {
                  try { await actions.reject(id, reason); await refreshData(); }
                  catch (error) {
                    toast(apiErrorMessage(error, t, 'dialog.rejectFailed'), 'danger');
                  }
                }}
              />
            )}
            {activePage === 'system' && <SystemPage />}
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
          clients={clients}
          products={products}
          materials={rawMaterials}
          batches={productionBatches}
          onSave={saveEntity}
          onEdit={(nextModal) => setModal(nextModal)}
          onDelete={(nextModal) => setPendingDelete(nextModal)}
        />
      ) : null}
      {pendingDelete ? (
        <DeleteConfirmDialog
          modal={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void deleteEntity(pendingDelete)
              .then(() => { setPendingDelete(null); setModal(null); })
              .catch(error => {
                toast(apiErrorMessage(error, t, 'dialog.deleteFailed'), 'danger');
                setPendingDelete(null);
              });
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
    </PermissionsProvider>
  );
}

function LoginPage({ activeDesign, onDesignChange, onLanguageChange, onLogin, formatMoney }: {
  activeDesign: DesignVariant;
  onDesignChange: (design: DesignVariant) => void;
  onLanguageChange: (language: SupportedLanguage) => void;
  onLogin: (username: string, password: string) => Promise<void>;
  formatMoney: (value: number) => string;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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
            onSubmit={async (event) => {
              event.preventDefault();
              setIsSubmitting(true);
              try {
                await onLogin(username.trim(), password);
              } catch (error) {
                toast(apiErrorMessage(error, t, 'auth.loginFailed'), 'danger');
              } finally {
                setIsSubmitting(false);
              }
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
                {t('common.username')}
                <span className="relative">
                  <FiUser className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: designStyles.fieldIcon }} />
                  <input
                    className="h-12 w-full rounded-2xl border pl-10 pr-3 text-sm font-medium outline-none transition focus:ring-4 focus:ring-primary/15"
                    placeholder={t('login.emailPlaceholder')}
                    style={{ background: designStyles.fieldBackground, borderColor: designStyles.fieldBorder, color: designStyles.inputText }}
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={event => setUsername(event.target.value)}
                    required
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
                    autoComplete="current-password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    required
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
              className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white transition"
              style={{ background: designStyles.ctaBackground, boxShadow: designStyles.ctaShadow }}
              disabled={isSubmitting}
            >
              {isSubmitting ? t('common.loading') : t('login.submit')}
              <FiArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-4 text-center text-xs leading-5" style={{ color: designStyles.footerColor }}>
              {t('login.hint')}
            </p>
            <a href="/attendance-kiosk" className="mt-3 block text-center text-xs font-bold text-primary">Attendance kiosk</a>
          </form>
        </div>
      </section>
    </main>
  );
}

function EntityModal({ modal, onClose, formatMoney, categories, clients, products, materials, batches, onSave, onEdit, onDelete }: { modal: ModalState; onClose: () => void; formatMoney: (value: number) => string; categories: ProductCategory[]; clients: Client[]; products: Product[]; materials: Material[]; batches: ProductionBatch[]; onSave: (modal: ModalState, payload: Record<string, unknown>) => Promise<void>; onEdit: (modal: ModalState) => void; onDelete: (modal: ModalState) => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
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
  const operationalTitles: Partial<Record<EntityKind, string>> = {
    material: t('entityModal.titles.material'), batch: t('entityModal.titles.batch'),
    payment: t('entityModal.titles.payment'), stockMovement: t('entityModal.titles.stockMovement'),
  };
  const operationalModePrefix = modal.mode === 'edit' ? t('entityModal.edit') : modal.mode === 'view' ? t('common.view') : t('entityModal.create');
  const title = operationalTitles[modal.kind] ? `${operationalModePrefix} ${operationalTitles[modal.kind]}` : t(`${namespace}.modal.${modal.mode}Title`);
  const summary = t(`${namespace}.modal.summary`);
  const nextStep = t(`${namespace}.modal.nextStep`);
  const formRef = useRef<HTMLFormElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  return (
    <div
      className="client-drawer-overlay--nova fixed inset-0 z-[150] flex justify-end bg-background-overlay/72 backdrop-blur-[3px]"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="client-drawer-panel--nova h-full w-full max-w-[780px] overflow-y-auto bg-background-subtle p-4 shadow-xl ring-1 ring-border-soft/50 min-[641px]:p-5"
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
        ) : (
          <ApiEntityForm ref={formRef} modal={modal} categories={categories} clients={clients} products={products} materials={materials} batches={batches} />
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
            <button disabled={isSaving} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-accent disabled:opacity-60" onClick={() => {
              if (!formRef.current?.reportValidity()) return;
              const missingHidden = Array.from(formRef.current.querySelectorAll<HTMLInputElement>('input[type="hidden"][required]')).find(el => !el.value);
              if (missingHidden) {
                toast(t('admin.ui.requiredFieldsMissing'), 'danger');
                return;
              }
              const payload = Object.fromEntries(new FormData(formRef.current).entries());
              setIsSaving(true);
              void onSave(modal, payload)
                .then(onClose)
                .catch(error => {
                  toast(apiErrorMessage(error, t), 'danger');
                })
                .finally(() => setIsSaving(false));
            }}>
              {isSaving ? t('common.loading') : t('common.save')}
            </button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

/** First order line inside the order create form: pick product + qty, the total previews
 *  live from the product's stored per-piece price. Isolated in its own component so typing
 *  here doesn't re-render (and reset) the surrounding uncontrolled form fields. */
function OrderFirstItemFields({ products, inputClass }: { products: Product[]; inputClass: string }) {
  const { t } = useTranslation();
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('');
  const price = products.find(row => String(row.id) === productId)?.price ?? 0;
  const total = price * (Number(qty) || 0);
  return (
    <>
      <label className="grid gap-1.5 text-sm font-bold text-text-secondary">
        {t('admin.fields.product')}
        <Dropdown name="product" required value={productId} onChange={setProductId} options={products.map(row => ({ value: String(row.id), label: row.name }))} />
      </label>
      <label className="grid gap-1.5 text-sm font-bold text-text-secondary">
        {t('admin.fields.quantity')}
        <input className={inputClass} name="quantity" type="number" min="1" required value={qty} onChange={event => setQty(event.target.value)} />
      </label>
      {productId ? (
        <div className="rounded-xl bg-primary/6 px-4 py-3 text-sm font-semibold text-text-secondary ring-1 ring-primary/15 sm:col-span-2">
          {t('admin.fields.unitPrice')}: <span className="font-extrabold text-text-primary">{price.toLocaleString()} so'm</span>
          <span className="mx-2 opacity-50">·</span>
          {t('admin.fields.totalAmount')}: <span className="font-extrabold text-primary">{total.toLocaleString()} so'm</span>
        </div>
      ) : null}
    </>
  );
}

/** Color chooser matching the client-status modal: a live round swatch next to a dropdown of named palette colors. */
function CategoryColorField({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  const { t } = useTranslation();
  const [color, setColor] = useState(defaultValue);
  return (
    <label className="grid gap-1.5 text-sm font-bold text-text-secondary">
      {label}
      <div className="flex items-center gap-3">
        <span className="h-9 w-9 shrink-0 rounded-full ring-2 ring-border-soft/50" style={{ backgroundColor: color }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <Dropdown
            name={name}
            value={color}
            onChange={setColor}
            options={CATEGORY_COLOR_OPTIONS.map(option => ({ value: option.value, label: t(`products.categoryColors.${option.nameKey}`) }))}
          />
        </div>
      </div>
    </label>
  );
}

const ApiEntityForm = forwardRef<HTMLFormElement, { modal: ModalState; categories: ProductCategory[]; clients: Client[]; products: Product[]; materials: Material[]; batches: ProductionBatch[] }>(
  function ApiEntityForm({ modal, categories, clients, products, materials, batches }, ref) {
    const { t } = useTranslation();
    const f = (key: string) => t(`admin.fields.${key}`);
    const raw = (modal.item?.api || {}) as Record<string, unknown>;
    const value = (name: string, fallback = '') => String(raw[name] ?? fallback);
    const today = new Date().toISOString().slice(0, 10);
    const [orderCurrency, setOrderCurrency] = useState(value('currency', 'UZS') || 'UZS');
    useEffect(() => {
      if (modal.kind === 'order') setOrderCurrency(value('currency', 'UZS') || 'UZS');
    }, [modal.item?.id, modal.kind, raw.currency]);
    const clientStatusOptions = useMemo(() => {
      const custom = loadCustomClientStatuses();
      const keys = Array.from(new Set([...BUILT_IN_CLIENT_STATUSES, ...custom.map(status => status.key)]));
      return keys.map(value => {
        const match = custom.find(status => status.key === value);
        return { value, label: match ? match.label : t(`statuses.${value}`) };
      });
    }, [modal.kind, modal.item?.id, t]);
    const inputClass = 'h-11 w-full rounded-xl border border-border-soft/60 bg-surface-card px-3 text-sm font-medium text-text-primary outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20';
    const FieldInput = ({ name, label, type = 'text', required = false, fallback = '', step }: { name: string; label: string; type?: string; required?: boolean; fallback?: string; step?: string }) => {
      // Backend decimals come as "70000.00" — trim pointless trailing zeros in number inputs.
      const raw = value(name, fallback);
      const defaultValue = type === 'number' ? trimTrailingZeros(raw) : raw;
      return (
        <label className="grid gap-1.5 text-sm font-bold text-text-secondary">
          {label}
          {type === 'date' ? <DatePicker name={name} required={required} defaultValue={defaultValue} /> : <input className={inputClass} name={name} type={type} required={required} defaultValue={defaultValue} step={step} />}
        </label>
      );
    };
    const SelectInput = ({ name, label, options, required = false, fallback = '', selectedValue, onChange }: { name: string; label: string; options: Array<{ value: string; label: string }>; required?: boolean; fallback?: string; selectedValue?: string; onChange?: (value: string) => void }) => (
      <label className="grid gap-1.5 text-sm font-bold text-text-secondary">
        {label}
        <Dropdown name={name} required={required} defaultValue={value(name, fallback)} value={selectedValue} onChange={onChange} options={options} />
      </label>
    );
    const TextArea = ({ name, label }: { name: string; label: string }) => (
      <label className="grid gap-1.5 text-sm font-bold text-text-secondary sm:col-span-2">
        {label}
        <textarea className={`${inputClass} min-h-24 py-3`} name={name} defaultValue={value(name)} />
      </label>
    );

    return (
      <form ref={ref} className="rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/40">
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          {modal.kind === 'client' ? <>
            <FieldInput name="full_name" label={f('fullName')} fallback={(modal.item as Client | undefined)?.name} required />
            <FieldInput name="phone" label={f('phone')} fallback={(modal.item as Client | undefined)?.phone} />
            <SelectInput name="status" label={f('status')} required fallback={(modal.item as Client | undefined)?.statusKey || 'new'} options={clientStatusOptions} />
            <TextArea name="address" label={f('address')} />
            <TextArea name="note" label={f('note')} />
          </> : null}
          {modal.kind === 'category' ? <>
            <FieldInput name="name" label={f('category')} fallback={(modal.item as ProductCategory | undefined)?.name} required />
            <CategoryColorField name="color" label={t('products.categoryColumns.color')} defaultValue={(modal.item as ProductCategory | undefined)?.color || CATEGORY_COLOR_PALETTE[0]} />
          </> : null}
          {modal.kind === 'product' ? <>
            <FieldInput name="name" label={f('name')} fallback={(modal.item as Product | undefined)?.name} required />
            <FieldInput name="code" label={f('code')} fallback={(modal.item as Product | undefined)?.sku} />
            <SelectInput name="category" label={f('category')} options={categories.map(row => ({ value: String(row.id), label: row.name }))} />
            <FieldInput name="size_range" label={f('sizeRange')} />
            <FieldInput name="material_type" label={f('materialType')} />
            <FieldInput name="color" label={f('color')} fallback={(modal.item as Product | undefined)?.color} />
            <FieldInput name="unit_price_with_tax_uzs" label={f('priceWithTaxUzs')} type="number" step="0.01" fallback="0" />
            <FieldInput name="unit_price_without_tax_uzs" label={f('priceWithoutTaxUzs')} type="number" step="0.01" fallback="0" />
            <FieldInput name="unit_price_with_tax_usd" label={f('priceWithTaxUsd')} type="number" step="0.01" fallback="0" />
            <FieldInput name="unit_price_without_tax_usd" label={f('priceWithoutTaxUsd')} type="number" step="0.01" fallback="0" />
            <FieldInput name="vat_percent" label={f('vatPercent')} type="number" step="0.01" fallback="12" />
          </> : null}
          {modal.kind === 'staff' ? <>
            <FieldInput name="full_name" label={f('fullName')} fallback={(modal.item as StaffMember | undefined)?.name} required />
            <FieldInput name="employee_code" label={f('employeeCode')} required />
            <FieldInput name="phone" label={f('phone')} fallback={(modal.item as StaffMember | undefined)?.phone} />
            <SelectInput name="position" label={t('staff.columns.position')} required fallback="other" options={['seamstress', 'driver', 'guard', 'other'].map(value => ({ value, label: optionLabel(t, 'employeePosition', value) }))} />
            <SelectInput name="salary_type" label={f('salaryType')} required fallback="fixed_daily" options={['piece_rate', 'fixed_daily'].map(value => ({ value, label: optionLabel(t, 'salaryType', value) }))} />
            <FieldInput name="daily_rate" label={t('staff.columns.salary')} type="number" step="0.01" />
            <FieldInput name="hire_date" label={f('hireDate')} type="date" required fallback={today} />
            <SelectInput name="status" label={f('status')} required fallback="active" options={['active', 'inactive'].map(value => ({ value, label: optionLabel(t, 'employeeStatus', value) }))} />
            <TextArea name="address" label={f('address')} />
            <TextArea name="note" label={f('note')} />
          </> : null}
          {modal.kind === 'order' ? <>
            <SelectInput name="client" label={f('client')} required fallback={(modal.item as Order | undefined)?.clientId} options={clients.map(row => ({ value: String(row.id), label: row.name }))} />
            <FieldInput name="order_number" label={f('orderNumber')} required fallback={(modal.item as Order | undefined)?.orderId} />
            {modal.mode === 'create' ? <OrderFirstItemFields products={products} inputClass={inputClass} /> : null}
            <FieldInput name="order_date" label={f('orderDate')} type="date" required fallback={today} />
            <FieldInput name="due_date" label={f('dueDate')} type="date" />
            <SelectInput name="status" label={f('status')} required fallback="draft" options={['draft', 'confirmed', 'completed', 'cancelled'].map(value => ({ value, label: optionLabel(t, 'orderStatus', value) }))} />
            <SelectInput name="currency" label={f('currency')} required fallback="UZS" selectedValue={orderCurrency} onChange={setOrderCurrency} options={[{ value: 'UZS', label: 'UZS' }, { value: 'USD', label: 'USD' }]} />
            {orderCurrency === 'USD' ? <FieldInput name="exchange_rate" label={f('exchangeRate')} type="number" step="0.0001" /> : null}
            <TextArea name="note" label={f('note')} />
          </> : null}
          {modal.kind === 'material' ? <>
            <FieldInput name="name" label={f('name')} required />
            <FieldInput name="code" label={f('code')} />
            <SelectInput name="unit" label={f('unit')} required fallback="m" options={['m', 'piece', 'kg', 'linear_meter'].map(value => ({ value, label: optionLabel(t, 'materialUnit', value) }))} />
            <FieldInput name="unit_price" label={f('unitPrice')} type="number" step="0.01" fallback="0" />
            <FieldInput name="min_stock_level" label={f('minStockLevel')} type="number" step="0.0001" fallback="0" />
          </> : null}
          {modal.kind === 'batch' ? <>
            <SelectInput name="product" label={f('product')} required options={products.map(row => ({ value: String(row.id), label: row.name }))} />
            <FieldInput name="batch_number" label={f('batchNumber')} required />
            <FieldInput name="started_date" label={f('startedDate')} type="date" required fallback={today} />
            <FieldInput name="planned_quantity" label={f('planned')} type="number" required fallback="1" />
            <FieldInput name="delivered_to_warehouse" label={f('delivered')} type="number" fallback="0" />
            <TextArea name="note" label={f('note')} />
          </> : null}
          {modal.kind === 'payment' ? <>
            <SelectInput name="client" label={f('client')} required options={clients.map(row => ({ value: String(row.id), label: row.name }))} />
            <SelectInput name="payment_method" label={f('method')} required fallback="cash" options={['cash', 'card', 'bank_transfer', 'usd_cash'].map(value => ({ value, label: optionLabel(t, 'paymentMethod', value) }))} />
            <FieldInput name="amount" label={f('amount')} type="number" step="0.01" required />
            <SelectInput name="currency" label={f('currency')} required fallback="UZS" options={[{ value: 'UZS', label: 'UZS' }, { value: 'USD', label: 'USD' }]} />
            <FieldInput name="exchange_rate" label={f('exchangeRate')} type="number" step="0.0001" />
            <FieldInput name="payment_date" label={f('paymentDate')} type="date" required fallback={today} />
            <TextArea name="note" label={f('note')} />
          </> : null}
          {modal.kind === 'stockMovement' ? <>
            <SelectInput name="material" label={f('material')} required options={materials.map(row => ({ value: String(row.id), label: row.name }))} />
            <SelectInput name="transaction_type" label={f('type')} required fallback="in" options={['in', 'out_production', 'out_writeoff', 'defect'].map(value => ({ value, label: optionLabel(t, 'materialTxType', value) }))} />
            <FieldInput name="quantity" label={f('quantity')} type="number" step="0.0001" required />
            <FieldInput name="unit_price" label={f('unitPrice')} type="number" step="0.01" fallback="0" />
            <FieldInput name="date" label={f('date')} type="date" required fallback={today} />
            <SelectInput name="related_production_batch" label={f('batch')} options={batches.map(row => ({ value: String(row.id), label: row.orderId || row.product }))} />
            <TextArea name="note" label={f('note')} />
          </> : null}
        </div>
      </form>
    );
  },
);

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
            : modal.kind === 'material'
              ? (modal.item as Material | undefined)?.name
              : modal.kind === 'batch'
                ? (modal.item as ProductionBatch | undefined)?.orderId
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
            {t('customize.currentColor')}: <span className="font-bold text-text-primary">{t(`customize.presets.${BACKGROUND_COLOR_PRESETS.find(p => p.value === accent)?.key ?? 'indigo'}`)}</span>
            &nbsp;·&nbsp;{t('customize.usageHint')}
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
      { label: t('clients.columns.status'), value: statusLabel(t, item.statusKey) },
      { label: t('clients.columns.manager'), value: item.manager },
      { label: t('clients.columns.value'), value: formatMoney(item.value) },
      { label: t('clients.columns.lastContact'), value: formatDisplayDate(item.lastContact, t) },
    ];
  }

  if (modal.kind === 'staff') {
    const item = modal.item as StaffMember;
    return [
      { label: t('staff.columns.staff'), value: item.name },
      { label: t('staff.columns.position'), value: optionLabel(t, 'employeePosition', item.role) },
      { label: t('staff.columns.shift'), value: optionLabel(t, 'salaryType', item.shift) },
      { label: t('staff.columns.arrival'), value: item.arrival },
      { label: t('staff.columns.leaving'), value: item.leaving },
      { label: t('staff.columns.status'), value: statusLabel(t, item.statusKey) },
      { label: t('staff.columns.attendance'), value: `${item.attendance}%` },
    ];
  }

  if (modal.kind === 'category') {
    const item = modal.item as ProductCategory;
    const colorOption = CATEGORY_COLOR_OPTIONS.find(option => option.value === item.color);
    return [
      { label: t('products.categoryColumns.category'), value: item.name },
      { label: t('products.categoryColumns.color'), value: colorOption ? t(`products.categoryColors.${colorOption.nameKey}`) : item.color },
    ];
  }

  if (modal.kind === 'order') {
    const item = modal.item as Order;
    return [
      { label: t('orders.columns.orderId'), value: item.orderId },
      { label: t('orders.columns.client'), value: item.client },
      { label: t('orders.columns.orderDate'), value: formatDisplayDate(item.orderDate, t) },
      { label: t('orders.columns.dueDate'), value: formatDisplayDate(item.dueDate, t) },
      { label: t('orders.columns.total'), value: formatMoney(item.totalAmount) },
      { label: t('orders.columns.status'), value: statusLabel(t, item.statusKey) },
      { label: t('orders.form.notes'), value: item.notes },
    ];
  }

  if (modal.kind === 'material') {
    const item = modal.item as Material;
    return [
      { label: t('materials.columns.name'), value: item.name },
      { label: t('admin.fields.code'), value: item.sku },
      { label: t('materials.columns.stock'), value: `${item.stock.toLocaleString()} ${unitLabel(item.unit, t)}` },
      { label: t('materials.columns.price'), value: formatMoney(item.price) },
      { label: t('materials.columns.status'), value: statusLabel(t, item.statusKey) },
    ];
  }

  if (modal.kind === 'batch') {
    const item = modal.item as ProductionBatch;
    return [
      { label: t('production.batch.order'), value: item.orderId ?? '' },
      { label: t('admin.fields.product'), value: item.product },
      { label: t('production.stock.currentStock'), value: `${item.producedQty.toLocaleString()} ${unitLabel(item.unit, t)}` },
      { label: t('admin.fields.status'), value: optionLabel(t, 'productionStatus', item.shift) },
      { label: t('admin.fields.note'), value: item.notes },
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

export default App;
