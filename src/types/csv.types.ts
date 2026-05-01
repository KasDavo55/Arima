/**
 * Tipos para el manejo de datos CSV en el proyecto ARIMA/SARIMA.
 *
 * Estos tipos son agnósticos a la fuente de datos: hoy se cargan desde un CSV,
 * en el futuro pueden venir de una API o BD sin necesidad de cambiar los consumidores.
 */

/**
 * Representa una fila genérica del CSV.
 * Las claves son los nombres de las columnas (encabezados) y los valores
 * pueden ser string o number (PapaParse puede inferir tipos numéricos).
 */
export type CsvRow = Record<string, string | number | null>;

/**
 * Resultado del parseo exitoso de un archivo CSV.
 */
export interface CsvParseResult {
  /** Nombres de las columnas en el orden en que aparecen en el archivo. */
  headers: string[];
  /** Filas del CSV como objetos clave-valor. */
  rows: CsvRow[];
  /** Total de registros leídos (sin contar la cabecera). */
  totalRows: number;
  /** Nombre del archivo original. */
  fileName: string;
}

/**
 * Estado del proceso de carga/parseo del CSV.
 * Útil para que la UI muestre estados de loading, éxito o error.
 */
export type CsvLoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: CsvParseResult }
  | { status: 'error'; message: string };

/**
 * Configuración opcional para el parser de CSV.
 * Permite ajustar el comportamiento sin modificar la lógica interna.
 */
export interface CsvParserOptions {
  /** Si true, la primera fila se trata como cabecera. Default: true */
  header?: boolean;
  /** Si true, intenta convertir valores numéricos. Default: true */
  dynamicTyping?: boolean;
  /** Si true, omite líneas vacías. Default: true */
  skipEmptyLines?: boolean;
  /** Delimitador personalizado (auto-detectado por defecto). */
  delimiter?: string;
}

/**
 * Interfaz que cualquier proveedor de datos debe implementar.
 * Esto permite intercambiar fácilmente CSV por API/BD en el futuro.
 */
export interface DataSourceProvider {
  loadData: (source: File | string) => Promise<CsvParseResult>;
}
