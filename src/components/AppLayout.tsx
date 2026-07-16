import { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { isFirebaseConfigured } from '@/db/firebase';
import { useFarm } from '@/contexts/FarmContext';
import { useAuth } from '@/contexts/AuthContext';
import { FARM_ROLE_LABELS } from '@/db/types';
import { usePermissions } from '@/hooks/usePermissions';
import NotificationsPanel from './NotificationsPanel';

interface AppLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { section: 'Overview' },
  { to: '/', icon: 'dashboard', label: 'Dashboard' },
  { section: 'Farm Operations' },
  { to: '/poultry/batches', icon: 'inventory_2', label: 'Batch Management' },
  { to: '/poultry/daily', icon: 'edit_note', label: 'Daily Recording' },
  { to: '/poultry/daily/history', icon: 'history', label: 'Report History' },
  { section: 'Inventory' },
  { to: '/products', icon: 'category', label: 'Products' },
  { to: '/purchases', icon: 'shopping_cart', label: 'Purchases' },
  { to: '/sales', icon: 'point_of_sale', label: 'Sales' },
  { to: '/inventory', icon: 'warehouse', label: 'Inventory' },
  { section: 'CRM' },
  { to: '/customers', icon: 'people', label: 'Customers' },
  { to: '/customer-payments', icon: 'payments', label: 'Customer Payments' },
  { to: '/customer-reports', icon: 'assessment', label: 'Customer Reports' },
  { to: '/suppliers', icon: 'local_shipping', label: 'Suppliers' },
  { to: '/supplier-payments', icon: 'account_balance', label: 'Supplier Payments' },
  { to: '/supplier-reports', icon: 'analytics', label: 'Supplier Reports' },
  { section: 'Reports' },
  { to: '/reports/poultry', icon: 'analytics', label: 'Poultry Reports' },
  { to: '/reports/sales', icon: 'bar_chart', label: 'Sales Reports' },
  { to: '/reports/purchases', icon: 'receipt_long', label: 'Purchase Reports' },
  { to: '/reports/inventory', icon: 'inventory', label: 'Inventory Reports' },
  { section: 'System' },
  { to: '/settings/farms', icon: 'agriculture', label: 'Farm Management' },
  { to: '/settings/members', icon: 'group', label: 'Team Members' },
  { to: '/settings/import-export', icon: 'file_upload', label: 'Data Import & Export' },
  { to: '/settings', icon: 'settings', label: 'Settings' },
  { section: 'Future Modules' },
  { to: '/crops', icon: 'grass', label: 'Crops', disabled: true },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/poultry/batches': 'Batch Management',
  '/poultry/daily': 'Daily Recording',
  '/poultry/daily/history': 'Report History',
  '/products': 'Product Management',
  '/purchases': 'Purchase Management',
  '/sales': 'Sales Management',
  '/inventory': 'Inventory',
  '/customers': 'Customer Management',
  '/customer-payments': 'Customer Payments',
  '/customer-reports': 'Customer Reports',
  '/suppliers': 'Supplier Management',
  '/supplier-payments': 'Supplier Payments',
  '/supplier-reports': 'Supplier Reports',
  '/reports/poultry': 'Poultry Reports',
  '/reports/sales': 'Sales Reports',
  '/reports/purchases': 'Purchase Reports',
  '/reports/inventory': 'Inventory Reports',
  '/crops': 'Crops Module',
  '/settings/farms': 'Farm Management',
  '/settings/members': 'Team Members',
  '/settings/import-export': 'Data Import & Export',
  '/settings': 'System Settings',
};

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showFarmDropdown, setShowFarmDropdown] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { currentFarm, farms, switchFarm } = useFarm();
  const { authUser, memberships, currentMembership, signOut, selectFarm, pendingMemberships } = useAuth();
  const { canManageMembers } = usePermissions();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const firebaseOk = isFirebaseConfigured();
  const pageTitle = PAGE_TITLES[location.pathname] || 'PoultryLog NG';
  const userRole = currentMembership?.role;

  return (
    <div className="app-layout">
      <div className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`} onClick={closeSidebar} />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon">🐔</div>
            <div>
              <h1>PoultryLog NG</h1>
              <span>Farm Management</span>
            </div>
          </div>
          {(farms.length > 1 || pendingMemberships.length > 0) && (
            <div className="farm-switcher" onClick={() => setShowFarmDropdown(!showFarmDropdown)}>
              <span className="material-icons-outlined" style={{ fontSize: 16 }}>agriculture</span>
              <span className="farm-name">{currentFarm?.farmName || 'Select Farm'}</span>
              <span className="material-icons-outlined" style={{ fontSize: 14 }}>expand_more</span>
              {showFarmDropdown && (
                <div className="farm-dropdown" onClick={e => e.stopPropagation()}>
                  {farms.map(f => (
                    <button
                      key={f.farmId}
                      className={`farm-dropdown-item ${f.farmId === currentFarm?.farmId ? 'active' : ''}`}
                      onClick={async () => { await selectFarm(f.farmId); await switchFarm(f.farmId); setShowFarmDropdown(false); }}
                    >
                      {f.farmName}
                      {f.farmId === currentFarm?.farmId && <span className="material-icons-outlined" style={{ fontSize: 14 }}>check</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {userRole && (
            <div className="farm-role-badge">
              {FARM_ROLE_LABELS[userRole]}
            </div>
          )}
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item, i) => {
            if ('section' in item && item.section) {
              return <div key={i} className="nav-section-title">{item.section}</div>;
            }
            const navItem = item as { to: string; icon: string; label: string; disabled?: boolean };
            return (
              <NavLink
                key={navItem.to}
                to={navItem.disabled ? '#' : navItem.to}
                className={({ isActive }) =>
                  `nav-item ${isActive ? 'active' : ''} ${navItem.disabled ? 'disabled' : ''}`
                }
                onClick={e => navItem.disabled && e.preventDefault()}
              >
                <span className="material-icons-outlined">{navItem.icon}</span>
                {navItem.label}
                {navItem.disabled && <span className="coming-soon">Soon</span>}
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <button className="sidebar-logout-btn" onClick={signOut}>
            <span className="material-icons-outlined">logout</span>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
            <span className="material-icons-outlined">menu</span>
          </button>
          <h2 className="page-title">{pageTitle}</h2>
          <div className="header-spacer" />
          {authUser && <NotificationsPanel />}
          <div className="sync-indicator">
            <span className={`sync-dot ${!isOnline ? 'offline' : ''}`} />
            {isOnline ? (firebaseOk ? 'Online' : 'Local') : 'Offline'}
          </div>
          {authUser && (
            <div className="user-profile-menu" ref={profileRef}>
              <button className="user-profile-btn" onClick={() => setShowProfileMenu(!showProfileMenu)}>
                {authUser.photoURL ? (
                  <img src={authUser.photoURL} alt="" className="user-avatar" referrerPolicy="no-referrer" />
                ) : (
                  <div className="user-avatar-placeholder">{authUser.displayName.charAt(0).toUpperCase()}</div>
                )}
              </button>
              {showProfileMenu && (
                <div className="profile-dropdown" onClick={e => e.stopPropagation()}>
                  <div className="profile-dropdown-header">
                    <img src={authUser.photoURL} alt="" className="profile-dropdown-avatar" referrerPolicy="no-referrer" />
                    <div>
                      <div className="profile-dropdown-name">{authUser.displayName}</div>
                      <div className="profile-dropdown-email">{authUser.email}</div>
                      {userRole && <div className="profile-dropdown-role">{FARM_ROLE_LABELS[userRole]}</div>}
                    </div>
                  </div>
                  <div className="profile-dropdown-divider" />
                  <button className="profile-dropdown-item" onClick={() => { setShowProfileMenu(false); window.location.href = '/settings/farms'; }}>
                    <span className="material-icons-outlined">agriculture</span>
                    Manage Farms
                  </button>
                  {canManageMembers && (
                    <button className="profile-dropdown-item" onClick={() => { setShowProfileMenu(false); window.location.href = '/settings/members'; }}>
                      <span className="material-icons-outlined">group</span>
                      Team Members
                    </button>
                  )}
                  <button className="profile-dropdown-item" onClick={() => { setShowProfileMenu(false); window.location.href = '/settings'; }}>
                    <span className="material-icons-outlined">settings</span>
                    Settings
                  </button>
                  <div className="profile-dropdown-divider" />
                  <button className="profile-dropdown-item danger" onClick={signOut}>
                    <span className="material-icons-outlined">logout</span>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )}
        </header>
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}
