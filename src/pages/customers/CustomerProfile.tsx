import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, nowISO, getActiveFarmId } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '@/components/ToastProvider';
import { Badge, Tabs, Modal, ConfirmDialog } from '@/components/UI';
import { PAYMENT_METHODS } from '@/db/types';
import type { Customer, CustomerPayment } from '@/db/types';
import { queueSync } from '@/db/sync';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, ArcElement } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, ArcElement);

export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const customerId = Number(id);

  const customer = useLiveQuery(() => db.customers.get(customerId), [customerId]);
  const sales = useLiveQuery(() => db.sales.where('customerId').equals(customerId).toArray(), [customerId]) || [];
  const payments = useLiveQuery(() => db.customerPayments.where('customerId').equals(customerId).toArray(), [customerId]) || [];
  const allSales = useLiveQuery(() => db.sales.toArray()) || [];
  const allPayments = useLiveQuery(() => db.customerPayments.toArray()) || [];

  const [activeTab, setActiveTab] = useState('overview');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    amountPaid: 0,
    paymentMethod: 'Cash',
    paymentReference: '',
    invoiceNumber: '',
    bank: '',
    cashier: '',
    receiptNumber: '',
    notes: '',
  });
  const [statementRange, setStatementRange] = useState({ from: '', to: '' });
  const [showStatement, setShowStatement] = useState(false);
  const [editingPayment, setEditingPayment] = useState<CustomerPayment | null>(null);
  const [deletePayment, setDeletePayment] = useState<CustomerPayment | null>(null);

  const computed = useMemo(() => {
    if (!customer) return { totalPurchases: 0, totalPayments: 0, outstanding: 0, numOrders: 0, avgOrder: 0, largestPurchase: 0, avgPayment: 0, largestPayment: 0 };
    const totalPurchases = sales.reduce((s, r) => s + r.totalAmount, 0);
    const completedPayments = payments.filter(p => p.status === 'completed');
    const totalPayments = completedPayments.reduce((s, r) => s + r.amountPaid, 0);
    const outstanding = customer.openingBalance + totalPurchases - totalPayments;
    const numOrders = sales.length;
    const avgOrder = numOrders > 0 ? totalPurchases / numOrders : 0;
    const largestPurchase = sales.length > 0 ? Math.max(...sales.map(s => s.totalAmount)) : 0;
    const avgPayment = completedPayments.length > 0 ? totalPayments / completedPayments.length : 0;
    const largestPayment = completedPayments.length > 0 ? Math.max(...completedPayments.map(p => p.amountPaid)) : 0;
    return { totalPurchases, totalPayments, outstanding, numOrders, avgOrder, largestPurchase, avgPayment, largestPayment };
  }, [customer, sales, payments]);

  const ledger = useMemo(() => {
    if (!customer) return [];
    const entries: { date: string; ref: string; type: string; description: string; debit: number; credit: number; balance: number }[] = [];
    let running = customer.openingBalance;
    if (customer.openingBalance > 0) {
      entries.push({ date: customer.registrationDate, ref: 'OPENING', type: 'Opening Balance', description: 'Opening balance carried forward', debit: customer.openingBalance, credit: 0, balance: running });
    }
    const allTx = [
      ...sales.map(s => ({ date: s.saleDate, ref: s.invoiceNumber || `SALE-${s.id}`, type: 'Sale', description: s.productName, debit: s.totalAmount, credit: 0 })),
      ...payments.filter(p => p.status === 'completed').map(p => ({ date: p.paymentDate, ref: p.receiptNumber || p.paymentReference || `PAY-${p.id}`, type: 'Payment', description: `Payment via ${p.paymentMethod}`, debit: 0, credit: p.amountPaid })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    for (const tx of allTx) {
      running = running + tx.debit - tx.credit;
      entries.push({ ...tx, balance: running });
    }
    return entries;
  }, [customer, sales, payments]);

  const monthlyData = useMemo(() => {
    const months: Record<string, { purchases: number; payments: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleDateString('en', { month: 'short', year: '2-digit' });
      months[key] = { purchases: 0, payments: 0 };
    }
    for (const s of sales) {
      const d = new Date(s.saleDate);
      const key = d.toLocaleDateString('en', { month: 'short', year: '2-digit' });
      if (months[key]) months[key].purchases += s.totalAmount;
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
  }, [sales, payments]);

  const topProducts = useMemo(() => {
    const map: Record<string, { qty: number; total: number }> = {};
    for (const s of sales) {
      if (!map[s.productName]) map[s.productName] = { qty: 0, total: 0 };
      map[s.productName].qty += s.quantity;
      map[s.productName].total += s.totalAmount;
    }
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
  }, [sales]);

  async function handlePaymentSubmit() {
    if (paymentForm.amountPaid <= 0) { toast('Enter a valid amount', 'error'); return; }
    if (!customer) return;
    const now = nowISO();
    const farmId = await getActiveFarmId();
    const record: Omit<CustomerPayment, 'id'> = {
      farmId,
      paymentDate: paymentForm.paymentDate,
      customerId: customer.id!,
      customerName: customer.fullName,
      paymentReference: paymentForm.paymentReference,
      invoiceNumber: paymentForm.invoiceNumber,
      amountPaid: paymentForm.amountPaid,
      paymentMethod: paymentForm.paymentMethod,
      bank: paymentForm.bank,
      cashier: paymentForm.cashier,
      status: 'completed',
      receiptNumber: paymentForm.receiptNumber || `REC-${Date.now().toString(36).toUpperCase()}`,
      notes: paymentForm.notes,
      createdBy: 'user',
      createdAt: now,
      modifiedBy: 'user',
      updatedAt: now,
      syncDate: '',
      syncStatus: 'pending',
    };
    if (editingPayment?.id) {
      await db.customerPayments.update(editingPayment.id, { ...record, syncStatus: 'pending' });
      await queueSync('customerPayments', editingPayment.id, 'update', record);
      toast('Payment updated');
    } else {
      const id = await db.customerPayments.add(record as CustomerPayment);
      await db.customers.update(customer.id!, { lastPaymentDate: paymentForm.paymentDate, updatedAt: now, syncStatus: 'pending' });
      await queueSync('customerPayments', id as number, 'create', { ...record, id });
      toast('Payment recorded');
    }
    setShowPaymentForm(false);
    setEditingPayment(null);
  }

  async function handleDeletePayment() {
    if (!deletePayment?.id || !customer) return;
    await db.customerPayments.delete(deletePayment.id);
    await queueSync('customerPayments', deletePayment.id, 'delete', null);
    toast('Payment deleted');
    setDeletePayment(null);
  }

  function openEditPayment(p: CustomerPayment) {
    setEditingPayment(p);
    setPaymentForm({
      paymentDate: p.paymentDate,
      amountPaid: p.amountPaid,
      paymentMethod: p.paymentMethod,
      paymentReference: p.paymentReference,
      invoiceNumber: p.invoiceNumber,
      bank: p.bank,
      cashier: p.cashier,
      receiptNumber: p.receiptNumber,
      notes: p.notes,
    });
    setShowPaymentForm(true);
  }

  function openNewPayment() {
    setEditingPayment(null);
    setPaymentForm({
      paymentDate: new Date().toISOString().split('T')[0],
      amountPaid: 0, paymentMethod: 'Cash', paymentReference: '', invoiceNumber: '',
      bank: '', cashier: '', receiptNumber: '', notes: '',
    });
    setShowPaymentForm(true);
  }

  const statementData = useMemo(() => {
    if (!customer || !showStatement) return [];
    const from = statementRange.from || '2000-01-01';
    const to = statementRange.to || '2099-12-31';
    const entries: { date: string; ref: string; description: string; debit: number; credit: number; balance: number }[] = [];
    let running = customer.openingBalance;
    entries.push({ date: customer.registrationDate, ref: 'OPENING', description: 'Opening Balance', debit: customer.openingBalance, credit: 0, balance: running });
    const allTx = [
      ...sales.filter(s => s.saleDate >= from && s.saleDate <= to).map(s => ({ date: s.saleDate, ref: s.invoiceNumber || `SALE-${s.id}`, description: s.productName, debit: s.totalAmount, credit: 0 })),
      ...payments.filter(p => p.status === 'completed' && p.paymentDate >= from && p.paymentDate <= to).map(p => ({ date: p.paymentDate, ref: p.receiptNumber || `PAY-${p.id}`, description: `Payment (${p.paymentMethod})`, debit: 0, credit: p.amountPaid })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    for (const tx of allTx) {
      running = running + tx.debit - tx.credit;
      entries.push({ ...tx, balance: running });
    }
    return entries;
  }, [customer, sales, payments, showStatement, statementRange]);

  if (!customer) return <div className="empty-state"><p>Loading customer...</p></div>;

  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'info' },
    { key: 'purchases', label: 'Purchases', icon: 'shopping_bag' },
    { key: 'payments', label: 'Payments', icon: 'payments' },
    { key: 'ledger', label: 'Ledger', icon: 'account_balance_book' },
    { key: 'analytics', label: 'Analytics', icon: 'insights' },
  ];

  return (
    <div>
      <button className="btn btn-text btn-sm mb-4" onClick={() => navigate('/customers')}>
        <span className="material-icons-outlined" style={{ fontSize: 18 }}>arrow_back</span>
        Back to Customers
      </button>

      <div className="card mb-4">
        <div className="flex items-center gap-4" style={{ flexWrap: 'wrap' }}>
          {customer.profilePhoto ? (
            <img src={customer.profilePhoto} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div className="avatar-placeholder-xl">{customer.fullName.charAt(0).toUpperCase()}</div>
          )}
          <div style={{ flex: 1 }}>
            <div className="flex items-center gap-3">
              <h2 style={{ fontSize: 22 }}>{customer.fullName}</h2>
              <Badge variant={customer.status === 'active' ? 'success' : 'neutral'}>{customer.status}</Badge>
              <Badge variant="info">{customer.category}</Badge>
            </div>
            <div className="flex gap-4 mt-4" style={{ flexWrap: 'wrap', fontSize: 13, color: 'var(--md-on-surface-variant)' }}>
              <span><strong>Code:</strong> {customer.customerCode}</span>
              {customer.phone && <span><span className="material-icons-outlined" style={{ fontSize: 14, verticalAlign: 'middle' }}>phone</span> {customer.phone}</span>}
              {customer.email && <span><span className="material-icons-outlined" style={{ fontSize: 14, verticalAlign: 'middle' }}>email</span> {customer.email}</span>}
              {customer.physicalAddress && <span><span className="material-icons-outlined" style={{ fontSize: 14, verticalAlign: 'middle' }}>location_on</span> {customer.physicalAddress}{customer.state ? `, ${customer.state}` : ''}</span>}
            </div>
          </div>
          <div className="text-right">
            <div style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>Outstanding Balance</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: computed.outstanding > 0 ? 'var(--md-error)' : 'var(--md-success)' }}>
              ₦{computed.outstanding.toLocaleString()}
            </div>
            {customer.creditLimit > 0 && (
              <div className="text-sm text-muted">Credit Limit: ₦{customer.creditLimit.toLocaleString()}</div>
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
                <div className="card-header"><span className="card-title">Customer Information</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
                  <div><span className="text-muted">Contact Person:</span> {customer.contactPerson || '-'}</div>
                  <div><span className="text-muted">Alt. Phone:</span> {customer.alternativePhone || '-'}</div>
                  <div><span className="text-muted">LGA:</span> {customer.lga || '-'}</div>
                  <div><span className="text-muted">Registered:</span> {new Date(customer.registrationDate).toLocaleDateString()}</div>
                  <div style={{ gridColumn: 'span 2' }}><span className="text-muted">Notes:</span> {customer.notes || '-'}</div>
                </div>
              </div>
              <div className="card">
                <div className="card-header"><span className="card-title">Account Summary</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
                  <div><span className="text-muted">Opening Balance:</span> <strong>₦{customer.openingBalance.toLocaleString()}</strong></div>
                  <div><span className="text-muted">Credit Limit:</span> <strong>₦{customer.creditLimit.toLocaleString()}</strong></div>
                  <div><span className="text-muted">Last Purchase:</span> {customer.lastPurchaseDate || 'Never'}</div>
                  <div><span className="text-muted">Last Payment:</span> {customer.lastPaymentDate || 'Never'}</div>
                  <div><span className="text-muted">Largest Purchase:</span> ₦{computed.largestPurchase.toLocaleString()}</div>
                  <div><span className="text-muted">Avg Payment:</span> ₦{computed.avgPayment.toLocaleString()}</div>
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
            {sales.length === 0 ? (
              <div className="card"><div className="empty-state" style={{ padding: 40 }}>
                <span className="material-icons-outlined">shopping_bag</span>
                <h3>No Purchases</h3>
                <p>This customer has not made any purchases yet</p>
              </div></div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr><th>Date</th><th>Invoice</th><th>Product</th><th>Qty</th><th>Amount</th><th>Discount</th><th>Total</th><th>Payment</th></tr>
                    </thead>
                    <tbody>
                      {sales.sort((a, b) => b.saleDate.localeCompare(a.saleDate)).map(s => (
                        <tr key={s.id}>
                          <td className="text-sm">{s.saleDate}</td>
                          <td><code className="text-sm">{s.invoiceNumber || '-'}</code></td>
                          <td><strong>{s.productName}</strong></td>
                          <td>{s.quantity} {s.unit}</td>
                          <td>₦{s.unitPrice.toLocaleString()}</td>
                          <td>{s.discount > 0 ? `₦${s.discount.toLocaleString()}` : '-'}</td>
                          <td><strong style={{ color: 'var(--md-success)' }}>₦{s.totalAmount.toLocaleString()}</strong></td>
                          <td><Badge variant="neutral">{s.paymentMethod}</Badge></td>
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
                <p>No payments have been recorded for this customer</p>
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
                          <td>{p.cashier || '-'}</td>
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
                        <td><Badge variant={e.type === 'Payment' ? 'success' : e.type === 'Opening Balance' ? 'info' : 'neutral'}>{e.type}</Badge></td>
                        <td>{e.description}</td>
                        <td>{e.debit > 0 ? <span style={{ color: 'var(--md-error)' }}>₦{e.debit.toLocaleString()}</span> : '-'}</td>
                        <td>{e.credit > 0 ? <span style={{ color: 'var(--md-success)' }}>₦{e.credit.toLocaleString()}</span> : '-'}</td>
                        <td><strong>₦{e.balance.toLocaleString()}</strong></td>
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
                  <h3>{sales.length > 0 ? Math.floor((Date.now() - new Date(sales.sort((a, b) => b.saleDate.localeCompare(a.saleDate))[0].saleDate).getTime()) / 86400000) : '-'}</h3>
                  <p>Days Since Last Purchase</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon blue"><span className="material-icons-outlined">show_chart</span></div>
                <div className="stat-info">
                  <h3>₦{computed.numOrders > 0 ? (computed.totalPurchases / Math.max(1, Math.ceil((Date.now() - new Date(customer.registrationDate).getTime()) / (30 * 86400000)))).toFixed(0) : '0'}</h3>
                  <p>Avg Monthly Spending</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon orange"><span className="material-icons-outlined">credit_card</span></div>
                <div className="stat-info">
                  <h3>{customer.creditLimit > 0 ? `${Math.min(100, Math.round((computed.outstanding / customer.creditLimit) * 100))}%` : 'N/A'}</h3>
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
                  options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        open={showPaymentForm}
        title={editingPayment ? 'Edit Payment' : 'Record Payment'}
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
            <label className="form-label">Invoice Number</label>
            <input className="form-input" value={paymentForm.invoiceNumber} onChange={e => setPaymentForm(f => ({ ...f, invoiceNumber: e.target.value }))} placeholder="Optional" />
          </div>
        </div>
        <div className="form-row cols-2">
          <div className="form-group">
            <label className="form-label">Receipt Number</label>
            <input className="form-input" value={paymentForm.receiptNumber} onChange={e => setPaymentForm(f => ({ ...f, receiptNumber: e.target.value }))} placeholder="Auto-generated if empty" />
          </div>
          <div className="form-group">
            <label className="form-label">Cashier / Staff</label>
            <input className="form-input" value={paymentForm.cashier} onChange={e => setPaymentForm(f => ({ ...f, cashier: e.target.value }))} placeholder="Staff name" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional notes" />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deletePayment}
        title="Delete Payment"
        message={`Delete payment of ₦${deletePayment?.amountPaid.toLocaleString()}? This will affect the customer's balance.`}
        onConfirm={handleDeletePayment}
        onCancel={() => setDeletePayment(null)}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
