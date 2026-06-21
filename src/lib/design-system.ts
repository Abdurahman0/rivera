export const DESIGN_STORAGE_KEY = 'rivera-design';

export const designVariants = ['nova'] as const;
export type DesignVariant = (typeof designVariants)[number];

export function isDesignVariant(value: string | null | undefined): value is DesignVariant {
  return Boolean(value && designVariants.includes(value as DesignVariant));
}

export function normalizeDesignVariant(value: string | null | undefined): DesignVariant {
  return isDesignVariant(value) ? value : 'nova';
}

export function getStoredDesignVariant(): DesignVariant {
  if (typeof window === 'undefined') {
    return 'nova';
  }

  try {
    return normalizeDesignVariant(window.localStorage.getItem(DESIGN_STORAGE_KEY));
  } catch {
    return 'nova';
  }
}

export function applyDesignVariant(nextDesign: DesignVariant): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset.design = nextDesign;
}

export function persistDesignVariant(nextDesign: DesignVariant): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(DESIGN_STORAGE_KEY, nextDesign);
  } catch {
    // Keep the in-memory design switch working without persistent storage.
  }
}

export function initializeStoredDesignVariant(): void {
  applyDesignVariant(getStoredDesignVariant());
}
