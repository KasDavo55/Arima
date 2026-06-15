export interface ColumnReport {
  name: string;
  nullCount: number;
  nonNumericCount: number;
}

export interface QualityReport {
  totalRows: number;
  duplicateRows: number;
  columns: ColumnReport[];
  hasIssues: boolean;
}

export function analyzeQuality(
  rows: Record<string, unknown>[],
  numericColumns: string[],
): QualityReport {
  const columns: ColumnReport[] = numericColumns.map((col) => {
    const values = rows.map((r) => r[col]);
    return {
      name: col,
      nullCount: values.filter(
        (v) => v === null || v === '' || v === undefined,
      ).length,
      nonNumericCount: values.filter(
        (v) => v !== null && v !== '' && v !== undefined && isNaN(Number(v)),
      ).length,
    };
  });

  // Duplicados por contenido completo de fila
  const seen = new Set<string>();
  let duplicateRows = 0;
  for (const row of rows) {
    const key = JSON.stringify(row);
    if (seen.has(key)) duplicateRows++;
    else seen.add(key);
  }

  const hasIssues =
    duplicateRows > 0 ||
    columns.some((c) => c.nullCount > 0 || c.nonNumericCount > 0);

  return { totalRows: rows.length, duplicateRows, columns, hasIssues };
}