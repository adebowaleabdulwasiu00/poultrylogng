import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db, generateId, nowISO, getActiveFarmId } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '@/components/ToastProvider';
import { Tabs, EmptyState } from '@/components/UI';
import { useFarm } from '@/contexts/FarmContext';
import { useAuth } from '@/contexts/AuthContext';
import { queueSync } from '@/db/sync';
import type { DailyReport, EggProduction, MortalityRecord, FeedIntake, MedicationRecord, WeightRecord, EnvironmentRecord, Attachment } from '@/db/types';
import {
  MORTALITY_REASONS, FEED_TYPES, FEED_SESSIONS, MEDICATION_CATEGORIES,
  ADMINISTRATION_METHODS, WEATHER_CONDITIONS, VENTILATION_STATUSES
} from '@/db/types';

const EGGS_PER_CRATE = 30;
const GRAMS_PER_BAG = 25000;

function emptyEgg(): EggProduction {
  return { totalPieces: 0, cracked: 0, damaged: 0, notes: '' };
}
function emptyMortality(): MortalityRecord {
  return { numberDead: 0, reason: 'Unknown', notes: '' };
}
function emptyFeed(): FeedIntake {
  return { feedType: 'Starter', feedBrand: '', quantityGrams: 0, feedingSession: 'Morning', notes: '' };
}
function emptyMedication(): MedicationRecord {
  return { medicationName: '', medicationCategory: 'Vaccine', quantityUsed: 0, unit: 'pieces', administrationMethod: 'Oral', supplier: '', notes: '' };
}
function emptyWeight(): WeightRecord {
  return { averageEggWeight: 0, averageBodyWeight: 0, eggWeightUnit: 'g', bodyWeightUnit: 'g' };
}
function emptyEnvironment(): EnvironmentRecord {
  return { temperature: 0, humidity: 0, weatherCondition: 'Sunny', ventilationStatus: 'Natural', lightHours: 0, waterConsumption: 0, waterUnit: 'L', notes: '' };
}

function piecesToCrates(pieces: number) {
  const crates = Math.floor(pieces / EGGS_PER_CRATE);
  const remaining = pieces % EGGS_PER_CRATE;
  return { crates, remaining };
}

function cratesToPieces(crates: number, pieces: number) {
  return crates * EGGS_PER_CRATE + pieces;
}

function gramsToDisplay(grams: number) {
  const bags = Math.floor(grams / GRAMS_PER_BAG);
  const remainingKg = (grams % GRAMS_PER_BAG) / 1000;
  return { bags, remainingKg };
}

function displayToGrams(bags: number, kg: number) {
  return bags * GRAMS_PER_BAG + kg * 1000;
}

export default function DailyRecording() {
  const batches = useLiveQuery(() => db.batches.where('status').equals('active').toArray()) || [];
  const allReports = useLiveQuery(() => db.dailyReports.toArray()) || [];
  const [activeTab, setActiveTab] = useState('eggs');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBatchId, setSelectedBatchId] = useState<number>(0);
  const [editingReport, setEditingReport] = useState<DailyReport | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const [eggData, setEggData] = useState<EggProduction[]>([emptyEgg()]);
  const [cratesInput, setCratesInput] = useState<number[]>([0]);
  const [piecesInput, setPiecesInput] = useState<number[]>([0]);

  const [mortalityData, setMortalityData] = useState<MortalityRecord[]>([emptyMortality()]);
  const [feedData, setFeedData] = useState<FeedIntake[]>([emptyFeed()]);
  const [feedBagsInput, setFeedBagsInput] = useState<number[]>([0]);
  const [feedKgInput, setFeedKgInput] = useState<number[]>([0]);
  const [feedUnitMode, setFeedUnitMode] = useState<'kg' | 'bags'>('kg');
  const [medicationData, setMedicationData] = useState<MedicationRecord[]>([emptyMedication()]);
  const [weightData, setWeightData] = useState<WeightRecord>(emptyWeight());
  const [envData, setEnvData] = useState<EnvironmentRecord>(emptyEnvironment());
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  const { currentFarm } = useFarm();
  const { authUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const selectedBatch = useMemo(() => batches.find(b => b.id === selectedBatchId), [batches, selectedBatchId]);

  const existingReport = useMemo(() => {
    if (!selectedBatchId) return null;
    return allReports.find(r => r.reportDate === selectedDate && r.batchId === selectedBatchId) || null;
  }, [allReports, selectedDate, selectedBatchId]);

  const loadReport = useCallback((report: DailyReport) => {
    setEditingReport(report);
    setEggData(report.eggProduction.length > 0 ? report.eggProduction : [emptyEgg()]);
    setMortalityData(report.mortality.length > 0 ? report.mortality : [emptyMortality()]);
    setFeedData(report.feedIntake.length > 0 ? report.feedIntake : [emptyFeed()]);
    setMedicationData(report.medication.length > 0 ? report.medication : [emptyMedication()]);
    setWeightData(report.weights.length > 0 ? report.weights[0] : emptyWeight());
    setEnvData(report.environment.length > 0 ? report.environment[0] : emptyEnvironment());
    setNotes(report.notes || '');

    const ci: number[] = [], pi: number[] = [];
    for (const e of (report.eggProduction.length > 0 ? report.eggProduction : [emptyEgg()])) {
      const conv = piecesToCrates(e.totalPieces);
      ci.push(conv.crates);
      pi.push(conv.remaining);
    }
    setCratesInput(ci);
    setPiecesInput(pi);

    const fb: number[] = [], fk: number[] = [];
    for (const f of (report.feedIntake.length > 0 ? report.feedIntake : [emptyFeed()])) {
      const conv = gramsToDisplay(f.quantityGrams);
      fb.push(conv.bags);
      fk.push(conv.remainingKg);
    }
    setFeedBagsInput(fb);
    setFeedKgInput(fk);
  }, []);

  useEffect(() => {
    const dateParam = searchParams.get('date');
    const batchParam = searchParams.get('batch');
    if (dateParam && batchParam) {
      const batchId = Number(batchParam);
      setSelectedDate(dateParam);
      setSelectedBatchId(batchId);
      const report = allReports.find(r => r.reportDate === dateParam && r.batchId === batchId);
      if (report) loadReport(report);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, allReports, loadReport, setSearchParams]);

  const activeReportId = editingReport?.id || existingReport?.id;
  const reportImages = useLiveQuery<Attachment[]>(
    () => activeReportId ? db.attachments.where('reportId').equals(activeReportId).toArray() : Promise.resolve([] as Attachment[]),
    [activeReportId]
  ) || [];

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const reportId = activeReportId;
    if (!reportId) {
      toast('Save the report first before adding images', 'error');
      return;
    }
    setUploading(true);
    try {
      const farmId = await getActiveFarmId();
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) {
          toast(`${file.name} is too large (max 10MB)`, 'error');
          continue;
        }
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const attachment: Attachment = {
          farmId,
          reportId,
          fileName: file.name,
          fileData: data,
          fileType: file.type,
          fileSize: file.size,
          uploadedAt: nowISO(),
        };
        await db.attachments.add(attachment);
      }
      toast(`${files.length} image${files.length > 1 ? 's' : ''} added`);
    } catch {
      toast('Failed to upload image', 'error');
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDeleteImage(id: number) {
    await db.attachments.delete(id);
    toast('Image removed');
  }

  function addEggRow() {
    setEggData(d => [...d, emptyEgg()]);
    setCratesInput(c => [...c, 0]);
    setPiecesInput(p => [...p, 0]);
  }
  function removeEggRow(i: number) {
    if (eggData.length <= 1) return;
    setEggData(d => d.filter((_, idx) => idx !== i));
    setCratesInput(c => c.filter((_, idx) => idx !== i));
    setPiecesInput(p => p.filter((_, idx) => idx !== i));
  }

  function addMortalityRow() { setMortalityData(d => [...d, emptyMortality()]); }
  function removeMortalityRow(i: number) { if (mortalityData.length > 1) setMortalityData(d => d.filter((_, idx) => idx !== i)); }

  function addFeedRow() {
    setFeedData(d => [...d, emptyFeed()]);
    setFeedBagsInput(b => [...b, 0]);
    setFeedKgInput(k => [...k, 0]);
  }
  function removeFeedRow(i: number) {
    if (feedData.length <= 1) return;
    setFeedData(d => d.filter((_, idx) => idx !== i));
    setFeedBagsInput(b => b.filter((_, idx) => idx !== i));
    setFeedKgInput(k => k.filter((_, idx) => idx !== i));
  }

  function addMedicationRow() { setMedicationData(d => [...d, emptyMedication()]); }
  function removeMedicationRow(i: number) { if (medicationData.length > 1) setMedicationData(d => d.filter((_, idx) => idx !== i)); }

  function isFormValid(): boolean {
    if (!selectedBatchId) return false;
    if (eggData.length === 0) return false;
    for (const e of eggData) {
      if (e.totalPieces <= 0 && e.cracked <= 0 && e.damaged <= 0) return false;
    }
    return true;
  }

  async function handleSubmit() {
    if (!selectedBatchId || !selectedBatch) {
      toast('Please select a batch', 'error');
      return;
    }

    const eggRecords: EggProduction[] = eggData.map((e, i) => ({
      ...e,
      totalPieces: cratesToPieces(cratesInput[i] || 0, piecesInput[i] || 0) || e.totalPieces,
    }));

    const feedRecords: FeedIntake[] = feedData.map((f, i) => ({
      ...f,
      quantityGrams: feedUnitMode === 'bags'
        ? displayToGrams(feedBagsInput[i] || 0, feedKgInput[i] || 0)
        : (feedKgInput[i] || 0) * 1000,
    }));

    const totalMortality = mortalityData.reduce((s, m) => s + m.numberDead, 0);
    const oldMortality = editingReport ? (editingReport.mortality || []).reduce((s, m) => s + m.numberDead, 0) : 0;
    const basePop = editingReport ? selectedBatch.currentPopulation + oldMortality : selectedBatch.currentPopulation;
    const newPop = Math.max(0, basePop - totalMortality);

    const now = nowISO();
    const farmId = await getActiveFarmId();
    const reportData: Omit<DailyReport, 'id'> = {
      farmId,
      reportDate: selectedDate,
      batchId: selectedBatchId,
      batchName: selectedBatch.batchName,
      eggProduction: eggRecords,
      mortality: mortalityData,
      feedIntake: feedRecords,
      medication: medicationData,
      weights: [weightData],
      environment: [envData],
      notes,
      createdBy: editingReport?.createdBy || 'user',
      createdAt: editingReport?.createdAt || now,
      modifiedBy: 'user',
      updatedAt: now,
      syncDate: '',
      syncStatus: 'pending',
    };

    if (editingReport?.id) {
      await db.dailyReports.update(editingReport.id, reportData);
      await queueSync('dailyReports', editingReport.id, 'update', reportData);
    } else {
      const id = await db.dailyReports.add(reportData as DailyReport);
      await queueSync('dailyReports', id as number, 'create', { ...reportData, id });
    }

    await db.batches.put({
      ...selectedBatch,
      currentPopulation: newPop,
      updatedAt: now,
      syncStatus: 'pending',
    });

    toast(editingReport ? 'Report updated successfully' : 'Daily report saved successfully');
    resetForm();
  }

  function resetForm() {
    setEditingReport(null);
    setEggData([emptyEgg()]);
    setCratesInput([0]);
    setPiecesInput([0]);
    setMortalityData([emptyMortality()]);
    setFeedData([emptyFeed()]);
    setFeedBagsInput([0]);
    setFeedKgInput([0]);
    setMedicationData([emptyMedication()]);
    setWeightData(emptyWeight());
    setEnvData(emptyEnvironment());
    setNotes('');
  }

  if (batches.length === 0) {
    return (
      <EmptyState
        icon="inventory_2"
        title="No Active Batches"
        description="Create at least one active batch before recording daily data"
        action={<a href="/poultry/batches" className="btn btn-primary">Go to Batch Management</a>}
      />
    );
  }

  const tabList = [
    { key: 'eggs', label: 'Egg Production', icon: 'egg' },
    { key: 'mortality', label: 'Mortality', icon: 'dangerous' },
    { key: 'feed', label: 'Feed Intake', icon: 'grass' },
    { key: 'medication', label: 'Medication', icon: 'medication' },
    { key: 'weights', label: 'Weights', icon: 'monitor_weight' },
    { key: 'environment', label: 'Environment', icon: 'thermostat' },
    { key: 'attachments', label: 'Attachments', icon: 'attach_file' },
    { key: 'notes', label: 'Notes', icon: 'notes' },
  ];

  return (
    <div>
      <div className="card mb-4">
        <div className="form-row cols-3">
          <div className="form-group">
            <label className="form-label">Report Date</label>
            <input className="form-input" type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Batch <span className="required">*</span></label>
            <select className="form-select" value={selectedBatchId || ''} onChange={e => {
              const v = Number(e.target.value);
              setSelectedBatchId(v);
              const existing = allReports.find(r => r.reportDate === selectedDate && r.batchId === v);
              if (existing) loadReport(existing);
              else resetForm();
            }}>
              <option value="">Select batch...</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.batchName} ({b.house}) - {b.currentPopulation} birds
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            {existingReport && !editingReport && (
              <button className="btn btn-outline" onClick={() => loadReport(existingReport)}>
                <span className="material-icons-outlined" style={{ fontSize: 18 }}>edit</span>
                Edit Existing
              </button>
            )}
            <a href="/poultry/daily/history" className="btn btn-secondary">
              <span className="material-icons-outlined" style={{ fontSize: 18 }}>history</span>
              History
            </a>
          </div>
        </div>
      </div>

      <div className="card">
        <Tabs tabs={tabList} activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'eggs' && (
          <div className="tab-content">
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ fontSize: 15 }}>Egg Collection</h3>
              <button className="btn btn-text btn-sm" onClick={addEggRow}>
                <span className="material-icons-outlined" style={{ fontSize: 18 }}>add</span> Add Row
              </button>
            </div>
            {eggData.map((egg, i) => (
              <div key={i} className="card mb-3" style={{ background: 'var(--md-surface-variant)' }}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-bold">Collection #{i + 1}</span>
                  {eggData.length > 1 && (
                    <button className="btn btn-icon btn-text btn-sm" onClick={() => removeEggRow(i)} style={{ color: 'var(--md-error)' }}>
                      <span className="material-icons-outlined" style={{ fontSize: 18 }}>close</span>
                    </button>
                  )}
                </div>
                <div className="form-row cols-4">
                  <div className="form-group">
                    <label className="form-label">Crates</label>
                    <input className="form-input" type="number" min="0" value={cratesInput[i] || ''} onChange={e => setCratesInput(c => { const n = [...c]; n[i] = Number(e.target.value); return n; })} />
                    <span className="form-hint">1 crate = 30 eggs</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pieces (remaining)</label>
                    <input className="form-input" type="number" min="0" max="29" value={piecesInput[i] || ''} onChange={e => setPiecesInput(p => { const n = [...p]; n[i] = Number(e.target.value); return n; })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cracked</label>
                    <input className="form-input" type="number" min="0" value={egg.cracked || ''} onChange={e => setEggData(d => { const n = [...d]; n[i] = { ...n[i], cracked: Number(e.target.value) }; return n; })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Damaged</label>
                    <input className="form-input" type="number" min="0" value={egg.damaged || ''} onChange={e => setEggData(d => { const n = [...d]; n[i] = { ...n[i], damaged: Number(e.target.value) }; return n; })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="form-input" value={egg.notes} onChange={e => setEggData(d => { const n = [...d]; n[i] = { ...n[i], notes: e.target.value }; return n; })} placeholder="Optional notes" />
                </div>
              </div>
            ))}
            <div className="card" style={{ background: '#E8F5E9', padding: 16 }}>
              <div className="flex justify-between">
                <span className="font-bold">Total (will be stored):</span>
                <span className="font-bold">
                  {eggData.reduce((s, e, i) => s + cratesToPieces(cratesInput[i] || 0, piecesInput[i] || 0), 0).toLocaleString()} pieces
                  &nbsp;| Cracked: {eggData.reduce((s, e) => s + (e.cracked || 0), 0)}
                  &nbsp;| Damaged: {eggData.reduce((s, e) => s + (e.damaged || 0), 0)}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'mortality' && (
          <div className="tab-content">
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ fontSize: 15 }}>Mortality Records</h3>
              <button className="btn btn-text btn-sm" onClick={addMortalityRow}>
                <span className="material-icons-outlined" style={{ fontSize: 18 }}>add</span> Add Row
              </button>
            </div>
            {mortalityData.map((m, i) => (
              <div key={i} className="card mb-3" style={{ background: 'var(--md-surface-variant)' }}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-bold">Record #{i + 1}</span>
                  {mortalityData.length > 1 && (
                    <button className="btn btn-icon btn-text btn-sm" onClick={() => removeMortalityRow(i)} style={{ color: 'var(--md-error)' }}>
                      <span className="material-icons-outlined" style={{ fontSize: 18 }}>close</span>
                    </button>
                  )}
                </div>
                <div className="form-row cols-2">
                  <div className="form-group">
                    <label className="form-label">Number Dead <span className="required">*</span></label>
                    <input className="form-input" type="number" min="0" value={m.numberDead || ''} onChange={e => setMortalityData(d => { const n = [...d]; n[i] = { ...n[i], numberDead: Number(e.target.value) }; return n; })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reason <span className="required">*</span></label>
                    <select className="form-select" value={m.reason} onChange={e => setMortalityData(d => { const n = [...d]; n[i] = { ...n[i], reason: e.target.value }; return n; })}>
                      {MORTALITY_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                {m.reason === 'Others' && (
                  <div className="form-group">
                    <label className="form-label">Specify Reason</label>
                    <input className="form-input" value={m.otherReason || ''} onChange={e => setMortalityData(d => { const n = [...d]; n[i] = { ...n[i], otherReason: e.target.value }; return n; })} placeholder="Enter custom reason" />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="form-input" value={m.notes} onChange={e => setMortalityData(d => { const n = [...d]; n[i] = { ...n[i], notes: e.target.value }; return n; })} placeholder="Optional notes" />
                </div>
              </div>
            ))}
            <div className="card" style={{ background: '#FFEBEE', padding: 16 }}>
              <span className="font-bold">Total Mortality: {mortalityData.reduce((s, m) => s + m.numberDead, 0)}</span>
              {selectedBatch && <span className="text-muted" style={{ marginLeft: 12 }}>Remaining: {selectedBatch.currentPopulation - mortalityData.reduce((s, m) => s + m.numberDead, 0)}</span>}
            </div>
          </div>
        )}

        {activeTab === 'feed' && (
          <div className="tab-content">
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ fontSize: 15 }}>Feed Intake</h3>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 mr-4">
                  <span className="text-sm">Entry mode:</span>
                  <select className="form-select" style={{ width: 'auto' }} value={feedUnitMode} onChange={e => setFeedUnitMode(e.target.value as 'kg' | 'bags')}>
                    <option value="kg">Kilograms</option>
                    <option value="bags">Bags</option>
                  </select>
                </div>
                <button className="btn btn-text btn-sm" onClick={addFeedRow}>
                  <span className="material-icons-outlined" style={{ fontSize: 18 }}>add</span> Add Row
                </button>
              </div>
            </div>
            {feedData.map((f, i) => (
              <div key={i} className="card mb-3" style={{ background: 'var(--md-surface-variant)' }}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-bold">Feed Entry #{i + 1}</span>
                  {feedData.length > 1 && (
                    <button className="btn btn-icon btn-text btn-sm" onClick={() => removeFeedRow(i)} style={{ color: 'var(--md-error)' }}>
                      <span className="material-icons-outlined" style={{ fontSize: 18 }}>close</span>
                    </button>
                  )}
                </div>
                <div className="form-row cols-3">
                  <div className="form-group">
                    <label className="form-label">Feed Type</label>
                    <select className="form-select" value={f.feedType} onChange={e => setFeedData(d => { const n = [...d]; n[i] = { ...n[i], feedType: e.target.value }; return n; })}>
                      {FEED_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Feed Brand</label>
                    <input className="form-input" value={f.feedBrand} onChange={e => setFeedData(d => { const n = [...d]; n[i] = { ...n[i], feedBrand: e.target.value }; return n; })} placeholder="e.g. Top Feeds" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Feeding Session</label>
                    <select className="form-select" value={f.feedingSession} onChange={e => setFeedData(d => { const n = [...d]; n[i] = { ...n[i], feedingSession: e.target.value }; return n; })}>
                      {FEED_SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row cols-2">
                  {feedUnitMode === 'kg' ? (
                    <div className="form-group">
                      <label className="form-label">Quantity (kg)</label>
                      <input className="form-input" type="number" step="0.1" min="0" value={feedKgInput[i] || ''} onChange={e => setFeedKgInput(k => { const n = [...k]; n[i] = Number(e.target.value); return n; })} />
                    </div>
                  ) : (
                    <>
                      <div className="form-group">
                        <label className="form-label">Bags</label>
                        <input className="form-input" type="number" min="0" value={feedBagsInput[i] || ''} onChange={e => setFeedBagsInput(b => { const n = [...b]; n[i] = Number(e.target.value); return n; })} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Remaining kg</label>
                        <input className="form-input" type="number" step="0.1" min="0" max="24.9" value={feedKgInput[i] || ''} onChange={e => setFeedKgInput(k => { const n = [...k]; n[i] = Number(e.target.value); return n; })} />
                        <span className="form-hint">1 bag = 25 kg</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="form-input" value={f.notes} onChange={e => setFeedData(d => { const n = [...d]; n[i] = { ...n[i], notes: e.target.value }; return n; })} placeholder="Optional notes" />
                </div>
              </div>
            ))}
            <div className="card" style={{ background: '#E3F2FD', padding: 16 }}>
              <span className="font-bold">
                Total Feed (stored as grams): {feedData.reduce((s, f, i) => {
                  return s + (feedUnitMode === 'bags' ? displayToGrams(feedBagsInput[i] || 0, feedKgInput[i] || 0) : (feedKgInput[i] || 0) * 1000);
                }, 0).toLocaleString()} g
                &nbsp;= {(feedData.reduce((s, f, i) => {
                  return s + (feedUnitMode === 'bags' ? displayToGrams(feedBagsInput[i] || 0, feedKgInput[i] || 0) : (feedKgInput[i] || 0) * 1000);
                }, 0) / 1000).toFixed(1)} kg
              </span>
            </div>
          </div>
        )}

        {activeTab === 'medication' && (
          <div className="tab-content">
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ fontSize: 15 }}>Medication Records</h3>
              <button className="btn btn-text btn-sm" onClick={addMedicationRow}>
                <span className="material-icons-outlined" style={{ fontSize: 18 }}>add</span> Add Row
              </button>
            </div>
            {medicationData.map((m, i) => (
              <div key={i} className="card mb-3" style={{ background: 'var(--md-surface-variant)' }}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-bold">Medication #{i + 1}</span>
                  {medicationData.length > 1 && (
                    <button className="btn btn-icon btn-text btn-sm" onClick={() => removeMedicationRow(i)} style={{ color: 'var(--md-error)' }}>
                      <span className="material-icons-outlined" style={{ fontSize: 18 }}>close</span>
                    </button>
                  )}
                </div>
                <div className="form-row cols-3">
                  <div className="form-group">
                    <label className="form-label">Medication Name <span className="required">*</span></label>
                    <input className="form-input" value={m.medicationName} onChange={e => setMedicationData(d => { const n = [...d]; n[i] = { ...n[i], medicationName: e.target.value }; return n; })} placeholder="e.g. Lasota" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-select" value={m.medicationCategory} onChange={e => setMedicationData(d => { const n = [...d]; n[i] = { ...n[i], medicationCategory: e.target.value }; return n; })}>
                      {MEDICATION_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Administration Method</label>
                    <select className="form-select" value={m.administrationMethod} onChange={e => setMedicationData(d => { const n = [...d]; n[i] = { ...n[i], administrationMethod: e.target.value }; return n; })}>
                      {ADMINISTRATION_METHODS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row cols-3">
                  <div className="form-group">
                    <label className="form-label">Quantity Used</label>
                    <input className="form-input" type="number" step="0.1" min="0" value={m.quantityUsed || ''} onChange={e => setMedicationData(d => { const n = [...d]; n[i] = { ...n[i], quantityUsed: Number(e.target.value) }; return n; })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unit</label>
                    <input className="form-input" value={m.unit} onChange={e => setMedicationData(d => { const n = [...d]; n[i] = { ...n[i], unit: e.target.value }; return n; })} placeholder="e.g. ml, pieces, g" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Supplier</label>
                    <input className="form-input" value={m.supplier} onChange={e => setMedicationData(d => { const n = [...d]; n[i] = { ...n[i], supplier: e.target.value }; return n; })} placeholder="Supplier name" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="form-input" value={m.notes} onChange={e => setMedicationData(d => { const n = [...d]; n[i] = { ...n[i], notes: e.target.value }; return n; })} placeholder="Optional notes" />
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'weights' && (
          <div className="tab-content">
            <h3 style={{ fontSize: 15, marginBottom: 16 }}>Weight Records</h3>
            <div className="card" style={{ background: 'var(--md-surface-variant)' }}>
              <div className="form-row cols-4">
                <div className="form-group">
                  <label className="form-label">Average Egg Weight</label>
                  <input className="form-input" type="number" step="0.1" min="0" value={weightData.averageEggWeight || ''} onChange={e => setWeightData(w => ({ ...w, averageEggWeight: Number(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Egg Weight Unit</label>
                  <select className="form-select" value={weightData.eggWeightUnit} onChange={e => setWeightData(w => ({ ...w, eggWeightUnit: e.target.value }))}>
                    <option value="g">Grams (g)</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="oz">Ounces (oz)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Average Body Weight</label>
                  <input className="form-input" type="number" step="0.1" min="0" value={weightData.averageBodyWeight || ''} onChange={e => setWeightData(w => ({ ...w, averageBodyWeight: Number(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Body Weight Unit</label>
                  <select className="form-select" value={weightData.bodyWeightUnit} onChange={e => setWeightData(w => ({ ...w, bodyWeightUnit: e.target.value }))}>
                    <option value="g">Grams (g)</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="lb">Pounds (lb)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'environment' && (
          <div className="tab-content">
            <h3 style={{ fontSize: 15, marginBottom: 16 }}>Environmental Data</h3>
            <div className="card" style={{ background: 'var(--md-surface-variant)' }}>
              <div className="form-row cols-3">
                <div className="form-group">
                  <label className="form-label">Temperature (°C)</label>
                  <input className="form-input" type="number" step="0.1" value={envData.temperature || ''} onChange={e => setEnvData(d => ({ ...d, temperature: Number(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Humidity (%)</label>
                  <input className="form-input" type="number" step="0.1" min="0" max="100" value={envData.humidity || ''} onChange={e => setEnvData(d => ({ ...d, humidity: Number(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Light Hours</label>
                  <input className="form-input" type="number" step="0.5" min="0" max="24" value={envData.lightHours || ''} onChange={e => setEnvData(d => ({ ...d, lightHours: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="form-row cols-3">
                <div className="form-group">
                  <label className="form-label">Weather Condition</label>
                  <select className="form-select" value={envData.weatherCondition} onChange={e => setEnvData(d => ({ ...d, weatherCondition: e.target.value }))}>
                    {WEATHER_CONDITIONS.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Ventilation Status</label>
                  <select className="form-select" value={envData.ventilationStatus} onChange={e => setEnvData(d => ({ ...d, ventilationStatus: e.target.value }))}>
                    {VENTILATION_STATUSES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Water Consumption</label>
                  <div className="form-row cols-2" style={{ gap: 8 }}>
                    <input className="form-input" type="number" step="0.1" min="0" value={envData.waterConsumption || ''} onChange={e => setEnvData(d => ({ ...d, waterConsumption: Number(e.target.value) }))} />
                    <select className="form-select" value={envData.waterUnit} onChange={e => setEnvData(d => ({ ...d, waterUnit: e.target.value }))}>
                      <option value="L">Liters</option>
                      <option value="mL">Milliliters</option>
                      <option value="gal">Gallons</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Other Environmental Notes</label>
                <textarea className="form-textarea" value={envData.notes} onChange={e => setEnvData(d => ({ ...d, notes: e.target.value }))} rows={3} placeholder="Any environmental observations..." />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'attachments' && (
          <div className="tab-content">
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ fontSize: 15 }}>Supporting Images</h3>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleImageUpload}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !activeReportId}
              >
                <span className="material-icons-outlined" style={{ fontSize: 18 }}>add_a_photo</span>
                {uploading ? 'Uploading...' : 'Add Image'}
              </button>
            </div>
            {!activeReportId && (
              <div className="card" style={{ padding: 20, textAlign: 'center', background: 'var(--md-surface-variant)' }}>
                <span className="material-icons-outlined" style={{ fontSize: 32, color: 'var(--md-outline)' }}>info</span>
                <p className="text-sm text-muted mt-2">Save the report first, then come back to attach images.</p>
              </div>
            )}
            {activeReportId && reportImages.length === 0 && !uploading && (
              <div className="card" style={{ padding: 30, textAlign: 'center', background: 'var(--md-surface-variant)' }}>
                <span className="material-icons-outlined" style={{ fontSize: 40, color: 'var(--md-outline)' }}>photo_library</span>
                <p className="text-muted mt-2">No images yet. Tap "Add Image" to upload photos.</p>
              </div>
            )}
            {reportImages.length > 0 && (
              <div className="image-grid">
                {reportImages.map(img => (
                  <div key={img.id} className="image-grid-item">
                    <img src={img.fileData} alt={img.fileName} className="image-grid-thumb" onClick={() => setLightboxSrc(img.fileData)} />
                    <div className="image-grid-overlay">
                      <button className="image-grid-btn" onClick={() => setLightboxSrc(img.fileData)} title="Zoom">
                        <span className="material-icons-outlined">zoom_in</span>
                      </button>
                      <button className="image-grid-btn image-grid-btn-danger" onClick={() => img.id && handleDeleteImage(img.id)} title="Delete">
                        <span className="material-icons-outlined">delete</span>
                      </button>
                    </div>
                    <div className="image-grid-name">{img.fileName}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="tab-content">
            <h3 style={{ fontSize: 15, marginBottom: 16 }}>General Notes</h3>
            <div className="form-group">
              <textarea
                className="form-textarea"
                rows={8}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Daily observations, recommendations, supervisor remarks..."
              />
            </div>
          </div>
        )}

        <div style={{ padding: '16px 0', borderTop: '1px solid var(--md-outline-variant)', marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" onClick={resetForm}>Clear Form</button>
          <button className="btn btn-primary" disabled={!isFormValid()} onClick={handleSubmit}>
            <span className="material-icons-outlined" style={{ fontSize: 18 }}>
              {editingReport ? 'save' : 'add_task'}
            </span>
            {editingReport ? 'Update Report' : 'Submit Daily Report'}
          </button>
        </div>
      </div>

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
