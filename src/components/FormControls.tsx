import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiCalendar, FiChevronDown, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

function useClickOutsideAndEscape(onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return ref;
}

export interface DropdownOption {
  value: string;
  label: string;
}

/** Form-embeddable custom dropdown: renders a hidden native input so uncontrolled
 *  `new FormData(form)` / `form.elements.namedItem(name)` reads keep working unchanged. */
export function Dropdown({
  name,
  options,
  defaultValue = '',
  value,
  onChange,
  placeholder,
  required,
  className = '',
}: {
  name?: string;
  options: DropdownOption[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useClickOutsideAndEscape(() => setIsOpen(false));
  const current = value ?? internalValue;
  const selectedOption = options.find(option => option.value === current);

  function select(next: string) {
    if (value === undefined) setInternalValue(next);
    onChange?.(next);
    setIsOpen(false);
  }

  return (
    <div ref={menuRef} className={['relative min-w-0', className].join(' ')}>
      {name ? <input type="hidden" name={name} value={current} required={required} /> : null}
      <button
        type="button"
        className={[
          'flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-border-soft bg-surface-card px-3 text-left text-sm text-text-primary outline-none transition duration-fast',
          'hover:border-primary/35',
          isOpen ? 'border-primary/50 ring-4 ring-primary/10' : '',
        ].join(' ')}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(current => !current)}
      >
        <span className={['min-w-0 truncate', selectedOption ? 'text-text-primary' : 'text-text-muted'].join(' ')}>
          {selectedOption?.label ?? placeholder ?? t('admin.ui.selectPlaceholder')}
        </span>
        <FiChevronDown className={['h-4 w-4 shrink-0 text-text-muted transition duration-fast', isOpen ? 'rotate-180' : ''].join(' ')} />
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 max-h-[260px] w-full min-w-[200px] overflow-y-auto rounded-2xl border border-border-soft/60 bg-surface-card p-1.5 shadow-[0_24px_55px_-30px_rgba(15,23,42,0.58)] backdrop-blur-xl" role="listbox">
          {!required ? (
            <button type="button" className="flex min-h-9 w-full items-center rounded-xl px-3 text-left text-sm font-medium text-text-muted transition hover:bg-surface-subtle" onClick={() => select('')}>
              {placeholder ?? t('admin.ui.selectPlaceholder')}
            </button>
          ) : null}
          {options.map(option => {
            const selected = option.value === current;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                className={['flex min-h-9 w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-sm font-medium transition', selected ? 'bg-primary/12 text-text-primary' : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary'].join(' ')}
                onClick={() => select(option.value)}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {selected ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

const MONTH_NAMES: Record<'uz' | 'ru', string[]> = {
  uz: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
};

const WEEKDAY_NAMES: Record<'uz' | 'ru', string[]> = {
  uz: ['Du', 'Se', 'Cho', 'Pay', 'Ju', 'Sha', 'Ya'],
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
};

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

/** Handmade calendar popover. Renders a hidden native input for form compatibility.
 *  For `type="datetime-local"` a plain time input is paired next to the calendar button. */
export function DatePicker({
  name,
  defaultValue = '',
  value,
  onChange,
  required,
  type = 'date',
  className = '',
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  type?: 'date' | 'datetime-local';
  className?: string;
}) {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('ru') ? 'ru' : 'uz';
  const [datePart, timePart] = (value ?? defaultValue ?? '').split('T');
  const [internalDate, setInternalDate] = useState(datePart ?? '');
  const [internalTime, setInternalTime] = useState(timePart ?? '00:00');
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useClickOutsideAndEscape(() => setIsOpen(false));

  const currentDate = value !== undefined ? (value.split('T')[0] ?? '') : internalDate;
  const currentTime = value !== undefined ? (value.split('T')[1]?.slice(0, 5) ?? '00:00') : internalTime;
  const combined = type === 'datetime-local' && currentDate ? `${currentDate}T${currentTime}` : currentDate;

  const [viewDate, setViewDate] = useState(() => parseIsoDate(currentDate) ?? new Date());

  function commit(nextDate: string, nextTime: string) {
    const next = type === 'datetime-local' && nextDate ? `${nextDate}T${nextTime}` : nextDate;
    if (value === undefined) {
      setInternalDate(nextDate);
      setInternalTime(nextTime);
    }
    onChange?.(next);
  }

  const monthLabel = `${MONTH_NAMES[lang][viewDate.getMonth()]} ${viewDate.getFullYear()}`;
  const weekdayLabels = WEEKDAY_NAMES[lang];

  const days = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ date: Date; inMonth: boolean }> = [];
    for (let i = 0; i < startOffset; i++) cells.push({ date: new Date(year, month, i - startOffset + 1), inMonth: false });
    for (let day = 1; day <= daysInMonth; day++) cells.push({ date: new Date(year, month, day), inMonth: true });
    while (cells.length % 7 !== 0 || cells.length < 42) cells.push({ date: new Date(year, month, daysInMonth + cells.length - startOffset - daysInMonth + 1), inMonth: false });
    return cells;
  }, [viewDate]);

  const todayIso = toIsoDate(new Date());

  const displayText = currentDate ? currentDate.split('-').reverse().join('.') : '';

  return (
    <div ref={menuRef} className={['relative flex min-w-0 gap-2', className].join(' ')}>
      {name ? <input type="hidden" name={name} value={combined} required={required} /> : null}
      <button
        type="button"
        className={[
          'flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-border-soft bg-surface-card px-3 text-left text-sm text-text-primary outline-none transition duration-fast',
          'hover:border-primary/35',
          isOpen ? 'border-primary/50 ring-4 ring-primary/10' : '',
        ].join(' ')}
        onClick={() => setIsOpen(current => !current)}
      >
        <span className={['min-w-0 truncate', displayText ? 'text-text-primary' : 'text-text-muted'].join(' ')}>{displayText || 'dd.mm.yyyy'}</span>
        <FiCalendar className="h-4 w-4 shrink-0 text-text-muted" />
      </button>
      {type === 'datetime-local' ? (
        <input
          type="time"
          value={currentTime}
          onChange={event => commit(currentDate, event.target.value)}
          className="h-11 w-[110px] shrink-0 rounded-xl border border-border-soft bg-surface-card px-2 text-sm text-text-primary outline-none focus:border-primary/50"
        />
      ) : null}

      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[280px] rounded-2xl border border-border-soft/60 bg-surface-card p-3 shadow-[0_24px_55px_-30px_rgba(15,23,42,0.58)] backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition hover:bg-surface-subtle" onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
              <FiChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold capitalize text-text-primary">{monthLabel}</span>
            <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition hover:bg-surface-subtle" onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
              <FiChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weekdayLabels.map(label => (
              <span key={label} className="grid h-7 place-items-center text-[10px] font-bold uppercase text-text-muted">{label}</span>
            ))}
            {days.map(({ date, inMonth }, index) => {
              const iso = toIsoDate(date);
              const isSelected = iso === currentDate;
              const isToday = iso === todayIso;
              return (
                <button
                  key={`${iso}-${index}`}
                  type="button"
                  className={[
                    'grid h-8 place-items-center rounded-lg text-xs font-semibold transition',
                    !inMonth ? 'text-text-muted/40 hover:bg-surface-subtle' : 'text-text-primary hover:bg-primary/10',
                    isSelected ? 'bg-primary text-primary-foreground hover:bg-primary' : '',
                    isToday && !isSelected ? 'ring-1 ring-primary/40' : '',
                  ].join(' ')}
                  onClick={() => {
                    commit(iso, currentTime);
                    setViewDate(date);
                    if (type === 'date') setIsOpen(false);
                  }}
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
