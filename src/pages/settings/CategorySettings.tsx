import { useState } from 'react';
import { db, nowISO } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '@/components/ToastProvider';
import { Modal, ConfirmDialog, Badge } from '@/components/UI';
import { queueSync } from '@/db/sync';
import type { ProductCategoryRecord } from '@/db/types';

export default function CategorySettings() {
  const categories = useLiveQuery(() => db.productCategories.toArray()) || [];
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProductCategoryRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductCategoryRecord | null>(null);
  const [form, setForm] = useState({ categoryName: '', description: '', sortOrder: 0 });

  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  function openNew() {
    setEditing(null);
    setForm({ categoryName: '', description: '', sortOrder: categories.length + 1 });
    setShowForm(true);
  }

  function openEdit(c: ProductCategoryRecord) {
    setEditing(c);
    setForm({ categoryName: c.categoryName, description: c.description, sortOrder: c.sortOrder });
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.categoryName.trim()) { toast('Category name is required', 'error'); return; }
    const now = nowISO();
    if (editing?.id) {
      await db.productCategories.update(editing.id, { ...form, updatedAt: now, syncStatus: 'pending' });
      await queueSync('productCategories', editing.id, 'update', { ...form, updatedAt: now });
      toast('Category updated');
    } else {
      const id = await db.productCategories.add({ ...form, status: 'active', createdAt: now, updatedAt: now, syncStatus: 'pending' } as ProductCategoryRecord);
      await queueSync('productCategories', id as number, 'create', { ...form, id, createdAt: now, updatedAt: now });
      toast('Category added');
    }
    setShowForm(false);
  }

  async function toggleStatus(c: ProductCategoryRecord) {
    const newStatus = c.status === 'active' ? 'inactive' : 'active';
    const now = nowISO();
    await db.productCategories.update(c.id!, { status: newStatus, updatedAt: now, syncStatus: 'pending' });
    await queueSync('productCategories', c.id!, 'update', { status: newStatus, updatedAt: now });
    toast(`Category ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    await db.productCategories.delete(deleteTarget.id);
    await queueSync('productCategories', deleteTarget.id, 'delete', null);
    toast('Category deleted');
    setDeleteTarget(null);
  }

  return (
    <div>
      <div className="settings-section-header">
        <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2>Product Categories</h2>
            <p>Manage categories for your product catalog</p>
          </div>
          <button className="btn btn-primary" onClick={openNew}>
            <span className="material-icons-outlined" style={{ fontSize: 18 }}>add</span>
            Add Category
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Category Name</th>
                <th>Description</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, i) => (
                <tr key={c.id}>
                  <td className="text-sm text-muted">{i + 1}</td>
                  <td><strong>{c.categoryName}</strong></td>
                  <td className="text-muted">{c.description || '-'}</td>
                  <td><Badge variant={c.status === 'active' ? 'success' : 'error'}>{c.status}</Badge></td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-icon btn-text btn-sm" onClick={() => openEdit(c)}>
                        <span className="material-icons-outlined" style={{ fontSize: 18 }}>edit</span>
                      </button>
                      <button className="btn btn-icon btn-text btn-sm" onClick={() => toggleStatus(c)}>
                        <span className="material-icons-outlined" style={{ fontSize: 18 }}>{c.status === 'active' ? 'block' : 'check_circle'}</span>
                      </button>
                      <button className="btn btn-icon btn-text btn-sm" onClick={() => setDeleteTarget(c)} style={{ color: 'var(--md-error)' }}>
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
        title={editing ? 'Edit Category' : 'Add Category'}
        onClose={() => setShowForm(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editing ? 'Update' : 'Add'}</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Category Name <span className="required">*</span></label>
          <input className="form-input" value={form.categoryName} onChange={e => setForm(f => ({ ...f, categoryName: e.target.value }))} placeholder="e.g. Eggs" autoFocus />
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
        title="Delete Category"
        message={`Delete "${deleteTarget?.categoryName}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
