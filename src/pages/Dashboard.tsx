import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

export default function Dashboard() {
  const batches = useLiveQuery(() => db.batches.where('status').equals('active').toArray()) || [];
  const allBatches = useLiveQuery(() => db.batches.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const allPayments = useLiveQuery(() => db.customerPayments.toArray()) || [];
  const todayStr = new Date().toISOString().split('T')[0];

  const [todayEggs, setTodayEggs] = useState(0);
  const [todayFeed, setTodayFeed] = useState(0);
  const [todayMortality, setTodayMortality] = useState(0);
  const [todayMedication, setTodayMedication] = useState(0);
  const [recentSales, setRecentSales] = useState(0);
  const [recentPurchases, setRecentPurchases] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [weeklyProduction, setWeeklyProduction] = useState<{ label: string; value: number }[]>([]);
  const [mortalityByReason, setMortalityByReason] = useState<{ label: string; value: number }[]>([]);

  const sales = useLiveQuery(() => db.sales.orderBy('saleDate').reverse().limit(5).toArray()) || [];
  const purchases = useLiveQuery(() => db.purchases.orderBy('purchaseDate').reverse().limit(5).toArray()) || [];

  useEffect(() => {
    async function load() {
      const todayReports = await db.dailyReports.where('reportDate').equals(todayStr).toArray();
      let eggs = 0, feed = 0, mortality = 0, medication = 0;
      for (const r of todayReports) {
        for (const e of (r.eggProduction || [])) eggs += e.totalPieces;
        for (const f of (r.feedIntake || [])) feed += f.quantityGrams;
        for (const m of (r.mortality || [])) mortality += m.numberDead;
        for (const med of (r.medication || [])) medication += med.quantityUsed;
      }
      setTodayEggs(eggs);
      setTodayFeed(feed);
      setTodayMortality(mortality);
      setTodayMedication(medication);

      const recentSalesArr = await db.sales.where('saleDate').equals(todayStr).toArray();
      setRecentSales(recentSalesArr.reduce((s, r) => s + r.totalAmount, 0));

      const recentPurchasesArr = await db.purchases.where('purchaseDate').equals(todayStr).toArray();
      setRecentPurchases(recentPurchasesArr.reduce((s, r) => s + r.totalPrice, 0));

      setLowStockCount(products.filter(p => p.currentStock <= p.minimumStock).length);

      // Weekly production
      const days: { label: string; value: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        const dayReports = await db.dailyReports.where('reportDate').equals(ds).toArray();
        let total = 0;
        for (const r of dayReports) {
          for (const e of (r.eggProduction || [])) total += e.totalPieces;
        }
        days.push({ label: d.toLocaleDateString('en', { weekday: 'short' }), value: total });
      }
      setWeeklyProduction(days);

      // Mortality by reason
      const reasonMap: Record<string, number> = {};
      const allReports = await db.dailyReports.toArray();
      for (const r of allReports) {
        for (const m of (r.mortality || [])) {
          reasonMap[m.reason] = (reasonMap[m.reason] || 0) + m.numberDead;
        }
      }
      setMortalityByReason(Object.entries(reasonMap).map(([label, value]) => ({ label, value })));
    }
    load();
  }, [todayStr, products.length]);

  const totalBirds = batches.reduce((s, b) => s + b.currentPopulation, 0);

  return (
    <div>
      <div className="grid grid-4 mb-6">
        <div className="stat-card">
          <div className="stat-icon green"><span className="material-icons-outlined">egg</span></div>
          <div className="stat-info">
            <h3>{todayEggs.toLocaleString()}</h3>
            <p>Today's Egg Production</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><span className="material-icons-outlined">pets</span></div>
          <div className="stat-info">
            <h3>{totalBirds.toLocaleString()}</h3>
            <p>Total Birds Alive</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><span className="material-icons-outlined">inventory_2</span></div>
          <div className="stat-info">
            <h3>{batches.length}</h3>
            <p>Active Batches</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><span className="material-icons-outlined">dangerous</span></div>
          <div className="stat-info">
            <h3>{todayMortality}</h3>
            <p>Mortality Today</p>
          </div>
        </div>
      </div>

      <div className="grid grid-4 mb-6">
        <div className="stat-card">
          <div className="stat-icon teal"><span className="material-icons-outlined">grass</span></div>
          <div className="stat-info">
            <h3>{(todayFeed / 1000).toFixed(1)} kg</h3>
            <p>Feed Consumed Today</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><span className="material-icons-outlined">medication</span></div>
          <div className="stat-info">
            <h3>{todayMedication}</h3>
            <p>Medication Today</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><span className="material-icons-outlined">paid</span></div>
          <div className="stat-info">
            <h3>₦{recentSales.toLocaleString()}</h3>
            <p>Today's Sales</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon brown"><span className="material-icons-outlined">shopping_cart</span></div>
          <div className="stat-info">
            <h3>₦{recentPurchases.toLocaleString()}</h3>
            <p>Today's Purchases</p>
          </div>
        </div>
      </div>

      {lowStockCount > 0 && (
        <div className="card mb-6" style={{ borderLeft: '4px solid var(--md-warning)', background: '#FFF8E1' }}>
          <div className="flex items-center gap-3">
            <span className="material-icons-outlined" style={{ color: 'var(--md-warning)', fontSize: 28 }}>warning</span>
            <div>
              <strong>Low Stock Alert</strong>
              <p className="text-sm text-muted">{lowStockCount} product(s) are below minimum stock level</p>
            </div>
            <Link to="/inventory" className="btn btn-sm btn-outline" style={{ marginLeft: 'auto' }}>View Inventory</Link>
          </div>
        </div>
      )}

      {customers.length > 0 && (
        <div className="grid grid-3 mb-6">
          <div className="stat-card">
            <div className="stat-icon green"><span className="material-icons-outlined">people</span></div>
            <div className="stat-info">
              <h3>{customers.filter(c => c.status === 'active').length}</h3>
              <p>Active Customers</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange"><span className="material-icons-outlined">pending_actions</span></div>
            <div className="stat-info">
              <h3>{customers.filter(c => { const ts = sales.filter(s => s.customerId === c.id).reduce((a, r) => a + r.totalAmount, 0); const tp = allPayments.filter(p => p.customerId === c.id && p.status === 'completed').reduce((a, r) => a + r.amountPaid, 0); return c.openingBalance + ts - tp > 0; }).length}</h3>
              <p>Customers Owing</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue"><span className="material-icons-outlined">link</span></div>
            <div className="stat-info">
              <h3>{sales.filter(s => s.customerId).length} / {sales.length}</h3>
              <p>Sales Linked to Customers</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-2 mb-6">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Weekly Egg Production</span>
          </div>
          <Bar
            data={{
              labels: weeklyProduction.map(d => d.label),
              datasets: [{
                label: 'Eggs',
                data: weeklyProduction.map(d => d.value),
                backgroundColor: '#4CAF50',
                borderRadius: 6,
              }]
            }}
            options={{
              responsive: true,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true } }
            }}
          />
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Mortality by Cause</span>
          </div>
          {mortalityByReason.length > 0 ? (
            <Doughnut
              data={{
                labels: mortalityByReason.map(d => d.label),
                datasets: [{
                  data: mortalityByReason.map(d => d.value),
                  backgroundColor: ['#D32F2F', '#E65100', '#F57F17', '#2E7D32', '#0277BD', '#7B1FA2', '#5D4037', '#455A64', '#C62828', '#AD1457', '#6A1B9A', '#00838F', '#33691E', '#827717', '#BF360C'],
                }]
              }}
              options={{
                responsive: true,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8 } } },
              }}
            />
          ) : (
            <div className="empty-state" style={{ padding: 30 }}>
              <p className="text-muted">No mortality data yet</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Sales</span>
            <Link to="/sales" className="btn btn-text btn-sm">View All</Link>
          </div>
          {sales.length > 0 ? (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(s => (
                    <tr key={s.id}>
                      <td>{s.saleDate}</td>
                      <td>{s.customer}</td>
                      <td>₦{s.totalAmount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 30 }}>
              <span className="material-icons-outlined">point_of_sale</span>
              <p className="text-muted">No sales recorded yet</p>
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Purchases</span>
            <Link to="/purchases" className="btn btn-text btn-sm">View All</Link>
          </div>
          {purchases.length > 0 ? (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Supplier</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map(p => (
                    <tr key={p.id}>
                      <td>{p.purchaseDate}</td>
                      <td>{p.supplier}</td>
                      <td>₦{p.totalPrice.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 30 }}>
              <span className="material-icons-outlined">shopping_cart</span>
              <p className="text-muted">No purchases recorded yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
