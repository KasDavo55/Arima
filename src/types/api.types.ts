/**
 * Tipos del API.
 *
 * IMPORTANTE: Estos tipos deben coincidir EXACTAMENTE con los esquemas Pydantic
 * en `backend/app/models/schemas.py`. Cualquier cambio allí debe replicarse aquí.
 */

// ============================================================
// Entrada: serie temporal
// ============================================================

export type Frequency = 'D' | 'W' | 'M' | 'Q';

export interface TimeSeriesPoint {
  date: string;  // ISO 8601, ej: '2017-01-15'
  value: number;
}

export interface TimeSeriesData {
  points: TimeSeriesPoint[];
  frequency: Frequency;
}

// ============================================================
// Análisis exploratorio
// ============================================================

export interface StationarityResult {
  statistic: number;
  p_value: number;
  is_stationary: boolean;
  critical_values: Record<string, number>;
  interpretation: string;
}

export interface DecompositionResult {
  trend: (number | null)[];
  seasonal: (number | null)[];
  residual: (number | null)[];
  dates: string[];
}

export interface AcfPacfResult {
  acf: number[];
  pacf: number[];
  confidence_interval: number;
  lags: number[];
}

export interface ExplorationResponse {
  stationarity: StationarityResult;
  decomposition: DecompositionResult;
  acf_pacf: AcfPacfResult;
  summary_stats: Record<string, number>;
}

// ============================================================
// Pronóstico
// ============================================================

export type ModelType = 'ARIMA' | 'SARIMA' | 'AUTO';

export interface ArimaOrder {
  p: number;
  d: number;
  q: number;
}

export interface SeasonalOrder {
  P: number;
  D: number;
  Q: number;
  s: number;
}

export interface ForecastRequest {
  series: TimeSeriesData;
  model_type: ModelType;
  arima_order?: ArimaOrder;
  seasonal_order?: SeasonalOrder;
  train_size: number;
  forecast_horizon: number;
  confidence_level: number;
}

export interface ForecastMetrics {
  rmse: number;
  mae: number;
  mape: number;
  aic: number;
  bic: number;
}

export interface ForecastPoint {
  date: string;
  forecast: number;
  lower_bound: number;
  upper_bound: number;
}

export interface ResidualDiagnostics {
  ljung_box_p_value: number;
  is_white_noise: boolean;
  residuals: number[];
  interpretation: string;
}

export interface ForecastResponse {
  model_type_used: string;
  arima_order: number[];
  seasonal_order: number[] | null;
  metrics: ForecastMetrics;
  train_data: TimeSeriesPoint[];
  test_data: TimeSeriesPoint[];
  test_predictions: number[];
  forecast: ForecastPoint[];
  residual_diagnostics: ResidualDiagnostics;
}
/** Resumen estadístico que se envía al recomendador de IA. */
export interface SeriesSummary {
  n_observations: number;
  frequency: string;
  date_range: [string, string];
  stats: {
    mean: number;
    std: number;
    min: number;
    max: number;
    cv: number;
  };
  adf_pvalue: number;
  trend_strength: number;
  seasonal_strength: number;
  acf_significant_lags: number[];
  missing_pct: number;
}

/** Respuesta del agente de IA con la recomendación de modelo. */
export interface RecommendationResponse {
  recommended_model: 'ARIMA' | 'SARIMA' | 'NONE';
  suggested_params: {
    p: number;
    d: number;
    q: number;
    P: number;
    D: number;
    Q: number;
    s: number;
  };
  confidence: 'alta' | 'media' | 'baja';
  reasoning: string;
}