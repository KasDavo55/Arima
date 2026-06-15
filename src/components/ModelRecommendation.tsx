import { Sparkles } from 'lucide-react';
import type { RecommendationResponse } from '../types/api.types';

interface Props {
  recommendation: RecommendationResponse | null;
  loading: boolean;
}

export function ModelRecommendation({ recommendation, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-2xl p-5 flex items-center gap-3">
        <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
        <span className="text-sm text-indigo-300">Consultando al recomendador de IA…</span>
      </div>
    );
  }

  if (!recommendation) return null;

  const confColor =
    recommendation.confidence === 'alta'
      ? 'text-emerald-400'
      : recommendation.confidence === 'media'
      ? 'text-amber-400'
      : 'text-slate-400';

  return (
    <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-2xl p-5 space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-indigo-400" />
        <h3 className="text-sm font-semibold text-indigo-300">Recomendación de la IA</h3>
      </div>
      <p className="text-lg font-bold text-white">
        Modelo sugerido: {recommendation.recommended_model}
        <span className={`ml-2 text-xs font-normal ${confColor}`}>
          (confianza: {recommendation.confidence})
        </span>
      </p>
      <p className="text-sm text-slate-400">{recommendation.reasoning}</p>
    </div>
  );
}