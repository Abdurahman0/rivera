import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiClock, FiDatabase, FiLock, FiSettings, FiShield, FiUsers } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { actions } from '../api/client';
import { ApiResourceManager, type ResourceConfig } from '../components/ApiResourceManager';
import { usePermissions } from '../components/PermissionsProvider';
import { FaceCamera, type FaceCameraHandle } from '../components/FaceCamera';
import { systemConfigs } from '../data/resource-config';
import { RESOURCE_BACKEND_PAGE } from '../lib/permissions';

const systemGroups = [
  { id: 'access', label: 'admin.page.systemGroups.access', icon: FiUsers, resources: ['users', 'permissions'] },
  { id: 'configuration', label: 'admin.page.systemGroups.configuration', icon: FiSettings, resources: ['settings', 'backups'] },
  { id: 'attendanceConfig', label: 'admin.page.systemGroups.attendanceConfig', icon: FiClock, resources: ['schedules', 'devices'] },
  { id: 'audit', label: 'admin.page.systemGroups.audit', icon: FiDatabase, resources: ['audit', 'exports'] },
  { id: 'security', label: 'admin.page.systemGroups.security', icon: FiShield, resources: ['security', 'stockLogs', 'payrollLogs', 'attendanceLogs', 'backupLogs'] },
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
    <div className="flex flex-wrap gap-2">{group?.resources.map(key => <button key={key} onClick={() => setSelected(key)} className={`rounded-xl px-3 py-2 text-xs font-bold ${selected === key ? 'bg-primary/10 text-primary ring-1 ring-primary/20' : 'bg-surface-subtle text-text-muted'}`}>{t(configs[key].title)}</button>)}</div>
  </div>;
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
  const headerActions = selected === 'backups' && canManageSelected ? [{ label: 'admin.page.runBackupNow', run: actions.runBackup }] : undefined;

  if (!config) return null;

  return <div className="grid gap-5">
    <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{t('admin.page.system.eyebrow')}</p><h2 className="mt-1 text-3xl font-extrabold text-text-primary">{t('admin.page.system.title')}</h2><p className="mt-2 text-sm text-text-muted">{t('admin.page.system.description')}</p></div>
    <ResourceNavigation groups={viewableGroups} activeGroup={activeGroup} selected={selected} setActiveGroup={setActiveGroup} setSelected={setSelected} configs={systemConfigs} />
    <ApiResourceManager key={selected} config={config} headerActions={headerActions} />
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
