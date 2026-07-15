import { useEffect, useMemo, useRef, useState } from 'react';
import { FiX } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { api, resources, type ApiError } from '../api/client';
import { FaceCamera, type FaceCameraHandle } from './FaceCamera';
import { useToast } from './ToastProvider';
import { Dropdown } from './FormControls';

interface EmployeeOption {
  id: string;
  full_name: string;
  employee_code: string;
}

export function FaceEnrollDrawer({ onClose, onEnrolled }: { onClose: () => void; onEnrolled: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const cameraRef = useRef<FaceCameraHandle | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState('');

  useEffect(() => { void api.list<EmployeeOption>(resources.employees).then(setEmployees); }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return employees;
    return employees.filter(employee => `${employee.full_name} ${employee.employee_code}`.toLowerCase().includes(needle));
  }, [employees, query]);

  const selectedEmployee = employees.find(employee => employee.id === employeeId);

  async function handleCapture(descriptor: number[], photo: Blob) {
    if (!employeeId || status === 'saving') return;
    setStatus('saving');
    setError('');
    try {
      const existing = await api.list<{ id: string }>(resources.employeeFaceEncodings, { employee: employeeId });
      const form = new FormData();
      form.append('employee', employeeId);
      form.append('encoding', JSON.stringify(descriptor));
      form.append('source_image', photo, 'face.jpg');
      if (existing.length) await api.update(resources.employeeFaceEncodings, existing[0].id, form);
      else await api.create(resources.employeeFaceEncodings, form);
      setStatus('done');
    } catch (requestError) {
      const message = (requestError as ApiError).message || t('faceEnroll.enrollFailed');
      setError(message);
      toast(message, 'danger');
      setStatus('idle');
      cameraRef.current?.reset();
    }
  }

  return <div className="fixed inset-0 z-[200] grid place-items-center bg-background-overlay/72 px-3 backdrop-blur-[3px]" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" className="grid max-h-[94vh] w-full max-w-[880px] grid-rows-[auto_1fr] overflow-hidden rounded-[28px] bg-surface-card shadow-[0_40px_110px_-42px_rgba(15,23,42,0.62)] ring-1 ring-border-soft/55">
      <div className="flex flex-wrap items-center gap-3 border-b border-border-soft/30 p-5">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-primary">{t('faceEnroll.eyebrow')}</p>
          <h3 className="m-0 mt-0.5 text-xl font-extrabold text-text-primary">{t('faceEnroll.title')}</h3>
        </div>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('faceEnroll.searchPlaceholder')} className="h-11 w-full rounded-xl border border-border-soft bg-surface-card px-3 text-sm text-text-primary outline-none focus:border-primary/50 sm:w-[190px]" />
        <Dropdown
          className="w-full sm:w-[250px]"
          value={employeeId}
          onChange={next => { setEmployeeId(next); setStatus('idle'); cameraRef.current?.reset(); }}
          placeholder={t('faceEnroll.selectPlaceholder')}
          options={filtered.map(employee => ({ value: employee.id, label: `${employee.full_name} · ${employee.employee_code}` }))}
        />
        <button className="rounded-xl bg-surface-muted p-3 text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary" onClick={onClose} aria-label={t('common.close')}><FiX /></button>
      </div>

      <div className="grid content-start gap-3 overflow-y-auto p-5">
        {employeeId ? <FaceCamera ref={cameraRef} className="aspect-[4/3] max-h-[62vh] w-full rounded-[24px]" active={status !== 'done'} disabled={status === 'saving' || status === 'done'} onCapture={(descriptor, photo) => void handleCapture(descriptor, photo)}>
          {status === 'saving' ? <span className="text-sm font-bold text-white">{t('faceEnroll.saving', { name: selectedEmployee?.full_name })}</span> : null}
          {status === 'done' ? <span className="text-sm font-bold text-white">{t('faceEnroll.done', { name: selectedEmployee?.full_name })}</span> : null}
        </FaceCamera> : <div className="grid aspect-[4/3] max-h-[62vh] w-full place-items-center rounded-[24px] bg-surface-subtle text-sm font-semibold text-text-muted">{t('faceEnroll.pickEmployeeHint')}</div>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {!error && employeeId && status !== 'done' ? <p className="m-0 min-w-0 flex-1 text-xs font-semibold text-text-muted">{t('faceEnroll.instructions')}</p> : <span className="flex-1" />}
          {status === 'done' ? <button className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground" onClick={onEnrolled}>{t('faceEnroll.doneButton')}</button>
            : <button className="rounded-xl bg-surface-muted px-5 py-3 text-sm font-bold text-text-secondary" onClick={onClose}>{t('faceEnroll.cancelButton')}</button>}
        </div>
      </div>
    </section>
  </div>;
}
