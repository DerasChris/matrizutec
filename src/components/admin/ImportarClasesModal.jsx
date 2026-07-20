import { useState, useRef, useMemo } from 'react';
import { X, Upload, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Loader, Table2, FileSpreadsheet, GraduationCap, ArrowRight } from 'lucide-react';
import { parsearExcelClases, parsearExcelUTEC } from '../../utils/excelImporter';
import { analizarImport, ejecutarImport, guardarSnapshotCarga } from '../../services/clasesService';
import toast from 'react-hot-toast';

const FASES = {
  UPLOAD: 'upload',
  VALIDACION: 'validacion',
  ANALIZANDO: 'analizando',
  CONFLICTOS: 'conflictos',
  IMPORTANDO: 'importando',
  EXITO: 'exito',
};

const DIAS_CORTO = { lunes: 'L', martes: 'M', miercoles: 'X', jueves: 'J', viernes: 'V', sabado: 'S', domingo: 'D' };

function fmtDias(dias) {
  if (!Array.isArray(dias)) return '—';
  return dias.map(d => DIAS_CORTO[d] ?? d[0].toUpperCase()).join('');
}

const FORMATOS = [
  {
    id: 'estandar',
    label: 'Template estándar',
    desc: 'Formato propio del sistema. Columnas separadas para Hora inicio/fin y días completos.',
    icon: FileSpreadsheet,
    hint: 'Template estándar — el sistema detecta nombres de columna alternativos automáticamente',
  },
  {
    id: 'utec-basico',
    label: 'UTEC — Reporte básico',
    desc: 'Columnas: Escuela, CodMat, Nombre, Docente, Sección, Hora, Dias, Inscritos, Aula.',
    icon: GraduationCap,
    hint: 'Formato UTEC básico — Hora: 06:30-08:00 · Dias: Lu-Ma-Mie · Aula: BJ-LAB.3',
  },
  {
    id: 'utec-completo',
    label: 'UTEC — Reporte completo',
    desc: 'Igual que el básico + CodEmp, Cupo, Disponible, Estado. Filtra automáticamente clases "Cerrado" y aulas virtuales.',
    icon: GraduationCap,
    hint: 'Formato UTEC completo — filtra Estado=Cerrado, AULA VIRTUAL y EN LINEA automáticamente',
  },
];

const IDENTITY_KEY = c => `${c.labId}|${c.codigoAsignatura}|${c.seccion}`;

const DIAS_LABEL = { lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom' };
function fmtDiasLargo(dias) {
  if (!Array.isArray(dias)) return '—';
  return dias.map(d => DIAS_LABEL[d] ?? d).join(', ');
}

export default function ImportarClasesModal({ ciclo, clasesExistentes, perfil, onClose, onImportado }) {
  const [fase, setFase] = useState(FASES.UPLOAD);
  const [formato, setFormato] = useState('estandar');
  const [resultado, setResultado] = useState(null);
  const [analisis, setAnalisis] = useState(null);
  const [decisions, setDecisions] = useState({});
  const [erroresExpandidos, setErroresExpandidos] = useState(false);
  const [previstaAbierta, setPrevistaAbierta] = useState(false);
  const [archivos, setArchivos] = useState([]); // [{ nombre, total, validas, errores }]
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  // Agrupar conflictos por clase importada
  const conflictGroups = useMemo(() => {
    if (!analisis?.conflictos?.length) return [];
    const groups = new Map();
    for (const c of analisis.conflictos) {
      const key = IDENTITY_KEY(c.claseImportada);
      if (!groups.has(key)) groups.set(key, { key, claseImportada: c.claseImportada, conflictosCon: [] });
      groups.get(key).conflictosCon.push(c.claseExistente);
    }
    return Array.from(groups.values());
  }, [analisis]);

  // Acepta uno o varios archivos y fusiona sus resultados en un solo análisis.
  // Necesario cuando un laboratorio aparece en más de un reporte (p. ej. un
  // lab compartido por dos escuelas): si se importaran por separado, el
  // segundo archivo desactivaría las clases del primero en ese lab, porque
  // el alcance de la sincronización es "los labs presentes en el Excel".
  // Al fusionar antes de analizar, todas las clases de esos labs están
  // presentes a la vez y nada se pisa entre sí.
  async function procesarArchivos(fileList) {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;

    const invalidos = files.filter(f => !f.name.endsWith('.xlsx'));
    if (invalidos.length) {
      toast.error(`Solo se aceptan archivos .xlsx: ${invalidos.map(f => f.name).join(', ')}`);
      return;
    }

    const parser = formato === 'estandar' ? parsearExcelClases : parsearExcelUTEC;
    const porArchivo = [];
    const validas = [];
    const errores = [];
    let total = 0;
    let omitidas = 0;
    const desglose = { cerradas: 0, virtuales: 0, aulasRegulares: 0 };

    try {
      for (const file of files) {
        const buffer = await file.arrayBuffer();
        const res = parser(buffer, ciclo.id);
        validas.push(...res.validas);
        errores.push(...res.errores.map(e => ({ ...e, archivo: file.name })));
        total += res.total;
        omitidas += res.omitidas || 0;
        desglose.cerradas += res.desglose?.cerradas || 0;
        desglose.virtuales += res.desglose?.virtuales || 0;
        desglose.aulasRegulares += res.desglose?.aulasRegulares || 0;
        porArchivo.push({ nombre: file.name, total: res.total, validas: res.validas.length, errores: res.errores.length });
      }
    } catch (err) {
      toast.error(err.message);
      return;
    }

    setArchivos(porArchivo);
    setResultado({ validas, errores, total, omitidas, desglose });
    setFase(FASES.VALIDACION);
  }

  function handleFileInput(e) { procesarArchivos(e.target.files); }
  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    procesarArchivos(e.dataTransfer.files);
  }

  async function confirmarImportacion() {
    if (!resultado?.validas?.length) return;
    setFase(FASES.ANALIZANDO);
    try {
      const a = await analizarImport(ciclo.id, resultado.validas);
      setAnalisis(a);
      if (a.conflictos.length > 0) {
        // Decisión por defecto: omitir (conservar existente)
        const defs = {};
        a.conflictos.forEach(c => { defs[IDENTITY_KEY(c.claseImportada)] = 'omitir'; });
        setDecisions(defs);
        setFase(FASES.CONFLICTOS);
      } else {
        await procederConImport(a, {});
      }
    } catch (err) {
      toast.error('Error al analizar: ' + err.message);
      setFase(FASES.VALIDACION);
    }
  }

  async function procederConImport(a, resolvedDecisions) {
    setFase(FASES.IMPORTANDO);
    try {
      if (clasesExistentes > 0) {
        await guardarSnapshotCarga(ciclo.id, ciclo.nombre, perfil);
      }
      // Filtrar clases nuevas omitidas por el usuario
      const omitirKeys = new Set(
        Object.entries(resolvedDecisions).filter(([, d]) => d === 'omitir').map(([k]) => k)
      );
      const toCreateFinal = (a || analisis).toCreate.filter(c => !omitirKeys.has(IDENTITY_KEY(c)));
      const stats = await ejecutarImport(ciclo.id, {
        toUpdate: (a || analisis).toUpdate,
        toCreate: toCreateFinal,
        toDeactivate: (a || analisis).toDeactivate,
      });
      setResultado(r => ({ ...r, stats, omitidas: omitirKeys.size }));
      setFase(FASES.EXITO);
      onImportado(stats);
    } catch (err) {
      toast.error('Error al importar: ' + err.message);
      setFase(FASES.VALIDACION);
    }
  }

  function setDecision(key, decision) {
    setDecisions(d => ({ ...d, [key]: decision }));
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Importar carga académica</h2>
            <p className="text-sm text-gray-500 mt-0.5">{ciclo.nombre}</p>
          </div>
          {fase !== FASES.IMPORTANDO && (
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={20} /></button>
          )}
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* ── UPLOAD ── */}
          {fase === FASES.UPLOAD && (
            <div className="space-y-4">
              {/* Selector de formato */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Formato del archivo</p>
                <div className="grid grid-cols-3 gap-2">
                  {FORMATOS.map(f => {
                    const Icon = f.icon;
                    const activo = formato === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFormato(f.id)}
                        className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-all ${
                          activo
                            ? 'border-utec-primary bg-utec-light'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Icon size={14} className={activo ? 'text-utec-primary' : 'text-gray-400'} />
                          <span className={`text-xs font-semibold leading-tight ${activo ? 'text-utec-primary' : 'text-gray-700'}`}>
                            {f.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 leading-snug">{f.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Zona de carga */}
              <button
                type="button"
                className={`w-full border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                  dragOver ? 'border-utec-primary bg-utec-light' : 'border-gray-300 hover:border-utec-primary hover:bg-gray-50'
                }`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
              >
                <Upload size={36} className="mx-auto text-gray-400 mb-3" />
                <p className="text-sm font-medium text-gray-700">Arrastra tus archivos Excel aquí, o haz clic para seleccionar</p>
                <p className="text-xs text-gray-500 mt-1">
                  Puedes seleccionar varios a la vez — se fusionan en un solo análisis (útil si un laboratorio aparece en más de un reporte)
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {FORMATOS.find(f => f.id === formato)?.hint}
                </p>
              </button>
              <input ref={inputRef} type="file" accept=".xlsx" multiple className="hidden" onChange={handleFileInput} />
            </div>
          )}

          {/* ── VALIDACION ── */}
          {fase === FASES.VALIDACION && resultado && (() => {
            const pendientesDocenteCount = resultado.validas.filter(v => v.motivosRevision?.includes('docente')).length;
            const pendientesModuloCount = resultado.validas.filter(v => v.motivosRevision?.includes('modulo')).length;
            return (
            <div className="space-y-4">
              <div className="text-sm text-gray-500">
                {archivos.length === 1 ? (
                  <p>Archivo: <span className="font-medium text-gray-700">{archivos[0].nombre}</span></p>
                ) : (
                  <>
                    <p className="mb-1">{archivos.length} archivos fusionados en un solo análisis:</p>
                    <ul className="space-y-0.5">
                      {archivos.map(a => (
                        <li key={a.nombre} className="flex justify-between gap-2 text-xs">
                          <span className="truncate font-medium text-gray-700">{a.nombre}</span>
                          <span className="text-gray-400 shrink-0">{a.validas} válidas{a.errores > 0 ? `, ${a.errores} con error` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              {/* Contadores */}
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
                  <p className={`text-xs ${resultado.errores.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>Con errores</p>
                </div>
              </div>

              {/* Banner de filas omitidas (solo formato UTEC) */}
              {resultado.omitidas > 0 && (() => {
                const partes = [];
                if (resultado.desglose?.aulasRegulares > 0) partes.push(`${resultado.desglose.aulasRegulares} en aulas/talleres que no son laboratorio`);
                if (resultado.desglose?.virtuales > 0) partes.push(`${resultado.desglose.virtuales} virtuales/en línea`);
                if (resultado.desglose?.cerradas > 0) partes.push(`${resultado.desglose.cerradas} cerradas`);
                return (
                  <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-600">
                    <span className="text-gray-400 mt-0.5 shrink-0">ⓘ</span>
                    <p>
                      Se omitieron <strong>{resultado.omitidas}</strong> {resultado.omitidas === 1 ? 'fila' : 'filas'} que no aplican al sistema de laboratorios
                      {partes.length > 0 && ` (${partes.join(', ')})`}.
                    </p>
                  </div>
                );
              })()}

              {/* Errores */}
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
                          <p className="font-medium text-gray-700">{e.archivo ? `${e.archivo} — ` : ''}Fila {e.fila} — {e.referencia}</p>
                          <ul className="mt-1 list-disc list-inside text-red-600 space-y-0.5">
                            {e.errores.map((msg, j) => <li key={j}>{msg}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Vista previa de datos */}
              {resultado.validas.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    onClick={() => setPrevistaAbierta(v => !v)}
                  >
                    <span className="flex items-center gap-2">
                      <Table2 size={15} />
                      Vista previa de datos ({resultado.validas.length} clases)
                    </span>
                    {previstaAbierta ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {previstaAbierta && (
                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            {['Lab', 'Código', 'Materia', 'Sección', 'Docente', 'Días', 'Horario'].map(h => (
                              <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap border-b border-gray-200">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {resultado.validas.map((c, i) => {
                            const revisarDocente = c.motivosRevision?.includes('docente');
                            const revisarModulo = c.motivosRevision?.includes('modulo');
                            return (
                            <tr key={i} className="hover:bg-gray-50">
                              <td
                                className={`px-3 py-1.5 whitespace-nowrap font-mono ${revisarModulo ? 'text-amber-600 font-semibold' : 'text-gray-700'}`}
                                title={revisarModulo ? c.observaciones : undefined}
                              >
                                {c.labId}{revisarModulo ? ' ⚠' : ''}
                              </td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-gray-700 font-medium">{c.codigoAsignatura}</td>
                              <td className="px-3 py-1.5 text-gray-700 max-w-[180px] truncate" title={c.nombreAsignatura}>{c.nombreAsignatura}</td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-gray-700">{c.seccion}</td>
                              <td
                                className={`px-3 py-1.5 max-w-[120px] truncate font-medium ${revisarDocente ? 'text-amber-600' : 'text-gray-600'}`}
                                title={revisarDocente ? 'Sin docente — pendiente de revisión' : c.docente}
                              >
                                {revisarDocente ? '⚠ REVISAR' : c.docente}
                              </td>
                              <td className="px-3 py-1.5 whitespace-nowrap font-mono text-gray-700">{fmtDias(c.diasSemana)}</td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-gray-700">{c.horaInicio}–{c.horaFin}</td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Aviso fusión */}
              {clasesExistentes > 0 && (
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-blue-500" />
                  <p>
                    Hay <strong>{clasesExistentes}</strong> clases en este ciclo. Solo se sincronizan
                    los laboratorios que aparecen en este Excel — las clases de otros labs
                    se conservan intactas. Se guardará un snapshot para poder restaurar si es necesario.
                  </p>
                </div>
              )}

              {/* Banner de clases pendientes de revisión */}
              {pendientesDocenteCount > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-500" />
                  <p>
                    <strong>{pendientesDocenteCount} {pendientesDocenteCount === 1 ? 'clase sin docente' : 'clases sin docente'}</strong> — se importarán marcadas como "⚠ REVISAR". El encargado podrá completar el nombre al editar cada clase desde la matriz.
                  </p>
                </div>
              )}

              {/* Banner de módulos de Lab 03 sin confirmar */}
              {pendientesModuloCount > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-500" />
                  <p>
                    <strong>{pendientesModuloCount} {pendientesModuloCount === 1 ? 'clase de Lab 03' : 'clases de Lab 03'}</strong> sin módulo especificado en el reporte — se importarán sin módulo asignado y con una sugerencia en observaciones. El encargado debe confirmar el módulo (M1–M4) al editar cada clase.
                  </p>
                </div>
              )}

              {resultado.validas.length === 0 && (
                <p className="text-sm text-red-600 text-center">No hay filas válidas para importar. Corrige los errores en el archivo.</p>
              )}

              <div className="flex justify-between gap-3 pt-2">
                <button
                  onClick={() => { setFase(FASES.UPLOAD); setResultado(null); setArchivos([]); setPrevistaAbierta(false); setErroresExpandidos(false); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cambiar archivos
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
          );
          })()}

          {/* ── ANALIZANDO ── */}
          {fase === FASES.ANALIZANDO && (
            <div className="py-10 text-center space-y-3">
              <Loader size={36} className="mx-auto text-utec-primary animate-spin" />
              <p className="text-sm font-medium text-gray-700">Analizando conflictos de horario...</p>
              <p className="text-xs text-gray-500">Comparando contra las clases activas del ciclo</p>
            </div>
          )}

          {/* ── CONFLICTOS ── */}
          {fase === FASES.CONFLICTOS && analisis && (() => {
            const importarCount = conflictGroups.filter(g => decisions[g.key] === 'importar').length;
            const omitirCount   = conflictGroups.filter(g => decisions[g.key] !== 'importar').length;
            const noConflictoCreate = (analisis.toCreate.length - conflictGroups.length);
            const totalAImportar = analisis.toUpdate.length + noConflictoCreate + importarCount;

            return (
              <div className="space-y-4">
                {/* Cabecera */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-amber-700 flex items-center gap-1.5">
                      <AlertTriangle size={16} /> {conflictGroups.length} conflicto{conflictGroups.length !== 1 ? 's' : ''} de horario detectado{conflictGroups.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Las siguientes clases nuevas chocan con horarios ya existentes. Decide qué hacer con cada una.
                    </p>
                  </div>
                  {/* Acciones masivas */}
                  <div className="flex gap-1.5 shrink-0 ml-3">
                    <button
                      onClick={() => { const d = {}; conflictGroups.forEach(g => { d[g.key] = 'omitir'; }); setDecisions(d); }}
                      className="text-xs px-2 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100"
                    >
                      Omitir todas
                    </button>
                    <button
                      onClick={() => { const d = {}; conflictGroups.forEach(g => { d[g.key] = 'importar'; }); setDecisions(d); }}
                      className="text-xs px-2 py-1 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50"
                    >
                      Importar todas
                    </button>
                  </div>
                </div>

                {/* Tarjetas de conflicto */}
                <div className="space-y-3 max-h-[52vh] overflow-y-auto pr-1">
                  {conflictGroups.map(group => {
                    const dec = decisions[group.key] || 'omitir';
                    const ci = group.claseImportada;
                    return (
                      <div key={group.key} className={`border rounded-xl overflow-hidden transition-colors ${dec === 'importar' ? 'border-amber-300' : 'border-gray-200'}`}>
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{ci.labId} · Nueva clase</p>
                          <p className="text-sm font-bold text-gray-800 mt-0.5">{ci.nombreAsignatura} <span className="font-normal text-gray-500">· Sec. {ci.seccion}</span></p>
                          <p className="text-xs text-gray-500 mt-0.5">{fmtDiasLargo(ci.diasSemana)} · {ci.horaInicio}–{ci.horaFin} · {ci.docente}</p>
                        </div>

                        <div className="px-4 py-2 bg-red-50/50 border-b border-gray-200">
                          <p className="text-xs font-medium text-red-700 mb-1">Choca con {group.conflictosCon.length === 1 ? 'esta clase existente' : `estas ${group.conflictosCon.length} clases existentes`}:</p>
                          {group.conflictosCon.map((ce, i) => (
                            <div key={i} className="text-xs text-red-600 py-0.5 flex items-start gap-1.5">
                              <ArrowRight size={11} className="mt-0.5 shrink-0" />
                              <span><strong>{ce.nombreAsignatura}</strong> Sec. {ce.seccion} · {fmtDiasLargo(ce.diasSemana)} · {ce.horaInicio}–{ce.horaFin}</span>
                            </div>
                          ))}
                        </div>

                        <div className="px-4 py-3 flex gap-2">
                          <button
                            onClick={() => setDecision(group.key, 'omitir')}
                            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all border-2 ${
                              dec === 'omitir'
                                ? 'bg-gray-800 text-white border-gray-800'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                            }`}
                          >
                            No importar esta clase
                          </button>
                          <button
                            onClick={() => setDecision(group.key, 'importar')}
                            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all border-2 ${
                              dec === 'importar'
                                ? 'bg-amber-500 text-white border-amber-500'
                                : 'bg-white text-amber-600 border-amber-200 hover:border-amber-400'
                            }`}
                          >
                            Importar de todas formas
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 pt-1 border-t border-gray-200">
                  <button
                    onClick={() => { setFase(FASES.VALIDACION); setAnalisis(null); }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Volver
                  </button>
                  <div className="flex items-center gap-3">
                    {omitirCount > 0 && (
                      <span className="text-xs text-gray-500">{omitirCount} {omitirCount === 1 ? 'clase omitida' : 'clases omitidas'}</span>
                    )}
                    <button
                      onClick={() => procederConImport(analisis, decisions)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-utec-primary rounded-lg hover:bg-utec-dark"
                    >
                      <Upload size={15} />
                      Proceder — {totalAImportar} {totalAImportar === 1 ? 'clase' : 'clases'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── IMPORTANDO ── */}
          {fase === FASES.IMPORTANDO && (
            <div className="py-8 text-center space-y-3">
              <Loader size={36} className="mx-auto text-utec-primary animate-spin" />
              <p className="text-sm font-medium text-gray-700">Importando clases...</p>
              <p className="text-xs text-gray-500">Esto puede tomar unos segundos</p>
            </div>
          )}

          {/* ── ÉXITO ── */}
          {fase === FASES.EXITO && resultado?.stats && (
            <div className="py-6 text-center space-y-4">
              <CheckCircle size={48} className="mx-auto text-green-500" />
              <p className="text-lg font-semibold text-gray-900">Carga académica actualizada</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-blue-700">{resultado.stats.actualizadas}</p>
                  <p className="text-xs text-blue-600">Actualizadas</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-green-700">{resultado.stats.creadas}</p>
                  <p className="text-xs text-green-600">Nuevas</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-gray-500">{resultado.stats.desactivadas}</p>
                  <p className="text-xs text-gray-500">Desactivadas</p>
                </div>
              </div>
              {resultado.stats.desactivadas > 0 && (
                <p className="text-xs text-gray-500">Las clases desactivadas ya no aparecen en la matriz pero se conservan en el historial.</p>
              )}
              {analisis?.preservados > 0 && (
                <p className="text-xs text-gray-500">
                  {analisis.preservados} {analisis.preservados === 1 ? 'clase de otro laboratorio quedó' : 'clases de otros laboratorios quedaron'} sin cambios.
                </p>
              )}
              {resultado.validas?.filter(v => v.pendienteRevision).length > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 text-left">
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-500" />
                  <p>
                    <strong>{resultado.validas.filter(v => v.pendienteRevision).length} clases</strong> quedaron pendientes de revisión (docente y/o módulo de Lab 03 sin especificar). El encargado las verá marcadas al editar la clase en la matriz.
                  </p>
                </div>
              )}
              <button onClick={onClose} className="px-6 py-2 text-sm font-medium text-white bg-utec-primary rounded-lg hover:bg-utec-dark">
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
