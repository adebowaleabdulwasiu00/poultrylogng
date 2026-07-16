import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, nowISO, getActiveFarmId } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '@/components/ToastProvider';
import { Modal, EmptyState, SearchBar, Badge, ConfirmDialog } from '@/components/UI';
import { PAYMENT_METHODS } from '@/db/types';
import type { SupplierPayment } from '@/db/types';
import { queueSync } from '@/db/sync';

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  if (!src) return null;
  return (
    <div className="modal-overlay" onClick={onClose} style={{ cursor: 'zoom-out' }}>
      <button className="btn btn-icon" onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.6)', color: '#fff', zIndex: 10, borderRadius: '50%' }}>
        <span className="material-icons-outlined">close</span>
      </button>
      <img src={src} alt="Proof of Payment" onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }} />
    </div>
  );
}

export default function SupplierPayments() {
  const payments = useLiveQuery(() => db.supplierPayments.toArray()) || [];
  const suppliers = useLiveQuery(() => db.suppliers.where('status').equals('active').toArray()) || [];
  const [search, setSearch] = useState('');
  const [filterMethod, setFilterMethod] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SupplierPayment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupplierPayment | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [form, setForm] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    supplierId: 0,
    amountPaid: 0,
    paymentMethod: 'Cash',
    paymentReference: '',
    bank: '',
    staff: '',
    receiptNumber: '',
    notes: '',
    attachment: '',
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    let result = payments;
    if (filterMethod !== 'All') result = result.filter(p => p.paymentMethod === filterMethod);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.supplierName.toLowerCase().includes(q) ||
        p.receiptNumber.toLowerCase().includes(q) ||
        p.paymentReference.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  }, [payments, search, filterMethod]);

  const stats = useMemo(() => {
    const completed = payments.filter(p => p.status === 'completed');
    const total = completed.reduce((s, p) => s + p.amountPaid, 0);
    const today = new Date().toISOString().split('T')[0];
    const todayTotal = completed.filter(p => p.paymentDate === today).reduce((s, p) => s + p.amountPaid, 0);
    const largest = completed.length > 0 ? Math.max(...completed.map(p => p.amountPaid)) : 0;
    return { total, todayTotal, count: completed.length, largest };
  }, [payments]);

  function openNew() {
    setEditing(null);
    setForm({
      paymentDate: new Date().toISOString().split('T')[0],
      supplierId: 0, amountPaid: 0, paymentMethod: 'Cash', paymentReference: '',
      bank: '', staff: '', receiptNumber: '', notes: '', attachment: '',
    });
    setShowForm(true);
  }

  function openEdit(p: SupplierPayment) {
    setEditing(p);
    setForm({
      paymentDate: p.paymentDate,
      supplierId: p.supplierId,
      amountPaid: p.amountPaid,
      paymentMethod: p.paymentMethod,
      paymentReference: p.paymentReference,
      bank: p.bank,
      staff: p.staff,
      receiptNumber: p.receiptNumber,
      notes: p.notes,
      attachment: p.attachment || '',
    });
    setShowForm(true);
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, attachment: reader.result as string }));
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!form.supplierId) { toast('Select a supplier', 'error'); return; }
    if (form.amountPaid <= 0) { toast('Enter a valid amount', 'error'); return; }
    const supplier = suppliers.find(s => s.id === form.supplierId);
    if (!supplier) { toast('Invalid supplier', 'error'); return; }
    const now = nowISO();
    const farmId = await getActiveFarmId();
    const record: Omit<SupplierPayment, 'id'> = {
      farmId,
      paymentDate: form.paymentDate,
      supplierId: form.supplierId,
      supplierName: supplier.businessName,
      paymentReference: form.paymentReference,
      amountPaid: form.amountPaid,
      paymentMethod: form.paymentMethod,
      bank: form.bank,
      staff: form.staff,
      status: 'completed',
      receiptNumber: form.receiptNumber || `SPREC-${Date.now().toString(36).toUpperCase()}`,
      notes: form.notes,
      attachment: form.attachment,
      createdBy: 'user',
      createdAt: now,
      modifiedBy: 'user',
      updatedAt: now,
      syncDate: '',
      syncStatus: 'pending',
    };
    if (editing?.id) {
      await db.supplierPayments.update(editing.id, { ...record, syncStatus: 'pending' });
      await queueSync('supplierPayments', editing.id, 'update', record);
      toast('Payment updated');
    } else {
      const id = await db.supplierPayments.add(record as SupplierPayment);
      await db.suppliers.update(form.supplierId, { lastPaymentDate: form.paymentDate, updatedAt: now, syncStatus: 'pending' });
      await queueSync('supplierPayments', id as number, 'create', { ...record, id });
      toast('Payment recorded');
    }
    setShowForm(false);
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    await db.supplierPayments.delete(deleteTarget.id);
    await queueSync('supplierPayments', deleteTarget.id, 'delete', null);
    toast('Payment deleted');
    setDeleteTarget(null);
  }

  return (
    <div>
      <div className="grid grid-4 mb-6">
        <div className="stat-card">
          <div className="stat-icon green"><span className="material-icons-outlined">paid</span></div>
          <div className="stat-info"><h3>₦{stats.total.toLocaleString()}</h3><p>Total Payments</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><span className="material-icons-outlined">today</span></div>
          <div className="stat-info"><h3>₦{stats.todayTotal.toLocaleString()}</h3><p>Today's Payments</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><span className="material-icons-outlined">receipt</span></div>
          <div className="stat-info"><h3>{stats.count}</h3><p>Total Transactions</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><span className="material-icons-outlined">trending_up</span></div>
          <div className="stat-info"><h3>₦{stats.largest.toLocaleString()}</h3><p>Largest Payment</p></div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search payments..." />
          <select className="form-select" style={{ width: 'auto', minWidth: 140 }} value={filterMethod} onChange={e => setFilterMethod(e.target.value)}>
            <option value="All">All Methods</option>
            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <span className="material-icons-outlined" style={{ fontSize: 18 }}>add</span>
          Record Payment
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="payments"
          title="No Payments"
          description="Record supplier payments to track your disbursements"
          action={<button className="btn btn-primary" onClick={openNew}>Record Payment</button>}
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Receipt</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Staff</th>
                  <th>Proof</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td className="text-sm">{p.paymentDate}</td>
                    <td>
                      <button className="btn btn-text btn-sm" onClick={() => navigate(`/suppliers/${p.supplierId}`)} style={{ padding: 0, fontWeight: 600 }}>
                        {p.supplierName}
                      </button>
                    </td>
                    <td><code className="text-sm">{p.receiptNumber}</code></td>
                    <td><strong style={{ color: 'var(--md-success)' }}>₦{p.amountPaid.toLocaleString()}</strong></td>
                    <td><Badge variant="neutral">{p.paymentMethod}</Badge></td>
                    <td className="text-sm">{p.paymentReference || '-'}</td>
                    <td className="text-sm">{p.staff || '-'}</td>
                    <td>
                      {p.attachment ? (
                        <button className="proof-thumb-btn" onClick={() => setLightboxSrc(p.attachment || '')} title="View proof of payment">
                          <img src={p.attachment} alt="Proof" className="proof-thumb" />
                          <span className="material-icons-outlined proof-thumb-lens">zoom_in</span>
                        </button>
                      ) : (
                        <span className="text-sm" style={{ color: 'var(--md-outline)' }}>-</span>
                      )}
                    </td>
                    <td><Badge variant={p.status === 'completed' ? 'success' : p.status === 'pending' ? 'warning' : 'error'}>{p.status}</Badge></td>
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
        title={editing ? 'Edit Payment' : 'Record Supplier Payment'}
        onClose={() => setShowForm(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editing ? 'Update' : 'Record Payment'}</button>
          </>
        }
      >
        <div className="form-row cols-2">
          <div className="form-group">
            <label className="form-label">Payment Date</label>
            <input className="form-input" type="date" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Supplier <span className="required">*</span></label>
            <select className="form-select" value={form.supplierId || ''} onChange={e => setForm(f => ({ ...f, supplierId: Number(e.target.value) }))}>
              <option value="">Select supplier...</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.businessName} ({s.supplierCode})</option>)}
            </select>
          </div>
        </div>
        <div className="form-row cols-2">
          <div className="form-group">
            <label className="form-label">Amount (₦) <span className="required">*</span></label>
            <input className="form-input" type="number" min="1" step="0.01" value={form.amountPaid || ''} onChange={e => setForm(f => ({ ...f, amountPaid: Number(e.target.value) }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <select className="form-select" value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row cols-2">
          <div className="form-group">
            <label className="form-label">Bank</label>
            <input className="form-input" value={form.bank} onChange={e => setForm(f => ({ ...f, bank: e.target.value }))} placeholder="Bank name" />
          </div>
          <div className="form-group">
            <label className="form-label">Payment Reference</label>
            <input className="form-input" value={form.paymentReference} onChange={e => setForm(f => ({ ...f, paymentReference: e.target.value }))} placeholder="Transfer reference" />
          </div>
        </div>
        <div className="form-row cols-2">
          <div className="form-group">
            <label className="form-label">Receipt Number</label>
            <input className="form-input" value={form.receiptNumber} onChange={e => setForm(f => ({ ...f, receiptNumber: e.target.value }))} placeholder="Auto-generated if empty" />
          </div>
          <div className="form-group">
            <label className="form-label">Staff</label>
            <input className="form-input" value={form.staff} onChange={e => setForm(f => ({ ...f, staff: e.target.value }))} placeholder="Staff name" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional notes" />
        </div>
        <div className="form-group">
          <label className="form-label">Proof of Payment (Optional)</label>
          {form.attachment ? (
            <div className="proof-upload-preview">
              <img src={form.attachment} alt="Proof preview" className="proof-preview-img" />
              <div className="proof-upload-actions">
                <button className="btn btn-sm btn-outline" type="button" onClick={() => setLightboxSrc(form.attachment)}>
                  <span className="material-icons-outlined" style={{ fontSize: 16 }}>zoom_in</span> View Full
                </button>
                <button className="btn btn-sm btn-danger-outline" type="button" onClick={() => setForm(f => ({ ...f, attachment: '' }))}>
                  <span className="material-icons-outlined" style={{ fontSize: 16 }}>delete</span> Remove
                </button>
              </div>
            </div>
          ) : (
            <label className="upload-zone" style={{ padding: '24px 16px' }}>
              <input type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} />
              <span className="material-icons-outlined" style={{ fontSize: 32, color: 'var(--md-outline)', display: 'block', marginBottom: 8 }}>cloud_upload</span>
              <span style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>Click to upload receipt or transfer screenshot</span>
              <span style={{ fontSize: 11, color: 'var(--md-outline)', marginTop: 4 }}>JPG, PNG or WebP (max 5MB)</span>
            </label>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Payment"
        message={`Delete payment of ₦${deleteTarget?.amountPaid.toLocaleString()} to "${deleteTarget?.supplierName}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmLabel="Delete"
        danger
      />

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
