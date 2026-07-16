import { useState, useMemo } from 'react';
import { db, generateId, nowISO, getActiveFarmId } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '@/components/ToastProvider';
import { Modal, EmptyState, SearchBar, Badge, ConfirmDialog } from '@/components/UI';
import { BIRD_TYPES, PRODUCTION_STAGES } from '@/db/types';
import type { Batch } from '@/db/types';
import { queueSync } from '@/db/sync';

const emptyBatch = (): Omit<Batch, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'syncDate'> => ({
  farmId: '',
  batchId: '',
  batchName: '',
  house: '',
  birdType: 'Layer',
  breed: '',
  source: '',
  supplier: '',
  dateReceived: new Date().toISOString().split('T')[0],
  quantityReceived: 0,
  initialAverageWeight: 0,
  productionStage: 'Chick',
  expectedProductionDate: '',
  currentPopulation: 0,
  status: 'active',
  notes: '',
  createdBy: 'user',
  modifiedBy: 'user',
});

export default function BatchManagement() {
  const batches = useLiveQuery(() => db.batches.toArray()) || [];
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [form, setForm] = useState(emptyBatch());
  const [deleteTarget, setDeleteTarget] = useState<Batch | null>(null);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    if (!search) return batches;
    const q = search.toLowerCase();
    return batches.filter(b =>
      b.batchName.toLowerCase().includes(q) ||
      b.batchId.toLowerCase().includes(q) ||
      b.house.toLowerCase().includes(q) ||
      b.birdType.toLowerCase().includes(q) ||
      b.supplier.toLowerCase().includes(q)
    );
  }, [batches, search]);

  function openNew() {
    setEditing(null);
    setForm(emptyBatch());
    setShowForm(true);
  }

  function openEdit(b: Batch) {
    setEditing(b);
    setForm({
      farmId: b.farmId,
      batchId: b.batchId,
      batchName: b.batchName,
      house: b.house,
      birdType: b.birdType,
      breed: b.breed,
      source: b.source,
      supplier: b.supplier,
      dateReceived: b.dateReceived,
      quantityReceived: b.quantityReceived,
      initialAverageWeight: b.initialAverageWeight,
      productionStage: b.productionStage,
      expectedProductionDate: b.expectedProductionDate,
      currentPopulation: b.currentPopulation,
      status: b.status,
      notes: b.notes,
      createdBy: b.createdBy,
      modifiedBy: b.modifiedBy,
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.batchName || !form.birdType) {
      toast('Please fill in required fields', 'error');
      return;
    }
    const now = nowISO();
    if (editing?.id) {
      const existing = await db.batches.get(editing.id);
      if (!existing) {
        toast('Batch not found. It may have been deleted.', 'error');
        setShowForm(false);
        return;
      }
      const updated: Batch = {
        ...existing,
        ...form,
        updatedAt: now,
        syncStatus: 'pending',
      };
      await db.batches.put(updated);
      await queueSync('batches', editing.id, 'update', updated);
      toast('Batch updated successfully');
    } else {
      const farmId = await getActiveFarmId();
      const id = await db.batches.add({
        ...form,
        farmId,
        batchId: form.batchId || generateId(),
        currentPopulation: form.quantityReceived,
        createdAt: now,
        updatedAt: now,
        syncDate: '',
        syncStatus: 'pending',
      } as Batch);
      await queueSync('batches', id as number, 'create', { ...form, id, createdAt: now, updatedAt: now });
      toast('Batch created successfully');
    }
    setShowForm(false);
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    await db.batches.delete(deleteTarget.id);
    await queueSync('batches', deleteTarget.id, 'delete', null);
    toast('Batch deleted');
    setDeleteTarget(null);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search batches..." />
        <button className="btn btn-primary" onClick={openNew}>
          <span className="material-icons-outlined" style={{ fontSize: 18 }}>add</span>
          New Batch
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="inventory_2"
          title="No Batches Yet"
          description="Create your first batch to start recording daily data"
          action={<button className="btn btn-primary" onClick={openNew}>Create First Batch</button>}
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>Batch Name</th>
                  <th>House</th>
                  <th>Bird Type</th>
                  <th>Received</th>
                  <th>Population</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id}>
                    <td className="text-sm">{b.batchId}</td>
                    <td><strong>{b.batchName}</strong></td>
                    <td>{b.house}</td>
                    <td>{b.birdType}</td>
                    <td className="text-sm">{b.dateReceived}</td>
                    <td>{b.currentPopulation.toLocaleString()}</td>
                    <td><Badge variant="info">{b.productionStage}</Badge></td>
                    <td>
                      <Badge variant={b.status === 'active' ? 'success' : b.status === 'closed' ? 'neutral' : 'warning'}>
                        {b.status}
                      </Badge>
                    </td>
                    <td>
                      <div className="actions">
                        <button className="btn btn-icon btn-text btn-sm" onClick={() => openEdit(b)} title="Edit">
                          <span className="material-icons-outlined" style={{ fontSize: 18 }}>edit</span>
                        </button>
                        <button className="btn btn-icon btn-text btn-sm" onClick={() => setDeleteTarget(b)} title="Delete" style={{ color: 'var(--md-error)' }}>
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
        title={editing ? 'Edit Batch' : 'New Batch'}
        onClose={() => setShowForm(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              {editing ? 'Update Batch' : 'Create Batch'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-row cols-2">
            <div className="form-group">
              <label className="form-label">Batch Name <span className="required">*</span></label>
              <input className="form-input" value={form.batchName} onChange={e => setForm(f => ({ ...f, batchName: e.target.value }))} placeholder="e.g. Batch A - Layers" />
            </div>
            <div className="form-group">
              <label className="form-label">Batch ID</label>
              <input className="form-input" value={form.batchId} onChange={e => setForm(f => ({ ...f, batchId: e.target.value }))} placeholder="Auto-generated if empty" />
            </div>
          </div>
          <div className="form-row cols-2">
            <div className="form-group">
              <label className="form-label">House / Pen <span className="required">*</span></label>
              <input className="form-input" value={form.house} onChange={e => setForm(f => ({ ...f, house: e.target.value }))} placeholder="e.g. House 1" />
            </div>
            <div className="form-group">
              <label className="form-label">Bird Type <span className="required">*</span></label>
              <select className="form-select" value={form.birdType} onChange={e => setForm(f => ({ ...f, birdType: e.target.value }))}>
                {BIRD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row cols-2">
            <div className="form-group">
              <label className="form-label">Breed</label>
              <input className="form-input" value={form.breed} onChange={e => setForm(f => ({ ...f, breed: e.target.value }))} placeholder="e.g. Isa Brown" />
            </div>
            <div className="form-group">
              <label className="form-label">Production Stage</label>
              <select className="form-select" value={form.productionStage} onChange={e => setForm(f => ({ ...f, productionStage: e.target.value }))}>
                {PRODUCTION_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row cols-2">
            <div className="form-group">
              <label className="form-label">Source</label>
              <input className="form-input" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="e.g. Farm source" />
            </div>
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <input className="form-input" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Supplier name" />
            </div>
          </div>
          <div className="form-row cols-2">
            <div className="form-group">
              <label className="form-label">Date Received</label>
              <input className="form-input" type="date" value={form.dateReceived} onChange={e => setForm(f => ({ ...f, dateReceived: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Expected Production Date</label>
              <input className="form-input" type="date" value={form.expectedProductionDate} onChange={e => setForm(f => ({ ...f, expectedProductionDate: e.target.value }))} />
            </div>
          </div>
          <div className="form-row cols-3">
            <div className="form-group">
              <label className="form-label">Quantity Received</label>
              <input className="form-input" type="number" value={form.quantityReceived || ''} onChange={e => setForm(f => ({ ...f, quantityReceived: Number(e.target.value), currentPopulation: editing ? f.currentPopulation : Number(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Current Population</label>
              <input className="form-input" type="number" value={form.currentPopulation || ''} onChange={e => setForm(f => ({ ...f, currentPopulation: Number(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Initial Avg Weight (g)</label>
              <input className="form-input" type="number" step="0.1" value={form.initialAverageWeight || ''} onChange={e => setForm(f => ({ ...f, initialAverageWeight: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as 'active' | 'closed' | 'depleted' }))}>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
              <option value="depleted">Depleted</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Additional notes..." />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Batch"
        message={`Are you sure you want to delete "${deleteTarget?.batchName}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
