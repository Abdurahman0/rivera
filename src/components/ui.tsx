import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FiBriefcase, FiChevronDown, FiDownload, FiEdit2, FiEye, FiPlus, FiSearch, FiSliders, FiTrash2 } from 'react-icons/fi';
import { designVariants, type DesignVariant } from '../lib/design-system';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n';
import type { StatusTone } from '../types/crm';

export function PremiumTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number | string; color?: string; payload?: { name?: string } }>; label?: string }) {
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

export function PageHeader({ eyebrow, title, description, createLabel, onCreate, onExport }: { eyebrow: string; title: string; description: string; createLabel?: string; onCreate?: () => void; onExport?: () => void }) {
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
        {onExport ? (
          <button className="inline-flex h-10 w-fit items-center gap-2 rounded-xl bg-surface-card px-4 text-sm font-bold text-text-primary shadow-sm ring-1 ring-border-soft/60 transition hover:bg-primary/10" onClick={onExport}>
            <FiDownload className="h-4 w-4" />
            {t('common.export')}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function Brand({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
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

export function LanguageSwitch({ onLanguageChange, tone = 'light' }: { onLanguageChange: (language: SupportedLanguage) => void; tone?: 'light' | 'dark' }) {
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

export function DesignSwitch({ activeDesign, onDesignChange }: { activeDesign: DesignVariant; onDesignChange: (design: DesignVariant) => void }) {
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

export function IconButton({ label, children, onClick, disabled }: { label: string; children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface-card text-text-secondary shadow-sm ring-1 ring-border-soft/45 transition hover:bg-primary/10 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function MetricCard({ icon, label, value, caption, tone }: { icon: ReactNode; label: string; value: string; caption: string; tone: StatusTone }) {
  return (
    <article className="stat-card app-card--nova group relative flex min-h-[148px] items-start justify-between gap-3 overflow-hidden p-5 transition duration-base hover:-translate-y-1 hover:shadow-[0_24px_50px_-34px_rgb(var(--color-primary)/0.5)] max-[640px]:p-4">
      <div className="grid gap-2.5">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">{label}</p>
        <p className="m-0 text-[clamp(1.7rem,3vw,2.35rem)] font-bold leading-none tracking-[-0.05em] text-text-primary">{value}</p>
        <p className="m-0 max-w-[26ch] text-[13px] leading-5 text-text-secondary">{caption}</p>
      </div>
      <span className={['inline-flex min-h-7 items-center self-start whitespace-nowrap rounded-pill border px-2.5 text-[11px] font-semibold transition duration-fast group-hover:shadow-sm', trendToneClasses(tone)].join(' ')}>
        {icon}
      </span>
    </article>
  );
}

export function Panel({ title, action, children, onAction }: { title: string; action: string; children: ReactNode; onAction?: () => void }) {
  return (
    <section className="app-card--nova min-w-0 p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-extrabold text-text-primary">{title}</h3>
        {onAction ? <button className="text-sm font-bold text-text-accent" onClick={onAction}>{action}</button> : (action ? <span className="text-sm font-bold text-text-muted">{action}</span> : null)}
      </div>
      {children}
    </section>
  );
}

export function SegmentTabs<T extends string>({ tabs, activeTab, onChange }: { tabs: Array<{ id: T; label: string; icon: ReactNode }>; activeTab: T; onChange: (tab: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2 rounded-xl bg-surface-card p-2 shadow-sm ring-1 ring-border-soft/35">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={[
            'inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-extrabold transition duration-fast',
            activeTab === tab.id
              ? 'bg-primary text-primary-foreground shadow-[0_18px_36px_-28px_rgb(var(--color-primary)/0.65)]'
              : 'bg-surface-subtle text-text-secondary hover:bg-primary/10 hover:text-text-primary',
          ].join(' ')}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function FilterBar({ query, setQuery, placeholder }: { query: string; setQuery: (query: string) => void; placeholder: string }) {
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
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-surface-card px-4 text-sm font-bold text-text-primary ring-1 ring-border-soft/55" onClick={() => setQuery('')}>
          <FiSliders className="h-4 w-4" />
          {t('common.filters')}
        </button>
      </div>
    </div>
  );
}

export function ClientsFilterBar({
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
  statusOptions: Array<{ value: string; label: string }>;
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
      <SelectField label={t('clients.filters.status')} value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
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

export function SelectField({ label, value, onChange, options, stretch = false }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; stretch?: boolean }) {
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
          'hover:border-primary/35 hover:bg-primary/8',
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

export function DataTable({ columns, rows, onRowClick }: { columns: string[]; rows: ReactNode[][]; onRowClick?: (rowIndex: number) => void }) {
  const renderDesktopCell = (cell: ReactNode) => {
    if (typeof cell === 'string' || typeof cell === 'number') {
      const value = String(cell);
      return <span className="block min-w-0 max-w-full truncate" title={value}>{cell}</span>;
    }

    return <span className="block min-w-0 max-w-full overflow-hidden">{cell}</span>;
  };

  return (
    <div className="table-shell rounded-xl bg-surface-card p-2 shadow-sm ring-1 ring-border-soft/40">
      <div className="grid gap-2 md:hidden">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={['grid gap-2 rounded-xl bg-surface-subtle/80 p-3 text-left ring-1 ring-border-soft/35', onRowClick ? 'cursor-pointer' : ''].join(' ')}
            onClick={() => onRowClick?.(rowIndex)}
            onKeyDown={event => {
              if (event.target !== event.currentTarget) return;
              if ((event.key === 'Enter' || event.key === ' ') && onRowClick) {
                event.preventDefault();
                onRowClick(rowIndex);
              }
            }}
            role={onRowClick ? 'button' : undefined}
            tabIndex={onRowClick ? 0 : undefined}
          >
            {row.map((cell, cellIndex) => (
              <span key={cellIndex} className="grid min-w-0 gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">{columns[cellIndex]}</span>
                <span className="min-w-0 text-sm font-semibold text-text-primary [overflow-wrap:anywhere]">{cell}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="data-table w-full min-w-[720px] table-fixed border-separate border-spacing-y-1.5 text-left">
          <thead>
            <tr>
              {columns.map(column => (
                <th key={column} className="data-table__cell data-table__cell--head bg-transparent px-4 py-3.5 text-left align-middle text-[11px] font-bold uppercase tracking-[0.12em] text-text-muted max-[640px]:px-4"><span className="block truncate" title={column}>{column}</span></th>
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
                  <td key={cellIndex} className="data-table__cell min-w-0 overflow-hidden px-4 py-3.5 align-middle text-sm text-text-primary first:rounded-l-lg last:rounded-r-lg max-[640px]:px-4">{renderDesktopCell(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RowActions({ onView, onEdit, onDelete }: { onView: () => void; onEdit?: () => void; onDelete?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <TableAction label={t('common.view')} onClick={onView}><FiEye /></TableAction>
      {onEdit ? <TableAction label={t('common.edit')} onClick={onEdit}><FiEdit2 /></TableAction> : null}
      {onDelete ? <TableAction label={t('common.delete')} onClick={onDelete}><FiTrash2 /></TableAction> : null}
    </div>
  );
}

export function TableAction({ label, children, onClick }: { label: string; children: ReactNode; onClick?: () => void }) {
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

export function PrimaryCell({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <span className="block min-w-0">
      <span className="block max-w-[240px] truncate text-sm font-bold text-text-primary">{title}</span>
      <span className="block max-w-[240px] truncate text-xs text-text-muted">{subtitle}</span>
    </span>
  );
}

export function StatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span className={['inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold', toneClasses(tone)].join(' ')}>
      {children}
    </span>
  );
}

export function Field({ label, placeholder, type = 'text', defaultValue = '' }: { label: string; placeholder: string; type?: string; defaultValue?: string }) {
  return (
    <label className="form-field--nova grid min-w-0 gap-1.5 rounded-xl bg-surface-subtle p-3 text-sm font-bold text-text-secondary ring-1 ring-border-soft/45">
      {label}
      <input className="form-field__input--nova h-11 w-full rounded-xl border border-border-soft/60 bg-surface-card px-3 text-sm font-medium text-text-primary placeholder:text-text-muted outline-none transition duration-fast focus:border-primary/50 focus:ring-2 focus:ring-primary/20" placeholder={placeholder} type={type} defaultValue={defaultValue} />
    </label>
  );
}

export function toneClasses(tone: StatusTone) {
  const classes: Record<StatusTone, string> = {
    success: 'bg-success-bg text-success',
    warning: 'bg-warning-bg text-warning',
    danger: 'bg-danger-bg text-danger',
    info: 'bg-info-bg text-info',
    neutral: 'bg-surface-muted text-text-secondary',
  };
  return classes[tone];
}

export function trendToneClasses(tone: StatusTone) {
  const classes: Record<StatusTone, string> = {
    success: 'border-success/10 bg-success-bg text-success',
    warning: 'border-warning/10 bg-warning-bg text-warning',
    danger: 'border-danger/10 bg-danger-bg text-danger',
    info: 'border-info/10 bg-info-bg text-info',
    neutral: 'border-neutral/10 bg-neutral-bg text-neutral',
  };
  return classes[tone];
}
