import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiClock, FiDatabase, FiEdit2, FiEye, FiLock, FiPlus, FiUsers, FiX } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { actions, api, resources } from '../api/client';
import type { ApiRecord } from '../api/types';
import { ApiResourceManager, type ResourceConfig } from '../components/ApiResourceManager';
import { usePermissions } from '../components/PermissionsProvider';
import { useToast } from '../components/ToastProvider';
import { FaceCamera, type FaceCameraHandle } from '../components/FaceCamera';
import { systemConfigs } from '../data/resource-config';
import { apiErrorMessage } from '../utils/crm';
import { RESOURCE_BACKEND_PAGE } from '../lib/permissions';

// Trimmed to what the workshop actually operates: the five specialised security/stock/
// payroll/attendance/backup logs and the export log duplicated the general audit trail
// and are still reachable via the API, just not surfaced here.
const systemGroups = [
  { id: 'access', label: 'admin.page.systemGroups.access', icon: FiUsers, resources: ['users'] },
  { id: 'attendanceConfig', label: 'admin.resources.devices.title', icon: FiClock, resources: ['devices'] },
  { id: 'audit', label: 'admin.page.systemGroups.audit', icon: FiDatabase, resources: ['audit'] },
] as const;

function useViewableGroups(groups: ReadonlyArray<{ id: string; label: string; icon: typeof FiLock; resources: readonly string[] }>) {
  const { hasPermission } = usePermissions();
  return useMemo(
    () => groups
      .map(group => ({ ...group, resources: group.resources.filter(key => hasPermission(RESOURCE_BACKEND_PAGE[key], 'view')) }))
      .filter(group => group.resources.length > 0),
    [groups, hasPermission],
  );
}

function ResourceNavigation({ groups, activeGroup, selected, setActiveGroup, setSelected, configs }: {
  groups: ReadonlyArray<{ id: string; label: string; icon: typeof FiLock; resources: readonly string[] }>;
  activeGroup: string;
  selected: string;
  setActiveGroup: (value: string) => void;
  setSelected: (value: string) => void;
  configs: Record<string, { title: string }>;
}) {
  const { t } = useTranslation();
  const group = groups.find(item => item.id === activeGroup) || groups[0];
  return <div className="app-card--nova grid gap-4 p-4">
    <div className="flex flex-wrap gap-2">{groups.map(item => { const Icon = item.icon; return <button key={item.id} onClick={() => { setActiveGroup(item.id); setSelected(item.resources[0]); }} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${activeGroup === item.id ? 'bg-primary text-primary-foreground' : 'bg-surface-subtle text-text-secondary'}`}><Icon />{t(item.label)}</button>; })}</div>
    {group && group.resources.length > 1 ? <div className="flex flex-wrap gap-2">{group.resources.map(key => <button key={key} onClick={() => setSelected(key)} className={`rounded-xl px-3 py-2 text-xs font-bold ${selected === key ? 'bg-primary/10 text-primary ring-1 ring-primary/20' : 'bg-surface-subtle text-text-muted'}`}>{t(configs[key].title)}</button>)}</div> : null}
  </div>;
}

/** Pages a user can be granted access to; labels come from admin.options.page.*. */
const PERMISSION_PAGES = ['dashboard', 'clients', 'products', 'materials', 'inventory', 'production', 'employees', 'attendance', 'payroll', 'finance', 'approvals', 'audit', 'users'] as const;
type GrantLevel = 'view' | 'manage' | null;

/** Users + permissions in one place: the create/edit drawer carries a per-page
 *  view/manage checklist (superadmin-only — the backend enforces the same rule),
 *  and the view drawer shows what the user can currently access. */
function UsersManager() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user: me } = usePermissions();
  const isSuper = Boolean(me?.is_superadmin);
  const canManage = usePermissions().hasPermission('users', 'manage');
  const [users, setUsers] = useState<ApiRecord[]>([]);
  const [permRows, setPermRows] = useState<ApiRecord[]>([]);
  const [drawer, setDrawer] = useState<{ mode: 'create' | 'edit' | 'view'; user?: ApiRecord } | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextUsers, nextPerms] = await Promise.all([
        api.list<ApiRecord>(resources.users),
        api.list<ApiRecord>(resources.permissions),
      ]);
      setUsers(nextUsers);
      setPermRows(nextPerms);
    } catch (error) {
      toast(apiErrorMessage(error, t), 'danger');
    }
  }, [t, toast]);
  useEffect(() => { void load(); }, [load]);

  const activeLevels = useCallback((userId: unknown): Record<string, 'view' | 'manage'> => {
    const map: Record<string, 'view' | 'manage'> = {};
    permRows.filter(row => String(row.user) === String(userId) && row.is_active).forEach(row => {
      if (map[String(row.page)] !== 'manage') map[String(row.page)] = row.level as 'view' | 'manage';
    });
    return map;
  }, [permRows]);

  return (
    <div className="app-card--nova overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft/30 p-4">
        <p className="m-0 text-sm text-text-muted">{t('usersManager.hint')}</p>
        {canManage ? (
          <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:opacity-90" onClick={() => setDrawer({ mode: 'create' })}>
            <FiPlus className="h-4 w-4" /> {t('admin.ui.create')}
          </button>
        ) : null}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-soft/25 bg-surface-subtle text-left text-xs font-extrabold uppercase tracking-wide text-text-muted">
            <th className="px-4 py-3">{t('admin.fields.username')}</th>
            <th className="px-4 py-3">{t('admin.fields.email')}</th>
            <th className="px-4 py-3">{t('usersManager.role')}</th>
            <th className="px-4 py-3">{t('admin.fields.active')}</th>
            <th className="px-4 py-3 text-right">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map(row => (
            <tr key={String(row.id)} className="cursor-pointer border-b border-border-soft/15 transition hover:bg-surface-subtle/60" onClick={() => setDrawer({ mode: 'view', user: row })}>
              <td className="px-4 py-3">
                <span className="block font-bold text-text-primary">{String(row.full_name || row.username)}</span>
                <span className="block text-xs text-text-muted">@{String(row.username)}</span>
              </td>
              <td className="px-4 py-3 text-text-secondary">{String(row.email || row.phone || '—')}</td>
              <td className="px-4 py-3">
                {row.is_superadmin
                  ? <span className="rounded-pill bg-primary/10 px-2.5 py-0.5 text-[11px] font-extrabold text-primary">{t('usersManager.superadmin')}</span>
                  : <span className="rounded-pill bg-surface-subtle px-2.5 py-0.5 text-[11px] font-bold text-text-secondary ring-1 ring-border-soft/40">{t('usersManager.regular')}</span>}
              </td>
              <td className="px-4 py-3">{row.is_active ? t('admin.ui.yes') : t('admin.ui.no')}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1.5" onClick={event => event.stopPropagation()}>
                  <button className="rounded-lg bg-surface-subtle p-2 text-text-secondary transition hover:text-text-primary" title={t('common.view')} onClick={() => setDrawer({ mode: 'view', user: row })}><FiEye /></button>
                  {canManage ? <button className="rounded-lg bg-primary/10 p-2 text-primary" title={t('common.edit')} onClick={() => setDrawer({ mode: 'edit', user: row })}><FiEdit2 /></button> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 ? <div className="px-4 py-10 text-center text-sm text-text-muted">{t('admin.ui.noRecords')}</div> : null}
      {drawer ? createPortal(
        <UserDrawer
          mode={drawer.mode}
          user={drawer.user}
          isSuper={isSuper}
          permRows={permRows}
          activeLevels={drawer.user ? activeLevels(drawer.user.id) : {}}
          onClose={() => setDrawer(null)}
          onSaved={() => { setDrawer(null); void load(); }}
        />,
        document.body,
      ) : null}
    </div>
  );
}

function UserDrawer({ mode, user, isSuper, permRows, activeLevels, onClose, onSaved }: {
  mode: 'create' | 'edit' | 'view';
  user?: ApiRecord;
  isSuper: boolean;
  permRows: ApiRecord[];
  activeLevels: Record<string, 'view' | 'manage'>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [form, setForm] = useState(() => ({
    username: String(user?.username ?? ''),
    full_name: String(user?.full_name ?? ''),
    phone: String(user?.phone ?? ''),
    email: String(user?.email ?? ''),
    password: '',
    is_active: user ? Boolean(user.is_active) : true,
    is_superadmin: Boolean(user?.is_superadmin),
  }));
  const [grants, setGrants] = useState<Record<string, GrantLevel>>(() => ({ ...activeLevels }));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const readOnly = mode === 'view';
  const inputClass = 'h-11 w-full rounded-xl border border-border-soft bg-surface-card px-3 text-sm text-text-primary outline-none focus:border-primary/50 disabled:opacity-60';

  const setGrant = (page: string, level: GrantLevel) => setGrants(current => ({ ...current, [page]: level }));

  async function syncPermissions(userId: string) {
    for (const page of PERMISSION_PAGES) {
      const want = grants[page] ?? null;
      const rows = permRows.filter(row => String(row.user) === String(userId) && String(row.page) === page);
      for (const row of rows) {
        const shouldBeActive = want !== null && row.level === want;
        if (Boolean(row.is_active) !== shouldBeActive) {
          await api.update(resources.permissions, String(row.id), { is_active: shouldBeActive });
        }
      }
      if (want && !rows.some(row => row.level === want)) {
        await api.create(resources.permissions, { user: userId, page, level: want, is_active: true });
      }
    }
  }

  async function save() {
    if (!form.username.trim() || !form.full_name.trim() || (mode === 'create' && !form.password)) {
      toast(t('admin.ui.requiredFieldsMissing'), 'danger');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        username: form.username.trim(), full_name: form.full_name.trim(), phone: form.phone, email: form.email,
        is_active: form.is_active, is_superadmin: form.is_superadmin,
      };
      if (form.password) payload.password = form.password;
      let userId: string;
      if (mode === 'create') {
        const created = await api.create<{ id: number | string }>(resources.users, payload);
        userId = String(created.id);
      } else {
        await api.update(resources.users, String(user!.id), payload);
        userId = String(user!.id);
      }
      // Superadmins hold everything implicitly, so their checklist is never synced.
      if (isSuper && !form.is_superadmin) await syncPermissions(userId);
      toast(t('admin.ui.savedOk'), 'success');
      onSaved();
    } catch (error) {
      toast(apiErrorMessage(error, t), 'danger');
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, key: 'username' | 'full_name' | 'phone' | 'email' | 'password', type = 'text', placeholder = '') => (
    <label className="grid gap-1.5 text-sm font-bold text-text-secondary">
      {label}
      <input className={inputClass} type={type} disabled={readOnly} value={form[key]} placeholder={placeholder} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[190] flex justify-end bg-background-overlay/72 backdrop-blur-[3px]" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" className="grid h-full w-full max-w-[640px] grid-rows-[auto_1fr_auto] overflow-hidden bg-surface-card shadow-[-24px_0_60px_-30px_rgba(15,23,42,0.55)] ring-1 ring-border-soft/55">
        <div className="flex items-start justify-between gap-4 border-b border-border-soft/30 p-6">
          <div className="min-w-0">
            <h3 className="m-0 font-display text-xl font-extrabold text-text-primary">
              {mode === 'create' ? t('usersManager.newUser') : String(user?.full_name || user?.username || '')}
            </h3>
            {mode !== 'create' ? <p className="mt-1 text-sm text-text-muted">@{String(user?.username ?? '')}</p> : null}
          </div>
          <button type="button" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-subtle text-text-secondary transition hover:bg-surface-muted hover:text-text-primary" onClick={onClose} aria-label={t('common.close')}>
            <FiX className="h-4 w-4" />
          </button>
        </div>
        <div className="grid content-start gap-4 overflow-y-auto p-6">
          {!readOnly ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {field(t('admin.fields.username'), 'username')}
              {field(t('admin.fields.fullName'), 'full_name')}
              {field(t('admin.fields.phone'), 'phone')}
              {field(t('admin.fields.email'), 'email')}
              {field(t('admin.fields.password'), 'password', 'password', mode === 'edit' ? t('usersManager.passwordKeep') : '')}
              <div className="grid gap-2 self-end pb-1">
                <label className="inline-flex items-center gap-2 text-sm font-bold text-text-secondary">
                  <input type="checkbox" className="h-4 w-4" checked={form.is_active} onChange={event => setForm(current => ({ ...current, is_active: event.target.checked }))} /> {t('admin.fields.active')}
                </label>
                {isSuper ? (
                  <label className="inline-flex items-center gap-2 text-sm font-bold text-text-secondary">
                    <input type="checkbox" className="h-4 w-4" checked={form.is_superadmin} onChange={event => setForm(current => ({ ...current, is_superadmin: event.target.checked }))} /> {t('usersManager.superadmin')}
                  </label>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="grid gap-2 rounded-2xl bg-surface-subtle/50 p-4 text-sm ring-1 ring-border-soft/30">
              <p className="m-0"><span className="text-text-muted">{t('admin.fields.email')}:</span> <span className="font-bold text-text-primary">{String(user?.email || '—')}</span></p>
              <p className="m-0"><span className="text-text-muted">{t('admin.fields.phone')}:</span> <span className="font-bold text-text-primary">{String(user?.phone || '—')}</span></p>
              <p className="m-0"><span className="text-text-muted">{t('admin.fields.active')}:</span> <span className="font-bold text-text-primary">{user?.is_active ? t('admin.ui.yes') : t('admin.ui.no')}</span></p>
            </div>
          )}

          <div>
            <p className="m-0 text-sm font-extrabold text-text-primary">{t('usersManager.permsTitle')}</p>
            {form.is_superadmin ? (
              <p className="mt-2 rounded-xl bg-primary/6 p-3 text-xs font-semibold text-text-secondary ring-1 ring-primary/15">{t('usersManager.superadminAll')}</p>
            ) : readOnly || isSuper ? (
              <>
                {!readOnly ? <p className="mt-1 text-xs text-text-muted">{t('usersManager.permsHint')}</p> : null}
                <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-border-soft/40">
                  <div className="grid grid-cols-[1fr_92px_110px] items-center gap-2 border-b border-border-soft/25 bg-surface-subtle px-4 py-2 text-[11px] font-extrabold uppercase tracking-wide text-text-muted">
                    <span>{t('admin.fields.page')}</span>
                    <span className="text-center">{t('admin.options.permissionLevel.view')}</span>
                    <span className="text-center">{t('admin.options.permissionLevel.manage')}</span>
                  </div>
                  {PERMISSION_PAGES.map(page => {
                    const level = grants[page] ?? null;
                    return (
                      <div key={page} className="grid grid-cols-[1fr_92px_110px] items-center gap-2 border-b border-border-soft/15 px-4 py-2 last:border-b-0">
                        <span className="text-sm font-semibold text-text-primary">{t(`admin.options.page.${page}`)}</span>
                        <span className="text-center">
                          <input type="checkbox" className="h-4 w-4" disabled={readOnly} checked={level !== null} onChange={event => setGrant(page, event.target.checked ? 'view' : null)} />
                        </span>
                        <span className="text-center">
                          <input type="checkbox" className="h-4 w-4" disabled={readOnly} checked={level === 'manage'} onChange={event => setGrant(page, event.target.checked ? 'manage' : 'view')} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="mt-2 rounded-xl bg-surface-subtle p-3 text-xs font-semibold text-text-muted ring-1 ring-border-soft/40">{t('usersManager.onlySuper')}</p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border-soft/30 p-5">
          <button className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-surface-subtle px-5 text-sm font-semibold text-text-secondary transition hover:bg-surface-muted hover:text-text-primary" onClick={onClose}>{readOnly ? t('common.close') : t('common.cancel')}</button>
          {!readOnly ? (
            <button disabled={saving} className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60" onClick={() => void save()}>
              {saving ? t('common.loading') : t('common.save')}
            </button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

export function SystemPage() {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const viewableGroups = useViewableGroups(systemGroups);
  const [activeGroup, setActiveGroup] = useState('access');
  const [selected, setSelected] = useState('users');

  useEffect(() => {
    if (viewableGroups.some(group => group.id === activeGroup && group.resources.includes(selected))) return;
    const fallback = viewableGroups[0];
    if (fallback) {
      setActiveGroup(fallback.id);
      setSelected(fallback.resources[0]);
    }
  }, [viewableGroups, activeGroup, selected]);

  const canManageSelected = hasPermission(RESOURCE_BACKEND_PAGE[selected], 'manage');
  const config: ResourceConfig | undefined = systemConfigs[selected]
    ? { ...systemConfigs[selected], readOnly: systemConfigs[selected].readOnly || !canManageSelected }
    : undefined;
  const headerActions = undefined;

  if (!config) return null;

  return <div className="grid gap-5">
    <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{t('admin.page.system.eyebrow')}</p><h2 className="mt-1 text-3xl font-extrabold text-text-primary">{t('admin.page.system.title')}</h2><p className="mt-2 text-sm text-text-muted">{t('admin.page.system.description')}</p></div>
    <ResourceNavigation groups={viewableGroups} activeGroup={activeGroup} selected={selected} setActiveGroup={setActiveGroup} setSelected={setSelected} configs={systemConfigs} />
    {selected === 'users' ? <UsersManager key={selected} /> : <ApiResourceManager key={selected} config={config} headerActions={headerActions} />}
  </div>;
}

const KIOSK_TOKEN_KEY = 'rivera-kiosk-device-token';
const KIOSK_RESULT_COOLDOWN_MS = 2500;

type KioskPhase = 'setup' | 'ready' | 'countdown' | 'processing' | 'result';
type AttendanceIntent = 'check_in' | 'check_out';

export function AttendanceKioskPage() {
  const { t } = useTranslation();
  const cameraRef = useRef<FaceCameraHandle | null>(null);
  const intentRef = useRef<AttendanceIntent | null>(null);
  const [deviceToken, setDeviceToken] = useState(() => window.localStorage.getItem(KIOSK_TOKEN_KEY) || '');
  const [phase, setPhase] = useState<KioskPhase>('setup');
  const [intent, setIntent] = useState<AttendanceIntent | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string } | null>(null);

  function start(event: React.FormEvent) {
    event.preventDefault();
    if (!deviceToken.trim()) return;
    window.localStorage.setItem(KIOSK_TOKEN_KEY, deviceToken.trim());
    setPhase('ready');
  }

  function beginCapture(nextIntent: AttendanceIntent) {
    if (phase !== 'ready') return;
    intentRef.current = nextIntent;
    setIntent(nextIntent);
    setPhase('countdown');
    void cameraRef.current?.capture(2000);
  }

  const handleCaptureFail = useCallback(() => {
    setMessage({ tone: 'warning', text: t('kiosk.noFaceDetected') });
    setPhase('result');
    window.setTimeout(() => { setMessage(null); setIntent(null); setPhase('ready'); }, KIOSK_RESULT_COOLDOWN_MS);
  }, [t]);

  const handleCapture = useCallback(async (descriptor: number[], photo: Blob) => {
    setPhase('processing');
    try {
      const form = new FormData();
      form.append('device_token', deviceToken.trim());
      form.append('encoding', JSON.stringify(descriptor));
      form.append('image', photo, 'capture.jpg');
      if (intentRef.current) form.append('event_type', intentRef.current);
      const response = await actions.deviceAttendanceCheck<{ matched: boolean; employee_name?: string; event_type?: string; event_at?: string }>(form);
      const time = new Date(String(response.event_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const name = response.employee_name ?? '';
      setMessage(response.matched
        ? { tone: 'success', text: response.event_type === 'check_out' ? t('kiosk.recordedOut', { name, time }) : t('kiosk.recordedIn', { name, time }) }
        : { tone: 'warning', text: t('kiosk.faceNotRecognized') });
    } catch (requestError) {
      setMessage({ tone: 'danger', text: requestError instanceof Error ? requestError.message : t('kiosk.checkFailed') });
    } finally {
      setPhase('result');
      window.setTimeout(() => {
        setMessage(null);
        setIntent(null);
        setPhase('ready');
      }, KIOSK_RESULT_COOLDOWN_MS);
    }
  }, [deviceToken, t]);

  if (phase === 'setup') {
    return <main className="grid min-h-screen place-items-center bg-background-default p-4">
      <div className="w-full max-w-lg rounded-[28px] bg-surface-card p-6 shadow-xl ring-1 ring-border-soft/50">
        <div className="mb-6 flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-xl font-black text-primary-foreground">R</span><div><p className="text-[11px] font-bold uppercase tracking-wide text-primary">{t('kiosk.brand')}</p><h1 className="text-2xl font-extrabold text-text-primary">{t('kiosk.title')}</h1></div></div>
        <form onSubmit={start} className="grid gap-4">
          <label className="grid gap-1.5 text-sm font-bold text-text-secondary">{t('kiosk.deviceTokenLabel')}<input value={deviceToken} onChange={event => setDeviceToken(event.target.value)} required type="password" className="h-12 rounded-xl border border-border-soft bg-surface-subtle px-3 text-text-primary outline-none focus:border-primary" /></label>
          <button className="h-12 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground">{t('kiosk.startButton')}</button>
        </form>
        <a href="/login" className="mt-4 block text-center text-xs font-bold text-text-muted">{t('kiosk.adminLogin')}</a>
      </div>
    </main>;
  }

  return <main className="fixed inset-0 flex flex-col bg-black">
    <div className="relative min-h-0 flex-1">
      <FaceCamera ref={cameraRef} className="h-full w-full" active mode="manual" onCapture={(descriptor, photo) => void handleCapture(descriptor, photo)} onCaptureFail={handleCaptureFail}>
        {phase === 'countdown' ? <span className="text-lg font-bold text-white">{t('kiosk.capturing')}</span> : null}
        {phase === 'processing' ? <span className="text-lg font-bold text-white">{intent === 'check_out' ? t('kiosk.checkingOut') : t('kiosk.checkingIn')}</span> : null}
        {phase === 'result' && message ? <span className={`text-lg font-bold ${message.tone === 'success' ? 'text-success' : message.tone === 'warning' ? 'text-warning' : 'text-danger'}`}>{message.text}</span> : null}
      </FaceCamera>
    </div>
    <div className="grid gap-3 bg-surface-card p-5">
      <div className="flex justify-center gap-4">
        <button disabled={phase !== 'ready'} onClick={() => beginCapture('check_in')} className="h-16 w-full max-w-[220px] rounded-2xl bg-success text-lg font-black text-white shadow-lg disabled:opacity-40">{t('kiosk.cameFAB')}</button>
        <button disabled={phase !== 'ready'} onClick={() => beginCapture('check_out')} className="h-16 w-full max-w-[220px] rounded-2xl bg-danger text-lg font-black text-white shadow-lg disabled:opacity-40">{t('kiosk.leftFAB')}</button>
      </div>
      <div className="flex items-center justify-center gap-4">
        <button className="text-xs font-bold text-text-muted underline" onClick={() => setPhase('setup')}>{t('kiosk.changeToken')}</button>
        <a href="/login" className="text-xs font-bold text-text-muted underline">{t('kiosk.adminLogin')}</a>
      </div>
    </div>
  </main>;
}
