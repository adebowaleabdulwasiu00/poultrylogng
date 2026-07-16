import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '@/components/ToastProvider';
import { Modal, EmptyState, SearchBar, Badge, ConfirmDialog } from '@/components/UI';
import { useSettings } from '@/hooks/useSettings';
import { queueSync } from '@/db/sync';
import type { SalesHeader } from '@/db/types';

export default function SalesManagement() {
  const headers = useLiveQuery(() => db.salesHeaders.toArray()) || [];
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getCompanyInfo } = useSettings();
  const companyInfo = getCompanyInfo();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteTarget, setDeleteTarget] = useState<SalesHeader | null>(null);

  const filtered = useMemo(() => {
    let result = headers;
    if (statusFilter !== 'all') {
      result = result.filter(h => h.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(h =>
        h.invoiceNumber.toLowerCase().includes(q) ||
        h.customerName.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
  }, [headers, search, statusFilter]);

  const stats = useMemo(() => ({
    total: headers.length,
    draft: headers.filter(h => h.status === 'draft').length,
    posted: headers.filter(h => h.status === 'posted').length,
    totalRevenue: headers.filter(h => h.status === 'posted').reduce((s, h) => s + h.grandTotal, 0),
    totalOutstanding: headers.filter(h => h.status === 'posted').reduce((s, h) => s + h.balanceDue, 0),
  }), [headers]);

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    const details = await db.salesDetails.where('headerId').equals(deleteTarget.id).toArray();
    if (deleteTarget.status === 'posted') {
      // Restore stock
      const products = await db.products.toArray();
      for (const d of details) {
        const product = products.find(p => p.id === d.productId);
        if (product) {
          await db.products.update(product.id!, {
            currentStock: product.currentStock + d.quantity,
            updatedAt: new Date().toISOString(), syncStatus: 'pending',
          });
        }
      }
    }
    await db.salesDetails.where('headerId').equals(deleteTarget.id).delete();
    await db.salesHeaders.delete(deleteTarget.id);
    await queueSync('salesHeaders', deleteTarget.id, 'delete', null);
    toast('Invoice deleted');
    setDeleteTarget(null);
  }

  function getStatusVariant(status: string) {
    switch (status) {
      case 'posted': return 'success' as const;
      case 'draft': return 'warning' as const;
      case 'cancelled': return 'error' as const;
      case 'voided': return 'error' as const;
      default: return 'neutral' as const;
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search invoices..." />
        <button className="btn btn-primary" onClick={() => navigate('/sales/new')}>
          <span className="material-icons-outlined" style={{ fontSize: 18 }}>add</span>
          New Invoice
        </button>
      </div>

      <div className="grid grid-4 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-icon green"><span className="material-icons-outlined">receipt_long</span></div>
          <div className="stat-info">
            <h3>{stats.total}</h3>
            <p>Total Invoices</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><span className="material-icons-outlined">edit_note</span></div>
          <div className="stat-info">
            <h3>{stats.draft}</h3>
            <p>Drafts</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><span className="material-icons-outlined">payments</span></div>
          <div className="stat-info">
            <h3>{companyInfo.currencySymbol}{stats.totalRevenue.toLocaleString()}</h3>
            <p>Total Revenue</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><span className="material-icons-outlined">pending</span></div>
          <div className="stat-info">
            <h3>{companyInfo.currencySymbol}{stats.totalOutstanding.toLocaleString()}</h3>
            <p>Outstanding</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        {['all', 'draft', 'posted', 'voided'].map(s => (
          <button
            key={s}
            className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="receipt_long"
          title="No Sales Invoices"
          description="Create your first sales invoice to start tracking revenue"
          action={<button className="btn btn-primary" onClick={() => navigate('/sales/new')}>Create Invoice</button>}
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(h => (
                  <tr key={h.id}>
                    <td><strong style={{ color: 'var(--md-primary)' }}>{h.invoiceNumber}</strong></td>
                    <td className="text-sm">{h.invoiceDate}</td>
                    <td>{h.customerName}</td>
                    <td className="text-muted">-</td>
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
                        <button className="btn btn-icon btn-text btn-sm" onClick={() => navigate(`/sales/${h.id}`)} title="View">
                          <span className="material-icons-outlined" style={{ fontSize: 18 }}>visibility</span>
                        </button>
                        {h.status === 'draft' && (
                          <button className="btn btn-icon btn-text btn-sm" onClick={() => navigate(`/sales/${h.id}/edit`)} title="Edit">
                            <span className="material-icons-outlined" style={{ fontSize: 18 }}>edit</span>
                          </button>
                        )}
                        <button className="btn btn-icon btn-text btn-sm" onClick={() => setDeleteTarget(h)} style={{ color: 'var(--md-error)' }} title="Delete">
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

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Invoice"
        message={`Delete invoice "${deleteTarget?.invoiceNumber}" for ${deleteTarget?.customerName}? ${deleteTarget?.status === 'posted' ? 'Stock will be restored.' : ''}`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
