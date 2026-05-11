import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  X, Save, Loader2, Calendar, CalendarRange, Repeat, CalendarDays,
  Plus, AlertTriangle, Edit2,
} from 'lucide-react';
import {
  TIPOS_RESERVA, DIAS_SEMANA, FRANJAS_HORARIAS,
} from '../../lib/constants';
import { horaToMinutos, fechaActualISO } from '../../utils/dateHelpers';
import { expandirOcurrencias } from '../../utils/expansorOcurrencias';
import { validarConflictosReserva } from '../../utils/validadorConflictos';
import {
  obtenerClasesRegularesParaValidacion,
  obtenerReservasAprobadasFuturas,
  modificarReservaAprobada,
  calcularDiferencias,
} from '../../services/reservasService';
import { crearNotificacion } from '../../services/notificacionesService';
import { TIPOS_NOTIFICACION } from '../../lib/constants';
import { obtenerLaboratorios } from '../../services/laboratoriosService';
import PreviewOcurrencias from './PreviewOcurrencias';

export default function EditarReservaModal({ reserva, abierto, onCerrar, onGuardado, adminPerfil }) {
  const [labs, setLabs] = useState([]);
  const [form, setForm] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [validando, setValidando] = useState(false);
  const [conflictos, setConflictos] = useState([]);
  const [errores, setErrores] = useState({});
  const [nuevaFecha, setNuevaFecha] = useState('');

  useEffect(() => {
    if (abierto) {
      obtenerLaboratorios().then(setLabs).catch(console.error);
    }
  }, [abierto]);

  useEffect(() => {
    if (abierto && reserva) {
      setForm({
        tipo: reserva.tipo || TIPOS_RESERVA.UNICA,
        labId: reserva.labId || '',
        modulos: reserva.modulos || [],
        asignatura: reserva.asignatura || '',
        motivo: reserva.motivo || '',
        horaInicio: reserva.horaInicio || '08:00',
        horaFin: reserva.horaFin || '10:00',
        fechaInicio: reserva.fechaInicio || '',
        fechaFin: reserva.fechaFin || '',
        diasSemana: reserva.diasSemana || [],
        fechasEspecificas: reserva.fechasEspecificas || [],
        docenteNombre: reserva.docenteNombre || '',
        docenteEmail: reserva.docenteEmail || '',
      });
      setErrores({});
      setConflictos([]);
    }
  }, [abierto, reserva]);

  const labSel = useMemo(() => form && labs.find(l => l.id === form.labId), [labs, form]);
  const tieneModulos = labSel?.tieneModulos && Array.isArray(labSel?.modulos) && labSel.modulos.length > 0;

  const ocurrencias = useMemo(() => form ? expandirOcurrencias(form) : [], [form]);

  useEffect(() => {
    if (!form || !abierto) return;
    if (!form.labId || ocurrencias.length === 0 || !form.horaInicio || !form.horaFin) {
      setConflictos([]);
      return;
    }
    if (horaToMinutos(form.horaFin) <= horaToMinutos(form.horaInicio)) {
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
          ignorarReservaId: reserva?.id,
        });

        if (!cancelado) setConflictos(conflictosDetectados);
      } catch (e) {
        console.error('Error validando edición:', e);
      } finally {
        if (!cancelado) setValidando(false);
      }
    })();

    return () => { cancelado = true; };
  }, [form, ocurrencias, abierto, reserva?.id]);

  if (!abierto || !form) return null;

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
      toast.error('Esa fecha ya está agregada');
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
    if (!form.docenteNombre.trim()) e.docenteNombre = 'Indica el docente';
    if (horaToMinutos(form.horaFin) <= horaToMinutos(form.horaInicio)) {
      e.horario = 'La hora fin debe ser posterior a la hora inicio';
    }
    if (tieneModulos && form.modulos.length === 0) {
      e.modulos = 'Selecciona al menos un módulo';
    }
    if (ocurrencias.length === 0) e.fechas = 'No hay fechas válidas';

    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function handleGuardar() {
    if (!validar()) {
      toast.error('Revisa los campos marcados');
      return;
    }
    if (conflictos.length > 0) {
      toast.error('Hay conflictos. Ajusta para poder guardar.');
      return;
    }

    try {
      setEnviando(true);
      const labInfo = labs.find(l => l.id === form.labId);
      const datosModificados = {
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
        docenteNombre: form.docenteNombre.trim(),
        docenteEmail: form.docenteEmail.trim(),
      };

      const cambios = calcularDiferencias(reserva, datosModificados);

      if (cambios.length === 0) {
        toast('No hay cambios que guardar', { icon: 'ℹ️' });
        setEnviando(false);
        return;
      }

      await modificarReservaAprobada(reserva.id, datosModificados, adminPerfil.uid, adminPerfil.nombre);

      try {
        const detalleCambios = cambios.map(c => `• ${c.campo}: ${c.antes} → ${c.despues}`).join('\n');
        await crearNotificacion({
          destinatarioId: reserva.docenteId,
          destinatarioEmail: reserva.docenteEmail,
          tipo: TIPOS_NOTIFICACION.RESERVA_MODIFICADA,
          titulo: `Tu reserva fue modificada: ${datosModificados.asignatura || datosModificados.motivo}`,
          mensaje: `Tu reserva fue modificada por ${adminPerfil.nombre}.\n\nCambios realizados:\n${detalleCambios}`,
          refId: reserva.id,
          refTipo: 'reserva',
        });
      } catch (e) {
        console.warn('Notificación no enviada:', e);
      }

      toast.success('Reserva modificada. El docente fue notificado.');
      onGuardado?.();
      onCerrar();
    } catch (e) {
      console.error(e);
      toast.error('Error al modificar la reserva');
    } finally {
      setEnviando(false);
    }
  }

  const tipos = [
    { id: TIPOS_RESERVA.UNICA, icon: Calendar, label: 'Día único' },
    { id: TIPOS_RESERVA.RANGO, icon: CalendarRange, label: 'Rango' },
    { id: TIPOS_RESERVA.RECURRENTE, icon: Repeat, label: 'Recurrente' },
    { id: TIPOS_RESERVA.MULTIPLES, icon: CalendarDays, label: 'Múltiples' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Edit2 size={18} className="text-utec-primary" />
            <div>
              <h2 className="text-lg font-semibold">Editar reserva</h2>
              <p className="text-xs text-gray-500">Solicitada originalmente por {reserva.docenteNombre}</p>
            </div>
          </div>
          <button onClick={onCerrar} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-amber-900">
              Estás editando una reserva ya <strong>aprobada</strong>. Los cambios se aplican inmediatamente y el docente será notificado con detalle de qué cambió.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Tipo de reserva</label>
            <div className="grid grid-cols-4 gap-2">
              {tipos.map(t => {
                const Icon = t.icon;
                const activo = form.tipo === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => actualizar('tipo', t.id)}
                    className={`p-2 border-2 rounded-lg text-center text-xs transition-colors ${
                      activo ? 'border-utec-primary bg-utec-light' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon size={14} className="mx-auto mb-1" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Laboratorio *</label>
              <select
                value={form.labId}
                onChange={e => { actualizar('labId', e.target.value); actualizar('modulos', []); }}
                className="input-base text-sm"
              >
                <option value="">--</option>
                {labs.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}{l.tieneModulos ? ' (con módulos)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Asignatura *</label>
              <input
                type="text"
                value={form.asignatura}
                onChange={e => actualizar('asignatura', e.target.value)}
                className="input-base text-sm"
              />
              {errores.asignatura && <p className="text-xs text-red-600 mt-1">{errores.asignatura}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Motivo / Detalle</label>
            <textarea
              value={form.motivo}
              onChange={e => actualizar('motivo', e.target.value)}
              rows={2}
              className="input-base text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Docente *</label>
              <input
                type="text"
                value={form.docenteNombre}
                onChange={e => actualizar('docenteNombre', e.target.value)}
                className="input-base text-sm"
              />
              {errores.docenteNombre && <p className="text-xs text-red-600 mt-1">{errores.docenteNombre}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email docente</label>
              <input
                type="email"
                value={form.docenteEmail}
                onChange={e => actualizar('docenteEmail', e.target.value)}
                className="input-base text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Hora inicio *</label>
              <select value={form.horaInicio} onChange={e => actualizar('horaInicio', e.target.value)} className="input-base text-sm">
                {FRANJAS_HORARIAS.map(f => <option key={f.inicio} value={f.inicio}>{f.inicio}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Hora fin *</label>
              <select value={form.horaFin} onChange={e => actualizar('horaFin', e.target.value)} className="input-base text-sm">
                {FRANJAS_HORARIAS.map(f => <option key={f.fin} value={f.fin}>{f.fin}</option>)}
              </select>
            </div>
          </div>
          {errores.horario && <p className="text-xs text-red-600 -mt-2">{errores.horario}</p>}

          {form.tipo === TIPOS_RESERVA.UNICA && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha *</label>
              <input type="date" value={form.fechaInicio} onChange={e => actualizar('fechaInicio', e.target.value)} className="input-base text-sm" />
            </div>
          )}

          {form.tipo === TIPOS_RESERVA.RANGO && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Desde *</label>
                <input type="date" value={form.fechaInicio} onChange={e => actualizar('fechaInicio', e.target.value)} className="input-base text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Hasta *</label>
                <input type="date" value={form.fechaFin} onChange={e => actualizar('fechaFin', e.target.value)} className="input-base text-sm" />
              </div>
            </div>
          )}

          {form.tipo === TIPOS_RESERVA.RECURRENTE && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Desde *</label>
                  <input type="date" value={form.fechaInicio} onChange={e => actualizar('fechaInicio', e.target.value)} className="input-base text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Hasta *</label>
                  <input type="date" value={form.fechaFin} onChange={e => actualizar('fechaFin', e.target.value)} className="input-base text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Días de la semana *</label>
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
              </div>
            </>
          )}

          {form.tipo === TIPOS_RESERVA.MULTIPLES && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fechas específicas *</label>
              <div className="flex gap-2 mb-2">
                <input type="date" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)} className="input-base text-sm flex-1" />
                <button type="button" onClick={agregarFechaEspecifica} className="px-3 py-2 bg-utec-primary text-white rounded-lg flex items-center gap-1 text-xs">
                  <Plus size={12} /> Agregar
                </button>
              </div>
              {form.fechasEspecificas.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.fechasEspecificas.map(f => (
                    <span key={f} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-900 rounded text-xs border border-blue-200">
                      {f}
                      <button onClick={() => quitarFechaEspecifica(f)} className="hover:text-red-600">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {tieneModulos && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-blue-900">Módulos del Lab 03 *</label>
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
                    <div className="opacity-80">PC {m.pcInicio}-{m.pcFin}</div>
                  </button>
                ))}
              </div>
              {errores.modulos && <p className="text-xs text-red-600 mt-1">{errores.modulos}</p>}
            </div>
          )}

          <PreviewOcurrencias ocurrencias={ocurrencias} conflictos={conflictos} cargando={validando} />
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onCerrar}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={enviando || validando || conflictos.length > 0 || ocurrencias.length === 0}
            className="px-4 py-2 bg-utec-primary text-white rounded-lg hover:bg-utec-dark disabled:opacity-50 flex items-center gap-1.5 text-sm font-medium"
          >
            {enviando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {enviando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
