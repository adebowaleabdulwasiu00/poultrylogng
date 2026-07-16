import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ToastProvider';
import { NIGERIAN_STATES } from '@/db/types';

interface Props { onBack: () => void; }

export default function CreateFarmWizard({ onBack }: Props) {
  const { authUser, createFarm } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    farmName: '', businessName: '', farmType: 'Poultry', description: '',
    country: 'Nigeria', state: '', lga: '', address: '',
    phone: '', email: authUser?.email || '', website: '',
    currency: 'NGN', timezone: 'Africa/Lagos', defaultLanguage: 'English', measurementUnits: 'Metric',
  });

  const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  async function handleCreate() {
    if (!form.farmName.trim()) { toast('Farm name is required', 'error'); return; }
    setCreating(true);
    try {
      await createFarm(form);
      toast('Farm created successfully!', 'success');
    } catch (err) {
      toast('Failed to create farm', 'error');
      setCreating(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card" style={{ maxWidth: 560 }}>
          <button className="btn-back" onClick={onBack}>
            <span className="material-icons-outlined">arrow_back</span>
          </button>

          <div className="auth-logo" style={{ marginBottom: 12 }}>
            <h1 style={{ fontSize: 20 }}>Create New Farm</h1>
          </div>

          <div className="wizard-steps">
            {[1, 2, 3].map(s => (
              <div key={s} className={`wizard-step ${step >= s ? 'active' : ''} ${step > s ? 'completed' : ''}`}>
                <div className="wizard-step-num">{step > s ? '✓' : s}</div>
                <span>{s === 1 ? 'Farm Info' : s === 2 ? 'Location' : 'Preferences'}</span>
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="wizard-content">
              <div className="form-group">
                <label>Farm Name *</label>
                <input value={form.farmName} onChange={e => update('farmName', e.target.value)} placeholder="e.g. Sunrise Poultry Farm" autoFocus />
              </div>
              <div className="form-group">
                <label>Business Name</label>
                <input value={form.businessName} onChange={e => update('businessName', e.target.value)} placeholder="e.g. Sunrise Agro Limited" />
              </div>
              <div className="form-group">
                <label>Farm Type</label>
                <select value={form.farmType} onChange={e => update('farmType', e.target.value)}>
                  <option>Poultry</option><option>Layer</option><option>Broiler</option>
                  <option>Breeder</option><option>Mixed</option><option>Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={form.description} onChange={e => update('description', e.target.value)} rows={2} placeholder="Brief description of your farm" />
              </div>

              <div className="auth-user-info" style={{ background: 'var(--md-surface-variant)', borderRadius: 'var(--md-radius-sm)', padding: 12 }}>
                <img src={authUser?.photoURL} alt="" className="auth-user-avatar" referrerPolicy="no-referrer" />
                <div>
                  <div className="text-sm text-secondary">Owner (you)</div>
                  <div className="auth-user-name" style={{ fontSize: 14 }}>{authUser?.displayName}</div>
                  <div className="auth-user-email" style={{ fontSize: 12 }}>{authUser?.email}</div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="wizard-content">
              <div className="form-group">
                <label>Country</label>
                <input value={form.country} onChange={e => update('country', e.target.value)} />
              </div>
              <div className="form-group">
                <label>State</label>
                <select value={form.state} onChange={e => update('state', e.target.value)}>
                  <option value="">Select State</option>
                  {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>LGA</label>
                <input value={form.lga} onChange={e => update('lga', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Address</label>
                <input value={form.address} onChange={e => update('address', e.target.value)} placeholder="Full farm address" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Phone</label>
                  <input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+234..." />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={e => update('email', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Website (Optional)</label>
                <input value={form.website} onChange={e => update('website', e.target.value)} placeholder="https://..." />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="wizard-content">
              <div className="form-row">
                <div className="form-group">
                  <label>Currency</label>
                  <select value={form.currency} onChange={e => update('currency', e.target.value)}>
                    <option value="NGN">NGN - Nigerian Naira</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="GHS">GHS - Ghanaian Cedi</option>
                    <option value="KES">KES - Kenyan Shilling</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Timezone</label>
                  <select value={form.timezone} onChange={e => update('timezone', e.target.value)}>
                    <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                    <option value="Africa/Accra">Africa/Accra (GMT)</option>
                    <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Language</label>
                  <select value={form.defaultLanguage} onChange={e => update('defaultLanguage', e.target.value)}>
                    <option>English</option><option>French</option><option>Yoruba</option><option>Hausa</option><option>Igbo</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Measurement Units</label>
                  <select value={form.measurementUnits} onChange={e => update('measurementUnits', e.target.value)}>
                    <option>Metric</option><option>Imperial</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="wizard-actions">
            {step > 1 && <button className="btn btn-outline" onClick={() => setStep(step - 1)}>Back</button>}
            {step < 3 ? (
              <button className="btn btn-primary" onClick={() => setStep(step + 1)}>Next</button>
            ) : (
              <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating...' : 'Create Farm'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
