import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFarm } from '@/contexts/FarmContext';
import { ROLE_PERMISSIONS } from '@/db/types';
import type { Permission, FarmRole } from '@/db/types';

export function usePermissions() {
  const { currentMembership } = useAuth();
  const { currentFarmId } = useFarm();

  const permissions = useMemo<Permission[]>(() => {
    if (!currentMembership || currentMembership.status !== 'active') return [];
    return ROLE_PERMISSIONS[currentMembership.role] || [];
  }, [currentMembership]);

  const hasPermission = useMemo(() => {
    const permSet = new Set(permissions);
    return (perm: Permission) => permSet.has(perm);
  }, [permissions]);

  const role = currentMembership?.role as FarmRole | undefined;

  const isAdmin = role === 'owner' || role === 'admin';
  const isOwner = role === 'owner';
  const canManageMembers = hasPermission('members:invite') || hasPermission('members:edit') || hasPermission('members:remove');
  const canManageSettings = hasPermission('settings:edit');
  const canViewReports = hasPermission('reports:view');

  return { permissions, hasPermission, role, isAdmin, isOwner, canManageMembers, canManageSettings, canViewReports, farmId: currentFarmId };
}
