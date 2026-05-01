import { AlertCircle } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  onDismiss?: () => void;
}

/**
 * Componente puro para mostrar mensajes de error de forma consistente.
 */
export const ErrorMessage = ({ message, onDismiss }: ErrorMessageProps) => {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg"
    >
      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-red-900">
          Error al procesar el archivo
        </p>
        <p className="text-sm text-red-700 mt-0.5">{message}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-medium text-red-700 hover:text-red-900 underline"
        >
          Cerrar
        </button>
      )}
    </div>
  );
};
