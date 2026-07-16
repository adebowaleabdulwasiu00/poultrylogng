import { useState, useMemo } from 'react';
import { db } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { Tabs, Badge } from '@/components/UI';

export default function SupplierReports() {
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) || [];
  const purchases = useLiveQuery(() => db.purchases.toArray()) || [];
  const payments = useLiveQuery(() => db.supplierPayments.toArray()) || [];
  const adjustments = useLiveQuery(() => db.supplierAdjustments.toArray()) || [];

  const [activeTab, setActiveTab] = useState('aging');
  const [statementSupplierId, setStatementSupplierId] = useState(0);
  const [statementRange, setStatementRange] = useState({ from: '', to: '' });
  const [showStatement, setShowStatement] = useState(false);

  function getComputed(s: typeof suppliers[0]) {
    const supPurchases = purchases.filter(p => p.supplierId === s.id);
    const supPayments = payments.filter(p => p.supplierId === s.id && p.status === 'completed');
    const supAdjustments = adjustments.filter(a => a.supplierId === s.id);
    const totalPurchases = supPurchases.reduce((sum, r) => sum + r.totalPrice, 0);
    const totalPayments = supPayments.reduce((sum, r) => sum + r.amountPaid, 0);
    const totalAdj = supAdjustments.reduce((sum, a) => {
      if (a.adjustmentType === 'credit_note' || a.adjustmentType === 'refund' || a.adjustmentType === 'return') return sum - a.amount;
      return sum + a.amount;
    }, 0);
    const outstanding = s.openingBalance + totalPurchases - totalPayments + totalAdj;
    const lastPurchase = supPurchases.length > 0 ? supPurchases.sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))[0].purchaseDate : '';
    const lastPayment = supPayments.length > 0 ? supPayments.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))[0].paymentDate : '';
    return { totalPurchases, totalPayments, outstanding, lastPurchase, lastPayment };
  }

  const agingData = useMemo(() => {
    const today = new Date();
    return suppliers.map(s => {
      const { outstanding, lastPayment, lastPurchase } = getComputed(s);
      let daysOverdue = 0;
      if (lastPayment) {
        daysOverdue = Math.floor((today.getTime() - new Date(lastPayment).getTime()) / 86400000);
      } else if (lastPurchase) {
        daysOverdue = Math.floor((today.getTime() - new Date(lastPurchase).getTime()) / 86400000);
      }
      let bucket = 'Current';
      if (outstanding <= 0) bucket = 'Paid';
      else if (daysOverdue <= 30) bucket = '1-30 Days';
      else if (daysOverdue <= 60) bucket = '31-60 Days';
      else if (daysOverdue <= 90) bucket = '61-90 Days';
      else bucket = 'Over 90 Days';
      return { ...s, outstanding, daysOverdue, bucket, lastPayment, lastPurchase };
    }).filter(s => s.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding);
  }, [suppliers, purchases, payments, adjustments]);

  const agingSummary = useMemo(() => {
    const summary: Record<string, { count: number; amount: number }> = {
      '1-30 Days': { count: 0, amount: 0 },
      '31-60 Days': { count: 0, amount: 0 },
      '61-90 Days': { count: 0, amount: 0 },
      'Over 90 Days': { count: 0, amount: 0 },
    };
    for (const s of agingData) {
      if (summary[s.bucket]) {
        summary[s.bucket].count++;
        summary[s.bucket].amount += s.outstanding;
      }
    }
    return summary;
  }, [agingData]);

  const farmOwes = useMemo(() => {
    return suppliers.map(s => {
      const { outstanding, lastPayment, lastPurchase } = getComputed(s);
      return { ...s, outstanding, lastPayment, lastPurchase };
    }).filter(s => s.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding);
  }, [suppliers, purchases, payments, adjustments]);

  const suppliersOwingFarm = useMemo(() => {
    return suppliers.map(s => {
      const { outstanding, lastPayment, lastPurchase } = getComputed(s);
      return { ...s, outstanding, lastPayment, lastPurchase };
    }).filter(s => s.outstanding < 0).sort((a, b) => a.outstanding - b.outstanding);
  }, [suppliers, purchases, payments, adjustments]);

  const topSuppliers = useMemo(() => {
    return suppliers.map(s => {
      const { totalPurchases } = getComputed(s);
      return { ...s, totalPurchases };
    }).sort((a, b) => b.totalPurchases - a.totalPurchases).slice(0, 10);
  }, [suppliers, purchases]);

  const inactiveSuppliers = useMemo(() => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const cutoff = sixMonthsAgo.toISOString().split('T')[0];
    return suppliers.filter(s => {
      const { lastPurchase } = getComputed(s);
      return !lastPurchase || lastPurchase < cutoff;
    });
  }, [suppliers, purchases]);

  const statementData = useMemo(() => {
    const s = suppliers.find(su => su.id === statementSupplierId);
    if (!s || !showStatement) return null;
    const from = statementRange.from || '2000-01-01';
    const to = statementRange.to || '2099-12-31';
    const supPurchases = purchases.filter(p => p.supplierId === s.id && p.purchaseDate >= from && p.purchaseDate <= to);
    const supPayments = payments.filter(p => p.supplierId === s.id && p.status === 'completed' && p.paymentDate >= from && p.paymentDate <= to);
    const supAdj = adjustments.filter(a => a.supplierId === s.id && a.adjustmentDate >= from && a.adjustmentDate <= to);
    const entries: { date: string; ref: string; description: string; debit: number; credit: number; balance: number }[] = [];
    let running = s.openingBalance;
    entries.push({ date: s.registrationDate, ref: 'OPENING', description: 'Opening Balance', debit: s.openingBalance > 0 ? s.openingBalance : 0, credit: s.openingBalance < 0 ? Math.abs(s.openingBalance) : 0, balance: running });
    const allTx = [
      ...supPurchases.map(p => ({ date: p.purchaseDate, ref: p.invoiceNumber || `PUR-${p.id}`, description: p.productName, debit: p.totalPrice, credit: 0 })),
      ...supPayments.map(p => ({ date: p.paymentDate, ref: p.receiptNumber || `PAY-${p.id}`, description: `Payment (${p.paymentMethod})`, debit: 0, credit: p.amountPaid })),
      ...supAdj.map(a => ({
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
    return { supplier: s, entries, closingBalance: running };
  }, [suppliers, purchases, payments, adjustments, statementSupplierId, showStatement, statementRange]);

  const tabs = [
    { key: 'aging', label: 'Aging Analysis', icon: 'schedule' },
    { key: 'farm_owes', label: 'Farm Owes Suppliers', icon: 'pending_actions' },
    { key: 'suppliers_owing', label: 'Suppliers Owing Farm', icon: 'savings' },
    { key: 'top', label: 'Top Suppliers', icon: 'leaderboard' },
    { key: 'inactive', label: 'Inactive Suppliers', icon: 'block' },
    { key: 'statement', label: 'Supplier Statement', icon: 'description' },
  ];

  const totalFarmOwes = farmOwes.reduce((s, c) => s + c.outstanding, 0);
  const totalOwingFarm = suppliersOwingFarm.reduce((s, c) => s + Math.abs(c.outstanding), 0);

  return (
    <div>
      <div className="grid grid-4 mb-6">
        <div className="stat-card">
          <div className="stat-icon orange"><span className="material-icons-outlined">pending_actions</span></div>
          <div className="stat-info"><h3>₦{totalFarmOwes.toLocaleString()}</h3><p>Farm Owes Suppliers</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><span className="material-icons-outlined">savings</span></div>
          <div className="stat-info"><h3>₦{totalOwingFarm.toLocaleString()}</h3><p>Suppliers Owing Farm</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><span className="material-icons-outlined">warning</span></div>
          <div className="stat-info"><h3>₦{(agingSummary['Over 90 Days']?.amount || 0).toLocaleString()}</h3><p>Over 90 Days</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><span className="material-icons-outlined">block</span></div>
          <div className="stat-info"><h3>{inactiveSuppliers.length}</h3><p>Inactive Suppliers</p></div>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="tab-content">
        {activeTab === 'aging' && (
          <div>
            <div className="grid grid-4 mb-4">
              {Object.entries(agingSummary).map(([bucket, data]) => (
                <div key={bucket} className="card" style={{ textAlign: 'center', borderLeft: `4px solid ${bucket === 'Over 90 Days' ? 'var(--md-error)' : bucket === '61-90 Days' ? '#E65100' : bucket === '31-60 Days' ? 'var(--md-warning)' : 'var(--md-info)'}` }}>
                  <div className="text-sm text-muted mb-3">{bucket}</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>₦{data.amount.toLocaleString()}</div>
                  <div className="text-sm text-muted">{data.count} supplier(s)</div>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr><th>Supplier</th><th>Code</th><th>Category</th><th>Outstanding</th><th>Days Overdue</th><th>Last Payment</th></tr>
                  </thead>
                  <tbody>
                    {agingData.map(s => (
                      <tr key={s.id}>
                        <td><strong>{s.businessName}</strong></td>
                        <td><code className="text-sm">{s.supplierCode}</code></td>
                        <td><Badge variant="info">{s.category}</Badge></td>
                        <td><strong style={{ color: 'var(--md-error)' }}>₦{s.outstanding.toLocaleString()}</strong></td>
                        <td>
                          <Badge variant={s.bucket === 'Over 90 Days' ? 'error' : s.bucket === '61-90 Days' ? 'warning' : 'info'}>
                            {s.daysOverdue} days
                          </Badge>
                        </td>
                        <td className="text-sm">{s.lastPayment || 'Never'}</td>
                      </tr>
                    ))}
                    {agingData.length === 0 && (
                      <tr><td colSpan={6} className="text-center text-muted" style={{ padding: 40 }}>No outstanding balances</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'farm_owes' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr><th>Supplier</th><th>Code</th><th>Category</th><th>Phone</th><th>Total Purchases</th><th>Total Payments</th><th>Amount Owed</th><th>Last Purchase</th></tr>
                </thead>
                <tbody>
                  {farmOwes.map(s => (
                    <tr key={s.id}>
                      <td><strong>{s.businessName}</strong></td>
                      <td><code className="text-sm">{s.supplierCode}</code></td>
                      <td><Badge variant="info">{s.category}</Badge></td>
                      <td>{s.phone}</td>
                      <td>₦{getComputed(s).totalPurchases.toLocaleString()}</td>
                      <td>₦{getComputed(s).totalPayments.toLocaleString()}</td>
                      <td><strong style={{ color: 'var(--md-error)' }}>₦{s.outstanding.toLocaleString()}</strong></td>
                      <td className="text-sm">{s.lastPurchase || 'Never'}</td>
                    </tr>
                  ))}
                  {farmOwes.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-muted" style={{ padding: 40 }}>Farm does not owe any suppliers</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'suppliers_owing' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr><th>Supplier</th><th>Code</th><th>Category</th><th>Phone</th><th>Amount Owed to Farm</th><th>Last Activity</th></tr>
                </thead>
                <tbody>
                  {suppliersOwingFarm.map(s => (
                    <tr key={s.id}>
                      <td><strong>{s.businessName}</strong></td>
                      <td><code className="text-sm">{s.supplierCode}</code></td>
                      <td><Badge variant="info">{s.category}</Badge></td>
                      <td>{s.phone}</td>
                      <td><strong style={{ color: 'var(--md-info)' }}>₦{Math.abs(s.outstanding).toLocaleString()}</strong></td>
                      <td className="text-sm">{s.lastPayment || s.lastPurchase || 'Never'}</td>
                    </tr>
                  ))}
                  {suppliersOwingFarm.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-muted" style={{ padding: 40 }}>No suppliers currently owe the farm</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'top' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr><th>#</th><th>Supplier</th><th>Code</th><th>Category</th><th>Total Purchases</th><th>Orders</th></tr>
                </thead>
                <tbody>
                  {topSuppliers.map((s, i) => {
                    const orderCount = purchases.filter(p => p.supplierId === s.id).length;
                    return (
                      <tr key={s.id}>
                        <td><strong>{i + 1}</strong></td>
                        <td><strong>{s.businessName}</strong></td>
                        <td><code className="text-sm">{s.supplierCode}</code></td>
                        <td><Badge variant="info">{s.category}</Badge></td>
                        <td><strong style={{ color: 'var(--md-success)' }}>₦{s.totalPurchases.toLocaleString()}</strong></td>
                        <td>{orderCount}</td>
                      </tr>
                    );
                  })}
                  {topSuppliers.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-muted" style={{ padding: 40 }}>No supplier data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'inactive' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr><th>Supplier</th><th>Code</th><th>Phone</th><th>Category</th><th>Last Purchase</th><th>Total Purchases</th></tr>
                </thead>
                <tbody>
                  {inactiveSuppliers.map(s => {
                    const { totalPurchases, lastPurchase } = getComputed(s);
                    return (
                      <tr key={s.id}>
                        <td><strong>{s.businessName}</strong></td>
                        <td><code className="text-sm">{s.supplierCode}</code></td>
                        <td>{s.phone}</td>
                        <td><Badge variant="info">{s.category}</Badge></td>
                        <td className="text-sm">{lastPurchase || 'Never'}</td>
                        <td>₦{totalPurchases.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {inactiveSuppliers.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-muted" style={{ padding: 40 }}>All suppliers are active</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'statement' && (
          <div>
            <div className="card mb-4">
              <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
                <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
                  <label className="form-label">Supplier</label>
                  <select className="form-select" value={statementSupplierId} onChange={e => { setStatementSupplierId(Number(e.target.value)); setShowStatement(false); }}>
                    <option value="">Select supplier...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.businessName} ({s.supplierCode})</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">From</label>
                  <input className="form-input" type="date" value={statementRange.from} onChange={e => setStatementRange(r => ({ ...r, from: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">To</label>
                  <input className="form-input" type="date" value={statementRange.to} onChange={e => setStatementRange(r => ({ ...r, to: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0, alignSelf: 'flex-end' }}>
                  <button className="btn btn-primary" disabled={!statementSupplierId} onClick={() => setShowStatement(true)}>
                    <span className="material-icons-outlined" style={{ fontSize: 18 }}>receipt</span>
                    Generate
                  </button>
                </div>
              </div>
            </div>

            {showStatement && statementData && (
              <div className="card" id="statement-print">
                <div style={{ textAlign: 'center', marginBottom: 24, borderBottom: '2px solid var(--md-primary)', paddingBottom: 16 }}>
                  <h2 style={{ color: 'var(--md-primary)' }}>SUPPLIER STATEMENT</h2>
                  <p className="text-muted">PoultryLog NG Farm Management</p>
                </div>
                <div className="grid grid-2 mb-4" style={{ fontSize: 14 }}>
                  <div>
                    <div><strong>{statementData.supplier.businessName}</strong></div>
                    <div className="text-muted">{statementData.supplier.supplierCode}</div>
                    <div className="text-muted">{statementData.supplier.phone}</div>
                    {statementData.supplier.email && <div className="text-muted">{statementData.supplier.email}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-muted">Statement Period</div>
                    <div><strong>{statementRange.from || 'All'}</strong> to <strong>{statementRange.to || 'Present'}</strong></div>
                    <div className="text-muted">Generated: {new Date().toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="card mb-4" style={{ background: '#E8F5E9', padding: 16 }}>
                  <div className="flex justify-between">
                    <span>Closing Balance:</span>
                    <span className="font-bold" style={{ fontSize: 18, color: statementData.closingBalance > 0 ? 'var(--md-error)' : statementData.closingBalance < 0 ? 'var(--md-info)' : 'var(--md-success)' }}>
                      {statementData.closingBalance < 0 ? `-₦${Math.abs(statementData.closingBalance).toLocaleString()}` : `₦${statementData.closingBalance.toLocaleString()}`}
                    </span>
                  </div>
                </div>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr><th>Date</th><th>Reference</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr>
                    </thead>
                    <tbody>
                      {statementData.entries.map((e, i) => (
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
                  <span>Total Debits: ₦{statementData.entries.reduce((s, e) => s + e.debit, 0).toLocaleString()}</span>
                  <span>Total Credits: ₦{statementData.entries.reduce((s, e) => s + e.credit, 0).toLocaleString()}</span>
                </div>
              </div>
            )}

            {showStatement && statementData && (
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
    </div>
  );
}
