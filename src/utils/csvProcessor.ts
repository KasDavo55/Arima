import Papa, { ParseResult, ParseError } from 'papaparse';
import type {
  CsvParseResult,
  CsvParserOptions,
  CsvRow,
  DataSourceProvider,
} from '../types/csv.types';

/**
 * Opciones por defecto para el parser de CSV.
 */
const DEFAULT_OPTIONS: Required<Omit<CsvParserOptions, 'delimiter'>> = {
  header: true,
  dynamicTyping: true,
  skipEmptyLines: true,
};

/**
 * Valida que el archivo proporcionado sea un CSV válido.
 * @throws Error si el archivo no es válido.
 */
const validateFile = (file: File): void => {
  if (!file) {
    throw new Error('No se proporcionó ningún archivo.');
  }

  const validExtensions = ['.csv', '.txt'];
  const fileName = file.name.toLowerCase();
  const hasValidExtension = validExtensions.some((ext) => fileName.endsWith(ext));

  if (!hasValidExtension) {
    throw new Error(
      `Formato no soportado. Se esperaba un archivo CSV. Recibido: ${file.name}`
    );
  }

  // Límite razonable: 50 MB
  const MAX_SIZE = 50 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error(
      `El archivo excede el tamaño máximo permitido (50 MB). Tamaño actual: ${(
        file.size /
        (1024 * 1024)
      ).toFixed(2)} MB`
    );
  }
};

/**
 * Parsea un archivo CSV y devuelve un resultado estructurado.
 *
 * Esta función es PURA respecto a la UI: no conoce React.
 * Cualquier componente o hook puede consumirla.
 *
 * @param file - Archivo CSV proporcionado por el usuario.
 * @param options - Opciones de parseo (opcional).
 * @returns Promesa que resuelve con los datos parseados.
 */
export const parseCsvFile = (
  file: File,
  options: CsvParserOptions = {}
): Promise<CsvParseResult> => {
  return new Promise((resolve, reject) => {
    try {
      validateFile(file);
    } catch (err) {
      reject(err);
      return;
    }

    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

    Papa.parse<CsvRow>(file, {
      header: mergedOptions.header,
      dynamicTyping: mergedOptions.dynamicTyping,
      skipEmptyLines: mergedOptions.skipEmptyLines,
      delimiter: options.delimiter,
      complete: (results: ParseResult<CsvRow>) => {
        // PapaParse puede devolver errores no fatales; los reportamos solo si son críticos.
        const criticalErrors = results.errors.filter(
          (e: ParseError) => e.type === 'Delimiter' || e.type === 'Quotes'
        );

        if (criticalErrors.length > 0) {
          reject(
            new Error(
              `Error al parsear el CSV: ${criticalErrors[0].message} (fila ${criticalErrors[0].row})`
            )
          );
          return;
        }

        if (!results.data || results.data.length === 0) {
          reject(new Error('El archivo CSV está vacío o no contiene datos válidos.'));
          return;
        }

        const headers =
          results.meta.fields ?? Object.keys(results.data[0] as object);

        resolve({
          headers,
          rows: results.data,
          totalRows: results.data.length,
          fileName: file.name,
        });
      },
      error: (error: Error) => {
        reject(new Error(`Error al leer el archivo: ${error.message}`));
      },
    });
  });
};

/**
 * Implementación de DataSourceProvider para archivos CSV.
 *
 * Cuando en el futuro se conecte a una API o BD, basta con crear
 * otra implementación de DataSourceProvider sin tocar los consumidores.
 *
 * Ejemplo futuro:
 *   class ApiDataProvider implements DataSourceProvider { ... }
 */
export const csvDataProvider: DataSourceProvider = {
  loadData: async (source: File | string): Promise<CsvParseResult> => {
    if (!(source instanceof File)) {
      throw new Error('csvDataProvider espera un objeto File.');
    }
    return parseCsvFile(source);
  },
};

/**
 * Devuelve los primeros N registros de un dataset.
 * Útil para previsualización.
 */
export const getPreviewRows = (rows: CsvRow[], count = 5): CsvRow[] => {
  return rows.slice(0, count);
};
