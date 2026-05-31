import { useState, useRef } from 'react';
import { X, Upload, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Loader } from 'lucide-react';
import { parsearExcelClases } from '../../utils/excelImporter';
import { importarClases } from '../../services/clasesService';
import toast from 'react-hot-toast';

const FASES = { UPLOAD: 'upload', VALIDACION: 'validacion', IMPORTANDO: 'importando', EXITO: 'exito' };

export default function ImportarClasesModal({ ciclo, clasesExistentes, onClose, onImportado }) {
  const [fase, setFase] = useState(FASES.UPLOAD);
  const [resultado, setResultado] = useState(null);
  const [erroresExpandidos, setErroresExpandidos] = useState(false);
  const [archivoNombre, setArchivoNombre] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  async function procesarArchivo(file) {
    if (!file) return;
    if (!file.name.endsWith('.xlsx')) {
      toast.error('Solo se aceptan archivos .xlsx');
      return;
    }
    setArchivoNombre(file.name);
    const buffer = await file.arrayBuffer();
    try {
      const res = parsearExcelClases(buffer, ciclo.id);
      setResultado(res);
      setFase(FASES.VALIDACION);
    } catch (err) {
      toast.error(err.message);
    }
  }

  function handleFileInput(e) {
    procesarArchivo(e.target.files?.[0]);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    procesarArchivo(e.dataTransfer.files?.[0]);
  }

  async function confirmarImportacion() {
    if (!resultado?.validas?.length) return;
    setFase(FASES.IMPORTANDO);
    try {
      const stats = await importarClases(ciclo.id, resultado.validas);
      setFase(FASES.EXITO);
      toast.success(`${stats.importadas} clases importadas correctamente.`);
      onImportado(stats);
    } catch (err) {
      toast.error('Error al importar: ' + err.message);
      setFase(FASES.VALIDACION);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Importar carga académica</h2>
            <p className="text-sm text-gray-500 mt-0.5">{ciclo.nombre}</p>
          </div>
          {fase !== FASES.IMPORTANDO && (
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
              <X size={20} />
            </button>
          )}
        </div>

        <div className="p-6">
          {/* FASE: UPLOAD */}
          {fase === FASES.UPLOAD && (
            <div>
              <button
                type="button"
                className={`w-full border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                  dragOver
                    ? 'border-utec-primary bg-utec-light'
                    : 'border-gray-300 hover:border-utec-primary hover:bg-gray-50'
                }`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
              >
                <Upload size={36} className="mx-auto text-gray-400 mb-3" />
                <p className="text-sm font-medium text-gray-700">
                  Arrastra tu archivo Excel aquí, o haz clic para seleccionar
                </p>
                <p className="text-xs text-gray-500 mt-1">Solo archivos .xlsx generados con el template</p>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          )}

          {/* FASE: VALIDACION */}
          {fase === FASES.VALIDACION && resultado && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Archivo: <span className="font-medium text-gray-700">{archivoNombre}</span>
              </p>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-gray-700">{resultado.total}</p>
                  <p className="text-xs text-gray-500">Total filas</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-green-700">{resultado.validas.length}</p>
                  <p className="text-xs text-green-600">Válidas</p>
                </div>
                <div className={`rounded-lg p-3 ${resultado.errores.length > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <p className={`text-2xl font-bold ${resultado.errores.length > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                    {resultado.errores.length}
                  </p>
                  <p className={`text-xs ${resultado.errores.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    Con errores
                  </p>
                </div>
              </div>

              {resultado.errores.length > 0 && (
                <div className="border border-red-200 rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 bg-red-50 text-sm font-medium text-red-700"
                    onClick={() => setErroresExpandidos(v => !v)}
                  >
                    <span className="flex items-center gap-2">
                      <AlertTriangle size={16} />
                      Ver {resultado.errores.length} {resultado.errores.length === 1 ? 'fila con error' : 'filas con errores'}
                    </span>
                    {erroresExpandidos ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {erroresExpandidos && (
                    <div className="max-h-48 overflow-y-auto divide-y divide-red-100">
                      {resultado.errores.map((e, i) => (
                        <div key={i} className="px-4 py-2 text-xs">
                          <p className="font-medium text-gray-700">
                            Fila {e.fila} — {e.referencia}
                          </p>
                          <ul className="mt-1 list-disc list-inside text-red-600 space-y-0.5">
                            {e.errores.map((msg, j) => <li key={j}>{msg}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {clasesExistentes > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                  <p>
                    Se eliminarán las <strong>{clasesExistentes}</strong> clases existentes en este
                    ciclo y se reemplazarán con las {resultado.validas.length} nuevas.
                  </p>
                </div>
              )}

              {resultado.validas.length === 0 && (
                <p className="text-sm text-red-600 text-center">
                  No hay filas válidas para importar. Corrige los errores en el archivo.
                </p>
              )}

              <div className="flex justify-between gap-3 pt-2">
                <button
                  onClick={() => { setFase(FASES.UPLOAD); setResultado(null); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cambiar archivo
                </button>
                <button
                  onClick={confirmarImportacion}
                  disabled={resultado.validas.length === 0}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-utec-primary rounded-lg hover:bg-utec-dark disabled:opacity-40"
                >
                  <Upload size={16} />
                  Importar {resultado.validas.length} clases
                </button>
              </div>
            </div>
          )}

          {/* FASE: IMPORTANDO */}
          {fase === FASES.IMPORTANDO && (
            <div className="py-8 text-center space-y-3">
              <Loader size={36} className="mx-auto text-utec-primary animate-spin" />
              <p className="text-sm font-medium text-gray-700">Importando clases...</p>
              <p className="text-xs text-gray-500">Esto puede tomar unos segundos</p>
            </div>
          )}

          {/* FASE: ÉXITO */}
          {fase === FASES.EXITO && (
            <div className="py-8 text-center space-y-4">
              <CheckCircle size={48} className="mx-auto text-green-500" />
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {resultado?.validas?.length} clases importadas
                </p>
                <p className="text-sm text-gray-500 mt-1">La carga académica está lista.</p>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2 text-sm font-medium text-white bg-utec-primary rounded-lg hover:bg-utec-dark"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
