import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, nowISO } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '@/components/ToastProvider';
import { EmptyState, SearchBar, Badge, ConfirmDialog } from '@/components/UI';
import { usePermissions } from '@/hooks/usePermissions';
import { useFarm } from '@/contexts/FarmContext';
import { queueSync } from '@/db/sync';
import DailyReportShare from '@/components/DailyReportShare';
import type { DailyReport, Attachment } from '@/db/types';

const EGGS_PER_CRATE = 30;

function formatCrates(pieces: number) {
  const crates = Math.floor(pieces / EGGS_PER_CRATE);
  const remaining = pieces % EGGS_PER_CRATE;
  if (crates === 0) return `${remaining} pcs`;
  if (remaining === 0) return `${crates} cr`;
  return `${crates} cr + ${remaining} pcs`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function totalEggs(r: DailyReport) {
  return (r.eggProduction || []).reduce((s, e) => s + e.totalPieces, 0);
}
function totalCracked(r: DailyReport) {
  return (r.eggProduction || []).reduce((s, e) => s + e.cracked, 0);
}
function totalDamaged(r: DailyReport) {
  return (r.eggProduction || []).reduce((s, e) => s + e.damaged, 0);
}
function totalMortality(r: DailyReport) {
  return (r.mortality || []).reduce((s, m) => s + m.numberDead, 0);
}
function totalFeedKg(r: DailyReport) {
  return (r.feedIntake || []).reduce((s, f) => s + f.quantityGrams, 0) / 1000;
}

export default function DailyReportHistory() {
  const allReports = useLiveQuery(() => db.dailyReports.toArray()) || [];
  const batches = useLiveQuery(() => db.batches.toArray()) || [];
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DailyReport | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DailyReport | null>(null);
  const [filterBatch, setFilterBatch] = useState<number>(0);
  const [filterMonth, setFilterMonth] = useState('');
  const { toast } = useToast();
  const { currentFarm } = useFarm();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const [showShare, setShowShare] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const canEdit = hasPermission('daily_reports:edit');
  const canDelete = hasPermission('daily_reports:delete');

  const selectedReportImages = useLiveQuery<Attachment[]>(
    () => selected?.id ? db.attachments.where('reportId').equals(selected.id).toArray() : Promise.resolve([] as Attachment[]),
    [selected?.id]
  ) || [];

  const batchMap = useMemo(() => {
    const m = new Map<number, string>();
    batches.forEach(b => { if (b.id) m.set(b.id, b.batchName); });
    return m;
  }, [batches]);

  const filtered = useMemo(() => {
    let list = [...allReports].sort((a, b) => b.reportDate.localeCompare(a.reportDate));
    if (filterBatch) list = list.filter(r => r.batchId === filterBatch);
    if (filterMonth) list = list.filter(r => r.reportDate.startsWith(filterMonth));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.batchName.toLowerCase().includes(q) ||
        r.reportDate.includes(q) ||
        r.createdBy.toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [allReports, search, filterBatch, filterMonth]);

  function handleEdit(r: DailyReport) {
    navigate(`/poultry/daily?date=${r.reportDate}&batch=${r.batchId}`);
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    const now = nowISO();
    await db.dailyReports.delete(deleteTarget.id);
    await queueSync('dailyReports', deleteTarget.id, 'delete', null);

    const batch = batches.find(b => b.id === deleteTarget.batchId);
    if (batch && totalMortality(deleteTarget) > 0) {
      const newPop = batch.currentPopulation + totalMortality(deleteTarget);
      await db.batches.update(batch.id!, { currentPopulation: newPop, updatedAt: now, syncStatus: 'pending' });
    }

    toast('Report deleted');
    setDeleteTarget(null);
    if (selected?.id === deleteTarget.id) setSelected(null);
  }

  function getBatchName(batchId: number) {
    return batchMap.get(batchId) || `Batch #${batchId}`;
  }

  const months = useMemo(() => {
    const set = new Set<string>();
    allReports.forEach(r => set.add(r.reportDate.substring(0, 7)));
    return [...set].sort().reverse();
  }, [allReports]);

  if (allReports.length === 0) {
    return (
      <EmptyState
        icon="history"
        title="No Reports Yet"
        description="Start recording daily activities to build your history"
        action={<a href="/poultry/daily" className="btn btn-primary">Go to Daily Recording</a>}
      />
    );
  }

  return (
    <div>
      <div className="card mb-4">
        <div className="history-filters" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px' }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Search reports..." />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Batch</label>
            <select className="form-select" value={filterBatch || ''} onChange={e => setFilterBatch(Number(e.target.value))} style={{ minWidth: 140 }}>
              <option value="">All Batches</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.batchName}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Month</label>
            <select className="form-select" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ minWidth: 140 }}>
              <option value="">All Months</option>
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <a href="/poultry/daily" className="btn btn-primary">
              <span className="material-icons-outlined" style={{ fontSize: 18 }}>add</span>
              New Report
            </a>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: selected ? '1 1 55%' : '1 1 100%', minWidth: 0 }}>
          {filtered.length === 0 ? (
            <div className="card" style={{ padding: 30, textAlign: 'center' }}>
              <p className="text-muted">No reports match your filters</p>
            </div>
          ) : (
            <>
              <div className="card mb-3" style={{ padding: '10px 16px', background: 'var(--md-surface-variant)' }}>
                <span className="text-sm text-muted">{filtered.length} report{filtered.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="report-list">
                {filtered.map(r => {
                  const eggs = totalEggs(r);
                  const mort = totalMortality(r);
                  const isSelected = selected?.id === r.id;
                  return (
                    <div
                      key={r.id}
                      className={`report-list-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelected(isSelected ? null : r)}
                    >
                      <div className="report-list-main">
                        <div className="report-list-date">
                          <span className="material-icons-outlined" style={{ fontSize: 16, color: 'var(--md-primary)' }}>calendar_today</span>
                          <span>{formatDate(r.reportDate)}</span>
                        </div>
                        <div className="report-list-batch">{r.batchName}</div>
                        <div className="report-list-stats">
                          <span className="report-stat">
                            <span className="material-icons-outlined" style={{ fontSize: 14 }}>egg</span>
                            {formatCrates(eggs)}
                          </span>
                          {mort > 0 && (
                            <span className="report-stat report-stat-danger">
                              <span className="material-icons-outlined" style={{ fontSize: 14 }}>dangerous</span>
                              {mort}
                            </span>
                          )}
                          {totalFeedKg(r) > 0 && (
                            <span className="report-stat">
                              <span className="material-icons-outlined" style={{ fontSize: 14 }}>grass</span>
                              {totalFeedKg(r).toFixed(1)} kg
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="material-icons-outlined" style={{ fontSize: 18, color: 'var(--md-outline)', transition: 'transform 0.2s', transform: isSelected ? 'rotate(180deg)' : '' }}>
                        expand_more
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {selected && (
          <div className="report-detail-panel">
            <div className="report-detail-header">
              <h3>Report Details</h3>
              <button className="btn btn-icon btn-text btn-sm" onClick={() => setSelected(null)}>
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            <div className="report-detail-meta">
              <div><strong>Date:</strong> {formatDate(selected.reportDate)}</div>
              <div><strong>Batch:</strong> {selected.batchName}</div>
              <div><strong>Recorded by:</strong> {selected.createdBy}</div>
              <div><strong>Last modified:</strong> {new Date(selected.updatedAt).toLocaleString('en-NG')}</div>
            </div>

            <div className="report-detail-section">
              <div className="report-detail-section-title">
                <span className="material-icons-outlined" style={{ fontSize: 16 }}>egg</span>
                Egg Production
              </div>
              <div className="report-detail-grid">
                <div className="report-detail-stat">
                  <span className="report-detail-stat-value">{formatCrates(totalEggs(selected))}</span>
                  <span className="report-detail-stat-label">Total</span>
                </div>
                <div className="report-detail-stat">
                  <span className="report-detail-stat-value">{totalEggs(selected).toLocaleString()}</span>
                  <span className="report-detail-stat-label">Pieces</span>
                </div>
                <div className="report-detail-stat">
                  <span className="report-detail-stat-value">{totalCracked(selected)}</span>
                  <span className="report-detail-stat-label">Cracked</span>
                </div>
                <div className="report-detail-stat">
                  <span className="report-detail-stat-value">{totalDamaged(selected)}</span>
                  <span className="report-detail-stat-label">Damaged</span>
                </div>
              </div>
            </div>

            {totalMortality(selected) > 0 && (
              <div className="report-detail-section">
                <div className="report-detail-section-title">
                  <span className="material-icons-outlined" style={{ fontSize: 16, color: 'var(--md-error)' }}>dangerous</span>
                  Mortality
                </div>
                <div className="report-detail-stat">
                  <span className="report-detail-stat-value">{totalMortality(selected)}</span>
                  <span className="report-detail-stat-label">Total Deaths</span>
                </div>
                {(selected.mortality || []).filter(m => m.numberDead > 0).map((m, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', marginTop: 4 }}>
                    {m.reason === 'Others' && m.otherReason ? m.otherReason : m.reason}: {m.numberDead}
                  </div>
                ))}
              </div>
            )}

            {totalFeedKg(selected) > 0 && (
              <div className="report-detail-section">
                <div className="report-detail-section-title">
                  <span className="material-icons-outlined" style={{ fontSize: 16 }}>grass</span>
                  Feed Intake
                </div>
                <div className="report-detail-stat">
                  <span className="report-detail-stat-value">{totalFeedKg(selected).toFixed(1)} kg</span>
                  <span className="report-detail-stat-label">Total Feed</span>
                </div>
                {(selected.feedIntake || []).filter(f => f.quantityGrams > 0).map((f, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', marginTop: 4 }}>
                    {f.feedType} {f.feedBrand ? `(${f.feedBrand})` : ''} — {(f.quantityGrams / 1000).toFixed(1)} kg
                  </div>
                ))}
              </div>
            )}

            {(selected.medication || []).some(m => m.medicationName) && (
              <div className="report-detail-section">
                <div className="report-detail-section-title">
                  <span className="material-icons-outlined" style={{ fontSize: 16 }}>medication</span>
                  Medication
                </div>
                {selected.medication.filter(m => m.medicationName).map((m, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', marginTop: i > 0 ? 4 : 0 }}>
                    {m.medicationName} — {m.quantityUsed}{m.unit} ({m.administrationMethod})
                  </div>
                ))}
              </div>
            )}

            {selected.weights?.[0] && (selected.weights[0].averageEggWeight > 0 || selected.weights[0].averageBodyWeight > 0) && (
              <div className="report-detail-section">
                <div className="report-detail-section-title">
                  <span className="material-icons-outlined" style={{ fontSize: 16 }}>monitor_weight</span>
                  Weights
                </div>
                <div style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>
                  {selected.weights[0].averageEggWeight > 0 && <div>Egg: {selected.weights[0].averageEggWeight}{selected.weights[0].eggWeightUnit}</div>}
                  {selected.weights[0].averageBodyWeight > 0 && <div>Body: {selected.weights[0].averageBodyWeight}{selected.weights[0].bodyWeightUnit}</div>}
                </div>
              </div>
            )}

            {selected.environment?.[0] && (selected.environment[0].temperature > 0 || selected.environment[0].humidity > 0) && (
              <div className="report-detail-section">
                <div className="report-detail-section-title">
                  <span className="material-icons-outlined" style={{ fontSize: 16 }}>thermostat</span>
                  Environment
                </div>
                <div style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>
                  {selected.environment[0].temperature > 0 && <div>Temp: {selected.environment[0].temperature}°C</div>}
                  {selected.environment[0].humidity > 0 && <div>Humidity: {selected.environment[0].humidity}%</div>}
                  <div>Weather: {selected.environment[0].weatherCondition} | Ventilation: {selected.environment[0].ventilationStatus}</div>
                  {selected.environment[0].waterConsumption > 0 && <div>Water: {selected.environment[0].waterConsumption} {selected.environment[0].waterUnit}</div>}
                </div>
              </div>
            )}

            {selected.notes && (
              <div className="report-detail-section">
                <div className="report-detail-section-title">
                  <span className="material-icons-outlined" style={{ fontSize: 16 }}>notes</span>
                  Notes
                </div>
                <div style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', fontStyle: 'italic' }}>
                  {selected.notes}
                </div>
              </div>
            )}

            {selectedReportImages.length > 0 && (
              <div className="report-detail-section">
                <div className="report-detail-section-title">
                  <span className="material-icons-outlined" style={{ fontSize: 16 }}>photo_library</span>
                  Images ({selectedReportImages.length})
                </div>
                <div className="image-grid" style={{ marginTop: 8 }}>
                  {selectedReportImages.map(img => (
                    <div key={img.id} className="image-grid-item image-grid-item-sm">
                      <img src={img.fileData} alt={img.fileName} className="image-grid-thumb" onClick={() => setLightboxSrc(img.fileData)} />
                      <div className="image-grid-overlay">
                        <button className="image-grid-btn" onClick={() => setLightboxSrc(img.fileData)} title="Zoom">
                          <span className="material-icons-outlined">zoom_in</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="report-detail-actions">
              <button className="btn btn-outline" onClick={() => setShowShare(true)}>
                <span className="material-icons-outlined" style={{ fontSize: 18 }}>share</span>
                Share
              </button>
              {canEdit && (
                <button className="btn btn-primary" onClick={() => handleEdit(selected)}>
                  <span className="material-icons-outlined" style={{ fontSize: 18 }}>edit</span>
                  Edit Report
                </button>
              )}
              {canDelete && (
                <button className="btn btn-outline" style={{ color: 'var(--md-error)' }} onClick={() => setDeleteTarget(selected)}>
                  <span className="material-icons-outlined" style={{ fontSize: 18 }}>delete</span>
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Report"
        message={`Are you sure you want to delete the report for "${deleteTarget?.batchName}" on ${deleteTarget ? formatDate(deleteTarget.reportDate) : ''}? This will also reverse the mortality population change. This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmLabel="Delete Report"
        danger
      />

      {selected && (
        <DailyReportShare
          open={showShare}
          onClose={() => setShowShare(false)}
          report={selected}
          batch={batches.find(b => b.id === selected.batchId) || null}
          farmName={currentFarm?.farmName || 'My Farm'}
          recordedBy={selected.createdBy || 'User'}
        />
      )}

      {lightboxSrc && (
        <div className="modal-overlay" onClick={() => setLightboxSrc(null)} style={{ cursor: 'zoom-out' }}>
          <button className="btn btn-icon" onClick={() => setLightboxSrc(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.6)', color: '#fff', zIndex: 10, borderRadius: '50%' }}>
            <span className="material-icons-outlined">close</span>
          </button>
          <img src={lightboxSrc} alt="Preview" onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }} />
        </div>
      )}
    </div>
  );
}
