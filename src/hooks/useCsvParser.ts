import { useCallback, useState } from 'react';
import type { CsvLoadState, DataSourceProvider } from '../types/csv.types';
import { csvDataProvider } from '../utils/csvProcessor';

/**
 * Hook personalizado que encapsula la lógica de carga y parseo de CSV.
 *
 * - Mantiene el estado de carga (idle/loading/success/error).
 * - Es agnóstico al proveedor de datos: por defecto usa CSV, pero
 *   puede recibir cualquier implementación de DataSourceProvider.
 * - No contiene lógica de UI; solo expone estado y acciones.
 *
 * @param provider - Implementación del proveedor de datos. Default: csvDataProvider.
 */
export const useCsvParser = (
  provider: DataSourceProvider = csvDataProvider
) => {
  const [state, setState] = useState<CsvLoadState>({ status: 'idle' });

  /**
   * Carga y parsea un archivo. Actualiza el estado en consecuencia.
   */
  const loadFile = useCallback(
    async (file: File): Promise<void> => {
      setState({ status: 'loading' });

      try {
        const data = await provider.loadData(file);
        setState({ status: 'success', data });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Error desconocido al procesar el archivo.';
        setState({ status: 'error', message });
      }
    },
    [provider]
  );

  /**
   * Resetea el estado a inicial.
   */
  const reset = useCallback((): void => {
    setState({ status: 'idle' });
  }, []);

  return {
    state,
    loadFile,
    reset,
    // Helpers derivados para conveniencia en la UI
    isLoading: state.status === 'loading',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
    data: state.status === 'success' ? state.data : null,
    error: state.status === 'error' ? state.message : null,
  };
};
