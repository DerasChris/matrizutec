import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { Download, AlertTriangle, Plus, X, Loader2 } from 'lucide-react';
import { registrarAsistenciaManual } from '../../services/asistenciaService';
import { duracionHoras, fechaActualISO } from '../../utils/dateHelpers';
import { contarOcurrenciasClaseEnRango } from '../../utils/matrizHelpers';
import { TIPOS_CLASE } from '../../lib/constants';

const DIA_CORTO = {
  lunes: 'Lu', martes: 'Ma', miercoles: 'Mi',
  jueves: 'Ju', viernes: 'Vi', sabado: 'Sá', domingo: 'Do',
};

// ─────────────────────────────────────────────────────────────────
// Raíz: sub-tabs dentro de la pestaña "Reportes"
// ─────────────────────────────────────────────────────────────────

export default function TabReportesAsistencia({
  asistencias, asistenciasValidas, asistenciasTodas,
  clases, labs, labMap, ciclo, cicloNombre, perfil, onGuardado,
}) {
  const [subTab, setSubTab] = useState('labs');

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: 'labs', label: 'Uso de laboratorios' },
          { id: 'materias', label: 'Horas por materia' },
          { id: 'detalle', label: 'Detalle' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              subTab === t.id
                ? 'border-utec-primary text-utec-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'labs' && (
        <SeccionUsoLaboratorios asistenciasValidas={asistenciasValidas} labs={labs} />
      )}
      {subTab === 'materias' && (
        <SeccionHorasPorMateria asistenciasValidas={asistenciasValidas} clases={clases} ciclo={ciclo} />
      )}
      {subTab === 'detalle' && (
        <SeccionDetalle
          asistencias={asistencias}
          asistenciasTodas={asistenciasTodas}
          clases={clases}
          labs={labs}
          labMap={labMap}
          ciclo={ciclo}
          cicloNombre={cicloNombre}
          perfil={perfil}
          onGuardado={onGuardado}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Uso de laboratorios
// ─────────────────────────────────────────────────────────────────

function SeccionUsoLaboratorios({ asistenciasValidas, labs }) {
  const stats = useMemo(() => {
    const porLab = {};
    for (const lab of labs) {
      porLab[lab.id] = { lab, registros: 0, horas: 0, clases: new Set(), docentes: new Set(), ultimaFecha: null };
    }
    for (const a of asistenciasValidas) {
      const s = porLab[a.labId];
      if (!s) continue; // lab fuera de alcance (inactivo o no asignado)
      s.registros++;
      s.horas += duracionHoras(a.horaInicio, a.horaFin);
      if (a.claseId) s.clases.add(a.claseId);
      if (a.docente) s.docentes.add(a.docente);
      if (!s.ultimaFecha || a.fecha > s.ultimaFecha) s.ultimaFecha = a.fecha;
    }
    return Object.values(porLab).sort((a, b) => (a.lab.numero || 0) - (b.lab.numero || 0));
  }, [asistenciasValidas, labs]);

  const sinRegistro = stats.filter(s => s.registros === 0);

  return (
    <div className="space-y-4">
      {sinRegistro.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-500" />
          <p>
            <strong>{sinRegistro.length}</strong> {sinRegistro.length === 1 ? 'laboratorio no tiene' : 'laboratorios no tienen'} ningún
            registro de asistencia este ciclo: {sinRegistro.map(s => s.lab.nombre).join(', ')}.
          </p>
        </div>
      )}

      <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Laboratorio', 'Registros', 'Horas acumuladas', 'Clases distintas', 'Docentes distintos', 'Último registro'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stats.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">Sin laboratorios en este alcance</td></tr>
            )}
            {stats.map(s => (
              <tr key={s.lab.id} className={s.registros === 0 ? 'bg-amber-50/40' : 'hover:bg-gray-50'}>
                <td className="px-3 py-2 text-gray-900 font-medium whitespace-nowrap">{s.lab.nombre}</td>
                <td className="px-3 py-2 text-center text-gray-700">{s.registros}</td>
                <td className="px-3 py-2 text-center text-gray-700">{s.horas.toFixed(1)}</td>
                <td className="px-3 py-2 text-center text-gray-700">{s.clases.size}</td>
                <td className="px-3 py-2 text-center text-gray-700">{s.docentes.size}</td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600">{s.ultimaFecha || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Horas por materia
// ─────────────────────────────────────────────────────────────────

function SeccionHorasPorMateria({ asistenciasValidas, clases, ciclo }) {
  const hoy = fechaActualISO();
  const cicloInicio = ciclo?.fechaInicio || hoy;
  const cicloFin = ciclo?.fechaFin || hoy;

  const materias = useMemo(() => {
    const porMateria = {};
    const regulares = clases.filter(c => c.tipo === TIPOS_CLASE.REGULAR && c.activo !== false);

    for (const c of regulares) {
      const key = c.codigoAsignatura || c.nombreAsignatura;
      if (!key) continue;
      if (!porMateria[key]) {
        porMateria[key] = {
          codigo: c.codigoAsignatura,
          nombre: c.nombreAsignatura,
          secciones: new Set(),
          horasSemana: 0,
          proyectadas: 0,
          esperadasAlaFecha: 0,
          reales: 0,
        };
      }
      const m = porMateria[key];
      m.secciones.add(c.seccion);
      const horasClase = duracionHoras(c.horaInicio, c.horaFin);
      m.horasSemana += horasClase * (c.diasSemana?.length || 0);

      const desde = c.fechaInicio || cicloInicio;
      const finVigencia = c.fechaFin || cicloFin;
      m.proyectadas += contarOcurrenciasClaseEnRango(c, desde, finVigencia) * horasClase;

      const hastaHoy = hoy < finVigencia ? hoy : finVigencia;
      m.esperadasAlaFecha += contarOcurrenciasClaseEnRango(c, desde, hastaHoy) * horasClase;
    }

    for (const a of asistenciasValidas) {
      const key = a.codigoAsignatura || a.nombreAsignatura;
      const m = porMateria[key];
      if (!m) continue; // asistencia de una clase que ya no está activa en este alcance
      m.reales += duracionHoras(a.horaInicio, a.horaFin);
    }

    return Object.values(porMateria)
      .map(m => ({
        ...m,
        cumplimiento: m.esperadasAlaFecha > 0 ? Math.round((m.reales / m.esperadasAlaFecha) * 100) : null,
      }))
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  }, [asistenciasValidas, clases, cicloInicio, cicloFin, hoy]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Horas/semana = duración × días por semana, sumado por sección. Proyección fin de ciclo y horas esperadas a
        la fecha cuentan las sesiones reales según el horario y la vigencia de cada clase (no una aproximación).
        El % de cumplimiento compara horas reales (asistencia aprobada) contra lo esperado a la fecha, no contra el
        total del ciclo — comparar contra la meta completa siempre se ve "atrasado" hasta el último día.
      </p>
      <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Materia', 'Secciones', 'Horas/semana', 'Proyección fin de ciclo', 'Esperadas a la fecha', 'Reales', '% cumplimiento'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {materias.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">Sin materias en este alcance</td></tr>
            )}
            {materias.map(m => (
              <tr key={m.codigo || m.nombre} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-900 max-w-xs truncate" title={m.nombre}>
                  {m.nombre} <span className="text-gray-400 text-xs">({m.codigo})</span>
                </td>
                <td className="px-3 py-2 text-center text-gray-700">{m.secciones.size}</td>
                <td className="px-3 py-2 text-center text-gray-700">{m.horasSemana.toFixed(1)}</td>
                <td className="px-3 py-2 text-center text-gray-700">{m.proyectadas.toFixed(1)}</td>
                <td className="px-3 py-2 text-center text-gray-700">{m.esperadasAlaFecha.toFixed(1)}</td>
                <td className="px-3 py-2 text-center text-gray-700">{m.reales.toFixed(1)}</td>
                <td className="px-3 py-2 text-center">
                  {m.cumplimiento === null ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    <span className={`font-semibold ${
                      m.cumplimiento >= 90 ? 'text-green-700' : m.cumplimiento >= 60 ? 'text-amber-700' : 'text-red-700'
                    }`}>
                      {m.cumplimiento}%
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

// ─────────────────────────────────────────────────────────────────
// Detalle (tabla filtrable + exportar + ingreso manual)
// ─────────────────────────────────────────────────────────────────

function SeccionDetalle({ asistencias, asistenciasTodas, clases, labs, labMap, ciclo, cicloNombre, perfil, onGuardado }) {
  const [filtroLab, setFiltroLab] = useState('');
  const [filtroDocente, setFiltroDocente] = useState('');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);

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
      Origen: a.origen === 'manual' ? 'Manual' : 'QR',
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
          onClick={() => setModalAbierto(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
        >
          <Plus size={14} /> Agregar asistencia manual
        </button>
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
                <td className="px-3 py-2 whitespace-nowrap font-mono text-gray-500">{a.horaMarcado || '—'}</td>
                <td className="px-3 py-2 text-center text-gray-700">{a.alumnosLlegaron}/{a.inscritos}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-1 flex-wrap">
                    {a.estado === 'rechazada' ? (
                      <span className="text-[10px] font-semibold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                        Rechazada por jefatura
                      </span>
                    ) : a.fueraDeHorario ? (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                        Marcó fuera de horario
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                        En horario
                      </span>
                    )}
                    {a.origen === 'manual' && (
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                        Manual
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalAbierto && (
        <ModalAsistenciaManual
          labs={labs}
          clases={clases}
          asistenciasTodas={asistenciasTodas}
          ciclo={ciclo}
          perfil={perfil}
          onClose={() => setModalAbierto(false)}
          onGuardado={() => { setModalAbierto(false); onGuardado(); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Modal: ingreso manual de asistencia
// ─────────────────────────────────────────────────────────────────

function ModalAsistenciaManual({ labs, clases, asistenciasTodas, ciclo, perfil, onClose, onGuardado }) {
  const [labId, setLabId] = useState('');
  const [claseId, setClaseId] = useState('');
  const [fecha, setFecha] = useState('');
  const [alumnos, setAlumnos] = useState('');
  const [confirmarSobrescribir, setConfirmarSobrescribir] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const clasesDelLab = useMemo(
    () => clases.filter(c => c.labId === labId && c.tipo === TIPOS_CLASE.REGULAR && c.activo !== false),
    [clases, labId]
  );
  const clase = clasesDelLab.find(c => c.id === claseId) || null;

  const docExistente = useMemo(() => {
    if (!claseId || !fecha) return null;
    return asistenciasTodas.find(a => a.claseId === claseId && a.fecha === fecha) || null;
  }, [asistenciasTodas, claseId, fecha]);

  function handleLabChange(v) { setLabId(v); setClaseId(''); setConfirmarSobrescribir(false); }
  function handleClaseChange(v) { setClaseId(v); setConfirmarSobrescribir(false); }
  function handleFechaChange(v) { setFecha(v); setConfirmarSobrescribir(false); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!clase || !fecha || alumnos === '') { toast.error('Completa todos los campos'); return; }
    if (docExistente && !confirmarSobrescribir) {
      setConfirmarSobrescribir(true);
      return;
    }
    setGuardando(true);
    try {
      await registrarAsistenciaManual({
        clase,
        labId,
        cicloId: ciclo?.id,
        fecha,
        alumnosLlegaron: Number(alumnos),
        adminUid: perfil?.uid,
        adminNombre: perfil?.nombre,
      });
      toast.success('Asistencia registrada');
      onGuardado();
    } catch (err) {
      toast.error(err.message || 'Error al registrar la asistencia');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Agregar asistencia manual</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <p className="text-xs text-gray-500">
            Úsalo solo cuando el docente no pudo marcar por QR (PIN, teléfono, etc.). Queda registrado con tu nombre.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Laboratorio</label>
            <select value={labId} onChange={e => handleLabChange(e.target.value)} className="input-base" required>
              <option value="">Selecciona...</option>
              {labs.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Clase</label>
            <select value={claseId} onChange={e => handleClaseChange(e.target.value)} className="input-base" required disabled={!labId}>
              <option value="">Selecciona...</option>
              {clasesDelLab.map(c => (
                <option key={c.id} value={c.id}>
                  {c.codigoAsignatura} — {c.nombreAsignatura} Sec.{c.seccion} · {(c.diasSemana || []).join('-')} {c.horaInicio}-{c.horaFin}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => handleFechaChange(e.target.value)} className="input-base" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alumnos que llegaron</label>
            <input
              type="number" min="0" max="500" value={alumnos}
              onChange={e => setAlumnos(e.target.value)}
              className="input-base" required
            />
          </div>

          {docExistente && (
            <p className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle size={13} className="shrink-0" />
              Ya existe un registro para esa clase en esa fecha ({docExistente.alumnosLlegaron} alumnos, origen{' '}
              {docExistente.origen === 'manual' ? 'manual' : 'QR'}).
              {confirmarSobrescribir ? ' Al guardar se sobrescribe.' : ' Guarda de nuevo para confirmar que quieres reemplazarlo.'}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-utec-primary text-white rounded-lg hover:bg-utec-dark disabled:opacity-50"
            >
              {guardando && <Loader2 size={14} className="animate-spin" />}
              {docExistente && !confirmarSobrescribir ? 'Revisar y confirmar' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
