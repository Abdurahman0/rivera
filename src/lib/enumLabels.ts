import type { TFunction } from 'i18next';

/** Translates a raw backend enum value using the shared admin.options dictionary, falling back to a humanized version of the raw value if no translation exists. */
export function translateOption(t: TFunction, domain: string, value: string) {
  return t(`admin.options.${domain}.${value}`, { defaultValue: value.replaceAll('_', ' ') });
}

const SENTINEL_PATTERNS: Array<[RegExp, (t: TFunction, match: string) => string]> = [
  [/^__deleted__$/, t => t('admin.options.movementNote.deleted')],
  [/^__incoming__$/, t => t('admin.options.movementNote.incoming')],
  [/^__production__$/, t => t('admin.options.movementNote.production')],
  [/^__client__$/, t => t('admin.options.movementNote.client')],
  [/^__materials__$/, t => t('admin.options.movementNote.materials')],
  [/^__status__(.+)$/, (t, value) => translateOption(t, 'transactionStatus', value)],
  [/^__method__(.+)$/, (t, value) => translateOption(t, 'paymentMethod', value)],
  [/^__type__(.+)$/, (t, value) => translateOption(t, 'materialTxType', value)],
  [/^__ftype__(.+)$/, (t, value) => translateOption(t, 'finishedTxType', value)],
];

/** Translates the sentinel-encoded fallback labels produced by adaptOperationalData for stock movements and finance entries; passes real user-entered text through unchanged. */
export function translateMovementLabel(t: TFunction, value: string | null | undefined) {
  if (!value) return value ?? '';
  for (const [pattern, resolve] of SENTINEL_PATTERNS) {
    const match = value.match(pattern);
    if (match) return resolve(t, match[1] ?? value);
  }
  return value;
}
