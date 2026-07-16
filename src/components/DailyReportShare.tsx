import { useRef, useCallback } from 'react';
import { Modal, EmptyState } from '@/components/UI';
import { useToast } from '@/components/ToastProvider';
import type { DailyReport, Batch } from '@/db/types';

const EGGS_PER_CRATE = 30;
const GRAMS_PER_BAG = 25000;
const CARD_W = 800;
const PAD = 40;

function eggBreakdown(report: DailyReport) {
  const totalPieces = report.eggProduction.reduce((s, e) => s + e.totalPieces, 0);
  const cracked = report.eggProduction.reduce((s, e) => s + e.cracked, 0);
  const damaged = report.eggProduction.reduce((s, e) => s + e.damaged, 0);
  const crates = Math.floor(totalPieces / EGGS_PER_CRATE);
  const pieces = totalPieces % EGGS_PER_CRATE;
  return { totalPieces, cracked, damaged, crates, pieces };
}

function feedBreakdown(report: DailyReport, population: number) {
  const totalGrams = report.feedIntake.reduce((s, f) => s + f.quantityGrams, 0);
  const totalKg = totalGrams / 1000;
  const bags = Math.floor(totalGrams / GRAMS_PER_BAG);
  const remainingKg = (totalGrams % GRAMS_PER_BAG) / 1000;
  const perBird = population > 0 ? totalGrams / population : 0;
  const types = [...new Set(report.feedIntake.map(f => f.feedType).filter(Boolean))];
  const brands = [...new Set(report.feedIntake.map(f => f.feedBrand).filter(Boolean))];
  return { totalGrams, totalKg, bags, remainingKg, perBird, types, brands, multipleTypes: types.length > 1 };
}

function productionMetrics(report: DailyReport, population: number) {
  const totalEggs = report.eggProduction.reduce((s, e) => s + e.totalPieces, 0);
  const totalFeedGrams = report.feedIntake.reduce((s, f) => s + f.quantityGrams, 0);
  const productionRate = population > 0 ? (totalEggs / population) * 100 : 0;
  const fcr = totalEggs > 0 ? totalFeedGrams / totalEggs : 0;
  return { productionRate, fcr, totalEggs, totalFeedGrams };
}

function mortalityBreakdown(report: DailyReport) {
  const total = report.mortality.reduce((s, m) => s + m.numberDead, 0);
  const reasons = report.mortality.filter(m => m.numberDead > 0).map(m => {
    const reason = m.reason === 'Others' && m.otherReason ? m.otherReason : m.reason;
    return `${reason} (${m.numberDead})`;
  });
  return { total, reasons };
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-NG', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function generatePlainText(report: DailyReport, batch: Batch | null, farmName: string, recordedBy: string): string {
  const lines: string[] = [];
  const egg = eggBreakdown(report);
  const feed = feedBreakdown(report, batch?.currentPopulation || 0);
  const metrics = productionMetrics(report, batch?.currentPopulation || 0);
  const mort = mortalityBreakdown(report);
  const env = report.environment?.[0];
  const weights = report.weights?.[0];

  lines.push('📊 DAILY FARM REPORT');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push(`🐔 ${farmName}`);
  if (batch) lines.push(`📋 ${batch.batchName} (${batch.currentPopulation.toLocaleString()} birds)`);
  lines.push(`📅 ${formatDate(report.reportDate)}`);
  lines.push(`👤 Recorded by: ${recordedBy}`);
  lines.push('');

  if (report.eggProduction.some(e => e.totalPieces > 0 || e.cracked > 0 || e.damaged > 0)) {
    lines.push('🥚 EGG PRODUCTION');
    lines.push(`   ${egg.crates} crates | ${egg.pieces} pieces`);
    lines.push(`   Cracked: ${egg.cracked} | Damaged: ${egg.damaged}`);
    lines.push(`   Total: ${egg.totalPieces.toLocaleString()} pieces`);
    if (batch && batch.currentPopulation > 0) {
      lines.push(`   Production Rate: ${metrics.productionRate.toFixed(1)}%`);
    }
    if (metrics.totalEggs > 0 && metrics.totalFeedGrams > 0) {
      lines.push(`   FCR: ${metrics.fcr.toFixed(1)} g feed / egg`);
    }
    lines.push('');
  }

  if (mort.total > 0) {
    lines.push(`☠ MORTALITY: ${mort.total} bird${mort.total !== 1 ? 's' : ''}`);
    if (mort.reasons.length > 0) lines.push(`   → ${mort.reasons.join(' | ')}`);
    if (batch) lines.push(`   Remaining: ${batch.currentPopulation} birds`);
    lines.push('');
  }

  if (feed.totalGrams > 0) {
    lines.push('🌾 FEED INTAKE');
    lines.push(`   ${feed.bags} bag${feed.bags !== 1 ? 's' : ''} + ${feed.remainingKg.toFixed(1)} kg (${feed.totalKg.toFixed(1)} kg total)`);
    const typeStr = feed.types.join(', ');
    const brandStr = feed.brands.length > 0 ? ` | ${feed.brands.join(', ')}` : '';
    lines.push(`   ${typeStr}${brandStr}`);
    lines.push(`   ${feed.perBird.toFixed(0)} g/bird/day`);
    if (feed.multipleTypes) lines.push('   ⚠ Multiple feed types used');
    lines.push('');
  }

  if (report.medication.some(m => m.medicationName)) {
    lines.push('💊 MEDICATION');
    report.medication.filter(m => m.medicationName).forEach(m => {
      lines.push(`   ${m.medicationName} (${m.medicationCategory}) — ${m.quantityUsed}${m.unit} — ${m.administrationMethod}`);
    });
    lines.push('');
  }

  if (weights && (weights.averageEggWeight > 0 || weights.averageBodyWeight > 0)) {
    lines.push('⚖ WEIGHTS');
    if (weights.averageEggWeight > 0) lines.push(`   Egg: ${weights.averageEggWeight}${weights.eggWeightUnit}`);
    if (weights.averageBodyWeight > 0) lines.push(`   Body: ${weights.averageBodyWeight}${weights.bodyWeightUnit}`);
    lines.push('');
  }

  if (env && (env.temperature > 0 || env.humidity > 0 || env.waterConsumption > 0)) {
    lines.push('🌡 ENVIRONMENT');
    if (env.temperature > 0 || env.humidity > 0) lines.push(`   Temp: ${env.temperature}°C | Humidity: ${env.humidity}%`);
    lines.push(`   Weather: ${env.weatherCondition} | Ventilation: ${env.ventilationStatus}`);
    if (env.waterConsumption > 0) lines.push(`   Water: ${env.waterConsumption} ${env.waterUnit}`);
    lines.push('');
  }

  if (report.notes?.trim()) {
    lines.push('📝 NOTES');
    lines.push(`   ${report.notes}`);
    lines.push('');
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('Generated by PoultryLog NG');
  return lines.join('\n');
}

async function drawReportImage(report: DailyReport, batch: Batch | null, farmName: string, recordedBy: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = CARD_W * scale;
  canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.font = '14px Inter, -apple-system, sans-serif';

  const egg = eggBreakdown(report);
  const feed = feedBreakdown(report, batch?.currentPopulation || 0);
  const metrics = productionMetrics(report, batch?.currentPopulation || 0);
  const mort = mortalityBreakdown(report);
  const env = report.environment?.[0];
  const weights = report.weights?.[0];

  const hasEggs = report.eggProduction.some(e => e.totalPieces > 0 || e.cracked > 0 || e.damaged > 0);
  const hasMortality = mort.total > 0;
  const hasFeed = feed.totalGrams > 0;
  const hasMedication = report.medication.some(m => m.medicationName);
  const hasWeights = weights && (weights.averageEggWeight > 0 || weights.averageBodyWeight > 0);
  const hasEnvironment = env && (env.temperature > 0 || env.humidity > 0 || env.waterConsumption > 0);
  const hasNotes = report.notes?.trim();
  const hasMetrics = hasEggs && batch && batch.currentPopulation > 0;

  let y = 0;

  function line(text: string, x: number, color: string, font: string, baseline: CanvasTextBaseline = 'top') {
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textBaseline = baseline;
    ctx.fillText(text, x, y);
  }

  function wrapText(text: string, x: number, maxWidth: number, lineHeight: number, color: string, font: string) {
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textBaseline = 'top';
    const words = text.split(' ');
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        ctx.fillText(currentLine, x, y);
        y += lineHeight;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      ctx.fillText(currentLine, x, y);
      y += lineHeight;
    }
  }

  function divider() {
    y += 8;
    ctx.strokeStyle = '#C8E6C9';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(CARD_W - PAD, y);
    ctx.stroke();
    y += 8;
  }

  function sectionTitle(text: string) {
    ctx.fillStyle = '#2E7D32';
    ctx.font = 'bold 15px Inter, -apple-system, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(text, PAD, y);
    y += 24;
  }

  function bodyText(text: string) {
    ctx.fillStyle = '#333';
    ctx.font = '14px Inter, -apple-system, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(text, PAD, y);
    y += 22;
  }

  function drawMetricBox(label: string, value: string, x: number, w: number) {
    ctx.fillStyle = '#E8F5E9';
    roundRect(ctx, x, y, w, 52, 8);
    ctx.fill();
    ctx.fillStyle = '#1B5E20';
    ctx.font = 'bold 20px Inter, -apple-system, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(value, x + 12, y + 8);
    ctx.fillStyle = '#666';
    ctx.font = '12px Inter, -apple-system, sans-serif';
    ctx.fillText(label, x + 12, y + 34);
  }

  function roundRect(context: CanvasRenderingContext2D, rx: number, ry: number, rw: number, rh: number, rr: number) {
    context.beginPath();
    context.moveTo(rx + rr, ry);
    context.lineTo(rx + rw - rr, ry);
    context.arcTo(rx + rw, ry, rx + rw, ry + rr, rr);
    context.lineTo(rx + rw, ry + rh - rr);
    context.arcTo(rx + rw, ry + rh, rx + rw - rr, ry + rh, rr);
    context.lineTo(rx + rr, ry + rh);
    context.arcTo(rx, ry + rh, rx, ry + rh - rr, rr);
    context.lineTo(rx, ry + rr);
    context.arcTo(rx, ry, rx + rr, ry, rr);
    context.closePath();
  }

  // --- Measure total height first ---
  let totalHeight = 0;
  function measureAll() {
    y = 0;
    y += 100;
    y += 12;
    y += 22; // farm
    if (batch) y += 22;
    y += 22; // date
    y += 22; // recorded by
    y += 4;
    divider();
    if (hasEggs) {
      sectionTitle('🥚 Egg Production');
      y += 22;
      y += 22;
      y += 22;
      y += 8;
    }
    if (hasMetrics) {
      y += 64; // metric boxes row
      y += 8;
    }
    if (hasMortality) {
      sectionTitle('☠ Mortality');
      y += 22;
      if (mort.reasons.length > 0) y += 22;
      if (batch) y += 22;
      y += 8;
    }
    if (hasFeed) {
      sectionTitle('🌾 Feed Intake');
      y += 22;
      y += 22;
      y += 22;
      if (feed.multipleTypes) y += 22;
      y += 8;
    }
    if (hasMedication) {
      sectionTitle('💊 Medication');
      report.medication.filter(m => m.medicationName).forEach(() => { y += 22; });
      y += 8;
    }
    if (hasWeights) {
      sectionTitle('⚖ Weights');
      y += 22;
      y += 8;
    }
    if (hasEnvironment) {
      sectionTitle('🌡 Environment');
      y += 22;
      y += 22;
      if (env!.waterConsumption > 0) y += 22;
      y += 8;
    }
    if (hasNotes) {
      sectionTitle('📝 Notes');
      const noteText = report.notes!.trim();
      ctx.font = '14px Inter, -apple-system, sans-serif';
      const words = noteText.split(' ');
      let lineW = 0;
      for (const word of words) {
        const testW = ctx.measureText((lineW ? ' ' : '') + word).width;
        if (testW > CARD_W - PAD * 2 && lineW > 0) {
          y += 22;
          lineW = 0;
          lineW = word.length;
        } else {
          lineW += (lineW ? 1 : 0) + word.length;
        }
      }
      if (lineW > 0) y += 22;
      y += 8;
    }
    y += 22;
    y += 24;
    totalHeight = y;
  }
  measureAll();

  // --- Draw ---
  canvas.height = totalHeight * scale;
  y = 0;

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CARD_W, totalHeight);

  // Header background
  const headerGrad = ctx.createLinearGradient(0, 0, CARD_W, 0);
  headerGrad.addColorStop(0, '#1B5E20');
  headerGrad.addColorStop(1, '#2E7D32');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, CARD_W, 100);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px Inter, -apple-system, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText('🐔 PoultryLog NG', PAD, 20);
  ctx.font = '14px Inter, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Daily Activity Report', PAD, 50);
  y = 100;

  // Meta
  y += 12;
  bodyText(`Farm: ${farmName}`);
  if (batch) bodyText(`Batch: ${batch.batchName} (${batch.currentPopulation.toLocaleString()} birds)`);
  bodyText(`Date: ${formatDate(report.reportDate)}`);
  bodyText(`Recorded by: ${recordedBy}`);
  y += 4;
  divider();

  // Egg Production
  if (hasEggs) {
    sectionTitle('🥚 Egg Production');
    bodyText(`${egg.crates} crates | ${egg.pieces} pieces | Cracked: ${egg.cracked} | Damaged: ${egg.damaged}`);
    ctx.fillStyle = '#1B5E20';
    ctx.font = 'bold 14px Inter, -apple-system, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(`Total: ${egg.totalPieces.toLocaleString()} pieces`, PAD, y);
    y += 22;
    y += 8;
  }

  // Production Metrics
  if (hasMetrics) {
    const boxW = (CARD_W - PAD * 2 - 16) / 2;
    drawMetricBox('Production Rate', `${metrics.productionRate.toFixed(1)}%`, PAD, boxW);
    drawMetricBox('FCR (Feed/Egg)', `${metrics.fcr.toFixed(1)} g`, PAD + boxW + 16, boxW);
    y += 64;
    y += 8;
  }

  // Mortality
  if (hasMortality) {
    sectionTitle('☠ Mortality');
    bodyText(`Total: ${mort.total} bird${mort.total !== 1 ? 's' : ''}`);
    if (mort.reasons.length > 0) bodyText(`→ ${mort.reasons.join(' | ')}`);
    if (batch) bodyText(`Remaining: ${batch.currentPopulation.toLocaleString()} birds`);
    y += 8;
  }

  // Feed Intake
  if (hasFeed) {
    sectionTitle('🌾 Feed Intake');
    bodyText(`${feed.bags} bag${feed.bags !== 1 ? 's' : ''} + ${feed.remainingKg.toFixed(1)} kg (${feed.totalKg.toFixed(1)} kg total)`);
    const typeStr = feed.types.join(', ');
    const brandStr = feed.brands.length > 0 ? ` | ${feed.brands.join(', ')}` : '';
    bodyText(`${typeStr}${brandStr}`);
    bodyText(`${feed.perBird.toFixed(0)} g/bird/day`);
    if (feed.multipleTypes) {
      ctx.fillStyle = '#E65100';
      ctx.font = '13px Inter, -apple-system, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText('⚠ Multiple feed types used', PAD, y);
      y += 22;
    }
    y += 8;
  }

  // Medication
  if (hasMedication) {
    sectionTitle('💊 Medication');
    report.medication.filter(m => m.medicationName).forEach(m => {
      bodyText(`${m.medicationName} (${m.medicationCategory}) — ${m.quantityUsed}${m.unit} — ${m.administrationMethod}`);
    });
    y += 8;
  }

  // Weights
  if (hasWeights) {
    sectionTitle('⚖ Weights');
    const wParts: string[] = [];
    if (weights!.averageEggWeight > 0) wParts.push(`Egg: ${weights!.averageEggWeight}${weights!.eggWeightUnit}`);
    if (weights!.averageBodyWeight > 0) wParts.push(`Body: ${weights!.averageBodyWeight}${weights!.bodyWeightUnit}`);
    bodyText(wParts.join(' | '));
    y += 8;
  }

  // Environment
  if (hasEnvironment) {
    sectionTitle('🌡 Environment');
    const envLine: string[] = [];
    if (env!.temperature > 0) envLine.push(`Temp: ${env!.temperature}°C`);
    if (env!.humidity > 0) envLine.push(`Humidity: ${env!.humidity}%`);
    if (env!.lightHours > 0) envLine.push(`Light: ${env!.lightHours}h`);
    if (envLine.length > 0) bodyText(envLine.join(' | '));
    bodyText(`Weather: ${env!.weatherCondition} | Ventilation: ${env!.ventilationStatus}`);
    if (env!.waterConsumption > 0) bodyText(`Water: ${env!.waterConsumption} ${env!.waterUnit}`);
    y += 8;
  }

  // Notes
  if (hasNotes) {
    sectionTitle('📝 Notes');
    wrapText(report.notes!.trim(), PAD, CARD_W - PAD * 2, 22, '#555', 'italic 14px Inter, -apple-system, sans-serif');
    y += 8;
  }

  // Footer
  divider();
  ctx.fillStyle = '#999';
  ctx.font = '11px Inter, -apple-system, sans-serif';
  ctx.textBaseline = 'top';
  const now = new Date();
  const footerText = `Generated by PoultryLog NG — ${now.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })} ${now.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}`;
  ctx.fillText(footerText, PAD, y);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to generate image'));
    }, 'image/png', 0.95);
  });
}

interface DailyReportShareProps {
  open: boolean;
  onClose: () => void;
  report: DailyReport | null;
  batch: Batch | null;
  farmName: string;
  recordedBy: string;
}

export default function DailyReportShare({ open, onClose, report, batch, farmName, recordedBy }: DailyReportShareProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleCopyText = useCallback(async () => {
    if (!report) return;
    const text = generatePlainText(report, batch, farmName, recordedBy);
    try {
      await navigator.clipboard.writeText(text);
      toast('Report copied! Paste into WhatsApp, Telegram, etc.', 'success');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast('Report copied!', 'success');
    }
  }, [report, batch, farmName, recordedBy, toast]);

  const handleShareImage = useCallback(async () => {
    if (!report) return;
    try {
      toast('Generating image...', 'info');
      const blob = await drawReportImage(report, batch, farmName, recordedBy);
      const file = new File([blob], `daily-report-${report.reportDate}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Daily Report — ${report.reportDate}` });
        toast('Shared!', 'success');
      } else {
        handleDownloadImage();
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        handleDownloadImage();
      }
    }
  }, [report, batch, farmName, recordedBy, toast]);

  const handleDownloadImage = useCallback(async () => {
    if (!report) return;
    try {
      toast('Generating image...', 'info');
      const blob = await drawReportImage(report, batch, farmName, recordedBy);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily-report-${report.reportDate}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('Image saved to downloads!', 'success');
    } catch {
      toast('Failed to generate image', 'error');
    }
  }, [report, batch, farmName, recordedBy, toast]);

  if (!report) return null;

  const egg = eggBreakdown(report);
  const feed = feedBreakdown(report, batch?.currentPopulation || 0);
  const metrics = productionMetrics(report, batch?.currentPopulation || 0);
  const mort = mortalityBreakdown(report);
  const env = report.environment?.[0];
  const weights = report.weights?.[0];

  const hasEggs = report.eggProduction.some(e => e.totalPieces > 0 || e.cracked > 0 || e.damaged > 0);
  const hasMortality = mort.total > 0;
  const hasFeed = feed.totalGrams > 0;
  const hasMedication = report.medication.some(m => m.medicationName);
  const hasWeights = weights && (weights.averageEggWeight > 0 || weights.averageBodyWeight > 0);
  const hasEnvironment = env && (env.temperature > 0 || env.humidity > 0 || env.waterConsumption > 0);
  const hasNotes = report.notes?.trim();
  const hasMetrics = hasEggs && batch && batch.currentPopulation > 0;

  const hasAnyData = hasEggs || hasMortality || hasFeed || hasMedication || hasWeights || hasEnvironment || hasNotes;

  return (
    <Modal
      open={open}
      title="Share Daily Report"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline" onClick={handleCopyText}>
            <span className="material-icons-outlined" style={{ fontSize: 18 }}>content_copy</span>
            Copy Text
          </button>
          <button className="btn btn-outline" onClick={handleDownloadImage}>
            <span className="material-icons-outlined" style={{ fontSize: 18 }}>download</span>
            Download Image
          </button>
          <button className="btn btn-primary" onClick={handleShareImage}>
            <span className="material-icons-outlined" style={{ fontSize: 18 }}>share</span>
            Share as Image
          </button>
        </>
      }
    >
      {!hasAnyData ? (
        <EmptyState
          icon="info"
          title="No Data to Share"
          description="This report has no recorded data yet."
        />
      ) : (
        <>
          <p className="text-sm text-secondary mb-3">Preview below, then choose how to share.</p>
          <div className="share-report-card-wrapper">
            <div ref={previewRef} className="share-report-card">
              <div className="share-report-header">
                <div className="share-report-logo">🐔</div>
                <h2>PoultryLog NG</h2>
                <p>Daily Activity Report</p>
              </div>

              <div className="share-report-meta">
                <div>Farm: <strong>{farmName}</strong></div>
                {batch && <div>Batch: <strong>{batch.batchName}</strong> ({batch.currentPopulation.toLocaleString()} birds)</div>}
                <div>Date: <strong>{formatDate(report.reportDate)}</strong></div>
                <div>Recorded by: <strong>{recordedBy}</strong></div>
              </div>

              {hasEggs && (
                <div className="share-report-section">
                  <div className="share-report-section-title">🥚 Egg Production</div>
                  <div className="share-report-egg-grid">
                    <div><span className="share-report-big-num">{egg.crates}</span><span>Crates</span></div>
                    <div><span className="share-report-big-num">{egg.pieces}</span><span>Pieces</span></div>
                    <div><span className="share-report-big-num">{egg.cracked}</span><span>Cracked</span></div>
                    <div><span className="share-report-big-num">{egg.damaged}</span><span>Damaged</span></div>
                  </div>
                  <div className="share-report-subtotal">Total: {egg.totalPieces.toLocaleString()} pieces</div>
                </div>
              )}

              {hasMetrics && (
                <div className="share-report-metrics-row">
                  <div className="share-report-metric-box">
                    <span className="share-report-metric-value">{metrics.productionRate.toFixed(1)}%</span>
                    <span className="share-report-metric-label">Production Rate</span>
                  </div>
                  <div className="share-report-metric-box">
                    <span className="share-report-metric-value">{metrics.fcr.toFixed(1)} g</span>
                    <span className="share-report-metric-label">FCR (feed / egg)</span>
                  </div>
                </div>
              )}

              {hasMortality && (
                <div className="share-report-section">
                  <div className="share-report-section-title">☠ Mortality</div>
                  <div>Total: {mort.total} bird{mort.total !== 1 ? 's' : ''}</div>
                  {mort.reasons.length > 0 && <div>→ {mort.reasons.join(' | ')}</div>}
                  {batch && <div>Remaining: <strong>{batch.currentPopulation.toLocaleString()}</strong> birds</div>}
                </div>
              )}

              {hasFeed && (
                <div className="share-report-section">
                  <div className="share-report-section-title">🌾 Feed Intake</div>
                  <div>{feed.bags} bag{feed.bags !== 1 ? 's' : ''} + {feed.remainingKg.toFixed(1)} kg ({feed.totalKg.toFixed(1)} kg total)</div>
                  <div>{feed.types.join(', ')}{feed.brands.length > 0 ? ` | ${feed.brands.join(', ')}` : ''}</div>
                  <div><strong>{feed.perBird.toFixed(0)} g/bird/day</strong></div>
                  {feed.multipleTypes && <div className="share-report-note">⚠ Multiple feed types used</div>}
                </div>
              )}

              {hasMedication && (
                <div className="share-report-section">
                  <div className="share-report-section-title">💊 Medication</div>
                  {report.medication.filter(m => m.medicationName).map((m, i) => (
                    <div key={i}>{m.medicationName} ({m.medicationCategory}) — {m.quantityUsed}{m.unit} — {m.administrationMethod}</div>
                  ))}
                </div>
              )}

              {hasWeights && (
                <div className="share-report-section">
                  <div className="share-report-section-title">⚖ Weights</div>
                  <div>
                    {weights!.averageEggWeight > 0 && <span>Egg: {weights!.averageEggWeight}{weights!.eggWeightUnit}</span>}
                    {weights!.averageEggWeight > 0 && weights!.averageBodyWeight > 0 && <span> | </span>}
                    {weights!.averageBodyWeight > 0 && <span>Body: {weights!.averageBodyWeight}{weights!.bodyWeightUnit}</span>}
                  </div>
                </div>
              )}

              {hasEnvironment && (
                <div className="share-report-section">
                  <div className="share-report-section-title">🌡 Environment</div>
                  <div>
                    {env!.temperature > 0 && <span>Temp: {env!.temperature}°C</span>}
                    {env!.temperature > 0 && env!.humidity > 0 && <span> | </span>}
                    {env!.humidity > 0 && <span>Humidity: {env!.humidity}%</span>}
                    {env!.lightHours > 0 && <span> | Light: {env!.lightHours}h</span>}
                  </div>
                  <div>Weather: {env!.weatherCondition} | Ventilation: {env!.ventilationStatus}</div>
                  {env!.waterConsumption > 0 && <div>Water: {env!.waterConsumption} {env!.waterUnit}</div>}
                </div>
              )}

              {hasNotes && (
                <div className="share-report-section">
                  <div className="share-report-section-title">📝 Notes</div>
                  <div className="share-report-notes">{report.notes}</div>
                </div>
              )}

              <div className="share-report-footer">
                Generated by PoultryLog NG — {new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })} {new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
