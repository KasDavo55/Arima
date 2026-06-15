import type {
  ExplorationResponse,
  SeriesSummary,
  TimeSeriesData,
} from '../types/api.types';

/** Varianza de un arreglo, ignorando nulls. */
function variance(arr: (number | null)[]): number {
  const v = arr.filter((x): x is number => x !== null);
  if (v.length === 0) return 0;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  return v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length;
}

/**
 * Construye el resumen estadístico que se envía al recomendador de IA,
 * a partir del análisis exploratorio que ya devuelve el backend.
 */
export function buildSummary(
  exploration: ExplorationResponse,
  data: TimeSeriesData,
): SeriesSummary {
  const values = data.points.map((p) => p.value);
  const dates = data.points.map((p) => p.date);

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const std = Math.sqrt(
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length,
  );

  // --- Fuerza de tendencia y estacionalidad (método estándar de descomposición) ---
  // strength = max(0, 1 - var(residuo) / var(residuo + componente))
  const { trend, seasonal, residual } = exploration.decomposition;

  const varResid = variance(residual);

  const detrended = residual.map((r, i) =>
    r !== null && trend[i] !== null ? r + (trend[i] as number) : null,
  );
  const trendStrength = Math.max(0, 1 - varResid / (variance(detrended) || 1));

  const deseasonal = residual.map((r, i) =>
    r !== null && seasonal[i] !== null ? r + (seasonal[i] as number) : null,
  );
  const seasonalStrength = Math.max(0, 1 - varResid / (variance(deseasonal) || 1));

  // --- Lags significativos del ACF (los que superan la banda de confianza) ---
  const { acf, confidence_interval, lags } = exploration.acf_pacf;
  const significantLags = lags.filter(
    (_, i) => Math.abs(acf[i]) > confidence_interval,
  );

  return {
    n_observations: values.length,
    frequency: data.frequency,
    date_range: [dates[0], dates[dates.length - 1]],
    stats: {
      mean,
      std,
      min: Math.min(...values),
      max: Math.max(...values),
      cv: std / mean,
    },
    adf_pvalue: exploration.stationarity.p_value,
    trend_strength: Number(trendStrength.toFixed(3)),
    seasonal_strength: Number(seasonalStrength.toFixed(3)),
    acf_significant_lags: significantLags,
    missing_pct: 0,
  };
}