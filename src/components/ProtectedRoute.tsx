import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import type { Permission } from '@/db/types';

interface ProtectedRouteProps {
  permission?: Permission;
  adminOnly?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function ProtectedRoute({ permission, adminOnly, children, fallback }: ProtectedRouteProps) {
  const { hasPermission, isAdmin } = usePermissions();

  if (adminOnly && !isAdmin) {
    return fallback || (
      <div className="empty-state">
        <span className="material-icons-outlined" style={{ fontSize: 64, color: 'var(--md-outline-variant)', marginBottom: 16 }}>lock</span>
        <h3>Access Denied</h3>
        <p style={{ color: 'var(--md-on-surface-variant)' }}>You need administrator privileges to access this page.</p>
      </div>
    );
  }

  if (permission && !hasPermission(permission)) {
    return fallback || (
      <div className="empty-state">
        <span className="material-icons-outlined" style={{ fontSize: 64, color: 'var(--md-outline-variant)', marginBottom: 16 }}>block</span>
        <h3>Insufficient Permissions</h3>
        <p style={{ color: 'var(--md-on-surface-variant)' }}>You don't have the required permission to access this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}
