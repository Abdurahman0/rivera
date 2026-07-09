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

  return <div className="fixed inset-0 z-[200] flex justify-end bg-background-overlay/70" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="h-full w-full max-w-[520px] overflow-y-auto bg-background-subtle p-5 shadow-xl">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div><p className="text-[11px] font-bold uppercase tracking-wide text-primary">{t('faceEnroll.eyebrow')}</p><h3 className="text-2xl font-extrabold text-text-primary">{t('faceEnroll.title')}</h3></div>
        <button className="rounded-xl bg-surface-muted p-3 text-text-secondary" onClick={onClose}><FiX /></button>
      </div>

      <div className="grid gap-4">
        <label className="grid gap-1.5 text-sm font-bold text-text-secondary">{t('faceEnroll.employeeLabel')}
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('faceEnroll.searchPlaceholder')} className="h-11 w-full rounded-xl border border-border-soft bg-surface-card px-3 text-sm text-text-primary outline-none focus:border-primary/50" />
        </label>
        <Dropdown
          value={employeeId}
          onChange={next => { setEmployeeId(next); setStatus('idle'); cameraRef.current?.reset(); }}
          placeholder={t('faceEnroll.selectPlaceholder')}
          options={filtered.map(employee => ({ value: employee.id, label: `${employee.full_name} · ${employee.employee_code}` }))}
        />

        {employeeId ? <FaceCamera ref={cameraRef} active={status !== 'done'} disabled={status === 'saving' || status === 'done'} onCapture={(descriptor, photo) => void handleCapture(descriptor, photo)}>
          {status === 'saving' ? <span className="text-sm font-bold text-white">{t('faceEnroll.saving', { name: selectedEmployee?.full_name })}</span> : null}
          {status === 'done' ? <span className="text-sm font-bold text-white">{t('faceEnroll.done', { name: selectedEmployee?.full_name })}</span> : null}
        </FaceCamera> : <div className="grid h-64 place-items-center rounded-[24px] bg-surface-subtle text-sm font-semibold text-text-muted">{t('faceEnroll.pickEmployeeHint')}</div>}

        {!error && employeeId && status !== 'done' ? <p className="text-xs font-semibold text-text-muted">{t('faceEnroll.instructions')}</p> : null}

        <div className="flex gap-2">
          {status === 'done' ? <button className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground" onClick={onEnrolled}>{t('faceEnroll.doneButton')}</button>
            : <button className="flex-1 rounded-xl bg-surface-muted px-4 py-3 text-sm font-bold text-text-secondary" onClick={onClose}>{t('faceEnroll.cancelButton')}</button>}
        </div>
      </div>
    </aside>
  </div>;
}
