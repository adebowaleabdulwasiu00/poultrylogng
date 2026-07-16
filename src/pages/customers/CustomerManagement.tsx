import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, generateId, nowISO, getActiveFarmId } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '@/components/ToastProvider';
import { Modal, EmptyState, SearchBar, Badge, ConfirmDialog } from '@/components/UI';
import { CUSTOMER_CATEGORIES, NIGERIAN_STATES } from '@/db/types';
import type { Customer } from '@/db/types';
import { queueSync } from '@/db/sync';

const initialForm = {
  fullName: '',
  contactPerson: '',
  phone: '',
  alternativePhone: '',
  email: '',
  physicalAddress: '',
  state: '',
  lga: '',
  category: 'Retail',
  creditLimit: 0,
  openingBalance: 0,
  notes: '',
  profilePhoto: '',
};

export default function CustomerManagement() {
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const sales = useLiveQuery(() => db.sales.toArray()) || [];
  const payments = useLiveQuery(() => db.customerPayments.toArray()) || [];
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [form, setForm] = useState(initialForm);
  const { toast } = useToast();
  const navigate = useNavigate();

  function getComputedFields(c: Customer) {
    const custSales = sales.filter(s => s.customerId === c.id);
    const custPayments = payments.filter(p => p.customerId === c.id);
    const totalPurchases = custSales.reduce((s, r) => s + r.totalAmount, 0);
    const totalPayments = custPayments.filter(p => p.status === 'completed').reduce((s, r) => s + r.amountPaid, 0);
    const outstanding = c.openingBalance + totalPurchases - totalPayments;
    return { totalPurchases, totalPayments, outstanding };
  }

  const filtered = useMemo(() => {
    let result = customers;
    if (filterCategory !== 'All') result = result.filter(c => c.category === filterCategory);
    if (filterStatus !== 'All') result = result.filter(c => c.status === filterStatus.toLowerCase());
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.fullName.toLowerCase().includes(q) ||
        c.customerCode.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.contactPerson.toLowerCase().includes(q)
      );
    }
    return result;
  }, [customers, search, filterCategory, filterStatus, sales, payments]);

  const stats = useMemo(() => {
    const active = customers.filter(c => c.status === 'active').length;
    const totalOutstanding = customers.reduce((s, c) => s + getComputedFields(c).outstanding, 0);
    const totalPurchases = customers.reduce((s, c) => s + getComputedFields(c).totalPurchases, 0);
    const exceedingCredit = customers.filter(c => {
      const { outstanding } = getComputedFields(c);
      return c.creditLimit > 0 && outstanding > c.creditLimit;
    }).length;
    return { active, totalOutstanding, totalPurchases, exceedingCredit };
  }, [customers, sales, payments]);

  function openNew() {
    setEditing(null);
    setForm(initialForm);
    setShowForm(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      fullName: c.fullName,
      contactPerson: c.contactPerson,
      phone: c.phone,
      alternativePhone: c.alternativePhone,
      email: c.email,
      physicalAddress: c.physicalAddress,
      state: c.state,
      lga: c.lga,
      category: c.category,
      creditLimit: c.creditLimit,
      openingBalance: c.openingBalance,
      notes: c.notes,
      profilePhoto: c.profilePhoto || '',
    });
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.fullName.trim()) {
      toast('Customer name is required', 'error');
      return;
    }
    if (!form.phone.trim()) {
      toast('Phone number is required', 'error');
      return;
    }
    const now = nowISO();
    const code = 'CUST-' + String(editing?.id || Date.now()).slice(-6).toUpperCase();

    const farmId = await getActiveFarmId();
    const record: Omit<Customer, 'id'> = {
      farmId,
      customerId: editing?.customerId || generateId(),
      customerCode: editing?.customerCode || code,
      fullName: form.fullName.trim(),
      contactPerson: form.contactPerson.trim(),
      phone: form.phone.trim(),
      alternativePhone: form.alternativePhone.trim(),
      email: form.email.trim(),
      physicalAddress: form.physicalAddress.trim(),
      state: form.state,
      lga: form.lga.trim(),
      category: form.category,
      creditLimit: form.creditLimit,
      openingBalance: form.openingBalance,
      lastPurchaseDate: editing?.lastPurchaseDate || '',
      lastPaymentDate: editing?.lastPaymentDate || '',
      status: editing?.status || 'active',
      registrationDate: editing?.registrationDate || now,
      notes: form.notes.trim(),
      profilePhoto: form.profilePhoto || undefined,
      createdBy: editing?.createdBy || 'user',
      createdAt: editing?.createdAt || now,
      modifiedBy: 'user',
      updatedAt: now,
      syncDate: '',
      syncStatus: 'pending',
    };

    if (editing?.id) {
      await db.customers.update(editing.id, { ...record, syncStatus: 'pending' });
      await queueSync('customers', editing.id, 'update', record);
      toast('Customer updated');
    } else {
      const id = await db.customers.add(record as Customer);
      await queueSync('customers', id as number, 'create', { ...record, id });
      toast('Customer registered');
    }
    setShowForm(false);
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    await db.customers.delete(deleteTarget.id);
    await queueSync('customers', deleteTarget.id, 'delete', null);
    toast('Customer deleted');
    setDeleteTarget(null);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, profilePhoto: reader.result as string }));
    reader.readAsDataURL(file);
  }

  async function toggleStatus(c: Customer) {
    const newStatus = c.status === 'active' ? 'inactive' : 'active';
    await db.customers.update(c.id!, { status: newStatus, updatedAt: nowISO(), syncStatus: 'pending' });
    await queueSync('customers', c.id!, 'update', { ...c, status: newStatus });
    toast(`Customer ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
  }

  return (
    <div>
      <div className="grid grid-4 mb-6">
        <div className="stat-card">
          <div className="stat-icon green"><span className="material-icons-outlined">people</span></div>
          <div className="stat-info">
            <h3>{stats.active}</h3>
            <p>Active Customers</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><span className="material-icons-outlined">account_balance_wallet</span></div>
          <div className="stat-info">
            <h3>₦{stats.totalPurchases.toLocaleString()}</h3>
            <p>Total Sales</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><span className="material-icons-outlined">pending_actions</span></div>
          <div className="stat-info">
            <h3>₦{stats.totalOutstanding.toLocaleString()}</h3>
            <p>Outstanding</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><span className="material-icons-outlined">credit_card_off</span></div>
          <div className="stat-info">
            <h3>{stats.exceedingCredit}</h3>
            <p>Over Credit Limit</p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search customers..." />
          <select className="form-select" style={{ width: 'auto', minWidth: 140 }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="All">All Categories</option>
            {CUSTOMER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="form-select" style={{ width: 'auto', minWidth: 120 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <span className="material-icons-outlined" style={{ fontSize: 18 }}>add</span>
          New Customer
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="people"
          title="No Customers"
          description="Register your first customer to start tracking sales and payments"
          action={<button className="btn btn-primary" onClick={openNew}>Register Customer</button>}
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Code</th>
                  <th>Phone</th>
                  <th>Category</th>
                  <th>Total Purchases</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const { totalPurchases, outstanding } = getComputedFields(c);
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="customer-avatar">
                            {c.profilePhoto ? (
                              <img src={c.profilePhoto} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              <div className="avatar-placeholder">{c.fullName.charAt(0).toUpperCase()}</div>
                            )}
                          </div>
                          <div>
                            <strong>{c.fullName}</strong>
                            {c.contactPerson && <div className="text-sm text-muted">{c.contactPerson}</div>}
                          </div>
                        </div>
                      </td>
                      <td><code className="text-sm">{c.customerCode}</code></td>
                      <td>{c.phone}</td>
                      <td><Badge variant="info">{c.category}</Badge></td>
                      <td>₦{totalPurchases.toLocaleString()}</td>
                      <td>
                        <span style={{ color: outstanding > 0 ? 'var(--md-error)' : 'var(--md-success)', fontWeight: 600 }}>
                          ₦{outstanding.toLocaleString()}
                        </span>
                      </td>
                      <td><Badge variant={c.status === 'active' ? 'success' : 'neutral'}>{c.status}</Badge></td>
                      <td>
                        <div className="actions">
                          <button className="btn btn-icon btn-text btn-sm" title="View Profile" onClick={() => navigate(`/customers/${c.id}`)}>
                            <span className="material-icons-outlined" style={{ fontSize: 18 }}>visibility</span>
                          </button>
                          <button className="btn btn-icon btn-text btn-sm" title="Edit" onClick={() => openEdit(c)}>
                            <span className="material-icons-outlined" style={{ fontSize: 18 }}>edit</span>
                          </button>
                          <button className="btn btn-icon btn-text btn-sm" title={c.status === 'active' ? 'Deactivate' : 'Activate'} onClick={() => toggleStatus(c)}>
                            <span className="material-icons-outlined" style={{ fontSize: 18 }}>{c.status === 'active' ? 'person_off' : 'person_add'}</span>
                          </button>
                          <button className="btn btn-icon btn-text btn-sm" title="Delete" onClick={() => setDeleteTarget(c)} style={{ color: 'var(--md-error)' }}>
                            <span className="material-icons-outlined" style={{ fontSize: 18 }}>delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={showForm}
        title={editing ? 'Edit Customer' : 'New Customer'}
        onClose={() => setShowForm(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editing ? 'Update' : 'Register'}</button>
          </>
        }
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="customer-avatar-lg">
            {form.profilePhoto ? (
              <img src={form.profilePhoto} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div className="avatar-placeholder-lg">{form.fullName ? form.fullName.charAt(0).toUpperCase() : '?'}</div>
            )}
          </div>
          <div>
            <label className="btn btn-sm btn-outline" style={{ cursor: 'pointer' }}>
              <span className="material-icons-outlined" style={{ fontSize: 16 }}>camera_alt</span>
              Photo
              <input type="file" accept="image/*" hidden onChange={handlePhotoUpload} />
            </label>
            {form.profilePhoto && (
              <button className="btn btn-sm btn-text" style={{ color: 'var(--md-error)' }} onClick={() => setForm(f => ({ ...f, profilePhoto: '' }))}>Remove</button>
            )}
          </div>
        </div>

        <div className="form-row cols-2">
          <div className="form-group">
            <label className="form-label">Full Name / Business Name <span className="required">*</span></label>
            <input className="form-input" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="e.g. Adewale Enterprises" />
          </div>
          <div className="form-group">
            <label className="form-label">Contact Person</label>
            <input className="form-input" value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} placeholder="Contact person name" />
          </div>
        </div>

        <div className="form-row cols-2">
          <div className="form-group">
            <label className="form-label">Phone Number <span className="required">*</span></label>
            <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="08012345678" />
          </div>
          <div className="form-group">
            <label className="form-label">Alternative Phone</label>
            <input className="form-input" value={form.alternativePhone} onChange={e => setForm(f => ({ ...f, alternativePhone: e.target.value }))} placeholder="Optional" />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Email Address</label>
          <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="customer@email.com" />
        </div>

        <div className="form-group">
          <label className="form-label">Physical Address</label>
          <textarea className="form-textarea" value={form.physicalAddress} onChange={e => setForm(f => ({ ...f, physicalAddress: e.target.value }))} rows={2} placeholder="Full address" />
        </div>

        <div className="form-row cols-2">
          <div className="form-group">
            <label className="form-label">State</label>
            <select className="form-select" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}>
              <option value="">Select state...</option>
              {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">LGA</label>
            <input className="form-input" value={form.lga} onChange={e => setForm(f => ({ ...f, lga: e.target.value }))} placeholder="Local Government Area" />
          </div>
        </div>

        <div className="form-row cols-2">
          <div className="form-group">
            <label className="form-label">Customer Category</label>
            <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CUSTOMER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Credit Limit (₦)</label>
            <input className="form-input" type="number" min="0" step="100" value={form.creditLimit || ''} onChange={e => setForm(f => ({ ...f, creditLimit: Number(e.target.value) }))} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Opening Balance (₦)</label>
          <input className="form-input" type="number" step="0.01" value={form.openingBalance || ''} onChange={e => setForm(f => ({ ...f, openingBalance: Number(e.target.value) }))} />
          <span className="form-hint">Previous outstanding amount carried forward</span>
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional notes about this customer" />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Customer"
        message={`Delete "${deleteTarget?.fullName}"? This will not delete their sales or payment records.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
