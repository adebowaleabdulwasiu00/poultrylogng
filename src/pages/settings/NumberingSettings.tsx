import { useState, useEffect } from 'react';
import { db, setSetting, getSetting } from '@/db/database';
import { useToast } from '@/components/ToastProvider';

export default function NumberingSettings() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    sale_prefix: 'INV',
    purchase_prefix: 'PUR',
    receipt_prefix: 'RCP',
  });

  useEffect(() => {
    async function load() {
      const sale = await getSetting('sale_prefix', 'INV');
      const purchase = await getSetting('purchase_prefix', 'PUR');
      const receipt = await getSetting('receipt_prefix', 'RCP');
      setForm({ sale_prefix: sale, purchase_prefix: purchase, receipt_prefix: receipt });
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await setSetting('sale_prefix', form.sale_prefix, 'numbering');
      await setSetting('purchase_prefix', form.purchase_prefix, 'numbering');
      await setSetting('receipt_prefix', form.receipt_prefix, 'numbering');
      toast('Numbering settings saved');
    } catch {
      toast('Failed to save', 'error');
    }
    setSaving(false);
  }

  return (
    <div>
      <div className="settings-section-header">
        <h2>Numbering Sequences</h2>
        <p>Configure prefixes for invoice and receipt numbers</p>
      </div>

      <div className="settings-form">
        <div className="card mb-4" style={{ background: '#E3F2FD', padding: 16 }}>
          <div className="flex items-center gap-2">
            <span className="material-icons-outlined" style={{ color: 'var(--md-info)' }}>info</span>
            <span className="text-sm">Numbers are generated automatically in the format: <strong>PREFIX-YEAR-000001</strong></span>
          </div>
        </div>

        <div className="settings-form-row">
          <div className="form-group">
            <label className="form-label">Sales Invoice Prefix</label>
            <input className="form-input" value={form.sale_prefix} onChange={e => setForm(f => ({ ...f, sale_prefix: e.target.value.toUpperCase() }))} placeholder="INV" />
            <span className="form-hint">Example: {form.sale_prefix}-{new Date().getFullYear()}-000001</span>
          </div>
          <div className="form-group">
            <label className="form-label">Purchase Invoice Prefix</label>
            <input className="form-input" value={form.purchase_prefix} onChange={e => setForm(f => ({ ...f, purchase_prefix: e.target.value.toUpperCase() }))} placeholder="PUR" />
            <span className="form-hint">Example: {form.purchase_prefix}-{new Date().getFullYear()}-000001</span>
          </div>
        </div>

        <div className="settings-form-row">
          <div className="form-group">
            <label className="form-label">Receipt Prefix</label>
            <input className="form-input" value={form.receipt_prefix} onChange={e => setForm(f => ({ ...f, receipt_prefix: e.target.value.toUpperCase() }))} placeholder="RCP" />
            <span className="form-hint">Example: {form.receipt_prefix}-{new Date().getFullYear()}-000001</span>
          </div>
          <div className="form-group" />
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
