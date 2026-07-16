import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '@/components/ToastProvider';
import { Modal, EmptyState, SearchBar, Badge, ConfirmDialog } from '@/components/UI';
import { useSettings } from '@/hooks/useSettings';
import { queueSync } from '@/db/sync';
import type { PurchaseHeader } from '@/db/types';

export default function PurchaseManagement() {
  const headers = useLiveQuery(() => db.purchaseHeaders.toArray()) || [];
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getCompanyInfo } = useSettings();
  const companyInfo = getCompanyInfo();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteTarget, setDeleteTarget] = useState<PurchaseHeader | null>(null);

  const filtered = useMemo(() => {
    let result = headers;
    if (statusFilter !== 'all') result = result.filter(h => h.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(h => h.purchaseNumber.toLowerCase().includes(q) || h.supplierName.toLowerCase().includes(q));
    }
    return result.sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
  }, [headers, search, statusFilter]);

  const stats = useMemo(() => ({
    total: headers.length,
    draft: headers.filter(h => h.status === 'draft').length,
    posted: headers.filter(h => h.status === 'posted').length,
    totalSpent: headers.filter(h => h.status === 'posted').reduce((s, h) => s + h.grandTotal, 0),
    totalOutstanding: headers.filter(h => h.status === 'posted').reduce((s, h) => s + h.balanceDue, 0),
  }), [headers]);

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    const details = await db.purchaseDetails.where('headerId').equals(deleteTarget.id).toArray();
    if (deleteTarget.status === 'posted') {
      const products = await db.products.toArray();
      for (const d of details) {
        const product = products.find(p => p.id === d.productId);
        if (product) {
          await db.products.update(product.id!, { currentStock: Math.max(0, product.currentStock - d.quantity), updatedAt: new Date().toISOString(), syncStatus: 'pending' });
        }
      }
    }
    await db.purchaseDetails.where('headerId').equals(deleteTarget.id).delete();
    await db.purchaseHeaders.delete(deleteTarget.id);
    await queueSync('purchaseHeaders', deleteTarget.id, 'delete', null);
    toast('Purchase deleted');
    setDeleteTarget(null);
  }

  function getStatusVariant(status: string) {
    switch (status) { case 'posted': return 'success' as const; case 'draft': return 'warning' as const; case 'cancelled': case 'voided': return 'error' as const; default: return 'neutral' as const; }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search purchases..." />
        <button className="btn btn-primary" onClick={() => navigate('/purchases/new')}>
          <span className="material-icons-outlined" style={{ fontSize: 18 }}>add</span>
          New Purchase
        </button>
      </div>

      <div className="grid grid-4 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-icon brown"><span className="material-icons-outlined">shopping_cart</span></div>
          <div className="stat-info"><h3>{stats.total}</h3><p>Total Purchases</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><span className="material-icons-outlined">edit_note</span></div>
          <div className="stat-info"><h3>{stats.draft}</h3><p>Drafts</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><span className="material-icons-outlined">payments</span></div>
          <div className="stat-info"><h3>{companyInfo.currencySymbol}{stats.totalSpent.toLocaleString()}</h3><p>Total Spent</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><span className="material-icons-outlined">pending</span></div>
          <div className="stat-info"><h3>{companyInfo.currencySymbol}{stats.totalOutstanding.toLocaleString()}</h3><p>Outstanding</p></div>
        </div>
      </div>

      <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        {['all', 'draft', 'posted', 'voided'].map(s => (
          <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="shopping_cart" title="No Purchases" description="Record your first purchase to track expenses and stock"
          action={<button className="btn btn-primary" onClick={() => navigate('/purchases/new')}>Record Purchase</button>}
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Purchase #</th><th>Date</th><th>Supplier</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(h => (
                  <tr key={h.id}>
                    <td><strong style={{ color: 'var(--md-secondary)' }}>{h.purchaseNumber}</strong></td>
                    <td className="text-sm">{h.purchaseDate}</td>
                    <td>{h.supplierName}</td>
                    <td><strong>{companyInfo.currencySymbol}{h.grandTotal.toLocaleString()}</strong></td>
                    <td>{companyInfo.currencySymbol}{h.amountPaid.toLocaleString()}</td>
                    <td>
                      <span style={{ color: h.balanceDue > 0 ? 'var(--md-error)' : 'var(--md-success)', fontWeight: 600 }}>
                        {companyInfo.currencySymbol}{h.balanceDue.toLocaleString()}
                      </span>
                    </td>
                    <td><Badge variant={getStatusVariant(h.status)}>{h.status}</Badge></td>
                    <td>
                      <div className="actions">
                        <button className="btn btn-icon btn-text btn-sm" onClick={() => navigate(`/purchases/${h.id}`)}>
                          <span className="material-icons-outlined" style={{ fontSize: 18 }}>visibility</span>
                        </button>
                        {h.status === 'draft' && (
                          <button className="btn btn-icon btn-text btn-sm" onClick={() => navigate(`/purchases/${h.id}/edit`)}>
                            <span className="material-icons-outlined" style={{ fontSize: 18 }}>edit</span>
                          </button>
                        )}
                        <button className="btn btn-icon btn-text btn-sm" onClick={() => setDeleteTarget(h)} style={{ color: 'var(--md-error)' }}>
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

      <ConfirmDialog open={!!deleteTarget} title="Delete Purchase"
        message={`Delete purchase "${deleteTarget?.purchaseNumber}" from ${deleteTarget?.supplierName}? ${deleteTarget?.status === 'posted' ? 'Stock will be adjusted.' : ''}`}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} confirmLabel="Delete" danger
      />
    </div>
  );
}
