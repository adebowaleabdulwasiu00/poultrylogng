import { useState } from 'react';
import { db, nowISO } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '@/components/ToastProvider';
import { Modal, ConfirmDialog, SearchBar, Badge } from '@/components/UI';
import { queueSync } from '@/db/sync';
import type { Bank } from '@/db/types';

export default function BankManagement() {
  const banks = useLiveQuery(() => db.banks.toArray()) || [];
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Bank | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bank | null>(null);
  const [form, setForm] = useState({ bankName: '', shortName: '', bankCode: '', sortOrder: 0, notes: '' });

  const filtered = banks.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    return b.bankName.toLowerCase().includes(q) || b.shortName.toLowerCase().includes(q) || b.bankCode.includes(q);
  }).sort((a, b) => a.sortOrder - b.sortOrder);

  function openNew() {
    setEditing(null);
    setForm({ bankName: '', shortName: '', bankCode: '', sortOrder: banks.length + 1, notes: '' });
    setShowForm(true);
  }

  function openEdit(b: Bank) {
    setEditing(b);
    setForm({ bankName: b.bankName, shortName: b.shortName, bankCode: b.bankCode, sortOrder: b.sortOrder, notes: b.notes });
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.bankName.trim()) { toast('Bank name is required', 'error'); return; }
    const now = nowISO();
    if (editing?.id) {
      await db.banks.update(editing.id, { ...form, updatedAt: now, syncStatus: 'pending' });
      await queueSync('banks', editing.id, 'update', { ...form, updatedAt: now });
      toast('Bank updated');
    } else {
      const id = await db.banks.add({ ...form, status: 'active', createdAt: now, updatedAt: now, syncStatus: 'pending' } as Bank);
      await queueSync('banks', id as number, 'create', { ...form, id, createdAt: now, updatedAt: now });
      toast('Bank added');
    }
    setShowForm(false);
  }

  async function toggleStatus(b: Bank) {
    const newStatus = b.status === 'active' ? 'inactive' : 'active';
    const now = nowISO();
    await db.banks.update(b.id!, { status: newStatus, updatedAt: now, syncStatus: 'pending' });
    await queueSync('banks', b.id!, 'update', { status: newStatus, updatedAt: now });
    toast(`Bank ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    await db.banks.delete(deleteTarget.id);
    await queueSync('banks', deleteTarget.id, 'delete', null);
    toast('Bank deleted');
    setDeleteTarget(null);
  }

  return (
    <div>
      <div className="settings-section-header">
        <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2>Bank Management</h2>
            <p>Manage banks used across the application</p>
          </div>
          <button className="btn btn-primary" onClick={openNew}>
            <span className="material-icons-outlined" style={{ fontSize: 18 }}>add</span>
            Add Bank
          </button>
        </div>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Search banks..." />

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Bank Name</th>
                <th>Short Name</th>
                <th>Bank Code</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b, i) => (
                <tr key={b.id}>
                  <td className="text-sm text-muted">{i + 1}</td>
                  <td><strong>{b.bankName}</strong></td>
                  <td>{b.shortName}</td>
                  <td>{b.bankCode}</td>
                  <td>
                    <Badge variant={b.status === 'active' ? 'success' : 'error'}>{b.status}</Badge>
                  </td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-icon btn-text btn-sm" onClick={() => openEdit(b)}>
                        <span className="material-icons-outlined" style={{ fontSize: 18 }}>edit</span>
                      </button>
                      <button className="btn btn-icon btn-text btn-sm" onClick={() => toggleStatus(b)}>
                        <span className="material-icons-outlined" style={{ fontSize: 18 }}>{b.status === 'active' ? 'block' : 'check_circle'}</span>
                      </button>
                      <button className="btn btn-icon btn-text btn-sm" onClick={() => setDeleteTarget(b)} style={{ color: 'var(--md-error)' }}>
                        <span className="material-icons-outlined" style={{ fontSize: 18 }}>delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--md-on-surface-variant)' }}>No banks found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={showForm}
        title={editing ? 'Edit Bank' : 'Add Bank'}
        onClose={() => setShowForm(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editing ? 'Update' : 'Add Bank'}</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Bank Name <span className="required">*</span></label>
          <input className="form-input" value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} placeholder="e.g. Guaranty Trust Bank" autoFocus />
        </div>
        <div className="settings-form-row">
          <div className="form-group">
            <label className="form-label">Short Name</label>
            <input className="form-input" value={form.shortName} onChange={e => setForm(f => ({ ...f, shortName: e.target.value }))} placeholder="e.g. GTBank" />
          </div>
          <div className="form-group">
            <label className="form-label">Bank Code</label>
            <input className="form-input" value={form.bankCode} onChange={e => setForm(f => ({ ...f, bankCode: e.target.value }))} placeholder="e.g. 058" />
          </div>
        </div>
        <div className="settings-form-row">
          <div className="form-group">
            <label className="form-label">Sort Order</label>
            <input className="form-input" type="number" min="1" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional notes" />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Bank"
        message={`Delete "${deleteTarget?.bankName}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
