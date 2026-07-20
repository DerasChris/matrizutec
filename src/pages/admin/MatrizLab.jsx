import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, RefreshCw, Loader2, Info, ChevronLeft, ChevronRight, Printer, CalendarDays, LayoutGrid, CalendarPlus, Maximize2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { obtenerLaboratorios, obtenerCicloActivo } from '../../services/laboratoriosService';
import { ROLES, MESES, TIPOS_CLASE, colorPorCodigo } from '../../lib/constants';
import { obtenerClasesDelLabPorMes } from '../../services/clasesService';
import { obtenerReservasAprobadasFuturas } from '../../services/reservasService';
import { getMesActual, getAnioActual, isoToFecha } from '../../utils/dateHelpers';
import MatrizGrid from '../../components/admin/MatrizGrid';
import MatrizSemanal from '../../components/admin/MatrizSemanal';
import ClaseFormulario from '../../components/admin/ClaseFormulario';
import DetalleReservaModal from '../../components/admin/DetalleReservaModal';
import EventoEspecialForm from '../../components/admin/EventoEspecialForm';

// ── Helpers de impresión ─────────────────────────────────────────────────────

const DIAS_ORDEN  = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DIAS_LABEL  = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };

function generarHTMLImpresion(lab, ciclo, clases, reservas, mesLabel, anio) {
  const clasesActivas = clases.filter(c => c.activo !== false && c.tipo !== 'puntual');

  // Agrupar clases regulares por día
  const porDia = {};
  for (const dia of DIAS_ORDEN) {
    const lista = clasesActivas
      .filter(c => c.diasSemana?.includes(dia))
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    if (lista.length) porDia[dia] = lista;
  }

  const filasDias = Object.entries(porDia).map(([dia, lista]) => `
    <tr>
      <td class="dia">${DIAS_LABEL[dia]}</td>
      <td>
        ${lista.map(c => `
          <div class="clase" style="border-left: 4px solid ${c.color || colorPorCodigo(c.codigoAsignatura)}">
            <span class="hora">${c.horaInicio} – ${c.horaFin}</span>
            <span class="nombre">${c.nombreAsignatura}</span>
            <span class="meta">${c.codigoAsignatura} · Secc. ${c.seccion} · ${c.docente}</span>
            ${c.inscritos ? `<span class="meta">${c.inscritos} inscritos</span>` : ''}
          </div>
        `).join('')}
      </td>
    </tr>
  `).join('');

  // Reservas del mes
  const filasReservas = reservas.length === 0 ? '<p class="sin-datos">Sin reservas aprobadas este mes.</p>' :
    reservas.map(r => `
      <div class="clase" style="border-left: 4px solid #f59e0b">
        <span class="hora">${r.ocurrencias?.[0] || ''} · ${r.horaInicio} – ${r.horaFin}</span>
        <span class="nombre">${r.asignatura || r.motivo || 'Sin título'}</span>
        <span class="meta">${r.docenteNombre || ''}</span>
      </div>
    `).join('');

  const hoy = new Date().toLocaleDateString('es-SV', { day: '2-digit', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${lab.nombre} – ${mesLabel} ${anio}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #111; padding: 24px; }
    header { border-bottom: 2px solid #185FA5; padding-bottom: 12px; margin-bottom: 16px; }
    header h1 { font-size: 18px; color: #185FA5; }
    header p  { font-size: 11px; color: #666; margin-top: 2px; }
    h2 { font-size: 13px; color: #185FA5; margin: 20px 0 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; padding: 6px 8px; border-bottom: 1px solid #f3f4f6; }
    td.dia { width: 90px; font-weight: 700; color: #374151; padding-top: 10px; white-space: nowrap; }
    .clase { display: flex; flex-direction: column; gap: 1px; padding: 5px 8px; margin-bottom: 4px; background: #f9fafb; border-radius: 4px; }
    .hora   { font-weight: 700; color: #374151; font-size: 10px; }
    .nombre { font-weight: 600; font-size: 11px; color: #111; }
    .meta   { font-size: 9px; color: #6b7280; }
    .sin-datos { color: #9ca3af; font-style: italic; padding: 8px 0; }
    footer { margin-top: 24px; font-size: 9px; color: #9ca3af; text-align: right; }
    @media print {
      body { padding: 12px; }
      @page { margin: 10mm; size: A4 portrait; }
    }
  </style>
</head>
<body>
  <header>
    <h1>${lab.nombre}</h1>
    <p>${ciclo?.nombre || ''} · ${mesLabel} ${anio}</p>
    <p>Generado el ${hoy}</p>
  </header>

  <h2>Horario semanal recurrente</h2>
  ${filasDias ? `<table>${filasDias}</table>` : '<p class="sin-datos">Sin clases regulares registradas.</p>'}

  <h2>Reservas aprobadas — ${mesLabel} ${anio}</h2>
  ${filasReservas}

  <footer>UTEC FICA · Sistema de Gestión de Laboratorios</footer>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function MatrizLab() {
  const { perfil } = useAuth();
  const [labs, setLabs]     = useState([]);
  const [ciclo, setCiclo]   = useState(null);
  const [labSel, setLabSel] = useState(null);
  const [mes,  setMes]      = useState(getMesActual());
  const [anio, setAnio]     = useState(getAnioActual());
  const [clases, setClases] = useState([]);
  const [todasLasReservas, setTodasLasReservas] = useState([]);
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [cargandoClases,  setCargandoClases]  = useState(false);

  const [vista, setVista] = useState('mensual'); // 'mensual' | 'semanal'
  const [modoConcentracion, setModoConcentracion] = useState(false);

  const [formAbierto,    setFormAbierto]    = useState(false);
  const [claseEditando,  setClaseEditando]  = useState(null);
  const [sugerencia,     setSugerencia]     = useState(null);
  const [reservaSeleccionada, setReservaSeleccionada] = useState(null);

  const [eventoFormAbierto,  setEventoFormAbierto]  = useState(false);
  const [eventoEditando,     setEventoEditando]     = useState(null);

  useEffect(() => { cargarBase(); }, []);
  useEffect(() => { if (labSel && ciclo) cargar(); }, [labSel, ciclo, mes, anio]);

  // Salir del modo concentración con Escape
  useEffect(() => {
    if (!modoConcentracion) return;
    function onKeyDown(e) { if (e.key === 'Escape') setModoConcentracion(false); }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modoConcentracion]);

  async function cargarBase() {
    try {
      setCargandoInicial(true);
      const [labsData, cicloData] = await Promise.all([
        obtenerLaboratorios(),
        obtenerCicloActivo(),
      ]);
      const labsFiltrados =
        perfil?.rol === ROLES.ENCARGADO &&
        Array.isArray(perfil?.labsAsignados) &&
        perfil.labsAsignados.length > 0
          ? labsData.filter(l => perfil.labsAsignados.includes(l.id))
          : labsData;

      setLabs(labsFiltrados);
      setCiclo(cicloData);
      if (labsFiltrados.length > 0) setLabSel(labsFiltrados[0]);
      if (!cicloData) toast.error('No hay un ciclo activo. Crea uno desde el dashboard.');
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar laboratorios');
    } finally {
      setCargandoInicial(false);
    }
  }

  async function cargar() {
    if (!labSel || !ciclo) return;
    try {
      setCargandoClases(true);
      const [clasesData, reservasData] = await Promise.all([
        obtenerClasesDelLabPorMes(labSel.id, ciclo.id, anio, mes),
        obtenerReservasAprobadasFuturas(),
      ]);
      setClases(clasesData);
      setTodasLasReservas(reservasData);
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar datos');
    } finally {
      setCargandoClases(false);
    }
  }

  const reservasDelLabYMes = useMemo(() => {
    if (!labSel) return [];
    return todasLasReservas.filter(r => {
      if (r.labId !== labSel.id) return false;
      if (!Array.isArray(r.ocurrencias)) return false;
      return r.ocurrencias.some(f => {
        const fecha = isoToFecha(f);
        if (!fecha) return false;
        return fecha.getFullYear() === anio && (fecha.getMonth() + 1) === mes;
      });
    });
  }, [todasLasReservas, labSel, anio, mes]);

  function abrirNueva(suggested = null) {
    setClaseEditando(null);
    setSugerencia(suggested);
    setFormAbierto(true);
  }

  function abrirEditar(clase) {
    if (clase.tipo === TIPOS_CLASE.REUNION || clase.tipo === TIPOS_CLASE.DEFENSA) {
      setEventoEditando(clase);
      setEventoFormAbierto(true);
      return;
    }
    setClaseEditando(clase);
    setSugerencia(null);
    setFormAbierto(true);
  }

  function mesAnterior() {
    if (mes === 1) { setMes(12); setAnio(a => a - 1); }
    else setMes(m => m - 1);
  }

  function mesSiguiente() {
    if (mes === 12) { setMes(1); setAnio(a => a + 1); }
    else setMes(m => m + 1);
  }

  function handleImprimir() {
    if (!labSel) return;
    const html = generarHTMLImpresion(labSel, ciclo, clases, reservasDelLabYMes, mesLabel, anio);
    const win  = window.open('', '_blank', 'width=860,height=980');
    if (!win) { toast.error('Permite popups para imprimir'); return; }
    win.document.write(html);
    win.document.close();
  }

  const mesLabel       = MESES.find(m => m.num === mes)?.label || '';
  const cantidadClases = clases.length;
  const cantidadReservas = reservasDelLabYMes.length;

  if (cargandoInicial) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-12 h-12 text-utec-primary animate-spin" />
      </div>
    );
  }

  if (!ciclo) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
        <p className="text-amber-900 font-medium mb-2">No hay ciclo activo</p>
        <p className="text-sm text-amber-800">Ve al Dashboard y siembra un ciclo activo antes de crear clases.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de clases regulares</h1>
        <p className="text-gray-600 text-sm mt-1">{ciclo.nombre}</p>
      </div>

      {/* ── Barra de controles ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Selector de lab */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Laboratorio</label>
            {perfil?.rol === ROLES.ENCARGADO ? (
              <div className="flex flex-wrap gap-2">
                {labs.map(l => (
                  <button
                    key={l.id}
                    onClick={() => setLabSel(l)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      labSel?.id === l.id
                        ? 'bg-utec-primary text-white border-utec-primary'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-utec-primary hover:text-utec-primary'
                    }`}
                  >
                    {l.nombre}
                  </button>
                ))}
              </div>
            ) : (
              <select
                value={labSel?.id || ''}
                onChange={e => setLabSel(labs.find(l => l.id === e.target.value))}
                className="input-base"
              >
                {labs.map(l => (
                  <option key={l.id} value={l.id}>{l.nombre}{l.tieneModulos ? ' (con módulos)' : ''}</option>
                ))}
              </select>
            )}
          </div>

          {/* Navegación de mes (solo vista mensual) */}
          {vista === 'mensual' && (
            <div className="flex items-end gap-1">
              <button onClick={mesAnterior} className="px-2 py-2 border border-gray-300 rounded-lg hover:bg-gray-50" title="Mes anterior">
                <ChevronLeft size={16} />
              </button>
              <div className="min-w-[160px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Mes</label>
                <select value={mes} onChange={e => setMes(parseInt(e.target.value))} className="input-base">
                  {MESES.map(m => <option key={m.num} value={m.num}>{m.label} {anio}</option>)}
                </select>
              </div>
              <button onClick={mesSiguiente} className="px-2 py-2 border border-gray-300 rounded-lg hover:bg-gray-50" title="Mes siguiente">
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Toggle vista */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vista</label>
            <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setVista('mensual')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  vista === 'mensual' ? 'bg-white text-utec-primary shadow-sm' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <LayoutGrid size={13} /> Mensual
              </button>
              <button
                onClick={() => setVista('semanal')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  vista === 'semanal' ? 'bg-white text-utec-primary shadow-sm' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <CalendarDays size={13} /> Semanal
              </button>
            </div>
          </div>

          <button
            onClick={cargar}
            disabled={cargandoClases}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 text-sm"
          >
            <RefreshCw size={14} className={cargandoClases ? 'animate-spin' : ''} />
            Actualizar
          </button>

          <button
            onClick={() => setModoConcentracion(true)}
            disabled={!labSel}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 text-sm text-gray-700 disabled:opacity-40"
            title="Pantalla completa — navega con el cursor (arrastrar para desplazar)"
          >
            <Maximize2 size={14} />
            Modo concentración
          </button>

          {/* Botón imprimir — disponible para encargados o cuando hay lab seleccionado */}
          {labSel && (
            <button
              onClick={handleImprimir}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 text-sm text-gray-700"
              title="Imprimir horario del laboratorio"
            >
              <Printer size={14} />
              Imprimir
            </button>
          )}

          <button
            onClick={() => abrirNueva()}
            className="px-4 py-2 bg-utec-primary text-white rounded-lg hover:bg-utec-dark flex items-center gap-1.5 text-sm font-medium"
          >
            <Plus size={16} /> Nueva clase
          </button>

          <button
            onClick={() => { setEventoEditando(null); setEventoFormAbierto(true); }}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 flex items-center gap-1.5 text-sm font-medium"
          >
            <CalendarPlus size={16} /> Evento especial
          </button>
        </div>
      </div>

      {/* ── Info banner ── */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-start gap-2 text-sm">
        <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-blue-900">
          <p>
            <strong>{labSel?.nombre}</strong>
            {vista === 'mensual' ? ` · ${mesLabel} ${anio} — Click y arrastra sobre celdas vacías para crear. Click en clase para editar.` : ' · Vista semanal — Click en clase para editar.'}
          </p>
          <div className="flex gap-3 mt-1 text-xs">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 bg-blue-700 rounded" /> Clase regular
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 bg-amber-400 rounded" /> Reserva aprobada
            </span>
          </div>
        </div>
      </div>

      {/* ── Contenido ── */}
      {labSel && (
        <>
          {cargandoClases ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <Loader2 className="w-8 h-8 text-utec-primary animate-spin mx-auto mb-2" />
              <p className="text-gray-600 text-sm">Cargando datos...</p>
            </div>
          ) : vista === 'mensual' ? (
            <MatrizGrid
              lab={labSel}
              clases={clases}
              reservas={reservasDelLabYMes}
              anio={anio}
              mes={mes}
              onCrearClase={abrirNueva}
              onEditarClase={abrirEditar}
              onClickReserva={r => setReservaSeleccionada(r)}
            />
          ) : (
            <MatrizSemanal
              clases={clases}
              reservas={todasLasReservas.filter(r => r.labId === labSel.id)}
              onClaseClick={abrirEditar}
            />
          )}

          <p className="text-center text-xs text-gray-500 mt-3">
            {cantidadClases === 0 && cantidadReservas === 0
              ? `Sin actividad en ${labSel.nombre}${vista === 'mensual' ? ` para ${mesLabel}` : ''}.`
              : `${cantidadClases} clase${cantidadClases === 1 ? '' : 's'} · ${cantidadReservas} reserva${cantidadReservas === 1 ? '' : 's'} aprobada${cantidadReservas === 1 ? '' : 's'}${vista === 'mensual' ? ` en ${mesLabel}` : ''}`}
          </p>
        </>
      )}

      {/* ── Modo concentración: pantalla completa ── */}
      {modoConcentracion && labSel && (
        <div className="fixed inset-0 z-40 bg-white flex flex-col">
          <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-200 shrink-0 flex-wrap">
            <div className="flex items-center gap-4">
              {vista === 'mensual' && (
                <div className="flex items-center gap-1.5">
                  <button onClick={mesAnterior} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50" title="Mes anterior">
                    <ChevronLeft size={20} />
                  </button>
                  <button onClick={mesSiguiente} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50" title="Mes siguiente">
                    <ChevronRight size={20} />
                  </button>
                </div>
              )}
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-none capitalize">
                  {vista === 'mensual' ? `${mesLabel} ${anio}` : 'Vista semanal'}
                </h2>
                <p className="text-sm text-gray-500 mt-1.5">
                  {labSel.nombre} · Arrastra para desplazarte, clic en una clase para editar
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                <button
                  onClick={() => setVista('mensual')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    vista === 'mensual' ? 'bg-white text-utec-primary shadow-sm' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <LayoutGrid size={13} /> Mensual
                </button>
                <button
                  onClick={() => setVista('semanal')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    vista === 'semanal' ? 'bg-white text-utec-primary shadow-sm' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <CalendarDays size={13} /> Semanal
                </button>
              </div>
              <button
                onClick={() => setModoConcentracion(false)}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
                title="Salir del modo concentración (Esc)"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 px-6 py-4">
            {vista === 'mensual' ? (
              <MatrizGrid
                lab={labSel}
                clases={clases}
                reservas={reservasDelLabYMes}
                anio={anio}
                mes={mes}
                onCrearClase={abrirNueva}
                onEditarClase={abrirEditar}
                onClickReserva={r => setReservaSeleccionada(r)}
                modoLectura
                maxHeight="100%"
              />
            ) : (
              <MatrizSemanal
                clases={clases}
                reservas={todasLasReservas.filter(r => r.labId === labSel.id)}
                onClaseClick={abrirEditar}
                modoLectura
                maxHeight="100%"
              />
            )}
          </div>
        </div>
      )}

      <ClaseFormulario
        abierto={formAbierto}
        onCerrar={() => setFormAbierto(false)}
        onGuardado={cargar}
        lab={labSel}
        ciclo={ciclo}
        claseEditando={claseEditando}
        sugerencia={sugerencia}
        todasLasClases={clases}
      />

      <DetalleReservaModal
        reserva={reservaSeleccionada}
        onCerrar={() => setReservaSeleccionada(null)}
      />

      {/* ── Slide-out: Evento especial ── */}
      {eventoFormAbierto && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => { setEventoFormAbierto(false); setEventoEditando(null); }}
          />
          <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">
                {eventoEditando ? 'Editar evento especial' : 'Nuevo evento especial'}
              </h2>
              <button
                onClick={() => { setEventoFormAbierto(false); setEventoEditando(null); }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <EventoEspecialForm
                labId={labSel?.id}
                cicloId={ciclo?.id}
                eventoEditando={eventoEditando}
                labs={labs}
                onGuardado={() => { setEventoFormAbierto(false); setEventoEditando(null); cargar(); }}
                onCerrar={() => { setEventoFormAbierto(false); setEventoEditando(null); }}
              />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
