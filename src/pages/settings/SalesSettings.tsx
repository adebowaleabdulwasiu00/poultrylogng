import { useState, useEffect } from 'react';
import { setSetting, getSetting } from '@/db/database';
import { useToast } from '@/components/ToastProvider';

export default function SalesSettings() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    prevent_negative_stock: 'true',
    default_payment_terms: '30',
    default_sales_tax_rate: '0',
    auto_generate_invoice: 'true',
  });

  useEffect(() => {
    async function load() {
      setForm({
        prevent_negative_stock: await getSetting('prevent_negative_stock', 'true'),
        default_payment_terms: await getSetting('default_payment_terms', '30'),
        default_sales_tax_rate: await getSetting('default_sales_tax_rate', '0'),
        auto_generate_invoice: await getSetting('auto_generate_invoice', 'true'),
      });
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(form)) {
        await setSetting(key, value, 'sales');
      }
      toast('Sales settings saved');
    } catch {
      toast('Failed to save', 'error');
    }
    setSaving(false);
  }

  return (
    <div>
      <div className="settings-section-header">
        <h2>Sales Settings</h2>
        <p>Configure default behavior for sales invoices</p>
      </div>

      <div className="settings-form">
        <div className="form-group">
          <label className="form-label">Prevent Negative Stock</label>
          <select className="form-select" value={form.prevent_negative_stock} onChange={e => setForm(f => ({ ...f, prevent_negative_stock: e.target.value }))}>
            <option value="true">Yes - Prevent sales when stock is insufficient</option>
            <option value="false">No - Allow negative stock</option>
          </select>
          <span className="form-hint">When enabled, the system will block sales that exceed available stock</span>
        </div>

        <div className="form-group">
          <label className="form-label">Auto-Generate Invoice Numbers</label>
          <select className="form-select" value={form.auto_generate_invoice} onChange={e => setForm(f => ({ ...f, auto_generate_invoice: e.target.value }))}>
            <option value="true">Yes - Automatically generate invoice numbers</option>
            <option value="false">No - Manual entry</option>
          </select>
        </div>

        <div className="settings-form-row">
          <div className="form-group">
            <label className="form-label">Default Payment Terms (Days)</label>
            <input className="form-input" type="number" min="0" value={form.default_payment_terms} onChange={e => setForm(f => ({ ...f, default_payment_terms: e.target.value }))} />
            <span className="form-hint">Default due date offset for credit sales</span>
          </div>
          <div className="form-group">
            <label className="form-label">Default Tax Rate (%)</label>
            <input className="form-input" type="number" min="0" max="100" step="0.5" value={form.default_sales_tax_rate} onChange={e => setForm(f => ({ ...f, default_sales_tax_rate: e.target.value }))} />
            <span className="form-hint">Applied to new invoices (0 = no tax)</span>
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
