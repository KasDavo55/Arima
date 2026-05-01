import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Upload, FileText, X } from 'lucide-react';

interface FileUploaderProps {
  /** Callback que se ejecuta cuando el usuario selecciona un archivo válido. */
  onFileSelected: (file: File) => void;
  /** Estado de carga externo (controlado por el hook). */
  isLoading?: boolean;
  /** Nombre del archivo actualmente cargado (si existe). */
  currentFileName?: string | null;
  /** Callback para limpiar el archivo cargado. */
  onReset?: () => void;
  /** Tipos de archivo aceptados. Default: .csv */
  accept?: string;
}

/**
 * Componente de carga de archivos con soporte para drag & drop.
 *
 * Es un componente PURO de UI: no parsea archivos, solo notifica al padre
 * mediante callback cuando se selecciona uno.
 */
export const FileUploader = ({
  onFileSelected,
  isLoading = false,
  currentFileName = null,
  onReset,
  accept = '.csv',
}: FileUploaderProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
    // Reset input para permitir cargar el mismo archivo dos veces
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      onFileSelected(file);
    }
  };

  const handleClick = (): void => {
    inputRef.current?.click();
  };

  // Si ya hay un archivo cargado, mostramos el "chip" con opción de remover
  if (currentFileName && !isLoading) {
    return (
      <div className="flex items-center justify-between p-4 bg-emerald-50 border-2 border-emerald-200 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-md">
            <FileText className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">{currentFileName}</p>
            <p className="text-xs text-emerald-700">Archivo cargado correctamente</p>
          </div>
        </div>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-white rounded-md transition-colors"
            aria-label="Eliminar archivo"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative flex flex-col items-center justify-center
        w-full p-10 border-2 border-dashed rounded-lg cursor-pointer
        transition-all duration-200
        ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-slate-100'
        }
        ${isLoading ? 'pointer-events-none opacity-60' : ''}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={isLoading}
      />

      <div
        className={`p-3 rounded-full mb-3 transition-colors ${
          isDragging ? 'bg-blue-100' : 'bg-white'
        }`}
      >
        <Upload
          className={`w-6 h-6 ${
            isDragging ? 'text-blue-600' : 'text-slate-500'
          }`}
        />
      </div>

      <p className="text-sm font-medium text-slate-700 mb-1">
        {isLoading
          ? 'Procesando archivo...'
          : isDragging
          ? 'Suelta el archivo aquí'
          : 'Haz clic o arrastra un archivo CSV'}
      </p>
      <p className="text-xs text-slate-500">
        Formatos soportados: {accept.toUpperCase()} · Máx. 50 MB
      </p>
    </div>
  );
};
