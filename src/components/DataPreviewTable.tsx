import { Table2 } from 'lucide-react';
import type { CsvRow } from '../types/csv.types';

interface DataPreviewTableProps {
  /** Nombres de las columnas en el orden a mostrar. */
  headers: string[];
  /** Filas a renderizar (ya recortadas a la cantidad deseada). */
  rows: CsvRow[];
  /** Total de registros del dataset completo (para mostrar en el header). */
  totalRows: number;
  /** Cantidad de filas que se están mostrando (para el subtítulo). */
  previewCount: number;
}

/**
 * Formatea un valor de celda para presentación.
 * - null/undefined → "—"
 * - números → toLocaleString
 * - resto → string
 */
const formatCellValue = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toString() : value.toLocaleString();
  }
  return String(value);
};

/**
 * Componente puro que renderiza una tabla con previsualización de datos.
 *
 * No conoce la fuente de los datos: solo recibe headers y rows.
 * Esto permite reutilizarlo con datos de CSV, API o BD indistintamente.
 */
export const DataPreviewTable = ({
  headers,
  rows,
  totalRows,
  previewCount,
}: DataPreviewTableProps) => {
  if (headers.length === 0 || rows.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
        No hay datos para mostrar.
      </div>
    );
  }

  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      {/* Encabezado de la sección */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-md border border-slate-200">
            <Table2 className="w-4 h-4 text-slate-700" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Previsualización de datos
            </h2>
            <p className="text-xs text-slate-500">
              Mostrando {Math.min(previewCount, rows.length)} de{' '}
              {totalRows.toLocaleString()} registros · {headers.length} columnas
            </p>
          </div>
        </div>
      </header>

      {/* Tabla con scroll horizontal para datasets anchos */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-500 text-xs uppercase tracking-wider w-12">
                #
              </th>
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-4 py-3 text-left font-medium text-slate-700 text-xs uppercase tracking-wider whitespace-nowrap"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, idx) => (
              <tr
                key={idx}
                className="hover:bg-slate-50 transition-colors"
              >
                <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                  {idx + 1}
                </td>
                {headers.map((header) => (
                  <td
                    key={header}
                    className="px-4 py-3 text-slate-700 whitespace-nowrap"
                  >
                    {formatCellValue(row[header])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
