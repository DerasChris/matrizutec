import { useState, useEffect, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { QRCodeCanvas } from 'qrcode.react';
import {
  QrCode, FileBarChart, RefreshCw, KeyRound, Printer,
  Download, AlertTriangle, Plus, Search, Users, Maximize2, Minimize2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { obtenerTodosLosCiclos } from '../../services/ciclosService';
import { obtenerClasesDelCiclo, obtenerLaboratorios } from '../../services/clasesService';
import {
  obtenerDocentes, generarPinUnico, guardarPinDocente,
  obtenerAsistenciasDelCiclo,
} from '../../services/asistenciaService';
import { ROLES, TIPOS_CLASE } from '../../lib/constants';

const DIA_CORTO = {
  lunes: 'Lu', martes: 'Ma', miercoles: 'Mi',
  jueves: 'Ju', viernes: 'Vi', sabado: 'Sá', domingo: 'Do',
};

const NOMBRE_REVISAR = 'REVISAR';

export default function GestionAsistencia() {
  const { perfil } = useAuth();
  const esEncargado = perfil?.rol === ROLES.ENCARGADO;
  const labsAsignadosSet = esEncargado ? new Set(perfil?.labsAsignados || []) : null;

  const [tab, setTab] = useState('pins');
  const [ciclos, setCiclos] = useState([]);
  const [cicloId, setCicloId] = useState('');
  const [labs, setLabs] = useState([]);
  const [clases, setClases] = useState([]);
  const [docentes, setDocentes] = useState([]);
  const [asistencias, setAsistencias] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([obtenerTodosLosCiclos(), obtenerLaboratorios()]).then(([c, l]) => {
      setCiclos(c);
      setLabs(labsAsignadosSet ? l.filter(lab => labsAsignadosSet.has(lab.id)) : l);
      const activo = c.find(x => x.activo);
      if (activo) setCicloId(activo.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cicloId) return;
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cicloId]);

  async function cargar() {
    setCargando(true);
    try {
      const [clasesData, docentesData, asistData] = await Promise.all([
        obtenerClasesDelCiclo(cicloId),
        obtenerDocentes(),
        obtenerAsistenciasDelCiclo(cicloId),
      ]);
      const clasesEnAlcance = labsAsignadosSet
        ? clasesData.filter(c => labsAsignadosSet.has(c.labId))
        : clasesData;
      setClases(clasesEnAlcance);
      setDocentes(docentesData);
      setAsistencias(labsAsignadosSet ? asistData.filter(a => labsAsignadosSet.has(a.labId)) : asistData);
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar datos de asistencia');
    } finally {
      setCargando(false);
    }
  }

  const cicloSeleccionado = ciclos.find(c => c.id === cicloId) || null;
  const labMap = useMemo(() => Object.fromEntries(labs.map(l => [l.id, l])), [labs]);

  if (cargando && labs.length === 0 && !cicloId) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-utec-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-6 pt-6 pb-4 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Asistencia docente</h1>
            <p className="text-sm text-gray-500 mt-0.5">QR por laboratorio + PIN de 4 dígitos, sin firma</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={cicloId}
              onChange={e => setCicloId(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-utec-primary"
            >
              {ciclos.map(c => (
                <option key={c.id} value={c.id}>{c.nombre} {c.anio}{c.activo ? ' ★' : ''}</option>
              ))}
            </select>
            <button
              onClick={cargar}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
              title="Actualizar"
            >
              <RefreshCw size={15} className={cargando ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {labs.length === 0 && (
        <div className="m-6 bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <p className="text-amber-900 font-medium mb-1">Todavía no tienes laboratorios asignados</p>
          <p className="text-sm text-amber-800">Pide a la jefa que te asigne uno o más desde Gestión de usuarios.</p>
        </div>
      )}

      {labs.length > 0 && (
        <>
          <div className="px-6 border-b border-gray-200 bg-white flex gap-1 shrink-0">
            {[
              { id: 'pins', label: 'PINs de docentes', icon: KeyRound },
              { id: 'qr', label: 'Generar QR', icon: QrCode },
              { id: 'reportes', label: 'Reportes', icon: FileBarChart },
            ].map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    tab === t.id
                      ? 'border-utec-primary text-utec-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={14} /> {t.label}
                </button>
              );
            })}
          </div>

          <div className="p-6 flex-1">
            {tab === 'pins' && (
              <TabPins clases={clases} docentes={docentes} labMap={labMap} onGuardado={cargar} />
            )}
            {tab === 'qr' && (
              <TabQR labs={labs} />
            )}
            {tab === 'reportes' && (
              <TabReportes
                asistencias={asistencias}
                labMap={labMap}
                cicloNombre={cicloSeleccionado?.nombre || ''}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Pestaña: PINs de docentes
// ─────────────────────────────────────────────────────────────────

function TabPins({ clases, docentes, labMap, onGuardado }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroLab, setFiltroLab] = useState('');
  const [guardandoId, setGuardandoId] = useState(null);
  const [manualAbierto, setManualAbierto] = useState(false);
  const [manualNombre, setManualNombre] = useState('');
  const [manualPin, setManualPin] = useState('');
  const [guardandoManual, setGuardandoManual] = useState(false);
  const [asignandoTodos, setAsignandoTodos] = useState(false);
  const [progreso, setProgreso] = useState({ hecho: 0, total: 0 });

  const docentesPorNombre = useMemo(
    () => Object.fromEntries(docentes.map(d => [d.nombre, d])),
    [docentes]
  );

  const revisarCount = useMemo(
    () => clases.filter(c => c.tipo === TIPOS_CLASE.REGULAR && c.activo !== false && (c.docente || '').trim().toUpperCase() === NOMBRE_REVISAR).length,
    [clases]
  );

  // Qué laboratorios da cada docente — para el filtro y la columna "Labs".
  const labsPorDocente = useMemo(() => {
    const map = {};
    for (const c of clases) {
      if (c.tipo !== TIPOS_CLASE.REGULAR) continue;
      if (c.activo === false) continue;
      const nombre = (c.docente || '').trim();
      if (!nombre || nombre.toUpperCase() === NOMBRE_REVISAR) continue;
      if (!map[nombre]) map[nombre] = new Set();
      map[nombre].add(c.labId);
    }
    return map;
  }, [clases]);

  const nombresDistintos = useMemo(() => {
    const set = new Set();
    for (const nombre of Object.keys(labsPorDocente)) set.add(nombre);
    // Incluye también docentes ya registrados aunque ya no tengan clase activa este ciclo
    for (const d of docentes) {
      if (d.activo !== false) set.add(d.nombre);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [labsPorDocente, docentes]);

  const filas = nombresDistintos
    .filter(n => !busqueda.trim() || n.toLowerCase().includes(busqueda.toLowerCase()))
    .filter(n => !filtroLab || labsPorDocente[n]?.has(filtroLab));

  async function asignarPin(nombre, pinExistente = null, docenteId = null) {
    setGuardandoId(nombre);
    try {
      const pin = generarPinUnico(docentes, docenteId);
      await guardarPinDocente({ id: docenteId, nombre, pin });
      toast.success(`PIN ${pinExistente ? 'regenerado' : 'asignado'} para ${nombre}: ${pin}`);
      onGuardado();
    } catch (e) {
      console.error(e);
      toast.error('Error al guardar el PIN');
    } finally {
      setGuardandoId(null);
    }
  }

  const sinPinCount = filas.filter(n => !docentesPorNombre[n]).length;

  async function asignarPinATodos() {
    const pendientes = nombresDistintos.filter(n => !docentesPorNombre[n]);
    if (pendientes.length === 0) { toast('Todos los docentes ya tienen PIN'); return; }
    setAsignandoTodos(true);
    setProgreso({ hecho: 0, total: pendientes.length });
    let docentesSimulados = [...docentes];
    let errores = 0;
    for (const nombre of pendientes) {
      try {
        const pin = generarPinUnico(docentesSimulados);
        await guardarPinDocente({ nombre, pin });
        docentesSimulados = [...docentesSimulados, { nombre, pin, activo: true }];
      } catch (e) {
        console.error(e);
        errores++;
      }
      setProgreso(p => ({ ...p, hecho: p.hecho + 1 }));
    }
    setAsignandoTodos(false);
    toast.success(`PIN asignado a ${pendientes.length - errores} docente(s)${errores ? `, ${errores} con error` : ''}`);
    onGuardado();
  }

  async function guardarManual(e) {
    e.preventDefault();
    if (!manualNombre.trim()) { toast.error('Escribe el nombre del docente'); return; }
    if (!/^\d{4}$/.test(manualPin)) { toast.error('El PIN debe ser de 4 dígitos'); return; }
    const enUso = docentes.some(d => d.activo !== false && d.pin === manualPin);
    if (enUso) { toast.error('Ese PIN ya está en uso por otro docente'); return; }
    setGuardandoManual(true);
    try {
      await guardarPinDocente({ nombre: manualNombre.trim(), pin: manualPin });
      toast.success(`PIN asignado a ${manualNombre.trim()}`);
      setManualNombre(''); setManualPin(''); setManualAbierto(false);
      onGuardado();
    } catch (e) {
      console.error(e);
      toast.error('Error al guardar');
    } finally {
      setGuardandoManual(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        El nombre se toma tal cual aparece en la carga académica — debe coincidir exacto para que el
        escaneo encuentre la clase. Si necesitas registrar un nombre que no aparece en la lista
        (por ejemplo para corregir una clase marcada <strong>REVISAR</strong>), usa "Agregar manual".
      </p>

      {revisarCount > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-500" />
          <p>
            <strong>{revisarCount}</strong> {revisarCount === 1 ? 'clase tiene' : 'clases tienen'} docente
            marcado como "REVISAR" — corrígelas primero desde Gestión de carga para que puedan recibir PIN
            por su nombre real.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-44">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar docente…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-utec-primary"
          />
        </div>
        <select
          value={filtroLab}
          onChange={e => setFiltroLab(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-utec-primary"
        >
          <option value="">Todos los labs</option>
          {Object.values(labMap).map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
        <button
          onClick={() => setManualAbierto(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
        >
          <Plus size={14} /> Agregar manual
        </button>
        <button
          onClick={asignarPinATodos}
          disabled={asignandoTodos || sinPinCount === 0}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-utec-primary text-utec-primary rounded-lg hover:bg-utec-light disabled:opacity-50 disabled:border-gray-300 disabled:text-gray-400"
        >
          {asignandoTodos ? (
            <>
              <RefreshCw size={14} className="animate-spin" /> Asignando {progreso.hecho}/{progreso.total}…
            </>
          ) : (
            <>
              <Users size={14} /> Asignar PIN a todos{sinPinCount > 0 ? ` (${sinPinCount})` : ''}
            </>
          )}
        </button>
      </div>

      {manualAbierto && (
        <form onSubmit={guardarManual} className="flex items-end gap-2 flex-wrap bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre exacto del docente</label>
            <input
              type="text"
              value={manualNombre}
              onChange={e => setManualNombre(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Como debe quedar en la clase"
            />
          </div>
          <div className="w-28">
            <label className="block text-xs font-medium text-gray-600 mb-1">PIN (4 dígitos)</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={manualPin}
              onChange={e => setManualPin(e.target.value.replace(/\D/g, ''))}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono"
              placeholder="0000"
            />
          </div>
          <button
            type="submit"
            disabled={guardandoManual}
            className="px-4 py-2 text-sm font-medium text-white bg-utec-primary rounded-lg hover:bg-utec-dark disabled:opacity-50"
          >
            Guardar
          </button>
        </form>
      )}

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Docente</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Laboratorios</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">PIN</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filas.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">Sin docentes para mostrar</td></tr>
            )}
            {filas.map(nombre => {
              const docente = docentesPorNombre[nombre];
              const cargandoFila = guardandoId === nombre;
              const labsDelDocente = [...(labsPorDocente[nombre] || [])];
              return (
                <tr key={nombre} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-900">{nombre}</td>
                  <td className="px-4 py-2.5">
                    {labsDelDocente.length === 0 ? (
                      <span className="text-gray-400 italic">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {labsDelDocente.map(labId => (
                          <span
                            key={labId}
                            className="text-[10px] font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded"
                          >
                            {labMap[labId]?.nombre || labId}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-gray-700">
                    {docente ? docente.pin : <span className="text-gray-400 font-sans italic">Sin asignar</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => asignarPin(nombre, docente?.pin, docente?.id)}
                      disabled={cargandoFila}
                      className="px-3 py-1.5 text-xs font-medium text-utec-primary border border-utec-primary rounded-lg hover:bg-utec-light disabled:opacity-50"
                    >
                      {cargandoFila ? 'Generando…' : docente ? 'Regenerar' : 'Asignar PIN'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Pestaña: Generar QR
// ─────────────────────────────────────────────────────────────────

function TabQR({ labs }) {
  const canvasRefs = useRef({});
  const fullscreenRef = useRef(null);
  const esBuildOnpremise = import.meta.env.BASE_URL !== '/';
  // BASE_URL incluye el subpath del deploy (ej. "/laboratorios/" en IIS) —
  // sin esto, el QR generado desde el build on-premise apunta a una URL
  // que no resuelve, porque la app solo está montada bajo ese subpath.
  const baseUrl = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '');
  const [labPantallaCompleta, setLabPantallaCompleta] = useState(null);

  function urlAsistencia(labId) {
    return `${baseUrl}/asistencia/${labId}`;
  }

  function imprimir(labsAImprimir) {
    const bloques = labsAImprimir.map(lab => {
      const canvas = canvasRefs.current[lab.id];
      const dataUrl = canvas ? canvas.toDataURL('image/png') : '';
      return `
        <div class="qr-card">
          <h2>${lab.nombre}</h2>
          <img src="${dataUrl}" width="260" height="260" />
          <p class="url">${urlAsistencia(lab.id)}</p>
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>QR de asistencia</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; padding: 16px; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
  .qr-card { border: 1px solid #ddd; border-radius: 12px; padding: 20px; text-align: center; page-break-inside: avoid; }
  .qr-card h2 { margin: 0 0 12px; font-size: 18px; color: #003366; }
  .qr-card img { width: 220px; height: 220px; }
  .qr-card .url { font-size: 10px; color: #888; margin-top: 10px; word-break: break-all; }
  @media print { @page { margin: 12mm; } }
</style></head>
<body>
  <div class="grid">${bloques}</div>
  <script>window.onload = () => window.print();</script>
</body></html>`;

    const win = window.open('', '_blank', 'width=900,height=1000');
    if (!win) { toast.error('Permite popups para imprimir'); return; }
    win.document.write(html);
    win.document.close();
  }

  useEffect(() => {
    if (!labPantallaCompleta) return;
    fullscreenRef.current?.requestFullscreen?.().catch(() => {});
    function onFsChange() {
      if (!document.fullscreenElement) setLabPantallaCompleta(null);
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [labPantallaCompleta]);

  function cerrarPantallaCompleta() {
    if (document.fullscreenElement) document.exitFullscreen();
    setLabPantallaCompleta(null);
  }

  const labEnPantalla = labs.find(l => l.id === labPantallaCompleta);

  return (
    <div className="space-y-4">
      {esBuildOnpremise && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
          <QrCode size={16} className="flex-shrink-0 mt-0.5 text-blue-500" />
          <p>
            Los QR se están generando con la URL <strong>{baseUrl}</strong> (dominio institucional).
            Verifica que sea la dirección correcta antes de imprimir y pegar los QR en los laboratorios.
          </p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Cada QR es fijo por laboratorio — imprímelo una vez y pégalo en el lab.</p>
        <button
          onClick={() => imprimir(labs)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-utec-primary rounded-lg hover:bg-utec-dark"
        >
          <Printer size={15} /> Imprimir todos
        </button>
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        {labs.map(lab => (
          <div key={lab.id} className="w-48 border border-gray-200 rounded-xl p-4 text-center bg-white">
            <p className="text-sm font-semibold text-gray-900 mb-3">{lab.nombre}</p>
            <QRCodeCanvas
              value={urlAsistencia(lab.id)}
              size={160}
              level="M"
              ref={el => { canvasRefs.current[lab.id] = el; }}
            />
            <p className="text-[10px] text-gray-400 mt-2 break-all">{urlAsistencia(lab.id)}</p>
            <div className="flex flex-col gap-1.5 mt-3">
              <button
                onClick={() => setLabPantallaCompleta(lab.id)}
                className="flex items-center justify-center gap-1 text-xs px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
              >
                <Maximize2 size={13} /> Pantalla completa
              </button>
              <button
                onClick={() => imprimir([lab])}
                className="flex items-center justify-center gap-1 text-xs px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
              >
                <Printer size={13} /> Imprimir
              </button>
            </div>
          </div>
        ))}
      </div>

      {labEnPantalla && (
        <div
          ref={fullscreenRef}
          className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center gap-6 p-8"
        >
          <button
            onClick={cerrarPantallaCompleta}
            className="absolute top-6 right-6 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
          >
            <Minimize2 size={16} /> Salir
          </button>
          <p className="text-2xl font-bold text-utec-primary">{labEnPantalla.nombre}</p>
          <QRCodeCanvas value={urlAsistencia(labEnPantalla.id)} size={420} level="M" />
          <p className="text-sm text-gray-400 break-all">{urlAsistencia(labEnPantalla.id)}</p>
          <button
            onClick={() => imprimir([labEnPantalla])}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-utec-primary rounded-lg hover:bg-utec-dark"
          >
            <Printer size={15} /> Imprimir
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Pestaña: Reportes
// ─────────────────────────────────────────────────────────────────

function TabReportes({ asistencias, labMap, cicloNombre }) {
  const [filtroLab, setFiltroLab] = useState('');
  const [filtroDocente, setFiltroDocente] = useState('');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');

  const filtradas = useMemo(() => {
    return asistencias
      .filter(a => !filtroLab || a.labId === filtroLab)
      .filter(a => !filtroDocente.trim() || a.docente?.toLowerCase().includes(filtroDocente.toLowerCase()))
      .filter(a => !filtroDesde || a.fecha >= filtroDesde)
      .filter(a => !filtroHasta || a.fecha <= filtroHasta)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  }, [asistencias, filtroLab, filtroDocente, filtroDesde, filtroHasta]);

  function exportar() {
    if (filtradas.length === 0) { toast.error('No hay registros para exportar'); return; }
    const filas = filtradas.map(a => ({
      Fecha: a.fecha,
      Día: a.diaSemana,
      Laboratorio: labMap[a.labId]?.nombre || a.labId,
      Código: a.codigoAsignatura,
      Materia: a.nombreAsignatura,
      Sección: a.seccion,
      Docente: a.docente,
      'Hora programada': `${a.horaInicio}-${a.horaFin}`,
      'Hora marcado': a.horaMarcado,
      'Alumnos llegaron': a.alumnosLlegaron,
      Inscritos: a.inscritos,
      Estado: a.fueraDeHorario ? 'Fuera de horario' : 'En horario',
    }));
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');
    XLSX.writeFile(wb, `asistencia_${(cicloNombre || 'ciclo').replace(/\s+/g, '_')}.xlsx`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={filtroLab}
          onChange={e => setFiltroLab(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
        >
          <option value="">Todos los labs</option>
          {Object.values(labMap).map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
        <input
          type="text"
          placeholder="Buscar docente…"
          value={filtroDocente}
          onChange={e => setFiltroDocente(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white min-w-40"
        />
        <input
          type="date"
          value={filtroDesde}
          onChange={e => setFiltroDesde(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
        />
        <span className="text-gray-400 text-sm">a</span>
        <input
          type="date"
          value={filtroHasta}
          onChange={e => setFiltroHasta(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
        />
        <button
          onClick={exportar}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
        >
          <Download size={14} /> Exportar Excel
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Fecha', 'Lab', 'Materia', 'Sección', 'Docente', 'Horario', 'Marcado', 'Alumnos', 'Estado'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtradas.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400 text-sm">Sin registros de asistencia</td></tr>
            )}
            {filtradas.map(a => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 whitespace-nowrap text-gray-700">{a.fecha} <span className="text-gray-400">({DIA_CORTO[a.diaSemana] || a.diaSemana})</span></td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-700">{labMap[a.labId]?.nombre || a.labId}</td>
                <td className="px-3 py-2 text-gray-900 max-w-xs truncate" title={a.nombreAsignatura}>{a.nombreAsignatura}</td>
                <td className="px-3 py-2 text-gray-600">{a.seccion}</td>
                <td className="px-3 py-2 text-gray-700">{a.docente}</td>
                <td className="px-3 py-2 whitespace-nowrap font-mono text-gray-700">{a.horaInicio}–{a.horaFin}</td>
                <td className="px-3 py-2 whitespace-nowrap font-mono text-gray-500">{a.horaMarcado}</td>
                <td className="px-3 py-2 text-center text-gray-700">{a.alumnosLlegaron}/{a.inscritos}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {a.fueraDeHorario ? (
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                      Marcó fuera de horario
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                      En horario
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
