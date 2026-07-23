import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Calendar, CalendarRange, Repeat, CalendarDays, Plus, X, Send, Loader2, Bus,
} from 'lucide-react';
import {
  TIPOS_RESERVA, TIPOS_RESERVA_LABEL, DIAS_SEMANA, FRANJAS_HORARIAS, SOFTWARE_DISPONIBLE,
} from '../../lib/constants';
import { Monitor } from 'lucide-react';
import { horaToMinutos, fechaActualISO } from '../../utils/dateHelpers';
import { expandirOcurrencias } from '../../utils/expansorOcurrencias';
import { validarConflictosReserva } from '../../utils/validadorConflictos';
import {
  obtenerClasesRegularesParaValidacion,
  obtenerReservasAprobadasFuturas,
  crearReserva,
} from '../../services/reservasService';
import { crearNotificacion, crearAlertaAdmin } from '../../services/notificacionesService';
import { TIPOS_NOTIFICACION } from '../../lib/constants';
import PreviewOcurrencias from './PreviewOcurrencias';

const ESTADO_VACIO = {
  tipo: TIPOS_RESERVA.UNICA,
  labId: '',
  modulos: [],
  asignatura: '',
  motivo: '',
  colegio: '',
  horaInicio: '08:00',
  horaFin: '10:00',
  fechaInicio: '',
  fechaFin: '',
  diasSemana: [],
  fechasEspecificas: [],
  programas: [],
  programasOtros: '',
};

const TIPOS = [
  { id: TIPOS_RESERVA.UNICA,      icon: Calendar,      label: 'Día único',    desc: 'Una sola fecha' },
  { id: TIPOS_RESERVA.RANGO,      icon: CalendarRange,  label: 'Rango',        desc: 'Días consecutivos' },
  { id: TIPOS_RESERVA.RECURRENTE, icon: Repeat,         label: 'Recurrente',   desc: 'Días por semana' },
  { id: TIPOS_RESERVA.MULTIPLES,  icon: CalendarDays,   label: 'Múltiples',    desc: 'Fechas sueltas' },
  { id: TIPOS_RESERVA.TOUR,       icon: Bus,            label: 'Tour UTEC',    desc: 'Visita de colegio' },
];

export default function FormularioReserva({ labs, perfil, emailJefa, onCreado }) {
  const [form, setForm] = useState(ESTADO_VACIO);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [validando, setValidando] = useState(false);
  const [conflictos, setConflictos] = useState([]);
  const [nuevaFecha, setNuevaFecha] = useState('');

  const esTour = form.tipo === TIPOS_RESERVA.TOUR;
  const labSel = useMemo(() => labs.find(l => l.id === form.labId) || null, [labs, form.labId]);
  const tieneModulos = labSel?.tieneModulos && Array.isArray(labSel?.modulos) && labSel.modulos.length > 0;
  const ocurrencias = useMemo(() => expandirOcurrencias(form), [form]);

  useEffect(() => {
    if (!form.labId || ocurrencias.length === 0 || !form.horaInicio || !form.horaFin) {
      setConflictos([]);
      return;
    }
    if (horaToMinutos(form.horaFin) <= horaToMinutos(form.horaInicio)) {
      setConflictos([]);
      return;
    }
    if (tieneModulos && form.modulos.length === 0) {
      setConflictos([]);
      return;
    }

    let cancelado = false;
    setValidando(true);

    (async () => {
      try {
        const [clases, reservas] = await Promise.all([
          obtenerClasesRegularesParaValidacion(form.labId),
          obtenerReservasAprobadasFuturas(),
        ]);
        if (cancelado) return;
        const conflictosDetectados = validarConflictosReserva({
          reserva: { labId: form.labId, horaInicio: form.horaInicio, horaFin: form.horaFin, modulos: form.modulos },
          ocurrencias,
          clasesRegulares: clases,
          reservasAprobadas: reservas,
        });
        if (!cancelado) setConflictos(conflictosDetectados);
      } catch (e) {
        console.error('Error validando:', e);
      } finally {
        if (!cancelado) setValidando(false);
      }
    })();

    return () => { cancelado = true; };
  }, [form.labId, form.horaInicio, form.horaFin, form.modulos, ocurrencias, tieneModulos]);

  function actualizar(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }));
    setErrores(e => ({ ...e, [campo]: null }));
  }

  function toggleDia(diaId) {
    setForm(f => ({
      ...f,
      diasSemana: f.diasSemana.includes(diaId)
        ? f.diasSemana.filter(d => d !== diaId)
        : [...f.diasSemana, diaId],
    }));
  }

  function toggleModulo(moduloId) {
    setForm(f => ({
      ...f,
      modulos: f.modulos.includes(moduloId)
        ? f.modulos.filter(m => m !== moduloId)
        : [...f.modulos, moduloId],
    }));
  }

  function togglePrograma(id) {
    setForm(f => ({
      ...f,
      programas: f.programas.includes(id)
        ? f.programas.filter(p => p !== id)
        : [...f.programas, id],
    }));
  }

  function agregarFechaEspecifica() {
    if (!nuevaFecha) return;
    if (form.fechasEspecificas.includes(nuevaFecha)) { toast.error('Esa fecha ya fue agregada'); return; }
    setForm(f => ({ ...f, fechasEspecificas: [...f.fechasEspecificas, nuevaFecha].sort() }));
    setNuevaFecha('');
  }

  function quitarFechaEspecifica(fecha) {
    setForm(f => ({ ...f, fechasEspecificas: f.fechasEspecificas.filter(x => x !== fecha) }));
  }

  function validar() {
    const e = {};
    if (!form.labId) e.labId = 'Selecciona un laboratorio';
    if (!form.horaInicio || !form.horaFin) e.horario = 'Horario requerido';
    if (form.horaInicio && form.horaFin && horaToMinutos(form.horaFin) <= horaToMinutos(form.horaInicio)) {
      e.horario = 'La hora fin debe ser posterior a la hora inicio';
    }
    if (tieneModulos && form.modulos.length === 0) e.modulos = 'Selecciona al menos un módulo';

    if (esTour) {
      if (!form.colegio.trim()) e.colegio = 'Indica el colegio o institución visitante';
      if (!form.fechaInicio) e.fechas = 'Indica la fecha del tour';
    } else {
      if (!form.asignatura.trim() && !form.motivo.trim()) e.asignatura = 'Indica asignatura o motivo';

      if (form.tipo === TIPOS_RESERVA.UNICA && !form.fechaInicio) e.fechas = 'Indica la fecha';
      if (form.tipo === TIPOS_RESERVA.RANGO && (!form.fechaInicio || !form.fechaFin)) e.fechas = 'Indica fecha inicio y fin';
      if (form.tipo === TIPOS_RESERVA.RECURRENTE) {
        if (!form.fechaInicio || !form.fechaFin) e.fechas = 'Indica rango de fechas';
        if (form.diasSemana.length === 0) e.diasSemana = 'Selecciona al menos un día';
      }
      if (form.tipo === TIPOS_RESERVA.MULTIPLES && form.fechasEspecificas.length === 0) {
        e.fechas = 'Agrega al menos una fecha';
      }
    }

    const hoy = fechaActualISO();
    if (form.fechaInicio && form.fechaInicio < hoy) e.fechas = 'No puedes reservar fechas pasadas';
    if (form.fechasEspecificas.some(f => f < hoy)) e.fechas = 'Hay fechas pasadas en la lista';

    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function handleEnviar() {
    if (!validar()) { toast.error('Revisa los campos marcados'); return; }
    if (conflictos.length > 0) { toast.error('Hay conflictos. Ajusta para poder enviar.'); return; }
    if (ocurrencias.length === 0) { toast.error('No hay fechas válidas para reservar'); return; }

    try {
      setEnviando(true);
      const labInfo = labs.find(l => l.id === form.labId);

      const reserva = {
        docenteId: perfil.uid,
        docenteNombre: perfil.nombre,
        docenteEmail: perfil.email,
        labId: form.labId,
        labNombre: labInfo?.nombre || form.labId,
        modulos: tieneModulos ? form.modulos : [],
        tipo: form.tipo,
        asignatura: esTour ? 'Tour UTEC' : form.asignatura.trim(),
        colegio: esTour ? form.colegio.trim() : '',
        motivo: esTour ? '' : form.motivo.trim(),
        horaInicio: form.horaInicio,
        horaFin: form.horaFin,
        fechaInicio: form.fechaInicio || ocurrencias[0],
        fechaFin: form.fechaFin || ocurrencias[ocurrencias.length - 1],
        diasSemana: form.diasSemana,
        fechasEspecificas: form.fechasEspecificas,
        ocurrencias,
        programas: form.programas,
        programasOtros: form.programasOtros.trim(),
      };

      const creada = await crearReserva(reserva);

      try {
        const tituloNotif = esTour
          ? `Tour UTEC – ${reserva.colegio}`
          : (reserva.asignatura || reserva.motivo);

        // Alerta broadcast para todos los admins (tiempo real)
        crearAlertaAdmin({
          tipo: 'nueva_reserva',
          titulo: `Nueva reserva: ${tituloNotif}`,
          mensaje: esTour
            ? `${perfil.nombre} solicitó ${reserva.labNombre} para Tour UTEC – ${reserva.colegio} (${reserva.horaInicio}–${reserva.horaFin}) el ${reserva.fechaInicio}.`
            : `${perfil.nombre} solicitó ${reserva.labNombre} (${reserva.horaInicio}–${reserva.horaFin}) — ${ocurrencias.length} fecha(s). Motivo: ${reserva.motivo || reserva.asignatura}`,
          refId: creada.id,
          refTipo: 'reserva',
        });

        // Notificación personal a la jefa (con email)
        if (emailJefa) {
          await crearNotificacion({
            destinatarioId: 'jefa',
            destinatarioEmail: emailJefa,
            tipo: TIPOS_NOTIFICACION.RESERVA_CREADA,
            titulo: `Nueva reserva pendiente: ${tituloNotif}`,
            mensaje: esTour
              ? `${perfil.nombre} solicitó ${reserva.labNombre} para Tour UTEC – ${reserva.colegio} (${reserva.horaInicio}-${reserva.horaFin}) el ${reserva.fechaInicio}.`
              : `${perfil.nombre} solicitó reservar ${reserva.labNombre} (${reserva.horaInicio}-${reserva.horaFin}) en ${ocurrencias.length} fecha(s).\n\nMotivo: ${reserva.motivo || reserva.asignatura}`,
            refId: creada.id,
            refTipo: 'reserva',
          });
        }
      } catch (e) {
        console.warn('No se pudo notificar a la jefa:', e);
      }

      toast.success(esTour ? 'Tour registrado. Espera la aprobación.' : 'Reserva enviada. Espera la aprobación de jefatura.');
      setForm(ESTADO_VACIO);
      onCreado?.();
    } catch (e) {
      console.error(e);
      toast.error('Error al enviar la solicitud');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">

      {/* ── Tipo de reserva ── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de solicitud</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {TIPOS.map(t => {
            const Icon = t.icon;
            const activo = form.tipo === t.id;
            const esTipoTour = t.id === TIPOS_RESERVA.TOUR;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => actualizar('tipo', t.id)}
                className={`p-3 border-2 rounded-lg text-left transition-colors ${
                  activo
                    ? esTipoTour
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-utec-primary bg-utec-light'
                    : esTipoTour
                      ? 'border-purple-200 hover:border-purple-400'
                      : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`flex items-center gap-2 font-medium text-sm ${esTipoTour && activo ? 'text-purple-800' : ''}`}>
                  <Icon size={14} /> {t.label}
                </div>
                <p className={`text-[11px] mt-1 ${esTipoTour ? 'text-purple-600' : 'text-gray-600'}`}>{t.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Banner informativo para Tour ── */}
      {esTour && (
        <div className="flex items-start gap-3 bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 text-sm text-purple-800">
          <Bus size={16} className="flex-shrink-0 mt-0.5" />
          <p>
            <strong>Tour UTEC:</strong> reserva el laboratorio para la visita de un colegio o institución externa.
            Solo necesitas indicar el laboratorio, el horario, la fecha y el nombre del visitante.
          </p>
        </div>
      )}

      {/* ── Lab + campo principal ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Laboratorio *</label>
          <select
            value={form.labId}
            onChange={e => actualizar('labId', e.target.value)}
            className={`input-base ${errores.labId ? 'border-red-500' : ''}`}
          >
            <option value="">-- Selecciona --</option>
            {labs.map(l => (
              <option key={l.id} value={l.id}>{l.nombre}{l.tieneModulos ? ' (con módulos)' : ''}</option>
            ))}
          </select>
          {errores.labId && <p className="text-xs text-red-600 mt-1">{errores.labId}</p>}
        </div>

        {esTour ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Colegio / Institución visitante *</label>
            <input
              type="text"
              value={form.colegio}
              onChange={e => actualizar('colegio', e.target.value)}
              placeholder="Ej. Colegio Externado San José, Instituto Nacional"
              className={`input-base ${errores.colegio ? 'border-red-500' : ''}`}
            />
            {errores.colegio && <p className="text-xs text-red-600 mt-1">{errores.colegio}</p>}
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Asignatura / Motivo *</label>
            <input
              type="text"
              value={form.asignatura}
              onChange={e => actualizar('asignatura', e.target.value)}
              placeholder="Ej. Asesoría grupal, Examen extraordinario"
              className={`input-base ${errores.asignatura ? 'border-red-500' : ''}`}
            />
            {errores.asignatura && <p className="text-xs text-red-600 mt-1">{errores.asignatura}</p>}
          </div>
        )}
      </div>

      {/* ── Detalle/motivo — solo para tipos no-tour ── */}
      {!esTour && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Detalle / motivo (opcional)</label>
          <textarea
            value={form.motivo}
            onChange={e => actualizar('motivo', e.target.value)}
            rows={2}
            className="input-base"
            placeholder="Describe el uso del laboratorio"
          />
        </div>
      )}

      {/* ── Horario ── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio *</label>
          <select value={form.horaInicio} onChange={e => actualizar('horaInicio', e.target.value)} className="input-base">
            {FRANJAS_HORARIAS.map(f => <option key={f.inicio} value={f.inicio}>{f.inicio}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin *</label>
          <select value={form.horaFin} onChange={e => actualizar('horaFin', e.target.value)} className="input-base">
            {FRANJAS_HORARIAS.map(f => <option key={f.fin} value={f.fin}>{f.fin}</option>)}
          </select>
        </div>
      </div>
      {errores.horario && <p className="text-xs text-red-600 -mt-3">{errores.horario}</p>}

      {/* ── Fecha única (UNICA y TOUR) ── */}
      {(form.tipo === TIPOS_RESERVA.UNICA || esTour) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {esTour ? 'Fecha del tour *' : 'Fecha *'}
          </label>
          <input
            type="date"
            value={form.fechaInicio}
            onChange={e => actualizar('fechaInicio', e.target.value)}
            min={fechaActualISO()}
            className="input-base"
          />
        </div>
      )}

      {/* ── Rango ── */}
      {form.tipo === TIPOS_RESERVA.RANGO && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde *</label>
            <input type="date" value={form.fechaInicio} onChange={e => actualizar('fechaInicio', e.target.value)} min={fechaActualISO()} className="input-base" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta *</label>
            <input type="date" value={form.fechaFin} onChange={e => actualizar('fechaFin', e.target.value)} min={form.fechaInicio || fechaActualISO()} className="input-base" />
          </div>
        </div>
      )}

      {/* ── Recurrente ── */}
      {form.tipo === TIPOS_RESERVA.RECURRENTE && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Desde *</label>
              <input type="date" value={form.fechaInicio} onChange={e => actualizar('fechaInicio', e.target.value)} min={fechaActualISO()} className="input-base" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hasta *</label>
              <input type="date" value={form.fechaFin} onChange={e => actualizar('fechaFin', e.target.value)} min={form.fechaInicio || fechaActualISO()} className="input-base" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Días de la semana *</label>
            <div className="flex flex-wrap gap-1.5">
              {DIAS_SEMANA.map(d => (
                <button
                  key={d.id} type="button" onClick={() => toggleDia(d.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    form.diasSemana.includes(d.id)
                      ? 'bg-utec-primary text-white border-utec-primary'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {d.corto}
                </button>
              ))}
            </div>
            {errores.diasSemana && <p className="text-xs text-red-600 mt-1">{errores.diasSemana}</p>}
          </div>
        </>
      )}

      {/* ── Múltiples ── */}
      {form.tipo === TIPOS_RESERVA.MULTIPLES && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fechas específicas *</label>
          <div className="flex gap-2 mb-2">
            <input type="date" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)} min={fechaActualISO()} className="input-base flex-1" />
            <button type="button" onClick={agregarFechaEspecifica} className="px-3 py-2 bg-utec-primary text-white rounded-lg flex items-center gap-1 text-sm">
              <Plus size={14} /> Agregar
            </button>
          </div>
          {form.fechasEspecificas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {form.fechasEspecificas.map(f => (
                <span key={f} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-900 rounded text-xs border border-blue-200">
                  {f}
                  <button onClick={() => quitarFechaEspecifica(f)} className="hover:text-red-600"><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {errores.fechas && <p className="text-xs text-red-600 -mt-3">{errores.fechas}</p>}

      {/* ── Módulos Lab 03 ── */}
      {tieneModulos && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-blue-900">Módulos de {labSel?.nombre} *</label>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, modulos: f.modulos.length === labSel.modulos.length ? [] : labSel.modulos.map(m => m.id) }))}
              className="text-xs text-blue-700 hover:underline"
            >
              {form.modulos.length === labSel.modulos.length ? 'Quitar todos' : 'Lab completo'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {labSel.modulos.map(m => (
              <button
                key={m.id} type="button" onClick={() => toggleModulo(m.id)}
                className={`p-2 rounded-md text-left text-xs border transition-colors ${
                  form.modulos.includes(m.id)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-blue-900 border-blue-200 hover:border-blue-400'
                }`}
              >
                <div className="font-semibold">{m.nombre}</div>
                <div className="opacity-80">
                  {m.pcInicio && m.pcFin ? `PC ${m.pcInicio}-${m.pcFin} · ` : ''}{m.equipos} eq.
                </div>
              </button>
            ))}
          </div>
          {errores.modulos && <p className="text-xs text-red-600 mt-1">{errores.modulos}</p>}
        </div>
      )}

      {/* ── Software requerido ── */}
      {!esTour && (
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Monitor size={14} className="text-utec-primary" />
            <label className="text-sm font-medium text-gray-700">
              Software o paquetería requerida <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">
            {SOFTWARE_DISPONIBLE.map(sw => (
              <label key={sw.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.programas.includes(sw.id)}
                  onChange={() => togglePrograma(sw.id)}
                  className="rounded border-gray-300 text-utec-primary"
                />
                <span className="text-gray-700">{sw.label}</span>
              </label>
            ))}
          </div>
          <input
            type="text"
            value={form.programasOtros}
            onChange={e => actualizar('programasOtros', e.target.value)}
            placeholder="Otro software no listado..."
            className="input-base text-sm"
          />
        </div>
      )}

      <PreviewOcurrencias ocurrencias={ocurrencias} conflictos={conflictos} cargando={validando} />

      <button
        onClick={handleEnviar}
        disabled={enviando || validando || conflictos.length > 0 || ocurrencias.length === 0}
        className={`w-full px-4 py-3 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium ${
          esTour ? 'bg-purple-600 hover:bg-purple-700' : 'bg-utec-primary hover:bg-utec-dark'
        }`}
      >
        {enviando ? <Loader2 size={18} className="animate-spin" /> : <Send size={16} />}
        {enviando ? 'Enviando...' : esTour ? 'Solicitar Tour UTEC' : 'Enviar solicitud de reserva'}
      </button>
    </div>
  );
}
