import { useState, useMemo } from 'react';
import { db } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { useSettings } from '@/hooks/useSettings';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function SalesReports() {
  const headers = useLiveQuery(() => db.salesHeaders.where('status').equals('posted').toArray()) || [];
  const details = useLiveQuery(() => db.salesDetails.toArray()) || [];
  const { getCompanyInfo } = useSettings();
  const companyInfo = getCompanyInfo();
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  const filtered = useMemo(() =>
    headers.filter(h => h.invoiceDate >= dateFrom && h.invoiceDate <= dateTo).sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate)),
    [headers, dateFrom, dateTo]
  );

  const totalRevenue = filtered.reduce((s, h) => s + h.grandTotal, 0);
  const totalDiscount = filtered.reduce((s, h) => s + h.discountAmount, 0);
  const totalOutstanding = filtered.reduce((s, h) => s + h.balanceDue, 0);
  const totalPaid = filtered.reduce((s, h) => s + h.amountPaid, 0);

  const detailsByHeader = useMemo(() => {
    const map: Record<number, typeof details> = {};
    for (const d of details) {
      if (!map[d.headerId]) map[d.headerId] = [];
      map[d.headerId].push(d);
    }
    return map;
  }, [details]);

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

  const byCustomer = useMemo(() => {
    const map: Record<string, { amount: number; count: number }> = {};
    for (const h of filtered) {
      if (!map[h.customerName]) map[h.customerName] = { amount: 0, count: 0 };
      map[h.customerName].amount += h.grandTotal;
      map[h.customerName].count++;
    }
    return map;
  }, [filtered]);

  const dailyRevenue = useMemo(() => {
    const map: Record<string, number> = {};
    for (const h of filtered) map[h.invoiceDate] = (map[h.invoiceDate] || 0) + h.grandTotal;
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
          <div className="stat-icon green"><span className="material-icons-outlined">paid</span></div>
          <div className="stat-info"><h3>{companyInfo.currencySymbol}{totalRevenue.toLocaleString()}</h3><p>Total Revenue</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><span className="material-icons-outlined">receipt</span></div>
          <div className="stat-info"><h3>{filtered.length}</h3><p>Invoices</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><span className="material-icons-outlined">payments</span></div>
          <div className="stat-info"><h3>{companyInfo.currencySymbol}{totalPaid.toLocaleString()}</h3><p>Amount Collected</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><span className="material-icons-outlined">pending</span></div>
          <div className="stat-info"><h3>{companyInfo.currencySymbol}{totalOutstanding.toLocaleString()}</h3><p>Outstanding</p></div>
        </div>
      </div>

      <div className="grid grid-2 mb-6">
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>Daily Revenue</h3>
          {Object.keys(dailyRevenue).length > 0 ? (
            <Bar
              data={{
                labels: Object.keys(dailyRevenue).sort().map(d => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })),
                datasets: [{ label: `Revenue (${companyInfo.currencySymbol})`, data: Object.keys(dailyRevenue).sort().map(d => dailyRevenue[d]), backgroundColor: '#4CAF50', borderRadius: 4 }]
              }}
              options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
            />
          ) : <p className="text-muted" style={{ textAlign: 'center', padding: 40 }}>No data</p>}
        </div>
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>Revenue by Product</h3>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Product</th><th>Qty Sold</th><th>Revenue</th><th>Share</th></tr></thead>
              <tbody>
                {Object.entries(byProduct).sort(([, a], [, b]) => b.amount - a.amount).map(([name, data]) => (
                  <tr key={name}>
                    <td><strong>{name}</strong></td>
                    <td>{data.qty}</td>
                    <td>{companyInfo.currencySymbol}{data.amount.toLocaleString()}</td>
                    <td>{totalRevenue > 0 ? ((data.amount / totalRevenue) * 100).toFixed(1) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 16 }}>Top Customers</h3>
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Customer</th><th>Total Purchases</th><th>Invoices</th></tr></thead>
            <tbody>
              {Object.entries(byCustomer).sort(([, a], [, b]) => b.amount - a.amount).map(([name, data]) => (
                <tr key={name}>
                  <td><strong>{name}</strong></td>
                  <td>{companyInfo.currencySymbol}{data.amount.toLocaleString()}</td>
                  <td>{data.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
