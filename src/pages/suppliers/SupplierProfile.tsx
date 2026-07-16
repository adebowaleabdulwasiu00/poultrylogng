import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, nowISO, getActiveFarmId } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '@/components/ToastProvider';
import { Badge, Tabs, Modal, ConfirmDialog } from '@/components/UI';
import { PAYMENT_METHODS } from '@/db/types';
import type { Supplier, SupplierPayment } from '@/db/types';
import { queueSync } from '@/db/sync';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, ArcElement } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, ArcElement);

export default function SupplierProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const supplierId = Number(id);

  const supplier = useLiveQuery(() => db.suppliers.get(supplierId), [supplierId]);
  const purchases = useLiveQuery(() => db.purchases.where('supplierId').equals(supplierId).toArray(), [supplierId]) || [];
  const payments = useLiveQuery(() => db.supplierPayments.where('supplierId').equals(supplierId).toArray(), [supplierId]) || [];
  const adjustments = useLiveQuery(() => db.supplierAdjustments.where('supplierId').equals(supplierId).toArray(), [supplierId]) || [];

  const [activeTab, setActiveTab] = useState('overview');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    amountPaid: 0,
    paymentMethod: 'Cash',
    paymentReference: '',
    bank: '',
    staff: '',
    receiptNumber: '',
    notes: '',
  });
  const [editingPayment, setEditingPayment] = useState<SupplierPayment | null>(null);
  const [deletePayment, setDeletePayment] = useState<SupplierPayment | null>(null);
  const [statementRange, setStatementRange] = useState({ from: '', to: '' });
  const [showStatement, setShowStatement] = useState(false);

  const computed = useMemo(() => {
    if (!supplier) return { totalPurchases: 0, totalPayments: 0, outstanding: 0, numOrders: 0, avgOrder: 0, largestPurchase: 0, avgPayment: 0, largestPayment: 0, totalAdjustments: 0 };
    const totalPurchases = purchases.reduce((s, r) => s + r.totalPrice, 0);
    const completedPayments = payments.filter(p => p.status === 'completed');
    const totalPayments = completedPayments.reduce((s, r) => s + r.amountPaid, 0);
    const totalAdjustments = adjustments.reduce((s, r) => {
      if (r.adjustmentType === 'credit_note' || r.adjustmentType === 'refund' || r.adjustmentType === 'return') return s - r.amount;
      return s + r.amount;
    }, 0);
    const outstanding = supplier.openingBalance + totalPurchases - totalPayments + totalAdjustments;
    const numOrders = purchases.length;
    const avgOrder = numOrders > 0 ? totalPurchases / numOrders : 0;
    const largestPurchase = purchases.length > 0 ? Math.max(...purchases.map(p => p.totalPrice)) : 0;
    const avgPayment = completedPayments.length > 0 ? totalPayments / completedPayments.length : 0;
    const largestPayment = completedPayments.length > 0 ? Math.max(...completedPayments.map(p => p.amountPaid)) : 0;
    return { totalPurchases, totalPayments, outstanding, numOrders, avgOrder, largestPurchase, avgPayment, largestPayment, totalAdjustments };
  }, [supplier, purchases, payments, adjustments]);

  const ledger = useMemo(() => {
    if (!supplier) return [];
    const entries: { date: string; ref: string; type: string; description: string; debit: number; credit: number; balance: number }[] = [];
    let running = supplier.openingBalance;
    if (supplier.openingBalance !== 0) {
      entries.push({ date: supplier.registrationDate, ref: 'OPENING', type: 'Opening Balance', description: 'Opening balance carried forward', debit: supplier.openingBalance > 0 ? supplier.openingBalance : 0, credit: supplier.openingBalance < 0 ? Math.abs(supplier.openingBalance) : 0, balance: running });
    }
    const allTx = [
      ...purchases.map(p => ({ date: p.purchaseDate, ref: p.invoiceNumber || `PUR-${p.id}`, type: 'Purchase', description: p.productName, debit: p.totalPrice, credit: 0 })),
      ...payments.filter(p => p.status === 'completed').map(p => ({ date: p.paymentDate, ref: p.receiptNumber || `PAY-${p.id}`, type: 'Payment', description: `Payment via ${p.paymentMethod}`, debit: 0, credit: p.amountPaid })),
      ...adjustments.map(a => ({
        date: a.adjustmentDate,
        ref: a.referenceNumber || `ADJ-${a.id}`,
        type: a.adjustmentType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: a.description,
        debit: (a.adjustmentType === 'debit_note' || a.adjustmentType === 'adjustment') ? a.amount : 0,
        credit: (a.adjustmentType === 'credit_note' || a.adjustmentType === 'refund' || a.adjustmentType === 'return') ? a.amount : 0,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    for (const tx of allTx) {
      running = running + tx.debit - tx.credit;
      entries.push({ ...tx, balance: running });
    }
    return entries;
  }, [supplier, purchases, payments, adjustments]);

  const monthlyData = useMemo(() => {
    const months: Record<string, { purchases: number; payments: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleDateString('en', { month: 'short', year: '2-digit' });
      months[key] = { purchases: 0, payments: 0 };
    }
    for (const p of purchases) {
      const d = new Date(p.purchaseDate);
      const key = d.toLocaleDateString('en', { month: 'short', year: '2-digit' });
      if (months[key]) months[key].purchases += p.totalPrice;
    }
    for (const p of payments.filter(pp => pp.status === 'completed')) {
      const d = new Date(p.paymentDate);
      const key = d.toLocaleDateString('en', { month: 'short', year: '2-digit' });
      if (months[key]) months[key].payments += p.amountPaid;
    }
    const labels = Object.keys(months);
    return {
      labels,
      purchases: labels.map(l => months[l].purchases),
      payments: labels.map(l => months[l].payments),
    };
  }, [purchases, payments]);

  const topProducts = useMemo(() => {
    const map: Record<string, { qty: number; total: number }> = {};
    for (const p of purchases) {
      if (!map[p.productName]) map[p.productName] = { qty: 0, total: 0 };
      map[p.productName].qty += p.quantity;
      map[p.productName].total += p.totalPrice;
    }
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
  }, [purchases]);

  async function handlePaymentSubmit() {
    if (paymentForm.amountPaid <= 0) { toast('Enter a valid amount', 'error'); return; }
    if (!supplier) return;
    const now = nowISO();
    const farmId = await getActiveFarmId();
    const record: Omit<SupplierPayment, 'id'> = {
      farmId,
      paymentDate: paymentForm.paymentDate,
      supplierId: supplier.id!,
      supplierName: supplier.businessName,
      paymentReference: paymentForm.paymentReference,
      amountPaid: paymentForm.amountPaid,
      paymentMethod: paymentForm.paymentMethod,
      bank: paymentForm.bank,
      staff: paymentForm.staff,
      status: 'completed',
      receiptNumber: paymentForm.receiptNumber || `SPREC-${Date.now().toString(36).toUpperCase()}`,
      notes: paymentForm.notes,
      createdBy: 'user',
      createdAt: now,
      modifiedBy: 'user',
      updatedAt: now,
      syncDate: '',
      syncStatus: 'pending',
    };
    if (editingPayment?.id) {
      await db.supplierPayments.update(editingPayment.id, { ...record, syncStatus: 'pending' });
      await queueSync('supplierPayments', editingPayment.id, 'update', record);
      toast('Payment updated');
    } else {
      const pid = await db.supplierPayments.add(record as SupplierPayment);
      await db.suppliers.update(supplier.id!, { lastPaymentDate: paymentForm.paymentDate, updatedAt: now, syncStatus: 'pending' });
      await queueSync('supplierPayments', pid as number, 'create', { ...record, id: pid });
      toast('Payment recorded');
    }
    setShowPaymentForm(false);
    setEditingPayment(null);
  }

  async function handleDeletePayment() {
    if (!deletePayment?.id || !supplier) return;
    await db.supplierPayments.delete(deletePayment.id);
    await queueSync('supplierPayments', deletePayment.id, 'delete', null);
    toast('Payment deleted');
    setDeletePayment(null);
  }

  function openEditPayment(p: SupplierPayment) {
    setEditingPayment(p);
    setPaymentForm({
      paymentDate: p.paymentDate,
      amountPaid: p.amountPaid,
      paymentMethod: p.paymentMethod,
      paymentReference: p.paymentReference,
      bank: p.bank,
      staff: p.staff,
      receiptNumber: p.receiptNumber,
      notes: p.notes,
    });
    setShowPaymentForm(true);
  }

  function openNewPayment() {
    setEditingPayment(null);
    setPaymentForm({
      paymentDate: new Date().toISOString().split('T')[0],
      amountPaid: 0, paymentMethod: 'Cash', paymentReference: '',
      bank: '', staff: '', receiptNumber: '', notes: '',
    });
    setShowPaymentForm(true);
  }

  const statementData = useMemo(() => {
    if (!supplier || !showStatement) return [];
    const from = statementRange.from || '2000-01-01';
    const to = statementRange.to || '2099-12-31';
    const entries: { date: string; ref: string; description: string; debit: number; credit: number; balance: number }[] = [];
    let running = supplier.openingBalance;
    entries.push({ date: supplier.registrationDate, ref: 'OPENING', description: 'Opening Balance', debit: supplier.openingBalance > 0 ? supplier.openingBalance : 0, credit: supplier.openingBalance < 0 ? Math.abs(supplier.openingBalance) : 0, balance: running });
    const allTx = [
      ...purchases.filter(p => p.purchaseDate >= from && p.purchaseDate <= to).map(p => ({ date: p.purchaseDate, ref: p.invoiceNumber || `PUR-${p.id}`, description: p.productName, debit: p.totalPrice, credit: 0 })),
      ...payments.filter(p => p.status === 'completed' && p.paymentDate >= from && p.paymentDate <= to).map(p => ({ date: p.paymentDate, ref: p.receiptNumber || `PAY-${p.id}`, description: `Payment (${p.paymentMethod})`, debit: 0, credit: p.amountPaid })),
      ...adjustments.filter(a => a.adjustmentDate >= from && a.adjustmentDate <= to).map(a => ({
        date: a.adjustmentDate,
        ref: a.referenceNumber || `ADJ-${a.id}`,
        description: a.description,
        debit: (a.adjustmentType === 'debit_note' || a.adjustmentType === 'adjustment') ? a.amount : 0,
        credit: (a.adjustmentType === 'credit_note' || a.adjustmentType === 'refund' || a.adjustmentType === 'return') ? a.amount : 0,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    for (const tx of allTx) {
      running = running + tx.debit - tx.credit;
      entries.push({ ...tx, balance: running });
    }
    return entries;
  }, [supplier, purchases, payments, adjustments, showStatement, statementRange]);

  if (!supplier) return <div className="empty-state"><p>Loading supplier...</p></div>;

  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'info' },
    { key: 'purchases', label: 'Purchases', icon: 'shopping_bag' },
    { key: 'payments', label: 'Payments', icon: 'payments' },
    { key: 'ledger', label: 'Ledger', icon: 'account_balance_book' },
    { key: 'analytics', label: 'Analytics', icon: 'insights' },
    { key: 'statement', label: 'Statement', icon: 'description' },
  ];

  return (
    <div>
      <button className="btn btn-text btn-sm mb-4" onClick={() => navigate('/suppliers')}>
        <span className="material-icons-outlined" style={{ fontSize: 18 }}>arrow_back</span>
        Back to Suppliers
      </button>

      <div className="card mb-4">
        <div className="flex items-center gap-4" style={{ flexWrap: 'wrap' }}>
          {supplier.profilePhoto ? (
            <img src={supplier.profilePhoto} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div className="avatar-placeholder-xl">{supplier.businessName.charAt(0).toUpperCase()}</div>
          )}
          <div style={{ flex: 1 }}>
            <div className="flex items-center gap-3">
              <h2 style={{ fontSize: 22 }}>{supplier.businessName}</h2>
              <Badge variant={supplier.status === 'active' ? 'success' : 'neutral'}>{supplier.status}</Badge>
              <Badge variant="info">{supplier.category}</Badge>
            </div>
            <div className="flex gap-4 mt-4" style={{ flexWrap: 'wrap', fontSize: 13, color: 'var(--md-on-surface-variant)' }}>
              <span><strong>Code:</strong> {supplier.supplierCode}</span>
              {supplier.phone && <span><span className="material-icons-outlined" style={{ fontSize: 14, verticalAlign: 'middle' }}>phone</span> {supplier.phone}</span>}
              {supplier.email && <span><span className="material-icons-outlined" style={{ fontSize: 14, verticalAlign: 'middle' }}>email</span> {supplier.email}</span>}
              {supplier.physicalAddress && <span><span className="material-icons-outlined" style={{ fontSize: 14, verticalAlign: 'middle' }}>location_on</span> {supplier.physicalAddress}{supplier.state ? `, ${supplier.state}` : ''}</span>}
            </div>
          </div>
          <div className="text-right">
            <div style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>
              {computed.outstanding > 0 ? 'Farm Owes Supplier' : computed.outstanding < 0 ? 'Supplier Owes Farm' : 'Balance'}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: computed.outstanding > 0 ? 'var(--md-error)' : computed.outstanding < 0 ? 'var(--md-info)' : 'var(--md-success)' }}>
              {computed.outstanding < 0 ? `-₦${Math.abs(computed.outstanding).toLocaleString()}` : `₦${computed.outstanding.toLocaleString()}`}
            </div>
            {supplier.creditLimit > 0 && (
              <div className="text-sm text-muted">Credit Limit: ₦{supplier.creditLimit.toLocaleString()}</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-4 mb-4">
        <div className="stat-card">
          <div className="stat-icon green"><span className="material-icons-outlined">shopping_bag</span></div>
          <div className="stat-info"><h3>₦{computed.totalPurchases.toLocaleString()}</h3><p>Total Purchases</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><span className="material-icons-outlined">payments</span></div>
          <div className="stat-info"><h3>₦{computed.totalPayments.toLocaleString()}</h3><p>Total Payments</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><span className="material-icons-outlined">receipt</span></div>
          <div className="stat-info"><h3>{computed.numOrders}</h3><p>Total Orders</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon teal"><span className="material-icons-outlined">trending_up</span></div>
          <div className="stat-info"><h3>₦{computed.avgOrder.toLocaleString()}</h3><p>Average Order</p></div>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="tab-content">
        {activeTab === 'overview' && (
          <div>
            <div className="grid grid-2 mb-4">
              <div className="card">
                <div className="card-header"><span className="card-title">Supplier Information</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
                  <div><span className="text-muted">Contact Person:</span> {supplier.contactPerson || '-'}</div>
                  <div><span className="text-muted">Alt. Phone:</span> {supplier.alternativePhone || '-'}</div>
                  <div><span className="text-muted">LGA:</span> {supplier.lga || '-'}</div>
                  <div><span className="text-muted">Registered:</span> {new Date(supplier.registrationDate).toLocaleDateString()}</div>
                  <div><span className="text-muted">TIN:</span> {supplier.taxIdentificationNumber || '-'}</div>
                  <div style={{ gridColumn: 'span 2' }}><span className="text-muted">Notes:</span> {supplier.notes || '-'}</div>
                </div>
              </div>
              <div className="card">
                <div className="card-header"><span className="card-title">Account & Banking</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
                  <div><span className="text-muted">Opening Balance:</span> <strong>₦{supplier.openingBalance.toLocaleString()}</strong></div>
                  <div><span className="text-muted">Credit Limit:</span> <strong>₦{supplier.creditLimit.toLocaleString()}</strong></div>
                  <div><span className="text-muted">Last Purchase:</span> {supplier.lastPurchaseDate || 'Never'}</div>
                  <div><span className="text-muted">Last Payment:</span> {supplier.lastPaymentDate || 'Never'}</div>
                  <div><span className="text-muted">Bank:</span> {supplier.bankName || '-'}</div>
                  <div><span className="text-muted">Account Name:</span> {supplier.bankAccountName || '-'}</div>
                  <div><span className="text-muted">Account No:</span> {supplier.bankAccountNumber || '-'}</div>
                  <div><span className="text-muted">Largest Purchase:</span> ₦{computed.largestPurchase.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {topProducts.length > 0 && (
              <div className="card">
                <div className="card-header"><span className="card-title">Top Products Purchased</span></div>
                <table className="data-table">
                  <thead>
                    <tr><th>Product</th><th>Quantity</th><th>Total Spent</th></tr>
                  </thead>
                  <tbody>
                    {topProducts.map(([name, data]) => (
                      <tr key={name}><td><strong>{name}</strong></td><td>{data.qty}</td><td>₦{data.total.toLocaleString()}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'purchases' && (
          <div>
            {purchases.length === 0 ? (
              <div className="card"><div className="empty-state" style={{ padding: 40 }}>
                <span className="material-icons-outlined">shopping_bag</span>
                <h3>No Purchases</h3>
                <p>No purchases have been recorded from this supplier</p>
              </div></div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr><th>Date</th><th>Invoice</th><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Payment</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {purchases.sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate)).map(p => (
                        <tr key={p.id}>
                          <td className="text-sm">{p.purchaseDate}</td>
                          <td><code className="text-sm">{p.invoiceNumber || '-'}</code></td>
                          <td><strong>{p.productName}</strong></td>
                          <td>{p.quantity} {p.unit}</td>
                          <td>₦{p.unitPrice.toLocaleString()}</td>
                          <td><strong style={{ color: 'var(--md-success)' }}>₦{p.totalPrice.toLocaleString()}</strong></td>
                          <td><Badge variant="neutral">{p.paymentMethod}</Badge></td>
                          <td><Badge variant={p.paymentStatus === 'paid' ? 'success' : p.paymentStatus === 'partial' ? 'warning' : 'error'}>{p.paymentStatus}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'payments' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div />
              <button className="btn btn-primary" onClick={openNewPayment}>
                <span className="material-icons-outlined" style={{ fontSize: 18 }}>add</span>
                Record Payment
              </button>
            </div>
            {payments.length === 0 ? (
              <div className="card"><div className="empty-state" style={{ padding: 40 }}>
                <span className="material-icons-outlined">payments</span>
                <h3>No Payments</h3>
                <p>No payments have been recorded to this supplier</p>
              </div></div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr><th>Date</th><th>Receipt</th><th>Amount</th><th>Method</th><th>Reference</th><th>Staff</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {payments.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate)).map(p => (
                        <tr key={p.id}>
                          <td className="text-sm">{p.paymentDate}</td>
                          <td><code className="text-sm">{p.receiptNumber}</code></td>
                          <td><strong style={{ color: 'var(--md-success)' }}>₦{p.amountPaid.toLocaleString()}</strong></td>
                          <td><Badge variant="neutral">{p.paymentMethod}</Badge></td>
                          <td>{p.paymentReference || '-'}</td>
                          <td>{p.staff || '-'}</td>
                          <td><Badge variant={p.status === 'completed' ? 'success' : p.status === 'pending' ? 'warning' : 'error'}>{p.status}</Badge></td>
                          <td>
                            <div className="actions">
                              <button className="btn btn-icon btn-text btn-sm" onClick={() => openEditPayment(p)}>
                                <span className="material-icons-outlined" style={{ fontSize: 18 }}>edit</span>
                              </button>
                              <button className="btn btn-icon btn-text btn-sm" onClick={() => setDeletePayment(p)} style={{ color: 'var(--md-error)' }}>
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
          </div>
        )}

        {activeTab === 'ledger' && (
          <div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr><th>Date</th><th>Reference</th><th>Type</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr>
                  </thead>
                  <tbody>
                    {ledger.map((e, i) => (
                      <tr key={i}>
                        <td className="text-sm">{e.date}</td>
                        <td><code className="text-sm">{e.ref}</code></td>
                        <td><Badge variant={e.type === 'Payment' ? 'success' : e.type === 'Purchase' ? 'neutral' : 'info'}>{e.type}</Badge></td>
                        <td>{e.description}</td>
                        <td>{e.debit > 0 ? <span style={{ color: 'var(--md-error)' }}>₦{e.debit.toLocaleString()}</span> : '-'}</td>
                        <td>{e.credit > 0 ? <span style={{ color: 'var(--md-success)' }}>₦{e.credit.toLocaleString()}</span> : '-'}</td>
                        <td><strong style={{ color: e.balance > 0 ? 'var(--md-error)' : e.balance < 0 ? 'var(--md-info)' : undefined }}>
                          {e.balance < 0 ? `-₦${Math.abs(e.balance).toLocaleString()}` : `₦${e.balance.toLocaleString()}`}
                        </strong></td>
                      </tr>
                    ))}
                    {ledger.length === 0 && (
                      <tr><td colSpan={7} className="text-center text-muted" style={{ padding: 40 }}>No ledger entries</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div>
            <div className="grid grid-3 mb-4">
              <div className="stat-card">
                <div className="stat-icon green"><span className="material-icons-outlined">calendar_today</span></div>
                <div className="stat-info">
                  <h3>{purchases.length > 0 ? Math.floor((Date.now() - new Date(purchases.sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))[0].purchaseDate).getTime()) / 86400000) : '-'}</h3>
                  <p>Days Since Last Purchase</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon blue"><span className="material-icons-outlined">show_chart</span></div>
                <div className="stat-info">
                  <h3>₦{computed.numOrders > 0 ? (computed.totalPurchases / Math.max(1, Math.ceil((Date.now() - new Date(supplier.registrationDate).getTime()) / (30 * 86400000)))).toFixed(0) : '0'}</h3>
                  <p>Avg Monthly Purchases</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon orange"><span className="material-icons-outlined">credit_card</span></div>
                <div className="stat-info">
                  <h3>{supplier.creditLimit > 0 ? `${Math.min(100, Math.round((Math.max(0, computed.outstanding) / supplier.creditLimit) * 100))}%` : 'N/A'}</h3>
                  <p>Credit Utilization</p>
                </div>
              </div>
            </div>

            <div className="card mb-4">
              <div className="card-header"><span className="card-title">Purchase & Payment Trends</span></div>
              <Bar
                data={{
                  labels: monthlyData.labels,
                  datasets: [
                    { label: 'Purchases', data: monthlyData.purchases, backgroundColor: '#2E7D32', borderRadius: 6 },
                    { label: 'Payments', data: monthlyData.payments, backgroundColor: '#0277BD', borderRadius: 6 },
                  ]
                }}
                options={{ responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }}
              />
            </div>

            {ledger.length > 0 && (
              <div className="card">
                <div className="card-header"><span className="card-title">Balance Over Time</span></div>
                <Line
                  data={{
                    labels: ledger.map(e => e.date),
                    datasets: [{
                      label: 'Balance',
                      data: ledger.map(e => e.balance),
                      borderColor: '#2E7D32',
                      backgroundColor: 'rgba(46,125,50,0.1)',
                      fill: true,
                      tension: 0.3,
                    }]
                  }}
                  options={{ responsive: true, plugins: { legend: { display: false } } }}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'statement' && (
          <div>
            <div className="card mb-4">
              <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">From</label>
                  <input className="form-input" type="date" value={statementRange.from} onChange={e => setStatementRange(r => ({ ...r, from: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">To</label>
                  <input className="form-input" type="date" value={statementRange.to} onChange={e => setStatementRange(r => ({ ...r, to: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0, alignSelf: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={() => setShowStatement(true)}>
                    <span className="material-icons-outlined" style={{ fontSize: 18 }}>receipt</span>
                    Generate
                  </button>
                </div>
              </div>
            </div>

            {showStatement && (
              <div className="card" id="statement-print">
                <div style={{ textAlign: 'center', marginBottom: 24, borderBottom: '2px solid var(--md-primary)', paddingBottom: 16 }}>
                  <h2 style={{ color: 'var(--md-primary)' }}>SUPPLIER STATEMENT</h2>
                  <p className="text-muted">PoultryLog NG Farm Management</p>
                </div>
                <div className="grid grid-2 mb-4" style={{ fontSize: 14 }}>
                  <div>
                    <div><strong>{supplier.businessName}</strong></div>
                    <div className="text-muted">{supplier.supplierCode}</div>
                    <div className="text-muted">{supplier.phone}</div>
                    {supplier.email && <div className="text-muted">{supplier.email}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-muted">Statement Period</div>
                    <div><strong>{statementRange.from || 'All'}</strong> to <strong>{statementRange.to || 'Present'}</strong></div>
                    <div className="text-muted">Generated: {new Date().toLocaleDateString()}</div>
                  </div>
                </div>
                {statementData.length > 0 && (
                  <div className="card mb-4" style={{ background: '#E8F5E9', padding: 16 }}>
                    <div className="flex justify-between">
                      <span>Closing Balance:</span>
                      <span className="font-bold" style={{ fontSize: 18, color: statementData[statementData.length - 1].balance > 0 ? 'var(--md-error)' : statementData[statementData.length - 1].balance < 0 ? 'var(--md-info)' : 'var(--md-success)' }}>
                        {statementData[statementData.length - 1].balance < 0
                          ? `-₦${Math.abs(statementData[statementData.length - 1].balance).toLocaleString()}`
                          : `₦${statementData[statementData.length - 1].balance.toLocaleString()}`}
                      </span>
                    </div>
                  </div>
                )}
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr><th>Date</th><th>Reference</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr>
                    </thead>
                    <tbody>
                      {statementData.map((e, i) => (
                        <tr key={i}>
                          <td className="text-sm">{e.date}</td>
                          <td><code className="text-sm">{e.ref}</code></td>
                          <td>{e.description}</td>
                          <td>{e.debit > 0 ? `₦${e.debit.toLocaleString()}` : '-'}</td>
                          <td>{e.credit > 0 ? `₦${e.credit.toLocaleString()}` : '-'}</td>
                          <td><strong>{e.balance < 0 ? `-₦${Math.abs(e.balance).toLocaleString()}` : `₦${e.balance.toLocaleString()}`}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex justify-between" style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>
                  <span>Total Debits: ₦{statementData.reduce((s, e) => s + e.debit, 0).toLocaleString()}</span>
                  <span>Total Credits: ₦{statementData.reduce((s, e) => s + e.credit, 0).toLocaleString()}</span>
                </div>
              </div>
            )}

            {showStatement && (
              <div className="mt-4 flex justify-end">
                <button className="btn btn-primary" onClick={() => window.print()}>
                  <span className="material-icons-outlined" style={{ fontSize: 18 }}>print</span>
                  Print Statement
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        open={showPaymentForm}
        title={editingPayment ? 'Edit Payment' : 'Record Payment to Supplier'}
        onClose={() => { setShowPaymentForm(false); setEditingPayment(null); }}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => { setShowPaymentForm(false); setEditingPayment(null); }}>Cancel</button>
            <button className="btn btn-primary" onClick={handlePaymentSubmit}>{editingPayment ? 'Update' : 'Record Payment'}</button>
          </>
        }
      >
        <div className="form-row cols-2">
          <div className="form-group">
            <label className="form-label">Payment Date</label>
            <input className="form-input" type="date" value={paymentForm.paymentDate} onChange={e => setPaymentForm(f => ({ ...f, paymentDate: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Amount (₦) <span className="required">*</span></label>
            <input className="form-input" type="number" min="1" step="0.01" value={paymentForm.amountPaid || ''} onChange={e => setPaymentForm(f => ({ ...f, amountPaid: Number(e.target.value) }))} />
          </div>
        </div>
        <div className="form-row cols-2">
          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <select className="form-select" value={paymentForm.paymentMethod} onChange={e => setPaymentForm(f => ({ ...f, paymentMethod: e.target.value }))}>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Bank</label>
            <input className="form-input" value={paymentForm.bank} onChange={e => setPaymentForm(f => ({ ...f, bank: e.target.value }))} placeholder="Bank name" />
          </div>
        </div>
        <div className="form-row cols-2">
          <div className="form-group">
            <label className="form-label">Payment Reference</label>
            <input className="form-input" value={paymentForm.paymentReference} onChange={e => setPaymentForm(f => ({ ...f, paymentReference: e.target.value }))} placeholder="Transfer reference" />
          </div>
          <div className="form-group">
            <label className="form-label">Receipt Number</label>
            <input className="form-input" value={paymentForm.receiptNumber} onChange={e => setPaymentForm(f => ({ ...f, receiptNumber: e.target.value }))} placeholder="Auto-generated if empty" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Staff</label>
          <input className="form-input" value={paymentForm.staff} onChange={e => setPaymentForm(f => ({ ...f, staff: e.target.value }))} placeholder="Staff name" />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional notes" />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deletePayment}
        title="Delete Payment"
        message={`Delete payment of ₦${deletePayment?.amountPaid.toLocaleString()}? This will affect the supplier's balance.`}
        onConfirm={handleDeletePayment}
        onCancel={() => setDeletePayment(null)}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
