/**
 * Utilidad para agregar datos crudos del CSV en una serie temporal.
 *
 * El CSV tiene 10,000 filas con múltiples ventas por día.
 * ARIMA/SARIMA requieren una observación por período → hay que agregar.
 */
import type { CsvRow } from '../types/csv.types';
import type { Frequency, TimeSeriesPoint } from '../types/api.types';

export type AggregationMethod = 'sum' | 'mean' | 'count';

export interface AggregationOptions {
  dateColumn: string;
  valueColumn: string;
  frequency: Frequency;
  method: AggregationMethod;
  /** Filtros opcionales: { Category: 'Furniture', Region: 'West' } */
  filters?: Record<string, string>;
}

/**
 * Parsea una fecha soportando múltiples formatos:
 * - ISO 8601: "2017-11-08", "2017-11-08T00:00:00"
 * - Europeo: "08/11/2017", "08-11-2017" (dd/mm/yyyy)
 * - Americano: "11/08/2017" (mm/dd/yyyy) — solo si el europeo no aplica
 *
 * Devuelve null si no se puede parsear.
 */
export function parseFlexibleDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).trim();

  // Intento 1: ISO 8601 (yyyy-mm-dd o yyyy/mm/dd)
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (!isNaN(date.getTime())) return date;
  }

  // Intento 2: dd/mm/yyyy o dd-mm-yyyy (formato europeo, común en LATAM)
  const euMatch = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (euMatch) {
    const [, d, m, y] = euMatch;
    const dayN = Number(d);
    const monN = Number(m);
    // Si el "día" es > 12, definitivamente es dd/mm/yyyy
    // Si el "mes" es > 12, debe ser mm/dd (americano), reintentamos abajo
    if (dayN <= 31 && monN <= 12) {
      const date = new Date(Number(y), monN - 1, dayN);
      if (!isNaN(date.getTime())) return date;
    }
    // Fallback americano: mm/dd/yyyy
    if (dayN <= 12 && monN <= 31) {
      const date = new Date(Number(y), dayN - 1, monN);
      if (!isNaN(date.getTime())) return date;
    }
  }

  // Intento 3: dejar que Date intente parsearlo (último recurso)
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) return fallback;

  return null;
}

/**
 * Convierte una fecha al inicio de su período según la frecuencia.
 */
function getPeriodKey(date: Date, frequency: Frequency): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  switch (frequency) {
    case 'D': {
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    case 'W': {
      const d = new Date(date);
      const dayOfWeek = d.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      d.setDate(d.getDate() + diff);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    case 'M': {
      return `${year}-${String(month + 1).padStart(2, '0')}-01`;
    }
    case 'Q': {
      const quarterStart = Math.floor(month / 3) * 3;
      return `${year}-${String(quarterStart + 1).padStart(2, '0')}-01`;
    }
  }
}

/**
 * Heurística: ¿esta cadena podría ser un identificador (ID) y no una fecha?
 * Casos: "CG-12520", "FUR-BO-10001798", "CA-2017-152156" — tienen guiones y letras.
 */
function looksLikeIdentifier(value: string): boolean {
  // Tiene letras → no es solo número/fecha
  if (/[a-zA-Z]/.test(value)) return true;
  return false;
}

/**
 * Detecta automáticamente columnas que parecen contener fechas REALES.
 * Mejorado: ignora identificadores con letras, requiere que MAYORÍA de la
 * muestra parsee como fecha válida usando parseFlexibleDate.
 */
export function detectDateColumns(rows: CsvRow[], headers: string[]): string[] {
  if (rows.length === 0) return [];

  const sample = rows.slice(0, Math.min(50, rows.length));

  return headers.filter((header) => {
    let validCount = 0;
    let totalNonEmpty = 0;

    for (const row of sample) {
      const value = row[header];
      if (value === null || value === undefined || value === '') continue;
      totalNonEmpty++;

      const str = String(value);
      // Si parece un ID (tiene letras Y guiones tipo CA-2017-XXX), descartamos
      if (looksLikeIdentifier(str)) continue;

      const parsed = parseFlexibleDate(str);
      if (parsed) validCount++;
    }

    if (totalNonEmpty === 0) return false;
    return validCount / totalNonEmpty > 0.8;
  });
}

/**
 * Detecta columnas numéricas REALES.
 * Mejorado: excluye columnas cuyo nombre sugiera un ID (Row ID, Customer ID,
 * Postal Code, etc.) aunque sean numéricas, porque agregar IDs no tiene sentido.
 */
export function detectNumericColumns(rows: CsvRow[], headers: string[]): string[] {
  if (rows.length === 0) return [];

  // Patrones de nombres que NO deberían tratarse como métricas numéricas
  const ID_LIKE_PATTERNS = [
    /\bid\b/i,
    /\bcode\b/i,
    /postal/i,
    /zip/i,
    /\brow\b/i,
    /phone/i,
    /\bnumber\b/i,
    /barcode/i,
    /sku/i,
  ];

  const sample = rows.slice(0, Math.min(50, rows.length));

  return headers.filter((header) => {
    // 1) Si el nombre parece un ID, lo excluimos
    if (ID_LIKE_PATTERNS.some((re) => re.test(header))) return false;

    // 2) Que la mayoría de los valores sean numéricos
    let validCount = 0;
    let totalNonEmpty = 0;

    for (const row of sample) {
      const value = row[header];
      if (value === null || value === undefined || value === '') continue;
      totalNonEmpty++;
      if (typeof value === 'number' && !isNaN(value)) validCount++;
    }

    if (totalNonEmpty === 0) return false;
    return validCount / totalNonEmpty > 0.7;
  });
}

/**
 * Devuelve los valores únicos de una columna (para construir filtros).
 * Mejorado: limita la cantidad para columnas con demasiados valores únicos
 * (ej: Order ID con 5000 valores no sirve como filtro).
 */
export function getUniqueValues(
  rows: CsvRow[],
  column: string,
  maxValues = 200,
): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const value = row[column];
    if (value !== null && value !== undefined && value !== '') {
      set.add(String(value));
      if (set.size > maxValues) return []; // demasiados → no sirve como filtro
    }
  }
  return Array.from(set).sort();
}

/**
 * Detecta columnas categóricas útiles para filtrar.
 * Una buena columna categórica tiene entre 2 y 50 valores únicos.
 */
export function detectCategoricalColumns(
  rows: CsvRow[],
  headers: string[],
  excludeColumns: string[],
): string[] {
  if (rows.length === 0) return [];

  return headers.filter((header) => {
    if (excludeColumns.includes(header)) return false;

    // Patrones a excluir por nombre: IDs, nombres únicos, fechas
    const EXCLUDE_PATTERNS = [
      /\bid\b/i,
      /\bname\b/i,
      /\bdate\b/i,
      /postal/i,
      /\bcode\b/i,
      /address/i,
      /product\s*name/i,
    ];
    if (EXCLUDE_PATTERNS.some((re) => re.test(header))) return false;

    // Contar valores únicos hasta un máximo razonable
    const unique = new Set<string>();
    for (const row of rows) {
      const value = row[header];
      if (value !== null && value !== undefined && value !== '') {
        unique.add(String(value));
        if (unique.size > 50) return false; // demasiados → probablemente no es categórica
      }
    }

    // Buena columna categórica: entre 2 y 50 valores únicos
    return unique.size >= 2 && unique.size <= 50;
  });
}

/**
 * Agrega filas crudas en una serie temporal.
 */
export function aggregateToTimeSeries(
  rows: CsvRow[],
  options: AggregationOptions,
): TimeSeriesPoint[] {
  const { dateColumn, valueColumn, frequency, method, filters = {} } = options;

  // 1. Aplicar filtros
  const filtered = rows.filter((row) => {
    for (const [col, value] of Object.entries(filters)) {
      if (String(row[col]) !== value) return false;
    }
    return true;
  });

  // 2. Agrupar por período
  const groups = new Map<string, number[]>();

  for (const row of filtered) {
    const dateValue = row[dateColumn];
    const numValue = row[valueColumn];

    if (dateValue === null || dateValue === undefined) continue;

    // Convertir el valor: aceptar número o string parseable
    let n: number;
    if (typeof numValue === 'number' && !isNaN(numValue)) {
      n = numValue;
    } else if (typeof numValue === 'string') {
      const parsed = parseFloat(numValue.replace(',', '.'));
      if (isNaN(parsed)) continue;
      n = parsed;
    } else {
      continue;
    }

    const date = parseFlexibleDate(dateValue);
    if (!date) continue;

    const key = getPeriodKey(date, frequency);
    const existing = groups.get(key);
    if (existing) {
      existing.push(n);
    } else {
      groups.set(key, [n]);
    }
  }

  // 3. Aplicar función de agregación
  const points: TimeSeriesPoint[] = Array.from(groups.entries()).map(
    ([date, values]) => {
      let aggregated: number;
      switch (method) {
        case 'sum':
          aggregated = values.reduce((a, b) => a + b, 0);
          break;
        case 'mean':
          aggregated = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case 'count':
          aggregated = values.length;
          break;
      }
      return { date, value: aggregated };
    },
  );

  // 4. Ordenar por fecha
  points.sort((a, b) => a.date.localeCompare(b.date));

  return points;
}
