import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Calendar, CalendarRange, Repeat, CalendarDays, Plus, X, Send, Loader2,
} from 'lucide-react';
import {
  TIPOS_RESERVA, TIPOS_RESERVA_LABEL, DIAS_SEMANA, FRANJAS_HORARIAS,
} from '../../lib/constants';
import { horaToMinutos, fechaActualISO } from '../../utils/dateHelpers';
import { expandirOcurrencias } from '../../utils/expansorOcurrencias';
import { validarConflictosReserva } from '../../utils/validadorConflictos';
import {
  obtenerClasesRegularesParaValidacion,
  obtenerReservasAprobadasFuturas,
  crearReserva,
} from '../../services/reservasService';
import { crearNotificacion } from '../../services/notificacionesService';
import { TIPOS_NOTIFICACION } from '../../lib/constants';
import PreviewOcurrencias from './PreviewOcurrencias';

const ESTADO_VACIO = {
  tipo: TIPOS_RESERVA.UNICA,
  labId: '',
  modulos: [],
  asignatura: '',
  motivo: '',
  horaInicio: '08:00',
  horaFin: '10:00',
  fechaInicio: '',
  fechaFin: '',
  diasSemana: [],
  fechasEspecificas: [],
};

export default function FormularioReserva({ labs, perfil, emailJefa, onCreado }) {
  const [form, setForm] = useState(ESTADO_VACIO);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [validando, setValidando] = useState(false);
  const [conflictos, setConflictos] = useState([]);
  const [nuevaFecha, setNuevaFecha] = useState('');

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
          reserva: {
            labId: form.labId,
            horaInicio: form.horaInicio,
            horaFin: form.horaFin,
            modulos: form.modulos,
          },
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

  function agregarFechaEspecifica() {
    if (!nuevaFecha) return;
    if (form.fechasEspecificas.includes(nuevaFecha)) {
      toast.error('Esa fecha ya fue agregada');
      return;
    }
    setForm(f => ({
      ...f,
      fechasEspecificas: [...f.fechasEspecificas, nuevaFecha].sort(),
    }));
    setNuevaFecha('');
  }

  function quitarFechaEspecifica(fecha) {
    setForm(f => ({
      ...f,
      fechasEspecificas: f.fechasEspecificas.filter(x => x !== fecha),
    }));
  }

  function validar() {
    const e = {};
    if (!form.labId) e.labId = 'Selecciona un laboratorio';
    if (!form.asignatura.trim() && !form.motivo.trim()) e.asignatura = 'Indica asignatura o motivo';
    if (!form.horaInicio || !form.horaFin) e.horario = 'Horario requerido';
    if (form.horaInicio && form.horaFin && horaToMinutos(form.horaFin) <= horaToMinutos(form.horaInicio)) {
      e.horario = 'La hora fin debe ser posterior a la hora inicio';
    }
    if (tieneModulos && form.modulos.length === 0) {
      e.modulos = 'Selecciona al menos un módulo';
    }

    if (form.tipo === TIPOS_RESERVA.UNICA && !form.fechaInicio) e.fechas = 'Indica la fecha';
    if (form.tipo === TIPOS_RESERVA.RANGO && (!form.fechaInicio || !form.fechaFin)) e.fechas = 'Indica fecha inicio y fin';
    if (form.tipo === TIPOS_RESERVA.RECURRENTE) {
      if (!form.fechaInicio || !form.fechaFin) e.fechas = 'Indica rango de fechas';
      if (form.diasSemana.length === 0) e.diasSemana = 'Selecciona al menos un día';
    }
    if (form.tipo === TIPOS_RESERVA.MULTIPLES && form.fechasEspecificas.length === 0) {
      e.fechas = 'Agrega al menos una fecha';
    }

    const hoy = fechaActualISO();
    if (form.fechaInicio && form.fechaInicio < hoy) e.fechas = 'No puedes reservar fechas pasadas';
    if (form.fechasEspecificas.some(f => f < hoy)) e.fechas = 'Hay fechas pasadas en la lista';

    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function handleEnviar() {
    if (!validar()) {
      toast.error('Revisa los campos marcados');
      return;
    }
    if (conflictos.length > 0) {
      toast.error('Hay conflictos. Ajusta para poder enviar.');
      return;
    }
    if (ocurrencias.length === 0) {
      toast.error('No hay fechas válidas para reservar');
      return;
    }

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
        asignatura: form.asignatura.trim(),
        motivo: form.motivo.trim(),
        horaInicio: form.horaInicio,
        horaFin: form.horaFin,
        fechaInicio: form.fechaInicio || ocurrencias[0],
        fechaFin: form.fechaFin || ocurrencias[ocurrencias.length - 1],
        diasSemana: form.diasSemana,
        fechasEspecificas: form.fechasEspecificas,
        ocurrencias,
      };

      const creada = await crearReserva(reserva);

      if (emailJefa) {
        try {
          await crearNotificacion({
            destinatarioId: 'jefa',
            destinatarioEmail: emailJefa,
            tipo: TIPOS_NOTIFICACION.RESERVA_CREADA,
            titulo: `Nueva reserva pendiente: ${reserva.asignatura || reserva.motivo}`,
            mensaje: `${perfil.nombre} solicitó reservar ${reserva.labNombre} (${reserva.horaInicio}-${reserva.horaFin}) en ${ocurrencias.length} fecha(s).\n\nMotivo: ${reserva.motivo || reserva.asignatura}`,
            refId: creada.id,
            refTipo: 'reserva',
          });
        } catch (e) {
          console.warn('No se pudo notificar a la jefa:', e);
        }
      }

      toast.success('Reserva enviada. Espera la aprobación de jefatura.');
      setForm(ESTADO_VACIO);
      onCreado?.();
    } catch (e) {
      console.error(e);
      toast.error('Error al enviar la reserva');
    } finally {
      setEnviando(false);
    }
  }

  const tipos = [
    { id: TIPOS_RESERVA.UNICA, icon: Calendar, label: 'Día único', desc: 'Una sola fecha' },
    { id: TIPOS_RESERVA.RANGO, icon: CalendarRange, label: 'Rango', desc: 'Días consecutivos' },
    { id: TIPOS_RESERVA.RECURRENTE, icon: Repeat, label: 'Recurrente', desc: 'Días por semana' },
    { id: TIPOS_RESERVA.MULTIPLES, icon: CalendarDays, label: 'Múltiples', desc: 'Fechas sueltas' },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de reserva</label>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {tipos.map(t => {
            const Icon = t.icon;
            const activo = form.tipo === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => actualizar('tipo', t.id)}
                className={`p-3 border-2 rounded-lg text-left transition-colors ${
                  activo ? 'border-utec-primary bg-utec-light' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-sm">
                  <Icon size={14} /> {t.label}
                </div>
                <p className="text-[11px] text-gray-600 mt-1">{t.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

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
              <option key={l.id} value={l.id}>
                {l.nombre}{l.tieneModulos ? ' (con módulos)' : ''}
              </option>
            ))}
          </select>
          {errores.labId && <p className="text-xs text-red-600 mt-1">{errores.labId}</p>}
        </div>
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
      </div>

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

      {form.tipo === TIPOS_RESERVA.UNICA && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
          <input
            type="date"
            value={form.fechaInicio}
            onChange={e => actualizar('fechaInicio', e.target.value)}
            min={fechaActualISO()}
            className="input-base"
          />
        </div>
      )}

      {form.tipo === TIPOS_RESERVA.RANGO && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde *</label>
            <input
              type="date"
              value={form.fechaInicio}
              onChange={e => actualizar('fechaInicio', e.target.value)}
              min={fechaActualISO()}
              className="input-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta *</label>
            <input
              type="date"
              value={form.fechaFin}
              onChange={e => actualizar('fechaFin', e.target.value)}
              min={form.fechaInicio || fechaActualISO()}
              className="input-base"
            />
          </div>
        </div>
      )}

      {form.tipo === TIPOS_RESERVA.RECURRENTE && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Desde *</label>
              <input
                type="date"
                value={form.fechaInicio}
                onChange={e => actualizar('fechaInicio', e.target.value)}
                min={fechaActualISO()}
                className="input-base"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hasta *</label>
              <input
                type="date"
                value={form.fechaFin}
                onChange={e => actualizar('fechaFin', e.target.value)}
                min={form.fechaInicio || fechaActualISO()}
                className="input-base"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Días de la semana *</label>
            <div className="flex flex-wrap gap-1.5">
              {DIAS_SEMANA.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDia(d.id)}
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

      {form.tipo === TIPOS_RESERVA.MULTIPLES && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fechas específicas *</label>
          <div className="flex gap-2 mb-2">
            <input
              type="date"
              value={nuevaFecha}
              onChange={e => setNuevaFecha(e.target.value)}
              min={fechaActualISO()}
              className="input-base flex-1"
            />
            <button
              type="button"
              onClick={agregarFechaEspecifica}
              className="px-3 py-2 bg-utec-primary text-white rounded-lg flex items-center gap-1 text-sm"
            >
              <Plus size={14} /> Agregar
            </button>
          </div>
          {form.fechasEspecificas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {form.fechasEspecificas.map(f => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-900 rounded text-xs border border-blue-200"
                >
                  {f}
                  <button onClick={() => quitarFechaEspecifica(f)} className="hover:text-red-600">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {errores.fechas && <p className="text-xs text-red-600 -mt-3">{errores.fechas}</p>}

      {tieneModulos && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-blue-900">Módulos del Lab 03 *</label>
            <button
              type="button"
              onClick={() => {
                setForm(f => ({
                  ...f,
                  modulos: f.modulos.length === labSel.modulos.length ? [] : labSel.modulos.map(m => m.id),
                }));
              }}
              className="text-xs text-blue-700 hover:underline"
            >
              {form.modulos.length === labSel.modulos.length ? 'Quitar todos' : 'Lab completo'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {labSel.modulos.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleModulo(m.id)}
                className={`p-2 rounded-md text-left text-xs border transition-colors ${
                  form.modulos.includes(m.id)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-blue-900 border-blue-200 hover:border-blue-400'
                }`}
              >
                <div className="font-semibold">{m.nombre}</div>
                <div className="opacity-80">PC {m.pcInicio}-{m.pcFin} · {m.equipos} eq.</div>
              </button>
            ))}
          </div>
          {errores.modulos && <p className="text-xs text-red-600 mt-1">{errores.modulos}</p>}
        </div>
      )}

      <PreviewOcurrencias ocurrencias={ocurrencias} conflictos={conflictos} cargando={validando} />

      <button
        onClick={handleEnviar}
        disabled={enviando || validando || conflictos.length > 0 || ocurrencias.length === 0}
        className="w-full px-4 py-3 bg-utec-primary text-white rounded-lg hover:bg-utec-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
      >
        {enviando ? <Loader2 size={18} className="animate-spin" /> : <Send size={16} />}
        {enviando ? 'Enviando...' : 'Enviar solicitud de reserva'}
      </button>
    </div>
  );
}
