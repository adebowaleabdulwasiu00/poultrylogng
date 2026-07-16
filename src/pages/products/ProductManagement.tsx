import { useState, useMemo, useRef } from 'react';
import { db, generateId, nowISO, getActiveFarmId } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '@/components/ToastProvider';
import { Modal, EmptyState, SearchBar, Badge, ConfirmDialog } from '@/components/UI';
import { useSettings } from '@/hooks/useSettings';
import type { Product } from '@/db/types';
import { queueSync } from '@/db/sync';

const emptyProduct = (): Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'syncDate'> => ({
  farmId: '',
  productId: '',
  productName: '',
  category: 'Eggs',
  unit: 'pieces',
  currentStock: 0,
  minimumStock: 0,
  sellingPrice: 0,
  purchasePrice: 0,
  image: '',
  status: 'active',
  createdBy: 'user',
  modifiedBy: 'user',
});

export default function ProductManagement() {
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const { productCategories, units } = useSettings();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyProduct());
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(p =>
      p.productName.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.productId.toLowerCase().includes(q)
    );
  }, [products, search]);

  function openNew() { setEditing(null); setForm(emptyProduct()); setShowForm(true); }
  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      farmId: p.farmId, productId: p.productId, productName: p.productName, category: p.category, unit: p.unit,
      currentStock: p.currentStock, minimumStock: p.minimumStock,
      sellingPrice: p.sellingPrice, purchasePrice: p.purchasePrice,
      image: p.image || '',
      status: p.status, createdBy: p.createdBy, modifiedBy: p.modifiedBy,
    });
    setShowForm(true);
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast('Image must be under 5MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, image: reader.result as string }));
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.productName) { toast('Product name is required', 'error'); return; }
    const now = nowISO();
    if (editing?.id) {
      const existing = await db.products.get(editing.id);
      if (!existing) { toast('Product not found', 'error'); setShowForm(false); return; }
      const updated: Product = { ...existing, ...form, updatedAt: now, syncStatus: 'pending' };
      await db.products.put(updated);
      await queueSync('products', editing.id, 'update', updated);
      toast('Product updated');
    } else {
      const farmId = await getActiveFarmId();
      const id = await db.products.add({
        ...form, farmId, productId: form.productId || generateId(), createdAt: now, updatedAt: now, syncDate: '', syncStatus: 'pending',
      } as Product);
      await queueSync('products', id as number, 'create', { ...form, id, createdAt: now, updatedAt: now });
      toast('Product created');
    }
    setShowForm(false);
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    await db.products.delete(deleteTarget.id);
    await queueSync('products', deleteTarget.id, 'delete', null);
    toast('Product deleted');
    setDeleteTarget(null);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search products..." />
        <button className="btn btn-primary" onClick={openNew}>
          <span className="material-icons-outlined" style={{ fontSize: 18 }}>add</span>
          New Product
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="category"
          title="No Products"
          description="Add products to track inventory, purchases, and sales"
          action={<button className="btn btn-primary" onClick={openNew}>Add First Product</button>}
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Stock</th>
                  <th>Min Stock</th>
                  <th>Purchase ₦</th>
                  <th>Selling ₦</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td style={{ padding: '6px 8px' }}>
                      {p.image ? (
                        <div className="product-thumb-btn" onClick={() => setLightboxSrc(p.image || '')} title="View image">
                          <img src={p.image} alt="" className="product-thumb" />
                          <span className="material-icons-outlined product-thumb-lens">zoom_in</span>
                        </div>
                      ) : (
                        <div className="product-thumb-placeholder">
                          <span className="material-icons-outlined" style={{ fontSize: 18, color: 'var(--md-outline)' }}>image</span>
                        </div>
                      )}
                    </td>
                    <td><strong>{p.productName}</strong></td>
                    <td><Badge variant="neutral">{p.category}</Badge></td>
                    <td>
                      <span style={{ color: p.currentStock <= p.minimumStock ? 'var(--md-error)' : 'inherit', fontWeight: p.currentStock <= p.minimumStock ? 700 : 400 }}>
                        {p.currentStock} {p.unit}
                      </span>
                    </td>
                    <td>{p.minimumStock}</td>
                    <td>₦{p.purchasePrice.toLocaleString()}</td>
                    <td>₦{p.sellingPrice.toLocaleString()}</td>
                    <td><Badge variant={p.status === 'active' ? 'success' : 'neutral'}>{p.status}</Badge></td>
                    <td>
                      <div className="actions">
                        <button className="btn btn-icon btn-text btn-sm" onClick={() => openEdit(p)}>
                          <span className="material-icons-outlined" style={{ fontSize: 18 }}>edit</span>
                        </button>
                        <button className="btn btn-icon btn-text btn-sm" onClick={() => setDeleteTarget(p)} style={{ color: 'var(--md-error)' }}>
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
      )}

      <Modal
        open={showForm}
        title={editing ? 'Edit Product' : 'New Product'}
        onClose={() => setShowForm(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editing ? 'Update' : 'Create'}</button>
          </>
        }
      >
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flexShrink: 0 }}>
            {form.image ? (
              <div className="product-form-preview" onClick={() => setLightboxSrc(form.image || '')}>
                <img src={form.image} alt="Product" className="product-form-img" />
                <div className="product-form-preview-overlay">
                  <span className="material-icons-outlined">zoom_in</span>
                </div>
              </div>
            ) : (
              <div className="product-form-placeholder" onClick={() => fileInputRef.current?.click()}>
                <span className="material-icons-outlined" style={{ fontSize: 32, color: 'var(--md-outline)' }}>add_a_photo</span>
                <span className="text-xs text-muted">Add Image</span>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
            {form.image && (
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                <button className="btn btn-sm btn-outline" type="button" onClick={() => fileInputRef.current?.click()}>
                  <span className="material-icons-outlined" style={{ fontSize: 14 }}>edit</span> Change
                </button>
                <button className="btn btn-sm btn-outline" type="button" style={{ color: 'var(--md-error)' }} onClick={() => setForm(f => ({ ...f, image: '' }))}>
                  <span className="material-icons-outlined" style={{ fontSize: 14 }}>delete</span> Remove
                </button>
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="form-row cols-2">
              <div className="form-group">
                <label className="form-label">Product Name <span className="required">*</span></label>
                <input className="form-input" value={form.productName} onChange={e => setForm(f => ({ ...f, productName: e.target.value }))} placeholder="e.g. Eggs (Crate)" />
              </div>
              <div className="form-group">
                <label className="form-label">Product ID</label>
                <input className="form-input" value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))} placeholder="Auto-generated if empty" />
              </div>
            </div>
            <div className="form-row cols-2">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {productCategories.map(c => <option key={c.id} value={c.categoryName}>{c.categoryName}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select className="form-select" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                  {units.map(u => <option key={u.id} value={u.abbreviation || u.unitName}>{u.unitName} ({u.abbreviation})</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
        <div className="form-row cols-3">
          <div className="form-group">
            <label className="form-label">Current Stock</label>
            <input className="form-input" type="number" min="0" value={form.currentStock || ''} onChange={e => setForm(f => ({ ...f, currentStock: Number(e.target.value) }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Minimum Stock</label>
            <input className="form-input" type="number" min="0" value={form.minimumStock || ''} onChange={e => setForm(f => ({ ...f, minimumStock: Number(e.target.value) }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as 'active' | 'inactive' }))}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="form-row cols-2">
          <div className="form-group">
            <label className="form-label">Purchase Price (₦)</label>
            <input className="form-input" type="number" min="0" step="0.01" value={form.purchasePrice || ''} onChange={e => setForm(f => ({ ...f, purchasePrice: Number(e.target.value) }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Selling Price (₦)</label>
            <input className="form-input" type="number" min="0" step="0.01" value={form.sellingPrice || ''} onChange={e => setForm(f => ({ ...f, sellingPrice: Number(e.target.value) }))} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Product"
        message={`Delete "${deleteTarget?.productName}"? This will not affect existing purchases or sales.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmLabel="Delete"
        danger
      />

      {lightboxSrc && (
        <div className="modal-overlay" onClick={() => setLightboxSrc(null)} style={{ cursor: 'zoom-out' }}>
          <button className="btn btn-icon" onClick={() => setLightboxSrc(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.6)', color: '#fff', zIndex: 10, borderRadius: '50%' }}>
            <span className="material-icons-outlined">close</span>
          </button>
          <img src={lightboxSrc} alt="Product" onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }} />
        </div>
      )}
    </div>
  );
}
