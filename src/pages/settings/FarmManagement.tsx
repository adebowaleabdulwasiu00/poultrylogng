import { useState } from 'react';
import { db, nowISO, generateId } from '@/db/database';
import { useFarm } from '@/contexts/FarmContext';
import { useToast } from '@/components/ToastProvider';
import { Modal, Badge, ConfirmDialog } from '@/components/UI';
import { NIGERIAN_STATES } from '@/db/types';
import type { Farm } from '@/db/types';

export default function FarmManagement() {
  const { farms, currentFarmId, switchFarm, refreshFarms } = useFarm();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Farm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Farm | null>(null);
  const [form, setForm] = useState({
    farmName: '', businessName: '', ownerName: '', contactPerson: '',
    phone: '', email: '', address: '', state: '', lga: '',
    country: 'Nigeria', farmType: 'Poultry',
  });

  function openNew() {
    setEditing(null);
    setForm({
      farmName: '', businessName: '', ownerName: '', contactPerson: '',
      phone: '', email: '', address: '', state: '', lga: '',
      country: 'Nigeria', farmType: 'Poultry',
    });
    setShowForm(true);
  }

  function openEdit(farm: Farm) {
    setEditing(farm);
    setForm({
      farmName: farm.farmName, businessName: farm.businessName,
      ownerName: farm.ownerName, contactPerson: farm.contactPerson,
      phone: farm.phone, email: farm.email, address: farm.address,
      state: farm.state, lga: farm.lga, country: farm.country,
      farmType: farm.farmType,
    });
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.farmName.trim()) { toast('Farm name is required', 'error'); return; }
    const now = nowISO();
    const farmId = editing?.farmId || generateId();
    const code = editing?.farmCode || `FRM-${String(farms.length + 1).padStart(4, '0')}`;

    const record: Farm = {
      farmId,
      farmCode: code,
      farmName: form.farmName.trim(),
      businessName: form.businessName.trim(),
      ownerName: form.ownerName.trim(),
      contactPerson: form.contactPerson.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      state: form.state,
      lga: form.lga.trim(),
      country: form.country,
      farmType: form.farmType,
      logo: editing?.logo || '',
      subscriptionStatus: editing?.subscriptionStatus || 'active',
      registrationDate: editing?.registrationDate || now,
      status: 'active',
      createdAt: editing?.createdAt || now,
      updatedAt: now,
      syncStatus: 'pending',
    };

    if (editing?.id) {
      await db.farms.update(editing.id, record);
      toast('Farm updated');
    } else {
      await db.farms.add(record);
      toast('Farm created');
    }
    setShowForm(false);
    await refreshFarms();
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    if (deleteTarget.farmId === currentFarmId) {
      toast('Cannot delete the active farm', 'error');
      setDeleteTarget(null);
      return;
    }
    await db.farms.update(deleteTarget.id, { status: 'inactive', updatedAt: nowISO() });
    toast('Farm deactivated');
    setDeleteTarget(null);
    await refreshFarms();
  }

  async function handleActivate(farmId: string) {
    await switchFarm(farmId);
    toast('Switched to farm');
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3>Farm Management</h3>
        <button className="btn btn-primary" onClick={openNew}>
          <span className="material-icons-outlined" style={{ fontSize: 18 }}>add</span>
          Add Farm
        </button>
      </div>

      {farms.length === 0 ? (
        <div className="empty-state">
          <span className="material-icons-outlined empty-icon">agriculture</span>
          <h3>No Farms</h3>
          <p>Create your first farm to get started.</p>
          <button className="btn btn-primary" onClick={openNew}>Create Farm</button>
        </div>
      ) : (
        <div className="grid gap-3">
          {farms.map(farm => (
            <div key={farm.farmId} className={`card ${farm.farmId === currentFarmId ? 'border-primary' : ''}`}
              style={{ borderLeft: farm.farmId === currentFarmId ? '4px solid var(--primary)' : undefined }}>
              <div className="card-body">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 style={{ margin: 0 }}>{farm.farmName}</h4>
                    <span className="text-secondary">{farm.farmCode} | {farm.farmType}</span>
                  </div>
                  <div className="flex gap-2">
                    {farm.farmId !== currentFarmId && (
                      <button className="btn btn-sm btn-primary" onClick={() => handleActivate(farm.farmId)}>
                        Switch To
                      </button>
                    )}
                    {farm.farmId === currentFarmId && (
                      <Badge variant="success">Active</Badge>
                    )}
                    <button className="btn btn-sm btn-outline" onClick={() => openEdit(farm)}>
                      <span className="material-icons-outlined" style={{ fontSize: 16 }}>edit</span>
                    </button>
                    {farm.farmId !== currentFarmId && (
                      <button className="btn btn-sm btn-danger-outline" onClick={() => setDeleteTarget(farm)}>
                        <span className="material-icons-outlined" style={{ fontSize: 16 }}>delete</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-sm text-secondary">
                  {farm.ownerName && <span>Owner: {farm.ownerName} | </span>}
                  {farm.phone && <span>Phone: {farm.phone} | </span>}
                  {farm.state && <span>State: {farm.state}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Farm' : 'Add Farm'}>
        <div className="form-grid">
          <div className="form-group">
            <label>Farm Name *</label>
            <input value={form.farmName} onChange={e => setForm({ ...form, farmName: e.target.value })} placeholder="e.g. Sunrise Poultry Farm" />
          </div>
          <div className="form-group">
            <label>Business Name</label>
            <input value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} placeholder="e.g. Sunrise Agro Limited" />
          </div>
          <div className="form-group">
            <label>Owner Name</label>
            <input value={form.ownerName} onChange={e => setForm({ ...form, ownerName: e.target.value })} placeholder="Owner's full name" />
          </div>
          <div className="form-group">
            <label>Contact Person</label>
            <input value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+234..." />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-group full-width">
            <label>Address</label>
            <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="form-group">
            <label>State</label>
            <select value={form.state} onChange={e => setForm({ ...form, state: e.target.value })}>
              <option value="">Select State</option>
              {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>LGA</label>
            <input value={form.lga} onChange={e => setForm({ ...form, lga: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Farm Type</label>
            <select value={form.farmType} onChange={e => setForm({ ...form, farmType: e.target.value })}>
              <option>Poultry</option><option>Layer</option><option>Broiler</option>
              <option>Breeder</option><option>Mixed</option><option>Other</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit}>{editing ? 'Update' : 'Create'} Farm</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Deactivate Farm" message={`Deactivate "${deleteTarget?.farmName}"? This farm will no longer appear in the list.`} />
    </div>
  );
}
