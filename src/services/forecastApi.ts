/**
 * Cliente HTTP para el backend de pronóstico.
 *
 * Encapsula todas las llamadas al API en funciones tipadas.
 * Si el día de mañana cambias el backend, solo modificas este archivo.
 */
import type {
  TimeSeriesData,
  ExplorationResponse,
  ForecastRequest,
  ForecastResponse,
  SeriesSummary,
  RecommendationResponse,
} from '../types/api.types';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

/**
 * Wrapper para fetch que maneja errores del backend de forma consistente.
 */
async function apiCall<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorMessage = `Error ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail ?? errorMessage;
    } catch {
      // Si la respuesta no es JSON, usar el statusText
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

/**
 * Solicita el análisis exploratorio: ADF, descomposición, ACF, PACF.
 */
export async function analyzeTimeSeries(
  data: TimeSeriesData,
): Promise<ExplorationResponse> {
  return apiCall<ExplorationResponse>('/exploration/analyze', data);
}

/**
 * Solicita la recomendación de modelo al agente de IA (Opus).
 * Recibe un resumen estadístico de la serie y devuelve qué modelo usar.
 */
export async function getModelRecommendation(
  summary: SeriesSummary,
): Promise<RecommendationResponse> {
  return apiCall<RecommendationResponse>('/recommend-model', { summary });
}

/**
 * Entrena el modelo y solicita el pronóstico.
 */
export async function generateForecast(
  request: ForecastRequest,
): Promise<ForecastResponse> {
  return apiCall<ForecastResponse>('/forecast', request);
}

/**
 * Verifica que el backend esté corriendo.
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}