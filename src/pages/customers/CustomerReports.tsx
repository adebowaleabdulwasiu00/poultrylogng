import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { Tabs, Badge } from '@/components/UI';

export default function CustomerReports() {
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const sales = useLiveQuery(() => db.sales.toArray()) || [];
  const payments = useLiveQuery(() => db.customerPayments.toArray()) || [];

  const [activeTab, setActiveTab] = useState('aging');
  const [statementCustomerId, setStatementCustomerId] = useState(0);
  const [statementRange, setStatementRange] = useState({ from: '', to: '' });
  const [showStatement, setShowStatement] = useState(false);

  function getComputed(c: typeof customers[0]) {
    const custSales = sales.filter(s => s.customerId === c.id);
    const custPayments = payments.filter(p => p.customerId === c.id && p.status === 'completed');
    const totalPurchases = custSales.reduce((s, r) => s + r.totalAmount, 0);
    const totalPayments = custPayments.reduce((s, r) => s + r.amountPaid, 0);
    const outstanding = c.openingBalance + totalPurchases - totalPayments;
    const lastPurchase = custSales.length > 0 ? custSales.sort((a, b) => b.saleDate.localeCompare(a.saleDate))[0].saleDate : '';
    const lastPayment = custPayments.length > 0 ? custPayments.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))[0].paymentDate : '';
    return { totalPurchases, totalPayments, outstanding, lastPurchase, lastPayment };
  }

  const agingData = useMemo(() => {
    const today = new Date();
    return customers.map(c => {
      const { outstanding, lastPayment, lastPurchase } = getComputed(c);
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
      return { ...c, outstanding, daysOverdue, bucket, lastPayment, lastPurchase };
    }).filter(c => c.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding);
  }, [customers, sales, payments]);

  const agingSummary = useMemo(() => {
    const summary: Record<string, { count: number; amount: number }> = {
      '1-30 Days': { count: 0, amount: 0 },
      '31-60 Days': { count: 0, amount: 0 },
      '61-90 Days': { count: 0, amount: 0 },
      'Over 90 Days': { count: 0, amount: 0 },
    };
    for (const c of agingData) {
      if (summary[c.bucket]) {
        summary[c.bucket].count++;
        summary[c.bucket].amount += c.outstanding;
      }
    }
    return summary;
  }, [agingData]);

  const topCustomers = useMemo(() => {
    return customers.map(c => {
      const { totalPurchases } = getComputed(c);
      return { ...c, totalPurchases };
    }).sort((a, b) => b.totalPurchases - a.totalPurchases).slice(0, 10);
  }, [customers, sales]);

  const inactiveCustomers = useMemo(() => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const cutoff = sixMonthsAgo.toISOString().split('T')[0];
    return customers.filter(c => {
      const { lastPurchase } = getComputed(c);
      return !lastPurchase || lastPurchase < cutoff;
    });
  }, [customers, sales]);

  const statementData = useMemo(() => {
    const c = customers.find(cu => cu.id === statementCustomerId);
    if (!c || !showStatement) return null;
    const from = statementRange.from || '2000-01-01';
    const to = statementRange.to || '2099-12-31';
    const custSales = sales.filter(s => s.customerId === c.id && s.saleDate >= from && s.saleDate <= to);
    const custPayments = payments.filter(p => p.customerId === c.id && p.status === 'completed' && p.paymentDate >= from && p.paymentDate <= to);
    const entries: { date: string; ref: string; description: string; debit: number; credit: number; balance: number }[] = [];
    let running = c.openingBalance;
    entries.push({ date: c.registrationDate, ref: 'OPENING', description: 'Opening Balance', debit: c.openingBalance, credit: 0, balance: running });
    const allTx = [
      ...custSales.map(s => ({ date: s.saleDate, ref: s.invoiceNumber || `SALE-${s.id}`, description: s.productName, debit: s.totalAmount, credit: 0 })),
      ...custPayments.map(p => ({ date: p.paymentDate, ref: p.receiptNumber || `PAY-${p.id}`, description: `Payment (${p.paymentMethod})`, debit: 0, credit: p.amountPaid })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    for (const tx of allTx) {
      running = running + tx.debit - tx.credit;
      entries.push({ ...tx, balance: running });
    }
    return { customer: c, entries, closingBalance: running };
  }, [customers, sales, payments, statementCustomerId, showStatement, statementRange]);

  const tabs = [
    { key: 'aging', label: 'Aging Analysis', icon: 'schedule' },
    { key: 'outstanding', label: 'Outstanding Balances', icon: 'pending_actions' },
    { key: 'top', label: 'Top Customers', icon: 'leaderboard' },
    { key: 'inactive', label: 'Inactive Customers', icon: 'person_off' },
    { key: 'statement', label: 'Customer Statement', icon: 'description' },
  ];

  const totalOutstanding = agingData.reduce((s, c) => s + c.outstanding, 0);

  return (
    <div>
      <div className="grid grid-4 mb-6">
        <div className="stat-card">
          <div className="stat-icon orange"><span className="material-icons-outlined">pending_actions</span></div>
          <div className="stat-info"><h3>₦{totalOutstanding.toLocaleString()}</h3><p>Total Outstanding</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><span className="material-icons-outlined">group_off</span></div>
          <div className="stat-info"><h3>{agingData.length}</h3><p>Customers Owing</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><span className="material-icons-outlined">warning</span></div>
          <div className="stat-info"><h3>₦{(agingSummary['Over 90 Days']?.amount || 0).toLocaleString()}</h3><p>Over 90 Days</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><span className="material-icons-outlined">person_off</span></div>
          <div className="stat-info"><h3>{inactiveCustomers.length}</h3><p>Inactive Customers</p></div>
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
                  <div className="text-sm text-muted">{data.count} customer(s)</div>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr><th>Customer</th><th>Code</th><th>Category</th><th>Outstanding</th><th>Days Overdue</th><th>Last Payment</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {agingData.map(c => (
                      <tr key={c.id}>
                        <td><strong>{c.fullName}</strong></td>
                        <td><code className="text-sm">{c.customerCode}</code></td>
                        <td><Badge variant="info">{c.category}</Badge></td>
                        <td><strong style={{ color: 'var(--md-error)' }}>₦{c.outstanding.toLocaleString()}</strong></td>
                        <td>
                          <Badge variant={c.bucket === 'Over 90 Days' ? 'error' : c.bucket === '61-90 Days' ? 'warning' : 'info'}>
                            {c.daysOverdue} days
                          </Badge>
                        </td>
                        <td className="text-sm">{c.lastPayment || 'Never'}</td>
                        <td>
                          <button className="btn btn-text btn-sm" onClick={() => { setStatementCustomerId(c.id!); setActiveTab('statement'); }}>
                            <span className="material-icons-outlined" style={{ fontSize: 16 }}>description</span>
                            Statement
                          </button>
                        </td>
                      </tr>
                    ))}
                    {agingData.length === 0 && (
                      <tr><td colSpan={7} className="text-center text-muted" style={{ padding: 40 }}>No outstanding balances</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'outstanding' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr><th>Customer</th><th>Code</th><th>Category</th><th>Phone</th><th>Total Purchases</th><th>Total Payments</th><th>Outstanding</th><th>Last Purchase</th></tr>
                </thead>
                <tbody>
                  {customers.map(c => {
                    const { totalPurchases, totalPayments, outstanding, lastPurchase } = getComputed(c);
                    return outstanding > 0 ? (
                      <tr key={c.id}>
                        <td><strong>{c.fullName}</strong></td>
                        <td><code className="text-sm">{c.customerCode}</code></td>
                        <td><Badge variant="info">{c.category}</Badge></td>
                        <td>{c.phone}</td>
                        <td>₦{totalPurchases.toLocaleString()}</td>
                        <td>₦{totalPayments.toLocaleString()}</td>
                        <td><strong style={{ color: 'var(--md-error)' }}>₦{outstanding.toLocaleString()}</strong></td>
                        <td className="text-sm">{lastPurchase || 'Never'}</td>
                      </tr>
                    ) : null;
                  })}
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
                  <tr><th>#</th><th>Customer</th><th>Code</th><th>Category</th><th>Total Purchases</th><th>Orders</th></tr>
                </thead>
                <tbody>
                  {topCustomers.map((c, i) => {
                    const orderCount = sales.filter(s => s.customerId === c.id).length;
                    return (
                      <tr key={c.id}>
                        <td><strong>{i + 1}</strong></td>
                        <td><strong>{c.fullName}</strong></td>
                        <td><code className="text-sm">{c.customerCode}</code></td>
                        <td><Badge variant="info">{c.category}</Badge></td>
                        <td><strong style={{ color: 'var(--md-success)' }}>₦{c.totalPurchases.toLocaleString()}</strong></td>
                        <td>{orderCount}</td>
                      </tr>
                    );
                  })}
                  {topCustomers.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-muted" style={{ padding: 40 }}>No customer data</td></tr>
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
                  <tr><th>Customer</th><th>Code</th><th>Phone</th><th>Category</th><th>Last Purchase</th><th>Total Purchases</th></tr>
                </thead>
                <tbody>
                  {inactiveCustomers.map(c => {
                    const { totalPurchases, lastPurchase } = getComputed(c);
                    return (
                      <tr key={c.id}>
                        <td><strong>{c.fullName}</strong></td>
                        <td><code className="text-sm">{c.customerCode}</code></td>
                        <td>{c.phone}</td>
                        <td><Badge variant="info">{c.category}</Badge></td>
                        <td className="text-sm">{lastPurchase || 'Never'}</td>
                        <td>₦{totalPurchases.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {inactiveCustomers.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-muted" style={{ padding: 40 }}>All customers are active</td></tr>
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
                  <label className="form-label">Customer</label>
                  <select className="form-select" value={statementCustomerId} onChange={e => { setStatementCustomerId(Number(e.target.value)); setShowStatement(false); }}>
                    <option value="">Select customer...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.fullName} ({c.customerCode})</option>)}
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
                  <button className="btn btn-primary" disabled={!statementCustomerId} onClick={() => setShowStatement(true)}>
                    <span className="material-icons-outlined" style={{ fontSize: 18 }}>receipt</span>
                    Generate
                  </button>
                </div>
              </div>
            </div>

            {showStatement && statementData && (
              <div className="card" id="statement-print">
                <div style={{ textAlign: 'center', marginBottom: 24, borderBottom: '2px solid var(--md-primary)', paddingBottom: 16 }}>
                  <h2 style={{ color: 'var(--md-primary)' }}>CUSTOMER STATEMENT</h2>
                  <p className="text-muted">PoultryLog NG Farm Management</p>
                </div>
                <div className="grid grid-2 mb-4" style={{ fontSize: 14 }}>
                  <div>
                    <div><strong>{statementData.customer.fullName}</strong></div>
                    <div className="text-muted">{statementData.customer.customerCode}</div>
                    <div className="text-muted">{statementData.customer.phone}</div>
                    {statementData.customer.email && <div className="text-muted">{statementData.customer.email}</div>}
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
                    <span className="font-bold" style={{ fontSize: 18, color: statementData.closingBalance > 0 ? 'var(--md-error)' : 'var(--md-success)' }}>
                      ₦{statementData.closingBalance.toLocaleString()}
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
                          <td><strong>₦{e.balance.toLocaleString()}</strong></td>
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
