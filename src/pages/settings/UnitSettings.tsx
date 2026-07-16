import { useState } from 'react';
import { db, nowISO } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '@/components/ToastProvider';
import { Modal, ConfirmDialog, Badge } from '@/components/UI';
import { queueSync } from '@/db/sync';
import type { UnitRecord } from '@/db/types';

export default function UnitSettings() {
  const units = useLiveQuery(() => db.units.toArray()) || [];
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UnitRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UnitRecord | null>(null);
  const [form, setForm] = useState({ unitName: '', abbreviation: '', category: 'General', sortOrder: 0 });

  const sorted = [...units].sort((a, b) => a.sortOrder - b.sortOrder);

  function openNew() {
    setEditing(null);
    setForm({ unitName: '', abbreviation: '', category: 'General', sortOrder: units.length + 1 });
    setShowForm(true);
  }

  function openEdit(u: UnitRecord) {
    setEditing(u);
    setForm({ unitName: u.unitName, abbreviation: u.abbreviation, category: u.category, sortOrder: u.sortOrder });
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.unitName.trim()) { toast('Unit name is required', 'error'); return; }
    if (!form.abbreviation.trim()) { toast('Abbreviation is required', 'error'); return; }
    const now = nowISO();
    if (editing?.id) {
      await db.units.update(editing.id, { ...form, updatedAt: now, syncStatus: 'pending' });
      await queueSync('units', editing.id, 'update', { ...form, updatedAt: now });
      toast('Unit updated');
    } else {
      const id = await db.units.add({ ...form, status: 'active', createdAt: now, updatedAt: now, syncStatus: 'pending' } as UnitRecord);
      await queueSync('units', id as number, 'create', { ...form, id, createdAt: now, updatedAt: now });
      toast('Unit added');
    }
    setShowForm(false);
  }

  async function toggleStatus(u: UnitRecord) {
    const newStatus = u.status === 'active' ? 'inactive' : 'active';
    const now = nowISO();
    await db.units.update(u.id!, { status: newStatus, updatedAt: now, syncStatus: 'pending' });
    await queueSync('units', u.id!, 'update', { status: newStatus, updatedAt: now });
    toast(`Unit ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    await db.units.delete(deleteTarget.id);
    await queueSync('units', deleteTarget.id, 'delete', null);
    toast('Unit deleted');
    setDeleteTarget(null);
  }

  return (
    <div>
      <div className="settings-section-header">
        <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2>Units of Measurement</h2>
            <p>Manage measurement units used for products</p>
          </div>
          <button className="btn btn-primary" onClick={openNew}>
            <span className="material-icons-outlined" style={{ fontSize: 18 }}>add</span>
            Add Unit
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Unit Name</th>
                <th>Abbreviation</th>
                <th>Category</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((u, i) => (
                <tr key={u.id}>
                  <td className="text-sm text-muted">{i + 1}</td>
                  <td><strong>{u.unitName}</strong></td>
                  <td>{u.abbreviation}</td>
                  <td><Badge variant="info">{u.category}</Badge></td>
                  <td><Badge variant={u.status === 'active' ? 'success' : 'error'}>{u.status}</Badge></td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-icon btn-text btn-sm" onClick={() => openEdit(u)}>
                        <span className="material-icons-outlined" style={{ fontSize: 18 }}>edit</span>
                      </button>
                      <button className="btn btn-icon btn-text btn-sm" onClick={() => toggleStatus(u)}>
                        <span className="material-icons-outlined" style={{ fontSize: 18 }}>{u.status === 'active' ? 'block' : 'check_circle'}</span>
                      </button>
                      <button className="btn btn-icon btn-text btn-sm" onClick={() => setDeleteTarget(u)} style={{ color: 'var(--md-error)' }}>
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
        title={editing ? 'Edit Unit' : 'Add Unit'}
        onClose={() => setShowForm(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editing ? 'Update' : 'Add'}</button>
          </>
        }
      >
        <div className="settings-form-row">
          <div className="form-group">
            <label className="form-label">Unit Name <span className="required">*</span></label>
            <input className="form-input" value={form.unitName} onChange={e => setForm(f => ({ ...f, unitName: e.target.value }))} placeholder="e.g. Kilogram" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Abbreviation <span className="required">*</span></label>
            <input className="form-input" value={form.abbreviation} onChange={e => setForm(f => ({ ...f, abbreviation: e.target.value }))} placeholder="e.g. kg" />
          </div>
        </div>
        <div className="settings-form-row">
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              <option value="Weight">Weight</option>
              <option value="Volume">Volume</option>
              <option value="Count">Count</option>
              <option value="Container">Container</option>
              <option value="General">General</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Sort Order</label>
            <input className="form-input" type="number" min="1" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Unit"
        message={`Delete "${deleteTarget?.unitName}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
