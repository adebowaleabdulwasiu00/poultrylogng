import { useState, useRef, useCallback } from 'react';
import { db } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '@/components/ToastProvider';
import { useFarm } from '@/contexts/FarmContext';
import { Badge } from '@/components/UI';
import { getAllTemplates, downloadTemplate, parseCSV, rowsToObjects, validateImportData } from '@/db/csvUtils';
import { executeImport } from '@/db/importEngine';
import type { ImportModule, ImportTemplate, ValidationError, ImportResult } from '@/db/types';

type WizardStep = 'select' | 'template' | 'upload' | 'preview' | 'importing' | 'result';

export default function DataImportExport() {
  const { toast } = useToast();
  const { currentFarmId } = useFarm();
  const templates = getAllTemplates();
  const importLogs = useLiveQuery(() => db.importLogs.where({ farmId: currentFarmId }).reverse().sortBy('importedAt'), [currentFarmId]) || [];
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>('select');
  const [selectedModule, setSelectedModule] = useState<ImportModule | null>(null);
  const [importMode, setImportMode] = useState<'add_new' | 'update_existing' | 'replace_existing'>('add_new');
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [showExport, setShowExport] = useState(false);

  const selectedTemplate = selectedModule ? templates.find(t => t.module === selectedModule) : null;

  function handleSelectModule(module: ImportModule) {
    setSelectedModule(module);
    setStep('template');
  }

  function handleDownloadTemplate() {
    if (selectedModule) {
      downloadTemplate(selectedModule);
      setStep('upload');
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedTemplate) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCSV(text);
      const objects = rowsToObjects(headers, rows, selectedTemplate);
      setParsedHeaders(headers);
      setParsedData(objects);
      setStep('preview');
    };
    reader.readAsText(file);
  }

  async function handleValidate() {
    if (!selectedModule || parsedData.length === 0) return;
    const errors = await validateImportData(selectedModule, parsedData);
    setValidationErrors(errors);
    return errors;
  }

  async function handleImport() {
    if (!selectedModule || parsedData.length === 0) return;
    setStep('importing');
    const errors = await validateImportData(selectedModule, parsedData);
    setValidationErrors(errors);

    const criticalErrors = errors.filter(e => !e.suggestion?.includes('skipped on import'));
    if (criticalErrors.length > 0) {
      toast(`${criticalErrors.length} critical errors found. Fix them before importing.`, 'error');
      setStep('preview');
      return;
    }

    const result = await executeImport(selectedModule, parsedData, importMode, (current, total) => {
      setProgress({ current, total });
    });

    setImportResult(result);
    setStep('result');
    toast(`Import complete: ${result.successful} created, ${result.updated} updated`, 'success');
  }

  function handleReset() {
    setStep('select');
    setSelectedModule(null);
    setParsedData([]);
    setParsedHeaders([]);
    setValidationErrors([]);
    setImportResult(null);
    setProgress({ current: 0, total: 0 });
  }

  function handleExport(module: ImportModule) {
    import('@/db/csvUtils').then(({ exportModuleToCSV }) => {
      exportModuleToCSV(module, currentFarmId);
      toast('Export started', 'success');
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3>Data Import & Export</h3>
        <button className="btn btn-outline" onClick={() => setShowExport(!showExport)}>
          <span className="material-icons-outlined" style={{ fontSize: 18 }}>download</span>
          {showExport ? 'Hide Exports' : 'Export Data'}
        </button>
      </div>

      {showExport && (
        <div className="card mb-4">
          <div className="card-header"><h4>Export Data</h4></div>
          <div className="card-body">
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {templates.map(t => (
                <button key={t.module} className="btn btn-outline btn-sm" onClick={() => handleExport(t.module)}>
                  <span className="material-icons-outlined" style={{ fontSize: 16 }}>{t.icon}</span>
                  Export {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 'select' && (
        <div>
          <h4 className="mb-3">Select Module to Import</h4>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
            {templates.map(t => (
              <div key={t.module} className="card clickable" onClick={() => handleSelectModule(t.module)}>
                <div className="card-body flex items-center gap-3">
                  <span className="material-icons-outlined" style={{ fontSize: 32, color: 'var(--primary)' }}>{t.icon}</span>
                  <div>
                    <h4 style={{ margin: 0 }}>{t.label}</h4>
                    <span className="text-secondary text-sm">{t.headers.length} columns</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 'template' && selectedTemplate && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h4>Import: {selectedTemplate.label}</h4>
            <button className="btn btn-sm btn-outline" onClick={handleReset}>Back</button>
          </div>
          <div className="card-body">
            <div className="mb-3">
              <label className="form-label">Import Mode</label>
              <div className="flex gap-3">
                <label className="radio-label">
                  <input type="radio" name="mode" value="add_new" checked={importMode === 'add_new'} onChange={() => setImportMode('add_new')} />
                  Add New Only
                </label>
                <label className="radio-label">
                  <input type="radio" name="mode" value="update_existing" checked={importMode === 'update_existing'} onChange={() => setImportMode('update_existing')} />
                  Update Existing
                </label>
                <label className="radio-label">
                  <input type="radio" name="mode" value="replace_existing" checked={importMode === 'replace_existing'} onChange={() => setImportMode('replace_existing')} />
                  Replace Existing
                </label>
              </div>
            </div>

            <div className="mb-3">
              <h5>Required Columns:</h5>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedTemplate.headers.filter(h => h.required).map(h => (
                  <Badge key={h.field} variant="info">{h.label}</Badge>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <h5>All Columns:</h5>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>Field</th><th>Required</th><th>Type</th><th>Sample</th><th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTemplate.headers.map(h => (
                      <tr key={h.field}>
                        <td>{h.label}</td>
                        <td>{h.required ? <Badge variant="warning">Required</Badge> : 'Optional'}</td>
                        <td>{h.type}</td>
                        <td className="text-secondary">{h.sampleValue}</td>
                        <td className="text-secondary">{h.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={handleDownloadTemplate}>
                <span className="material-icons-outlined" style={{ fontSize: 18 }}>download</span>
                Download Template CSV
              </button>
              <button className="btn btn-outline" onClick={() => setStep('upload')}>
                <span className="material-icons-outlined" style={{ fontSize: 18 }}>upload</span>
                I Have a CSV File
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'upload' && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h4>Upload CSV: {selectedTemplate?.label}</h4>
            <button className="btn btn-sm btn-outline" onClick={handleReset}>Back</button>
          </div>
          <div className="card-body">
            <div className="upload-zone" onClick={() => fileRef.current?.click()}>
              <span className="material-icons-outlined" style={{ fontSize: 48, color: 'var(--md-outline)' }}>cloud_upload</span>
              <p>Click to select a CSV file</p>
              <p className="text-secondary text-sm">or drag and drop</p>
              <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFileUpload} />
            </div>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h4>Preview: {parsedData.length} rows from {selectedTemplate?.label}</h4>
            <button className="btn btn-sm btn-outline" onClick={() => setStep('upload')}>Back</button>
          </div>
          <div className="card-body">
            {validationErrors.length > 0 && (
              <div className="alert alert-warning mb-3">
                <strong>{validationErrors.length} validation issues found:</strong>
                <div style={{ maxHeight: 200, overflow: 'auto', marginTop: 8 }}>
                  {validationErrors.slice(0, 50).map((e, i) => (
                    <div key={i} className="text-sm" style={{ padding: '2px 0' }}>
                      Row {e.row}: {e.column && <strong>{e.column}: </strong>}{e.error} — <em>{e.suggestion}</em>
                    </div>
                  ))}
                  {validationErrors.length > 50 && <div className="text-secondary text-sm">...and {validationErrors.length - 50} more</div>}
                </div>
              </div>
            )}

            <div style={{ overflowX: 'auto', maxHeight: 400, overflow: 'auto' }}>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>#</th>
                    {selectedTemplate?.headers.map(h => <th key={h.field}>{h.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 100).map((row, i) => (
                    <tr key={i}>
                      <td>{i + 2}</td>
                      {selectedTemplate?.headers.map(h => (
                        <td key={h.field}>{row[h.field] || <span className="text-secondary">-</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedData.length > 100 && <p className="text-secondary text-sm mt-2">Showing first 100 of {parsedData.length} rows</p>}

            <div className="flex gap-2 mt-3">
              <button className="btn btn-primary" onClick={handleImport}>
                <span className="material-icons-outlined" style={{ fontSize: 18 }}>upload</span>
                Import {parsedData.length} Rows
              </button>
              <button className="btn btn-outline" onClick={() => setStep('upload')}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="card">
          <div className="card-body text-center" style={{ padding: 60 }}>
            <div className="spinner" />
            <h3 className="mt-3">Importing...</h3>
            <p className="text-secondary">
              {progress.current > 0 ? `Processing row ${progress.current} of ${progress.total}` : 'Starting import...'}
            </p>
            {progress.total > 0 && (
              <div className="progress-bar mt-2">
                <div className="progress-fill" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
              </div>
            )}
          </div>
        </div>
      )}

      {step === 'result' && importResult && (
        <div className="card">
          <div className="card-header"><h4>Import Complete</h4></div>
          <div className="card-body">
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
              <div className="stat-card"><div className="stat-value">{importResult.totalRows}</div><div className="stat-label">Total Rows</div></div>
              <div className="stat-card success"><div className="stat-value">{importResult.successful}</div><div className="stat-label">Created</div></div>
              <div className="stat-card info"><div className="stat-value">{importResult.updated}</div><div className="stat-label">Updated</div></div>
              <div className="stat-card warning"><div className="stat-value">{importResult.skipped}</div><div className="stat-label">Skipped</div></div>
              <div className="stat-card danger"><div className="stat-value">{importResult.failed}</div><div className="stat-label">Failed</div></div>
              <div className="stat-card"><div className="stat-value">{importResult.processingTimeMs}ms</div><div className="stat-label">Duration</div></div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="mt-3">
                <h5>Errors:</h5>
                {importResult.errors.slice(0, 20).map((e, i) => (
                  <div key={i} className="text-sm">Row {e.row}: {e.error}</div>
                ))}
              </div>
            )}

            <button className="btn btn-primary mt-4" onClick={handleReset}>Import More Data</button>
          </div>
        </div>
      )}

      {importLogs.length > 0 && (
        <div className="card mt-4">
          <div className="card-header"><h4>Import History</h4></div>
          <div className="card-body">
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Date</th><th>Module</th><th>Mode</th><th>Rows</th><th>Created</th><th>Updated</th><th>Failed</th><th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {importLogs.slice(0, 20).map(log => (
                    <tr key={log.id}>
                      <td>{new Date(log.importedAt).toLocaleString()}</td>
                      <td>{log.moduleName}</td>
                      <td><Badge variant={log.importMode === 'add_new' ? 'success' : log.importMode === 'update_existing' ? 'info' : 'warning'}>{log.importMode}</Badge></td>
                      <td>{log.totalRows}</td>
                      <td>{log.successfulImports}</td>
                      <td>{log.updatedRecords}</td>
                      <td>{log.failedRecords}</td>
                      <td>{log.processingTimeMs}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
