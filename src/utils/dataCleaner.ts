import type { CleaningChoices } from '../components/DataCleaningPanel';

export function applyCleaning(
  rows: Record<string, unknown>[],
  numericColumns: string[],
  choices: CleaningChoices,
): Record<string, unknown>[] {
  let result = [...rows];

  // 1. Eliminar duplicados (fila completa idéntica)
  if (choices.removeDuplicates) {
    const seen = new Set<string>();
    result = result.filter((row) => {
      const key = JSON.stringify(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // 2. Tratar nulos en columnas numéricas
  const isMissing = (v: unknown) =>
    v === null || v === '' || v === undefined || (typeof v !== 'number' && isNaN(Number(v)));

  if (choices.nullStrategy === 'drop') {
    result = result.filter((row) =>
      numericColumns.every((col) => !isMissing(row[col])),
    );
  } else {
    for (const col of numericColumns) {
      const nums = result
        .map((r) => Number(r[col]))
        .filter((n) => !isNaN(n));

      let fill = 0;
      if (choices.nullStrategy === 'mean') {
        fill = nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
      } else if (choices.nullStrategy === 'median') {
        const sorted = [...nums].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        fill = sorted.length
          ? sorted.length % 2 !== 0
            ? sorted[mid]
            : (sorted[mid - 1] + sorted[mid]) / 2
          : 0;
      } // 'zero' deja fill = 0

      result = result.map((row) =>
        isMissing(row[col]) ? { ...row, [col]: fill } : row,
      );
    }
  }

  return result;
}