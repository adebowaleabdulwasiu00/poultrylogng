import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, generateId, nowISO, getActiveFarmId } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '@/components/ToastProvider';
import { Modal, EmptyState, SearchBar, Badge, ConfirmDialog } from '@/components/UI';
import { SUPPLIER_CATEGORIES, NIGERIAN_STATES } from '@/db/types';
import type { Supplier } from '@/db/types';
import { queueSync } from '@/db/sync';

const initialForm = {
  businessName: '',
  contactPerson: '',
  phone: '',
  alternativePhone: '',
  email: '',
  physicalAddress: '',
  state: '',
  lga: '',
  category: 'General Supplier',
  creditLimit: 0,
  openingBalance: 0,
  taxIdentificationNumber: '',
  bankName: '',
  bankAccountName: '',
  bankAccountNumber: '',
  notes: '',
  profilePhoto: '',
};

export default function SupplierManagement() {
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) || [];
  const purchases = useLiveQuery(() => db.purchases.toArray()) || [];
  const payments = useLiveQuery(() => db.supplierPayments.toArray()) || [];
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterBalance, setFilterBalance] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [form, setForm] = useState(initialForm);
  const { toast } = useToast();
  const navigate = useNavigate();

  function getComputedFields(s: Supplier) {
    const supPurchases = purchases.filter(p => p.supplierId === s.id);
    const supPayments = payments.filter(p => p.supplierId === s.id);
    const totalPurchases = supPurchases.reduce((sum, r) => sum + r.totalPrice, 0);
    const totalPayments = supPayments.filter(p => p.status === 'completed').reduce((sum, r) => sum + r.amountPaid, 0);
    const outstanding = s.openingBalance + totalPurchases - totalPayments;
    return { totalPurchases, totalPayments, outstanding };
  }

  const filtered = useMemo(() => {
    let result = suppliers;
    if (filterCategory !== 'All') result = result.filter(s => s.category === filterCategory);
    if (filterStatus !== 'All') result = result.filter(s => s.status === filterStatus.toLowerCase());
    if (filterBalance === 'owed_by_farm') result = result.filter(s => getComputedFields(s).outstanding > 0);
    else if (filterBalance === 'owing_farm') result = result.filter(s => getComputedFields(s).outstanding < 0);
    else if (filterBalance === 'no_balance') result = result.filter(s => getComputedFields(s).outstanding === 0);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.businessName.toLowerCase().includes(q) ||
        s.supplierCode.toLowerCase().includes(q) ||
        s.phone.includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.contactPerson.toLowerCase().includes(q)
      );
    }
    return result;
  }, [suppliers, search, filterCategory, filterStatus, filterBalance, purchases, payments]);

  const stats = useMemo(() => {
    const active = suppliers.filter(s => s.status === 'active').length;
    const totalOutstanding = suppliers.reduce((sum, s) => sum + getComputedFields(s).outstanding, 0);
    const totalPurchases = suppliers.reduce((sum, s) => sum + getComputedFields(s).totalPurchases, 0);
    const farmOwes = suppliers.reduce((sum, s) => {
      const { outstanding } = getComputedFields(s);
      return outstanding > 0 ? sum + outstanding : sum;
    }, 0);
    const suppliersOwingFarm = suppliers.reduce((sum, s) => {
      const { outstanding } = getComputedFields(s);
      return outstanding < 0 ? sum + Math.abs(outstanding) : sum;
    }, 0);
    return { active, totalOutstanding, totalPurchases, farmOwes, suppliersOwingFarm };
  }, [suppliers, purchases, payments]);

  function openNew() {
    setEditing(null);
    setForm(initialForm);
    setShowForm(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({
      businessName: s.businessName,
      contactPerson: s.contactPerson,
      phone: s.phone,
      alternativePhone: s.alternativePhone,
      email: s.email,
      physicalAddress: s.physicalAddress,
      state: s.state,
      lga: s.lga,
      category: s.category,
      creditLimit: s.creditLimit,
      openingBalance: s.openingBalance,
      taxIdentificationNumber: s.taxIdentificationNumber,
      bankName: s.bankName,
      bankAccountName: s.bankAccountName,
      bankAccountNumber: s.bankAccountNumber,
      notes: s.notes,
      profilePhoto: s.profilePhoto || '',
    });
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.businessName.trim()) {
      toast('Business name is required', 'error');
      return;
    }
    if (!form.phone.trim()) {
      toast('Phone number is required', 'error');
      return;
    }
    const now = nowISO();
    const code = 'SUP-' + String(editing?.id || Date.now()).slice(-6).toUpperCase();

    const farmId = await getActiveFarmId();
    const record: Omit<Supplier, 'id'> = {
      farmId,
      supplierId: editing?.supplierId || generateId(),
      supplierCode: editing?.supplierCode || code,
      businessName: form.businessName.trim(),
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
      totalPurchases: editing?.totalPurchases || 0,
      totalPayments: editing?.totalPayments || 0,
      outstandingBalance: editing?.outstandingBalance || 0,
      lastPurchaseDate: editing?.lastPurchaseDate || '',
      lastPaymentDate: editing?.lastPaymentDate || '',
      status: editing?.status || 'active',
      registrationDate: editing?.registrationDate || now,
      taxIdentificationNumber: form.taxIdentificationNumber.trim(),
      bankName: form.bankName.trim(),
      bankAccountName: form.bankAccountName.trim(),
      bankAccountNumber: form.bankAccountNumber.trim(),
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
      await db.suppliers.update(editing.id, { ...record, syncStatus: 'pending' });
      await queueSync('suppliers', editing.id, 'update', record);
      toast('Supplier updated');
    } else {
      const id = await db.suppliers.add(record as Supplier);
      await queueSync('suppliers', id as number, 'create', { ...record, id });
      toast('Supplier registered');
    }
    setShowForm(false);
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    await db.suppliers.delete(deleteTarget.id);
    await queueSync('suppliers', deleteTarget.id, 'delete', null);
    toast('Supplier deleted');
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

  async function toggleStatus(s: Supplier) {
    const newStatus = s.status === 'active' ? 'inactive' : 'active';
    await db.suppliers.update(s.id!, { status: newStatus, updatedAt: nowISO(), syncStatus: 'pending' });
    await queueSync('suppliers', s.id!, 'update', { ...s, status: newStatus });
    toast(`Supplier ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
  }

  return (
    <div>
      <div className="grid grid-4 mb-6">
        <div className="stat-card">
          <div className="stat-icon green"><span className="material-icons-outlined">local_shipping</span></div>
          <div className="stat-info">
            <h3>{stats.active}</h3>
            <p>Active Suppliers</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><span className="material-icons-outlined">account_balance_wallet</span></div>
          <div className="stat-info">
            <h3>₦{stats.totalPurchases.toLocaleString()}</h3>
            <p>Total Purchases</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><span className="material-icons-outlined">pending_actions</span></div>
          <div className="stat-info">
            <h3>₦{stats.farmOwes.toLocaleString()}</h3>
            <p>Farm Owes Suppliers</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><span className="material-icons-outlined">savings</span></div>
          <div className="stat-info">
            <h3>₦{stats.suppliersOwingFarm.toLocaleString()}</h3>
            <p>Suppliers Owing Farm</p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search suppliers..." />
          <select className="form-select" style={{ width: 'auto', minWidth: 150 }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="All">All Categories</option>
            {SUPPLIER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="form-select" style={{ width: 'auto', minWidth: 120 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <select className="form-select" style={{ width: 'auto', minWidth: 160 }} value={filterBalance} onChange={e => setFilterBalance(e.target.value)}>
            <option value="All">All Balances</option>
            <option value="owed_by_farm">Farm Owes Supplier</option>
            <option value="owing_farm">Supplier Owes Farm</option>
            <option value="no_balance">No Balance</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <span className="material-icons-outlined" style={{ fontSize: 18 }}>add</span>
          New Supplier
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="local_shipping"
          title="No Suppliers"
          description="Register your first supplier to start tracking purchases and payments"
          action={<button className="btn btn-primary" onClick={openNew}>Register Supplier</button>}
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Code</th>
                  <th>Phone</th>
                  <th>Category</th>
                  <th>Total Purchases</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const { totalPurchases, outstanding } = getComputedFields(s);
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="customer-avatar">
                            {s.profilePhoto ? (
                              <img src={s.profilePhoto} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              <div className="avatar-placeholder">{s.businessName.charAt(0).toUpperCase()}</div>
                            )}
                          </div>
                          <div>
                            <strong>{s.businessName}</strong>
                            {s.contactPerson && <div className="text-sm text-muted">{s.contactPerson}</div>}
                          </div>
                        </div>
                      </td>
                      <td><code className="text-sm">{s.supplierCode}</code></td>
                      <td>{s.phone}</td>
                      <td><Badge variant="info">{s.category}</Badge></td>
                      <td>₦{totalPurchases.toLocaleString()}</td>
                      <td>
                        <span style={{ color: outstanding > 0 ? 'var(--md-error)' : outstanding < 0 ? 'var(--md-info)' : 'var(--md-success)', fontWeight: 600 }}>
                          {outstanding < 0 ? `-₦${Math.abs(outstanding).toLocaleString()}` : `₦${outstanding.toLocaleString()}`}
                        </span>
                        {outstanding !== 0 && (
                          <div className="text-sm text-muted">{outstanding > 0 ? 'Farm owes' : 'Owes farm'}</div>
                        )}
                      </td>
                      <td><Badge variant={s.status === 'active' ? 'success' : 'neutral'}>{s.status}</Badge></td>
                      <td>
                        <div className="actions">
                          <button className="btn btn-icon btn-text btn-sm" title="View Profile" onClick={() => navigate(`/suppliers/${s.id}`)}>
                            <span className="material-icons-outlined" style={{ fontSize: 18 }}>visibility</span>
                          </button>
                          <button className="btn btn-icon btn-text btn-sm" title="Edit" onClick={() => openEdit(s)}>
                            <span className="material-icons-outlined" style={{ fontSize: 18 }}>edit</span>
                          </button>
                          <button className="btn btn-icon btn-text btn-sm" title={s.status === 'active' ? 'Deactivate' : 'Activate'} onClick={() => toggleStatus(s)}>
                            <span className="material-icons-outlined" style={{ fontSize: 18 }}>{s.status === 'active' ? 'block' : 'check_circle'}</span>
                          </button>
                          <button className="btn btn-icon btn-text btn-sm" title="Delete" onClick={() => setDeleteTarget(s)} style={{ color: 'var(--md-error)' }}>
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
        title={editing ? 'Edit Supplier' : 'New Supplier'}
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
              <div className="avatar-placeholder-lg">{form.businessName ? form.businessName.charAt(0).toUpperCase() : '?'}</div>
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
            <label className="form-label">Business Name <span className="required">*</span></label>
            <input className="form-input" value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} placeholder="e.g. Ade Feed Mills Ltd" />
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
          <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="supplier@email.com" />
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
            <label className="form-label">Supplier Category</label>
            <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {SUPPLIER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
          <span className="form-hint">Positive = Farm owes supplier. Negative = Supplier owes farm.</span>
        </div>

        <div className="form-group">
          <label className="form-label">Tax Identification Number (TIN)</label>
          <input className="form-input" value={form.taxIdentificationNumber} onChange={e => setForm(f => ({ ...f, taxIdentificationNumber: e.target.value }))} placeholder="Optional" />
        </div>

        <div className="form-row cols-3">
          <div className="form-group">
            <label className="form-label">Bank Name</label>
            <input className="form-input" value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} placeholder="Bank name" />
          </div>
          <div className="form-group">
            <label className="form-label">Account Name</label>
            <input className="form-input" value={form.bankAccountName} onChange={e => setForm(f => ({ ...f, bankAccountName: e.target.value }))} placeholder="Account name" />
          </div>
          <div className="form-group">
            <label className="form-label">Account Number</label>
            <input className="form-input" value={form.bankAccountNumber} onChange={e => setForm(f => ({ ...f, bankAccountNumber: e.target.value }))} placeholder="Account number" />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional notes about this supplier" />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Supplier"
        message={`Delete "${deleteTarget?.businessName}"? This will not delete their purchase or payment records.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
