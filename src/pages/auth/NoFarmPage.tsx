import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import CreateFarmWizard from './CreateFarmWizard';
import JoinFarmPage from './JoinFarmPage';

export default function NoFarmPage() {
  const { authUser, signOut } = useAuth();
  const [view, setView] = useState<'choose' | 'create' | 'join'>('choose');

  if (view === 'create') return <CreateFarmWizard onBack={() => setView('choose')} />;
  if (view === 'join') return <JoinFarmPage onBack={() => setView('choose')} />;

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card" style={{ maxWidth: 520 }}>
          <div className="auth-logo" style={{ marginBottom: 16 }}>
            <div className="auth-logo-icon" style={{ width: 48, height: 48, fontSize: 24 }}>🐔</div>
            <h1 style={{ fontSize: 22 }}>Get Started</h1>
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

          <p className="text-secondary text-center mb-4">
            You don't belong to any farm yet. Create your own farm or request to join an existing one.
          </p>

          <div className="no-farm-options">
            <button className="no-farm-option" onClick={() => setView('create')}>
              <span className="material-icons-outlined" style={{ fontSize: 40, color: 'var(--primary)' }}>add_business</span>
              <h3>Create New Farm</h3>
              <p>Set up your own farm and invite your team</p>
            </button>
            <button className="no-farm-option" onClick={() => setView('join')}>
              <span className="material-icons-outlined" style={{ fontSize: 40, color: 'var(--md-tertiary)' }}>group_add</span>
              <h3>Join Existing Farm</h3>
              <p>Request access to a farm you work with</p>
            </button>
          </div>

          <div className="auth-actions mt-4">
            <button className="btn btn-outline btn-sm" onClick={signOut}>
              <span className="material-icons-outlined" style={{ fontSize: 16 }}>logout</span>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
