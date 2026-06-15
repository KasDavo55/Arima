import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import type { QualityReport } from '../utils/dataQuality';

export type NullStrategy = 'mean' | 'median' | 'drop' | 'zero';

export interface CleaningChoices {
  nullStrategy: NullStrategy;
  removeDuplicates: boolean;
}

interface Props {
  report: QualityReport;
  onApply: (choices: CleaningChoices) => void;
}

export function DataCleaningPanel({ report, onApply }: Props) {
  const [choices, setChoices] = useState<CleaningChoices>({
    nullStrategy: 'median',
    removeDuplicates: true,
  });

  if (!report.hasIssues) {
    return (
      <div className="flex items-center gap-2 p-4 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-emerald-300">
        <CheckCircle2 className="w-5 h-5" />
        <span className="text-sm">No se detectaron anomalías. Los datos están listos.</span>
      </div>
    );
  }

  const totalNulls = report.columns.reduce((a, c) => a + c.nullCount, 0);
  const totalNonNum = report.columns.reduce((a, c) => a + c.nonNumericCount, 0);

  return (
    <div className="space-y-4 p-5 bg-amber-950/20 border border-amber-800/40 rounded-2xl">
      <div className="flex items-center gap-2 text-amber-300">
        <AlertTriangle className="w-5 h-5" />
        <h3 className="text-sm font-semibold">Se detectaron anomalías en los datos</h3>
      </div>

      <ul className="text-xs text-slate-400 space-y-1">
        {totalNulls > 0 && <li>• {totalNulls} valores nulos o faltantes</li>}
        {totalNonNum > 0 && <li>• {totalNonNum} valores no numéricos</li>}
        {report.duplicateRows > 0 && <li>• {report.duplicateRows} filas duplicadas</li>}
      </ul>

      {totalNulls > 0 && (
        <div>
          <label className="text-xs text-slate-400 uppercase tracking-wider mb-1.5 block">
            ¿Cómo tratar los valores faltantes?
          </label>
          <select
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
            value={choices.nullStrategy}
            onChange={(e) =>
              setChoices({ ...choices, nullStrategy: e.target.value as NullStrategy })
            }
          >
            <option value="median">Rellenar con la mediana (recomendado)</option>
            <option value="mean">Rellenar con la media</option>
            <option value="zero">Rellenar con cero</option>
            <option value="drop">Eliminar las filas afectadas</option>
          </select>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          className="accent-cyan-500"
          checked={choices.removeDuplicates}
          onChange={(e) =>
            setChoices({ ...choices, removeDuplicates: e.target.checked })
          }
        />
        Eliminar filas duplicadas
      </label>

      <button
        onClick={() => onApply(choices)}
        className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
      >
        <Sparkles className="w-4 h-4" />
        Aplicar limpieza y continuar
      </button>
    </div>
  );
}