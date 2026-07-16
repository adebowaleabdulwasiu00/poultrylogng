import { useState, useEffect } from 'react';
import { db, setSetting } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '@/components/ToastProvider';
import { NIGERIAN_STATES } from '@/db/types';

export default function CompanyInfoSettings() {
  const settings = useLiveQuery(() => db.settings.toArray()) || [];
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    farm_name: '', business_name: '', address: '', phone_numbers: '',
    email: '', website: '', tax_id: '', registration_number: '',
    currency: 'NGN', currency_symbol: '\u20a6', timezone: 'Africa/Lagos',
    country: 'Nigeria', state: '', logo: '',
  });

  useEffect(() => {
    if (settings.length === 0) return;
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;
    setForm(prev => ({ ...prev, ...map }));
  }, [settings]);

  function updateField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('Logo must be under 2MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setForm(prev => ({ ...prev, logo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(form)) {
        await setSetting(key, value, 'company');
      }
      toast('Company information saved');
    } catch {
      toast('Failed to save settings', 'error');
    }
    setSaving(false);
  }

  return (
    <div>
      <div className="settings-section-header">
        <h2>Company Information</h2>
        <p>Configure your business details for invoices, receipts, and reports</p>
      </div>

      <div className="settings-form">
        <div className="settings-form-row">
          <div className="form-group">
            <label className="form-label">Farm Name</label>
            <input className="form-input" value={form.farm_name} onChange={e => updateField('farm_name', e.target.value)} placeholder="e.g. Green Fields Poultry Farm" />
          </div>
          <div className="form-group">
            <label className="form-label">Business Name</label>
            <input className="form-input" value={form.business_name} onChange={e => updateField('business_name', e.target.value)} placeholder="e.g. Green Fields Agro Ltd" />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Logo</label>
          <div className="logo-upload-area">
            {form.logo && <img src={form.logo} alt="Logo" className="logo-preview" />}
            <div>
              <input type="file" accept="image/*" onChange={handleLogoUpload} id="logo-upload" style={{ display: 'none' }} />
              <label htmlFor="logo-upload" className="btn btn-secondary btn-sm">
                <span className="material-icons-outlined" style={{ fontSize: 16 }}>upload</span>
                {form.logo ? 'Change Logo' : 'Upload Logo'}
              </label>
              {form.logo && (
                <button className="btn btn-text btn-sm" onClick={() => updateField('logo', '')} style={{ marginLeft: 8, color: 'var(--md-error)' }}>
                  Remove
                </button>
              )}
              <p className="form-hint">Recommended: 200x200px, max 2MB</p>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Address</label>
          <textarea className="form-textarea" value={form.address} onChange={e => updateField('address', e.target.value)} rows={2} placeholder="Full business address" />
        </div>

        <div className="settings-form-row">
          <div className="form-group">
            <label className="form-label">Phone Numbers</label>
            <input className="form-input" value={form.phone_numbers} onChange={e => updateField('phone_numbers', e.target.value)} placeholder="e.g. 08012345678, 08098765432" />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input className="form-input" type="email" value={form.email} onChange={e => updateField('email', e.target.value)} placeholder="info@yourfarm.com" />
          </div>
        </div>

        <div className="settings-form-row">
          <div className="form-group">
            <label className="form-label">Website</label>
            <input className="form-input" value={form.website} onChange={e => updateField('website', e.target.value)} placeholder="www.yourfarm.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Tax Identification Number</label>
            <input className="form-input" value={form.tax_id} onChange={e => updateField('tax_id', e.target.value)} placeholder="TIN" />
          </div>
        </div>

        <div className="settings-form-row">
          <div className="form-group">
            <label className="form-label">Registration Number</label>
            <input className="form-input" value={form.registration_number} onChange={e => updateField('registration_number', e.target.value)} placeholder="RC Number" />
          </div>
          <div className="form-group">
            <label className="form-label">Currency</label>
            <div className="settings-form-row cols-2" style={{ marginBottom: 0 }}>
              <input className="form-input" value={form.currency} onChange={e => updateField('currency', e.target.value)} placeholder="NGN" />
              <input className="form-input" value={form.currency_symbol} onChange={e => updateField('currency_symbol', e.target.value)} placeholder="\u20a6" />
            </div>
          </div>
        </div>

        <div className="settings-form-row">
          <div className="form-group">
            <label className="form-label">Default Country</label>
            <input className="form-input" value={form.country} onChange={e => updateField('country', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Default State</label>
            <select className="form-select" value={form.state} onChange={e => updateField('state', e.target.value)}>
              <option value="">Select state...</option>
              {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Time Zone</label>
          <select className="form-select" value={form.timezone} onChange={e => updateField('timezone', e.target.value)}>
            <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
            <option value="Africa/Porto-Novo">Africa/Porto-Novo (WAT)</option>
            <option value="UTC">UTC</option>
          </select>
        </div>

        <div className="settings-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <span className="material-icons-outlined" style={{ fontSize: 18 }}>{saving ? 'hourglass_empty' : 'save'}</span>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
