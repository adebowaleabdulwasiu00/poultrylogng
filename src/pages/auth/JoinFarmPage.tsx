import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ToastProvider';
import { db } from '@/db/database';
import type { Farm } from '@/db/types';

interface Props { onBack: () => void; }

export default function JoinFarmPage({ onBack }: Props) {
  const { requestJoinFarm, signOut } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Farm[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSearch() {
    if (!search.trim()) return;
    const q = search.toLowerCase();
    const all = await db.farms.where('status').equals('active').toArray();
    const filtered = all.filter(f =>
      f.farmName.toLowerCase().includes(q) ||
      f.farmCode.toLowerCase().includes(q) ||
      f.businessName.toLowerCase().includes(q)
    );
    setResults(filtered);
  }

  async function handleSubmit() {
    if (!selectedFarm) return;
    setSubmitting(true);
    try {
      await requestJoinFarm(selectedFarm.farmId, message);
      setSubmitted(true);
      toast('Request submitted!', 'success');
    } catch {
      toast('Failed to submit request', 'error');
    }
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card" style={{ maxWidth: 480, textAlign: 'center' }}>
            <span className="material-icons-outlined" style={{ fontSize: 64, color: 'var(--md-warning)', marginBottom: 16 }}>pending_actions</span>
            <h2>Request Submitted</h2>
            <p className="text-secondary mt-2">
              Your request to join <strong>{selectedFarm?.farmName}</strong> has been sent to the farm administrators.
              You'll be notified once your request is reviewed.
            </p>
            <div className="auth-actions mt-4">
              <button className="btn btn-outline" onClick={onBack}>Back</button>
              <button className="btn btn-outline btn-sm" onClick={signOut}>Sign Out</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card" style={{ maxWidth: 520 }}>
          <button className="btn-back" onClick={onBack}>
            <span className="material-icons-outlined">arrow_back</span>
          </button>

          <div className="auth-logo" style={{ marginBottom: 16 }}>
            <h1 style={{ fontSize: 20 }}>Join Existing Farm</h1>
          </div>

          {!selectedFarm ? (
            <>
              <div className="search-bar" style={{ marginBottom: 16 }}>
                <span className="material-icons-outlined">search</span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Search by farm name, code, or business name..."
                  autoFocus
                />
                <button className="btn btn-sm btn-primary" onClick={handleSearch}>Search</button>
              </div>

              {results.length > 0 && (
                <div className="farm-selection-list">
                  {results.map(farm => (
                    <button key={farm.farmId} className="farm-selection-card" onClick={() => setSelectedFarm(farm)}>
                      <div className="farm-selection-info">
                        <h3>{farm.farmName}</h3>
                        <span className="text-secondary text-sm">{farm.farmCode} | {farm.farmType} | {farm.state || farm.country}</span>
                      </div>
                      <span className="material-icons-outlined">chevron_right</span>
                    </button>
                  ))}
                </div>
              )}

              {search && results.length === 0 && (
                <div className="text-center text-secondary" style={{ padding: 32 }}>
                  <span className="material-icons-outlined" style={{ fontSize: 48, opacity: 0.3 }}>search_off</span>
                  <p>No farms found matching "{search}"</p>
                </div>
              )}
            </>
          ) : (
            <div>
              <div className="farm-selection-card selected" style={{ marginBottom: 16 }}>
                <div className="farm-selection-info">
                  <h3>{selectedFarm.farmName}</h3>
                  <span className="text-secondary text-sm">{selectedFarm.farmCode} | {selectedFarm.farmType}</span>
                </div>
                <button className="btn btn-sm btn-outline" onClick={() => setSelectedFarm(null)}>Change</button>
              </div>

              <div className="form-group">
                <label>Message to Administrator (Optional)</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={3}
                  placeholder="Introduce yourself and explain why you'd like to join this farm..."
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button className="btn btn-outline" onClick={() => setSelectedFarm(null)}>Back</button>
                <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
