import { useState, useMemo } from 'react';
import { db } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { useSettings } from '@/hooks/useSettings';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function PurchaseReports() {
  const headers = useLiveQuery(() => db.purchaseHeaders.where('status').equals('posted').toArray()) || [];
  const details = useLiveQuery(() => db.purchaseDetails.toArray()) || [];
  const { getCompanyInfo } = useSettings();
  const companyInfo = getCompanyInfo();
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  const filtered = useMemo(() =>
    headers.filter(h => h.purchaseDate >= dateFrom && h.purchaseDate <= dateTo),
    [headers, dateFrom, dateTo]
  );

  const totalSpent = filtered.reduce((s, h) => s + h.grandTotal, 0);
  const totalOutstanding = filtered.reduce((s, h) => s + h.balanceDue, 0);

  const detailsByHeader = useMemo(() => {
    const map: Record<number, typeof details> = {};
    for (const d of details) {
      if (!map[d.headerId]) map[d.headerId] = [];
      map[d.headerId].push(d);
    }
    return map;
  }, [details]);

  const bySupplier = useMemo(() => {
    const map: Record<string, { amount: number; count: number }> = {};
    for (const h of filtered) {
      if (!map[h.supplierName]) map[h.supplierName] = { amount: 0, count: 0 };
      map[h.supplierName].amount += h.grandTotal;
      map[h.supplierName].count++;
    }
    return map;
  }, [filtered]);

  const byProduct = useMemo(() => {
    const map: Record<string, { amount: number; qty: number }> = {};
    for (const h of filtered) {
      const lines = detailsByHeader[h.id!] || [];
      for (const d of lines) {
        if (!map[d.productName]) map[d.productName] = { amount: 0, qty: 0 };
        map[d.productName].amount += d.lineTotal;
        map[d.productName].qty += d.quantity;
      }
    }
    return map;
  }, [filtered, detailsByHeader]);

  const monthly = useMemo(() => {
    const map: Record<string, number> = {};
    for (const h of filtered) {
      const month = h.purchaseDate.substring(0, 7);
      map[month] = (map[month] || 0) + h.grandTotal;
    }
    return map;
  }, [filtered]);

  return (
    <div>
      <div className="card mb-4">
        <div className="form-row cols-2">
          <div className="form-group">
            <label className="form-label">From</label>
            <input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">To</label>
            <input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid grid-4 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-icon brown"><span className="material-icons-outlined">receipt_long</span></div>
          <div className="stat-info"><h3>{companyInfo.currencySymbol}{totalSpent.toLocaleString()}</h3><p>Total Purchases</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><span className="material-icons-outlined">shopping_bag</span></div>
          <div className="stat-info"><h3>{filtered.length}</h3><p>Invoices</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon teal"><span className="material-icons-outlined">group</span></div>
          <div className="stat-info"><h3>{Object.keys(bySupplier).length}</h3><p>Suppliers</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><span className="material-icons-outlined">pending</span></div>
          <div className="stat-info"><h3>{companyInfo.currencySymbol}{totalOutstanding.toLocaleString()}</h3><p>Outstanding</p></div>
        </div>
      </div>

      <div className="grid grid-2 mb-6">
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>Monthly Purchases</h3>
          {Object.keys(monthly).length > 0 ? (
            <Bar
              data={{
                labels: Object.keys(monthly).sort(),
                datasets: [{ label: `Amount (${companyInfo.currencySymbol})`, data: Object.keys(monthly).sort().map(m => monthly[m]), backgroundColor: '#5D4037', borderRadius: 4 }]
              }}
              options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
            />
          ) : <p className="text-muted" style={{ textAlign: 'center', padding: 40 }}>No data</p>}
        </div>
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>By Product</h3>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Product</th><th>Qty</th><th>Amount</th></tr></thead>
              <tbody>
                {Object.entries(byProduct).sort(([, a], [, b]) => b.amount - a.amount).map(([name, data]) => (
                  <tr key={name}>
                    <td><strong>{name}</strong></td>
                    <td>{data.qty}</td>
                    <td>{companyInfo.currencySymbol}{data.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 16 }}>Purchases by Supplier</h3>
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Supplier</th><th>Total Amount</th><th>Invoices</th><th>Share</th></tr></thead>
            <tbody>
              {Object.entries(bySupplier).sort(([, a], [, b]) => b.amount - a.amount).map(([name, data]) => (
                <tr key={name}>
                  <td><strong>{name}</strong></td>
                  <td>{companyInfo.currencySymbol}{data.amount.toLocaleString()}</td>
                  <td>{data.count}</td>
                  <td>{totalSpent > 0 ? ((data.amount / totalSpent) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
