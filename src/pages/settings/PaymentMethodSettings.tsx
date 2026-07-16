import { useState } from 'react';
import { db, nowISO } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '@/components/ToastProvider';
import { Modal, ConfirmDialog, Badge } from '@/components/UI';
import { queueSync } from '@/db/sync';
import type { PaymentMethodRecord } from '@/db/types';

export default function PaymentMethodSettings() {
  const methods = useLiveQuery(() => db.paymentMethods.toArray()) || [];
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PaymentMethodRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentMethodRecord | null>(null);
  const [form, setForm] = useState({ methodName: '', description: '', sortOrder: 0 });

  const sorted = [...methods].sort((a, b) => a.sortOrder - b.sortOrder);

  function openNew() {
    setEditing(null);
    setForm({ methodName: '', description: '', sortOrder: methods.length + 1 });
    setShowForm(true);
  }

  function openEdit(m: PaymentMethodRecord) {
    setEditing(m);
    setForm({ methodName: m.methodName, description: m.description, sortOrder: m.sortOrder });
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.methodName.trim()) { toast('Method name is required', 'error'); return; }
    const now = nowISO();
    if (editing?.id) {
      await db.paymentMethods.update(editing.id, { ...form, updatedAt: now, syncStatus: 'pending' });
      await queueSync('paymentMethods', editing.id, 'update', { ...form, updatedAt: now });
      toast('Payment method updated');
    } else {
      const id = await db.paymentMethods.add({ ...form, status: 'active', createdAt: now, updatedAt: now, syncStatus: 'pending' } as PaymentMethodRecord);
      await queueSync('paymentMethods', id as number, 'create', { ...form, id, createdAt: now, updatedAt: now });
      toast('Payment method added');
    }
    setShowForm(false);
  }

  async function toggleStatus(m: PaymentMethodRecord) {
    const newStatus = m.status === 'active' ? 'inactive' : 'active';
    const now = nowISO();
    await db.paymentMethods.update(m.id!, { status: newStatus, updatedAt: now, syncStatus: 'pending' });
    await queueSync('paymentMethods', m.id!, 'update', { status: newStatus, updatedAt: now });
    toast(`Method ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    await db.paymentMethods.delete(deleteTarget.id);
    await queueSync('paymentMethods', deleteTarget.id, 'delete', null);
    toast('Payment method deleted');
    setDeleteTarget(null);
  }

  return (
    <div>
      <div className="settings-section-header">
        <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2>Payment Methods</h2>
            <p>Configure payment methods used in sales and purchases</p>
          </div>
          <button className="btn btn-primary" onClick={openNew}>
            <span className="material-icons-outlined" style={{ fontSize: 18 }}>add</span>
            Add Method
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Method Name</th>
                <th>Description</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m, i) => (
                <tr key={m.id}>
                  <td className="text-sm text-muted">{i + 1}</td>
                  <td><strong>{m.methodName}</strong></td>
                  <td className="text-muted">{m.description || '-'}</td>
                  <td><Badge variant={m.status === 'active' ? 'success' : 'error'}>{m.status}</Badge></td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-icon btn-text btn-sm" onClick={() => openEdit(m)}>
                        <span className="material-icons-outlined" style={{ fontSize: 18 }}>edit</span>
                      </button>
                      <button className="btn btn-icon btn-text btn-sm" onClick={() => toggleStatus(m)}>
                        <span className="material-icons-outlined" style={{ fontSize: 18 }}>{m.status === 'active' ? 'block' : 'check_circle'}</span>
                      </button>
                      <button className="btn btn-icon btn-text btn-sm" onClick={() => setDeleteTarget(m)} style={{ color: 'var(--md-error)' }}>
                        <span className="material-icons-outlined" style={{ fontSize: 18 }}>delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={showForm}
        title={editing ? 'Edit Payment Method' : 'Add Payment Method'}
        onClose={() => setShowForm(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editing ? 'Update' : 'Add'}</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Method Name <span className="required">*</span></label>
          <input className="form-input" value={form.methodName} onChange={e => setForm(f => ({ ...f, methodName: e.target.value }))} placeholder="e.g. Mobile Money" autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description" />
        </div>
        <div className="form-group">
          <label className="form-label">Sort Order</label>
          <input className="form-input" type="number" min="1" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))} />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Payment Method"
        message={`Delete "${deleteTarget?.methodName}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
