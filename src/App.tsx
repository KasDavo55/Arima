import { useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart, BarChart, Bar,
} from 'recharts';
import {
  Upload, FileText, X, TrendingUp, FlaskConical,
  Settings, BarChart2, ChevronRight, AlertCircle,
  CheckCircle2, Loader2, Database, Waves,
} from 'lucide-react';
import { useCsvParser } from './hooks/useCsvParser';
import {
  aggregateToTimeSeries,
  detectDateColumns,
  detectNumericColumns,
  getUniqueValues,
  detectCategoricalColumns,
  type AggregationMethod,
} from './utils/aggregator';
import {
  analyzeTimeSeries,
  generateForecast,
  getModelRecommendation,
} from './services/forecastApi';
import type {
  Frequency,
  TimeSeriesPoint,
  ForecastResponse,
  ExplorationResponse,
  RecommendationResponse,
} from './types/api.types';
import type { CsvRow } from './types/csv.types';
import { ModelRecommendation } from './components/ModelRecommendation';
import { buildSummary } from './utils/buildSummary';
import { DataCleaningPanel, type CleaningChoices } from './components/DataCleaningPanel';
import { analyzeQuality, type QualityReport } from './utils/dataQuality';
import { applyCleaning } from './utils/dataCleaner';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'aggregate' | 'explore' | 'forecast' | 'results';
type ModelType = 'AUTO' | 'ARIMA' | 'SARIMA';

interface AggregationConfig {
  dateColumn: string;
  valueColumn: string;
  frequency: Frequency;
  method: AggregationMethod;
  filters: Record<string, string>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FREQ_LABELS: Record<Frequency, string> = {
  D: 'Diaria', W: 'Semanal', M: 'Mensual', Q: 'Trimestral',
};

const STEP_ORDER: Step[] = ['upload', 'aggregate', 'explore', 'forecast', 'results'];

const fmt = (n: number, dec = 2) =>
  n?.toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec }) ?? '—';

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { id: 'upload', label: 'Datos', icon: Upload },
    { id: 'aggregate', label: 'Serie', icon: Database },
    { id: 'explore', label: 'Explorar', icon: Waves },
    { id: 'forecast', label: 'Modelo', icon: Settings },
    { id: 'results', label: 'Resultados', icon: TrendingUp },
  ] as const;

  const currentIdx = STEP_ORDER.indexOf(current);

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const done = i < currentIdx;
        const active = step.id === current;
        return (
          <div key={step.id} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-xs font-medium
              ${active ? 'bg-cyan-500 text-slate-900' : done ? 'text-cyan-400' : 'text-slate-600'}`}>
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className={`w-3 h-3 mx-1 ${done ? 'text-cyan-500' : 'text-slate-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function MetricCard({ label, value, sub, good }: { label: string; value: string; sub?: string; good?: boolean }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
      <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${good === undefined ? 'text-white' : good ? 'text-emerald-400' : 'text-amber-400'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-700/40 bg-slate-900/40">
        <Icon className="w-4 h-4 text-cyan-400" />
        <h3 className="text-sm font-semibold text-slate-300 tracking-wide">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const { state, loadFile, reset, isLoading: csvLoading, data: csvData } = useCsvParser();

  const [step, setStep] = useState<Step>('upload');
  const [aggConfig, setAggConfig] = useState<AggregationConfig>({
    dateColumn: '', valueColumn: '', frequency: 'M', method: 'sum', filters: {},
  });
  const [series, setSeries] = useState<TimeSeriesPoint[]>([]);
  const [exploration, setExploration] = useState<ExplorationResponse | null>(null);
  const [forecastResult, setForecastResult] = useState<ForecastResponse | null>(null);
  const [modelType, setModelType] = useState<ModelType>('AUTO');
  const [trainSize, setTrainSize] = useState(0.8);
  const [horizon, setHorizon] = useState(12);
  const [arimaP, setArimaP] = useState(1);
  const [arimaD, setArimaD] = useState(1);
  const [arimaQ, setArimaQ] = useState(1);
  const [seasonalP, setSeasonalP] = useState(1);
  const [seasonalD, setSeasonalD] = useState(1);
  const [seasonalQ, setSeasonalQ] = useState(1);
  const [seasonalS, setSeasonalS] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recomendación de IA
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);

  // Limpieza de datos
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);
  const [cleanedRows, setCleanedRows] = useState<CsvRow[] | null>(null);

  // ── Step 1: File upload ──────────────────────────────────────────────────

  const handleFileSelected = useCallback((file: File) => {
    reset();
    setStep('upload');
    setSeries([]);
    setExploration(null);
    setForecastResult(null);
    setRecommendation(null);
    setQualityReport(null);
    setCleanedRows(null);
    void loadFile(file);
  }, [loadFile, reset]);

  // Auto-detect columns + quality check when CSV loads
  const handleCsvLoaded = useCallback((rows: CsvRow[], headers: string[]) => {
    const dates = detectDateColumns(rows, headers);
    const nums = detectNumericColumns(rows, headers);
    setAggConfig(c => ({
      ...c,
      dateColumn: dates[0] ?? '',
      valueColumn: nums[0] ?? '',
      filters: {},
    }));

    // Detección de calidad sobre el CSV crudo
    const report = analyzeQuality(rows, nums);
    setQualityReport(report);

    if (report.hasIssues) {
      // Hay anomalías: nos quedamos en 'upload' para mostrar el panel de limpieza
      setCleanedRows(null);
    } else {
      // Sin problemas: datos listos, avanzamos
      setCleanedRows(rows);
      setStep('aggregate');
    }
  }, []);

  // Watch for CSV load
  if (state.status === 'success' && step === 'upload' && qualityReport === null) {
    handleCsvLoaded(state.data.rows, state.data.headers);
  }

  // ── Step 1.5: Apply cleaning ──────────────────────────────────────────────

  const handleApplyCleaning = useCallback((choices: CleaningChoices) => {
    if (!csvData) return;
    const nums = detectNumericColumns(csvData.rows, csvData.headers);
    const cleaned = applyCleaning(csvData.rows, nums, choices) as CsvRow[];
    setCleanedRows(cleaned);
    setStep('aggregate');
  }, [csvData]);

  // ── Step 2: Aggregate series ──────────────────────────────────────────────

  const handleAggregate = useCallback(() => {
    const sourceRows = cleanedRows ?? csvData?.rows;
    if (!sourceRows) return;
    setError(null);
    try {
      const pts = aggregateToTimeSeries(sourceRows, aggConfig);
      if (pts.length < 10) {
        setError('La serie resultante tiene menos de 10 puntos. Ajusta los filtros o la granularidad.');
        return;
      }
      setSeries(pts);
      setStep('explore');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al agregar los datos.');
    }
  }, [cleanedRows, csvData, aggConfig]);

  // ── Step 3: Explore + recomendación de IA ─────────────────────────────────

  const handleExplore = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRecommendation(null);
    try {
      const data = { points: series, frequency: aggConfig.frequency };
      const result = await analyzeTimeSeries(data);
      setExploration(result);
      setStep('forecast');

      // Recomendación de IA (no bloquea el flujo si falla)
      setLoadingRec(true);
      try {
        const summary = buildSummary(result, data);
        const rec = await getModelRecommendation(summary);
        setRecommendation(rec);
      } catch (recErr) {
        console.error('Fallo recomendación IA:', recErr);
      } finally {
        setLoadingRec(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al analizar la serie.');
    } finally {
      setLoading(false);
    }
  }, [series, aggConfig.frequency]);

  // ── Step 4: Forecast ──────────────────────────────────────────────────────

  const handleForecast = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const req: Parameters<typeof generateForecast>[0] = {
        series: { points: series, frequency: aggConfig.frequency },
        model_type: modelType,
        train_size: trainSize,
        forecast_horizon: horizon,
        confidence_level: 0.95,
        ...(modelType !== 'AUTO' && {
          arima_order: { p: arimaP, d: arimaD, q: arimaQ },
        }),
        ...(modelType === 'SARIMA' && {
          seasonal_order: { P: seasonalP, D: seasonalD, Q: seasonalQ, s: seasonalS },
        }),
      };
      const result = await generateForecast(req);
      setForecastResult(result);
      setStep('results');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar el pronóstico.');
    } finally {
      setLoading(false);
    }
  }, [series, aggConfig.frequency, modelType, trainSize, horizon,
    arimaP, arimaD, arimaQ, seasonalP, seasonalD, seasonalQ, seasonalS]);

  // ── Derived chart data ────────────────────────────────────────────────────

  const forecastChartData = forecastResult ? [
    ...forecastResult.train_data.map(p => ({ date: p.date, train: p.value })),
    ...forecastResult.test_data.map((p, i) => ({
      date: p.date, actual: p.value, predicted: forecastResult.test_predictions[i],
    })),
    ...forecastResult.forecast.map(p => ({
      date: p.date, forecast: p.forecast, lower: p.lower_bound, upper: p.upper_bound,
    })),
  ] : [];

  const decompositionData = exploration ? exploration.decomposition.dates.map((d, i) => ({
    date: d,
    trend: exploration.decomposition.trend[i],
    seasonal: exploration.decomposition.seasonal[i],
    residual: exploration.decomposition.residual[i],
  })) : [];

  const acfData = exploration ? exploration.acf_pacf.lags.slice(1).map(lag => ({
    lag,
    acf: exploration.acf_pacf.acf[lag],
    pacf: exploration.acf_pacf.pacf[lag],
    ci: exploration.acf_pacf.confidence_interval,
    neg_ci: -exploration.acf_pacf.confidence_interval,
  })) : [];

  // ── Render ────────────────────────────────────────────────────────────────

  const rows = csvData?.rows ?? [];
  const headers = csvData?.headers ?? [];
  const dateColumns = detectDateColumns(rows, headers);
  const numericColumns = detectNumericColumns(rows, headers);

  // Categorical columns for filters (smart detection)
  const categoricalColumns = detectCategoricalColumns(
    rows,
    headers,
    [...dateColumns, ...numericColumns],
  ).slice(0, 4);

  // ¿Mostrar el panel de limpieza? (hay reporte con problemas y aún no se limpió)
  const showCleaning = qualityReport?.hasIssues && !cleanedRows;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Google Font */}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-slate-900" />
            </div>
            <div>
              <span className="font-bold text-white text-sm tracking-tight">ARIMA</span>
              <span className="text-cyan-500 font-bold text-sm">/SARIMA</span>
              <span className="text-slate-500 text-xs ml-2 hidden sm:inline">Forecast Engine</span>
            </div>
          </div>
          <StepIndicator current={step} />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-950/60 border border-red-800/60 rounded-xl">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-300">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── STEP 1: Upload ── */}
        <SectionCard title="1. Carga de datos" icon={Upload}>
          {state.status === 'success' ? (
            <div className="flex items-center justify-between p-4 bg-emerald-950/40 border border-emerald-800/40 rounded-xl">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-emerald-300">{csvData?.fileName}</p>
                  <p className="text-xs text-slate-500">{csvData?.totalRows.toLocaleString()} registros · {csvData?.headers.length} columnas</p>
                </div>
              </div>
              <button onClick={() => { reset(); setStep('upload'); setSeries([]); setExploration(null); setForecastResult(null); setRecommendation(null); setQualityReport(null); setCleanedRows(null); }}
                className="p-2 text-slate-500 hover:text-red-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className={`flex flex-col items-center justify-center w-full p-12 border-2 border-dashed rounded-xl cursor-pointer transition-all
              ${csvLoading ? 'border-cyan-600 bg-cyan-950/20' : 'border-slate-700 hover:border-cyan-600 hover:bg-cyan-950/10'}`}>
              <input type="file" accept=".csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); e.target.value = ''; }} />
              {csvLoading
                ? <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-3" />
                : <Upload className="w-8 h-8 text-slate-500 mb-3" />}
              <p className="text-sm font-medium text-slate-300">
                {csvLoading ? 'Procesando...' : 'Arrastra tu CSV o haz clic para seleccionar'}
              </p>
              <p className="text-xs text-slate-600 mt-1">Máx. 50 MB</p>
            </label>
          )}
        </SectionCard>

        {/* ── STEP 1.5: Limpieza de datos ── */}
        {showCleaning && qualityReport && (
          <SectionCard title="1.5 Limpieza de datos" icon={Database}>
            <DataCleaningPanel report={qualityReport} onApply={handleApplyCleaning} />
          </SectionCard>
        )}

        {/* ── STEP 2: Aggregate ── */}
        {step !== 'upload' && csvData && (
          <SectionCard title="2. Configurar serie temporal" icon={Database}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">

              {/* Date column */}
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-1.5 block">Columna de fecha</label>
                <select value={aggConfig.dateColumn}
                  onChange={e => setAggConfig(c => ({ ...c, dateColumn: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none">
                  {dateColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Value column */}
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-1.5 block">Columna de valor</label>
                <select value={aggConfig.valueColumn}
                  onChange={e => setAggConfig(c => ({ ...c, valueColumn: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none">
                  {numericColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Frequency */}
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-1.5 block">Granularidad</label>
                <select value={aggConfig.frequency}
                  onChange={e => setAggConfig(c => ({ ...c, frequency: e.target.value as Frequency }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none">
                  {(Object.entries(FREQ_LABELS) as [Frequency, string][]).map(([k, v]) =>
                    <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              {/* Method */}
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-1.5 block">Agregación</label>
                <select value={aggConfig.method}
                  onChange={e => setAggConfig(c => ({ ...c, method: e.target.value as AggregationMethod }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none">
                  <option value="sum">Suma</option>
                  <option value="mean">Promedio</option>
                  <option value="count">Conteo</option>
                </select>
              </div>
            </div>

            {/* Filters */}
            {categoricalColumns.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Filtros opcionales</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {categoricalColumns.map(col => {
                    const options = getUniqueValues(rows, col);
                    return (
                      <div key={col}>
                        <label className="text-xs text-slate-500 mb-1 block">{col}</label>
                        <select
                          value={aggConfig.filters[col] ?? ''}
                          onChange={e => setAggConfig(c => ({
                            ...c,
                            filters: e.target.value
                              ? { ...c.filters, [col]: e.target.value }
                              : Object.fromEntries(Object.entries(c.filters).filter(([k]) => k !== col)),
                          }))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:border-cyan-500 focus:outline-none">
                          <option value="">Todos</option>
                          {options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button onClick={handleAggregate}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors">
              Generar serie temporal →
            </button>

            {/* Preview of aggregated series */}
            {series.length > 0 && (
              <div className="mt-5">
                <p className="text-xs text-slate-500 mb-3">{series.length} puntos · {FREQ_LABELS[aggConfig.frequency]}</p>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={series} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                    <defs>
                      <linearGradient id="seriesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={2} fill="url(#seriesGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {series.length > 0 && (
              <button onClick={handleExplore} disabled={loading}
                className="mt-4 flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                Analizar serie →
              </button>
            )}
          </SectionCard>
        )}

        {/* ── STEP 3: Exploration results ── */}
        {exploration && (
          <SectionCard title="3. Análisis exploratorio" icon={Waves}>
            {/* ADF test */}
            <div className={`p-4 rounded-xl border mb-5 ${exploration.stationarity.is_stationary
              ? 'bg-emerald-950/30 border-emerald-800/40'
              : 'bg-amber-950/30 border-amber-800/40'}`}>
              <div className="flex items-center gap-2 mb-1">
                {exploration.stationarity.is_stationary
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  : <AlertCircle className="w-4 h-4 text-amber-400" />}
                <span className="text-sm font-semibold text-slate-200">Test de Estacionariedad (ADF)</span>
              </div>
              <p className="text-xs text-slate-400">{exploration.stationarity.interpretation}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <MetricCard label="Media" value={fmt(exploration.summary_stats.mean)} />
              <MetricCard label="Desv. Est." value={fmt(exploration.summary_stats.std)} />
              <MetricCard label="Observaciones" value={String(Math.round(exploration.summary_stats.count))} />
            </div>

            {/* Decomposition */}
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Descomposición de la serie</p>
            {['trend', 'seasonal', 'residual'].map(key => (
              <div key={key} className="mb-4">
                <p className="text-xs text-slate-500 capitalize mb-1">
                  {key === 'trend' ? 'Tendencia' : key === 'seasonal' ? 'Estacionalidad' : 'Residuo'}
                </p>
                <ResponsiveContainer width="100%" height={100}>
                  <LineChart data={decompositionData} margin={{ top: 2, right: 10, bottom: 2, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" hide />
                    <YAxis tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={false} width={55} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, fontSize: 11 }} />
                    <Line type="monotone" dataKey={key}
                      stroke={key === 'trend' ? '#06b6d4' : key === 'seasonal' ? '#a78bfa' : '#f59e0b'}
                      strokeWidth={1.5} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ))}

            {/* ACF / PACF */}
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3 mt-2">ACF y PACF</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {['acf', 'pacf'].map(key => (
                <div key={key}>
                  <p className="text-xs text-slate-500 mb-1">{key.toUpperCase()}</p>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={acfData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="lag" tick={{ fontSize: 9, fill: '#475569' }} />
                      <YAxis domain={[-1, 1]} tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, fontSize: 11 }} />
                      <ReferenceLine y={exploration.acf_pacf.confidence_interval} stroke="#475569" strokeDasharray="4 4" />
                      <ReferenceLine y={-exploration.acf_pacf.confidence_interval} stroke="#475569" strokeDasharray="4 4" />
                      <Bar dataKey={key} fill={key === 'acf' ? '#06b6d4' : '#a78bfa'} opacity={0.8} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* ── STEP 3.5: Recomendación de IA ── */}
        {(exploration || loadingRec) && (
          <ModelRecommendation recommendation={recommendation} loading={loadingRec} />
        )}

        {/* ── STEP 4: Model config ── */}
        {step === 'forecast' || step === 'results' ? (
          <SectionCard title="4. Configuración del modelo" icon={Settings}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              {/* Model type */}
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-1.5 block">Tipo de modelo</label>
                <div className="flex gap-2">
                  {(['AUTO', 'ARIMA', 'SARIMA'] as ModelType[]).map(m => (
                    <button key={m} onClick={() => setModelType(m)}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all
                        ${modelType === m
                          ? 'bg-cyan-500 border-cyan-500 text-slate-900'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Train size */}
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-1.5 block">
                  Train split: {Math.round(trainSize * 100)}%
                </label>
                <input type="range" min={60} max={90} step={5} value={trainSize * 100}
                  onChange={e => setTrainSize(Number(e.target.value) / 100)}
                  className="w-full accent-cyan-500 mt-2" />
              </div>

              {/* Horizon */}
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-1.5 block">Horizonte de pronóstico</label>
                <input type="number" min={1} max={60} value={horizon}
                  onChange={e => setHorizon(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none" />
              </div>
            </div>

            {/* Manual params */}
            {modelType !== 'AUTO' && (
              <div className="mb-5">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Parámetros ARIMA (p, d, q)</p>
                <div className="flex gap-3">
                  {[['p', arimaP, setArimaP], ['d', arimaD, setArimaD], ['q', arimaQ, setArimaQ]].map(
                    ([label, val, setter]) => (
                      <div key={label as string} className="flex-1">
                        <label className="text-xs text-slate-500 mb-1 block text-center">{label as string}</label>
                        <input type="number" min={0} max={10} value={val as number}
                          onChange={e => (setter as (v: number) => void)(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 text-center focus:border-cyan-500 focus:outline-none" />
                      </div>
                    ))}
                </div>
              </div>
            )}

            {modelType === 'SARIMA' && (
              <div className="mb-5">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Parámetros estacionales (P, D, Q, s)</p>
                <div className="flex gap-3">
                  {[['P', seasonalP, setSeasonalP], ['D', seasonalD, setSeasonalD], ['Q', seasonalQ, setSeasonalQ], ['s', seasonalS, setSeasonalS]].map(
                    ([label, val, setter]) => (
                      <div key={label as string} className="flex-1">
                        <label className="text-xs text-slate-500 mb-1 block text-center">{label as string}</label>
                        <input type="number" min={0} max={52} value={val as number}
                          onChange={e => (setter as (v: number) => void)(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 text-center focus:border-cyan-500 focus:outline-none" />
                      </div>
                    ))}
                </div>
              </div>
            )}

            <button onClick={handleForecast} disabled={loading}
              className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-900 font-bold px-8 py-3 rounded-xl text-sm transition-all">
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Entrenando modelo...</>
                : <><TrendingUp className="w-4 h-4" /> Generar pronóstico</>}
            </button>
          </SectionCard>
        ) : null}

        {/* ── STEP 5: Results ── */}
        {forecastResult && (
          <>
            {/* Model info */}
            <div className="bg-cyan-950/30 border border-cyan-800/40 rounded-2xl p-5">
              <div className="flex flex-wrap items-center gap-3">
                <BarChart2 className="w-5 h-5 text-cyan-400" />
                <span className="text-sm font-bold text-cyan-300">
                  Modelo: {forecastResult.model_type_used}
                  ({forecastResult.arima_order.join(', ')})
                  {forecastResult.seasonal_order && ` × (${forecastResult.seasonal_order.join(', ')})`}
                </span>
                <span className={`ml-auto text-xs px-3 py-1 rounded-full font-medium ${
                  forecastResult.residual_diagnostics.is_white_noise
                    ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                    : 'bg-amber-900/60 text-amber-300 border border-amber-700'}`}>
                  {forecastResult.residual_diagnostics.is_white_noise ? '✓ Residuos OK' : '⚠ Revisar residuos'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">{forecastResult.residual_diagnostics.interpretation}</p>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <MetricCard label="RMSE" value={fmt(forecastResult.metrics.rmse)} />
              <MetricCard label="MAE" value={fmt(forecastResult.metrics.mae)} />
              <MetricCard label="MAPE" value={`${fmt(forecastResult.metrics.mape, 1)}%`}
                good={forecastResult.metrics.mape < 10} />
              <MetricCard label="AIC" value={fmt(forecastResult.metrics.aic, 0)} />
              <MetricCard label="BIC" value={fmt(forecastResult.metrics.bic, 0)} />
            </div>

            {/* Forecast chart */}
            <SectionCard title="5. Pronóstico" icon={TrendingUp}>
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={forecastChartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                  <defs>
                    <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                  <Line type="monotone" dataKey="train" stroke="#475569" strokeWidth={1.5} dot={false} name="Entrenamiento" />
                  <Line type="monotone" dataKey="actual" stroke="#06b6d4" strokeWidth={2} dot={false} name="Real (test)" />
                  <Line type="monotone" dataKey="predicted" stroke="#a78bfa" strokeWidth={2} strokeDasharray="5 3" dot={false} name="Predicho (test)" />
                  <Line type="monotone" dataKey="forecast" stroke="#f59e0b" strokeWidth={2.5} dot={false} name="Pronóstico" />
                  <Line type="monotone" dataKey="upper" stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 3" dot={false} name="IC superior" opacity={0.5} />
                  <Line type="monotone" dataKey="lower" stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 3" dot={false} name="IC inferior" opacity={0.5} />
                </LineChart>
              </ResponsiveContainer>

              {/* Forecast table */}
              <div className="mt-5 overflow-x-auto">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Tabla de pronóstico</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-800">
                      <th className="text-left py-2 pr-4 font-medium">Período</th>
                      <th className="text-right py-2 pr-4 font-medium">Pronóstico</th>
                      <th className="text-right py-2 pr-4 font-medium">IC Inferior</th>
                      <th className="text-right py-2 font-medium">IC Superior</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {forecastResult.forecast.map(p => (
                      <tr key={p.date} className="text-slate-300 hover:bg-slate-800/30 transition-colors">
                        <td className="py-2 pr-4 font-mono text-slate-400">{p.date}</td>
                        <td className="py-2 pr-4 text-right font-mono text-amber-400 font-semibold">{fmt(p.forecast)}</td>
                        <td className="py-2 pr-4 text-right font-mono text-slate-500">{fmt(p.lower_bound)}</td>
                        <td className="py-2 text-right font-mono text-slate-500">{fmt(p.upper_bound)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Download CSV */}
              <button
                onClick={() => {
  const csv = [
    'fecha,pronostico,ic_inferior,ic_superior',
    ...forecastResult.forecast.map(p =>
      `${p.date},${p.forecast.toFixed(4)},${p.lower_bound.toFixed(4)},${p.upper_bound.toFixed(4)}`
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'pronostico.csv'; a.click();
  URL.revokeObjectURL(url);
}}
                className="mt-4 flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium px-4 py-2 rounded-lg transition-colors">
                <FileText className="w-3.5 h-3.5" />
                Descargar pronóstico CSV
              </button>
            </SectionCard>
          </>
        )}
      </main>
    </div>
  );
}
