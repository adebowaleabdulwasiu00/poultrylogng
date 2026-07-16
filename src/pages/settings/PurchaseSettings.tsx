import { useState, useEffect } from 'react';
import { setSetting, getSetting } from '@/db/database';
import { useToast } from '@/components/ToastProvider';

export default function PurchaseSettings() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    default_purchase_terms: '30',
    default_purchase_tax_rate: '0',
    auto_generate_purchase_number: 'true',
  });

  useEffect(() => {
    async function load() {
      setForm({
        default_purchase_terms: await getSetting('default_purchase_terms', '30'),
        default_purchase_tax_rate: await getSetting('default_purchase_tax_rate', '0'),
        auto_generate_purchase_number: await getSetting('auto_generate_purchase_number', 'true'),
      });
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(form)) {
        await setSetting(key, value, 'purchase');
      }
      toast('Purchase settings saved');
    } catch {
      toast('Failed to save', 'error');
    }
    setSaving(false);
  }

  return (
    <div>
      <div className="settings-section-header">
        <h2>Purchase Settings</h2>
        <p>Configure default behavior for purchase invoices</p>
      </div>

      <div className="settings-form">
        <div className="form-group">
          <label className="form-label">Auto-Generate Purchase Numbers</label>
          <select className="form-select" value={form.auto_generate_purchase_number} onChange={e => setForm(f => ({ ...f, auto_generate_purchase_number: e.target.value }))}>
            <option value="true">Yes - Automatically generate purchase numbers</option>
            <option value="false">No - Manual entry</option>
          </select>
        </div>

        <div className="settings-form-row">
          <div className="form-group">
            <label className="form-label">Default Payment Terms (Days)</label>
            <input className="form-input" type="number" min="0" value={form.default_purchase_terms} onChange={e => setForm(f => ({ ...f, default_purchase_terms: e.target.value }))} />
            <span className="form-hint">Default due date offset for credit purchases</span>
          </div>
          <div className="form-group">
            <label className="form-label">Default Tax Rate (%)</label>
            <input className="form-input" type="number" min="0" max="100" step="0.5" value={form.default_purchase_tax_rate} onChange={e => setForm(f => ({ ...f, default_purchase_tax_rate: e.target.value }))} />
            <span className="form-hint">Applied to new purchase invoices (0 = no tax)</span>
          </div>
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
