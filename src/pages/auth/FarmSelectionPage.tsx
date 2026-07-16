import { useAuth } from '@/contexts/AuthContext';
import { FARM_ROLE_LABELS } from '@/db/types';

export default function FarmSelectionPage() {
  const { authUser, memberships, pendingMemberships, selectFarm, signOut } = useAuth();

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card" style={{ maxWidth: 600 }}>
          <div className="auth-logo" style={{ marginBottom: 16 }}>
            <div className="auth-logo-icon" style={{ width: 48, height: 48, fontSize: 24 }}>🐔</div>
            <h1 style={{ fontSize: 22 }}>Select a Farm</h1>
          </div>

          {authUser && (
            <div className="auth-user-info">
              <img src={authUser.photoURL} alt="" className="auth-user-avatar" referrerPolicy="no-referrer" />
              <div>
                <div className="auth-user-name">{authUser.displayName}</div>
                <div className="auth-user-email">{authUser.email}</div>
              </div>
            </div>
          )}

          <p className="text-secondary text-center mb-3">You have access to multiple farms. Select one to continue:</p>

          <div className="farm-selection-list">
            {memberships.map(mem => (
              <button key={mem.farmId} className="farm-selection-card" onClick={() => selectFarm(mem.farmId)}>
                <div className="farm-selection-info">
                  <h3>{mem.farmName}</h3>
                  <span className="farm-selection-role">{FARM_ROLE_LABELS[mem.role]}</span>
                </div>
                <span className="material-icons-outlined">chevron_right</span>
              </button>
            ))}
          </div>

          {pendingMemberships.length > 0 && (
            <div className="mt-3">
              <h4 className="text-secondary" style={{ fontSize: 13 }}>Pending Requests</h4>
              {pendingMemberships.map(mem => (
                <div key={mem.farmId} className="farm-selection-card pending">
                  <div className="farm-selection-info">
                    <h3>{mem.farmName}</h3>
                    <span className="text-secondary text-sm">Request pending approval</span>
                  </div>
                  <span className="material-icons-outlined" style={{ color: 'var(--md-warning)' }}>hourglass_top</span>
                </div>
              ))}
            </div>
          )}

          <div className="auth-actions mt-4">
            <button className="btn btn-outline" onClick={signOut}>
              <span className="material-icons-outlined" style={{ fontSize: 18 }}>logout</span>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
