import { useState, useEffect, useMemo } from 'react';
import { db } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { Tabs, SearchBar } from '@/components/UI';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

export default function PoultryReports() {
  const [activeTab, setActiveTab] = useState('production');
  const batches = useLiveQuery(() => db.batches.toArray()) || [];
  const reports = useLiveQuery(() => db.dailyReports.toArray()) || [];
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [batchFilter, setBatchFilter] = useState(0);

  const filtered = useMemo(() => {
    let r = reports.filter(r => r.reportDate >= dateFrom && r.reportDate <= dateTo);
    if (batchFilter) r = r.filter(r => r.batchId === batchFilter);
    return r.sort((a, b) => a.reportDate.localeCompare(b.reportDate));
  }, [reports, dateFrom, dateTo, batchFilter]);

  const totalEggs = filtered.reduce((s, r) => s + (r.eggProduction || []).reduce((s2, e) => s2 + e.totalPieces, 0), 0);
  const totalCracked = filtered.reduce((s, r) => s + (r.eggProduction || []).reduce((s2, e) => s2 + e.cracked, 0), 0);
  const totalDamaged = filtered.reduce((s, r) => s + (r.eggProduction || []).reduce((s2, e) => s2 + e.damaged, 0), 0);
  const totalMortality = filtered.reduce((s, r) => s + (r.mortality || []).reduce((s2, m) => s2 + m.numberDead, 0), 0);
  const totalFeed = filtered.reduce((s, r) => s + (r.feedIntake || []).reduce((s2, f) => s2 + f.quantityGrams, 0), 0);

  const productionByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filtered) {
      const eggs = (r.eggProduction || []).reduce((s, e) => s + e.totalPieces, 0);
      map[r.reportDate] = (map[r.reportDate] || 0) + eggs;
    }
    return map;
  }, [filtered]);

  const mortalityByReason = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filtered) {
      for (const m of (r.mortality || [])) {
        map[m.reason] = (map[m.reason] || 0) + m.numberDead;
      }
    }
    return map;
  }, [filtered]);

  const mortalityByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filtered) {
      map[r.reportDate] = (map[r.reportDate] || 0) + (r.mortality || []).reduce((s, m) => s + m.numberDead, 0);
    }
    return map;
  }, [filtered]);

  const feedByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filtered) {
      map[r.reportDate] = (map[r.reportDate] || 0) + (r.feedIntake || []).reduce((s, f) => s + f.quantityGrams, 0);
    }
    return map;
  }, [filtered]);

  const tabs = [
    { key: 'production', label: 'Production', icon: 'egg' },
    { key: 'mortality', label: 'Mortality', icon: 'dangerous' },
    { key: 'feed', label: 'Feed', icon: 'grass' },
    { key: 'batch', label: 'Batch Perf.', icon: 'assessment' },
  ];

  const dateLabels = Object.keys(productionByDate).sort();

  return (
    <div>
      <div className="card mb-4">
        <div className="form-row cols-3">
          <div className="form-group">
            <label className="form-label">From</label>
            <input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">To</label>
            <input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Batch</label>
            <select className="form-select" value={batchFilter} onChange={e => setBatchFilter(Number(e.target.value))}>
              <option value={0}>All Batches</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.batchName}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-4 mb-6">
        <div className="stat-card">
          <div className="stat-icon green"><span className="material-icons-outlined">egg</span></div>
          <div className="stat-info"><h3>{totalEggs.toLocaleString()}</h3><p>Total Eggs</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><span className="material-icons-outlined">dangerous</span></div>
          <div className="stat-info"><h3>{totalMortality}</h3><p>Total Mortality</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><span className="material-icons-outlined">grass</span></div>
          <div className="stat-info"><h3>{(totalFeed / 1000).toFixed(1)} kg</h3><p>Total Feed</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><span className="material-icons-outlined">broken_image</span></div>
          <div className="stat-info"><h3>{totalCracked + totalDamaged}</h3><p>Cracked + Damaged</p></div>
        </div>
      </div>

      <div className="card">
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'production' && (
          <div className="tab-content">
            <h3 style={{ fontSize: 15, marginBottom: 16 }}>Egg Production Trend</h3>
            {dateLabels.length > 0 ? (
              <Line
                data={{
                  labels: dateLabels.map(d => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })),
                  datasets: [{
                    label: 'Eggs',
                    data: dateLabels.map(d => productionByDate[d]),
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    fill: true,
                    tension: 0.3,
                  }]
                }}
                options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
              />
            ) : (
              <p className="text-muted" style={{ textAlign: 'center', padding: 40 }}>No production data in this period</p>
            )}
          </div>
        )}

        {activeTab === 'mortality' && (
          <div className="tab-content">
            <div className="grid grid-2">
              <div>
                <h3 style={{ fontSize: 15, marginBottom: 16 }}>Mortality Trend</h3>
                {Object.keys(mortalityByDate).length > 0 ? (
                  <Bar
                    data={{
                      labels: Object.keys(mortalityByDate).sort().map(d => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })),
                      datasets: [{
                        label: 'Deaths',
                        data: Object.keys(mortalityByDate).sort().map(d => mortalityByDate[d]),
                        backgroundColor: '#D32F2F',
                        borderRadius: 4,
                      }]
                    }}
                    options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
                  />
                ) : <p className="text-muted" style={{ textAlign: 'center', padding: 40 }}>No data</p>}
              </div>
              <div>
                <h3 style={{ fontSize: 15, marginBottom: 16 }}>Mortality by Cause</h3>
                {Object.keys(mortalityByReason).length > 0 ? (
                  <Pie
                    data={{
                      labels: Object.keys(mortalityByReason),
                      datasets: [{
                        data: Object.values(mortalityByReason),
                        backgroundColor: ['#D32F2F', '#E65100', '#F57F17', '#2E7D32', '#0277BD', '#7B1FA2', '#5D4037', '#455A64', '#C62828', '#AD1457', '#6A1B9A', '#00838F', '#33691E', '#827717', '#BF360C'],
                      }]
                    }}
                    options={{ responsive: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } }}
                  />
                ) : <p className="text-muted" style={{ textAlign: 'center', padding: 40 }}>No data</p>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'feed' && (
          <div className="tab-content">
            <h3 style={{ fontSize: 15, marginBottom: 16 }}>Feed Consumption Trend (kg)</h3>
            {Object.keys(feedByDate).length > 0 ? (
              <Bar
                data={{
                  labels: Object.keys(feedByDate).sort().map(d => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })),
                  datasets: [{
                    label: 'Feed (g)',
                    data: Object.keys(feedByDate).sort().map(d => feedByDate[d] / 1000),
                    backgroundColor: '#0277BD',
                    borderRadius: 4,
                  }]
                }}
                options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
              />
            ) : <p className="text-muted" style={{ textAlign: 'center', padding: 40 }}>No data</p>}
          </div>
        )}

        {activeTab === 'batch' && (
          <div className="tab-content">
            <h3 style={{ fontSize: 15, marginBottom: 16 }}>Batch Performance Summary</h3>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Days Recorded</th>
                    <th>Total Eggs</th>
                    <th>Avg/Day</th>
                    <th>Total Mortality</th>
                    <th>Total Feed (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map(b => {
                    const batchReports = filtered.filter(r => r.batchId === b.id);
                    const eggs = batchReports.reduce((s, r) => s + (r.eggProduction || []).reduce((s2, e) => s2 + e.totalPieces, 0), 0);
                    const mort = batchReports.reduce((s, r) => s + (r.mortality || []).reduce((s2, m) => s2 + m.numberDead, 0), 0);
                    const feed = batchReports.reduce((s, r) => s + (r.feedIntake || []).reduce((s2, f) => s2 + f.quantityGrams, 0), 0);
                    return (
                      <tr key={b.id}>
                        <td><strong>{b.batchName}</strong></td>
                        <td>{batchReports.length}</td>
                        <td>{eggs.toLocaleString()}</td>
                        <td>{batchReports.length > 0 ? Math.round(eggs / batchReports.length).toLocaleString() : '-'}</td>
                        <td>{mort}</td>
                        <td>{(feed / 1000).toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
