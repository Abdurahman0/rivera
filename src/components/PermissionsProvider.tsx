import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ApiCurrentUser } from '../api/types';
import { hasPagePermission, type PermissionLevel } from '../lib/permissions';

type PermissionsContextValue = {
  user: ApiCurrentUser | null;
  hasPermission: (page: string, level: PermissionLevel) => boolean;
};

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export function PermissionsProvider({ user, children }: { user: ApiCurrentUser | null; children: ReactNode }) {
  const value = useMemo<PermissionsContextValue>(() => ({
    user,
    hasPermission: (page, level) => hasPagePermission(user, page, level),
  }), [user]);

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) throw new Error('usePermissions must be used within PermissionsProvider');
  return context;
}

/** Convenience hook for a single page+level check, e.g. `useHasPermission('clients', 'manage')`. */
export function useHasPermission(page: string, level: PermissionLevel) {
  return usePermissions().hasPermission(page, level);
}
