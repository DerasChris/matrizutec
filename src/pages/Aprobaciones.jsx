import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Loader2, Check, X as XIcon, Trash2, Edit2, RefreshCw, Inbox,
  Clock, Calendar, MapPin, User, MessageSquare, History, Bus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  obtenerReservasPendientes,
  obtenerReservasProcesadasRecientes,
  aprobarReserva,
  rechazarReserva,
  eliminarReserva,
} from '../services/reservasService';
import { crearNotificacion } from '../services/notificacionesService';
import { TIPOS_NOTIFICACION, ESTADOS_RESERVA, ESTADOS_RESERVA_LABEL, ESTADOS_RESERVA_COLOR, TIPOS_RESERVA } from '../lib/constants';
import { formatearFechaCorta } from '../utils/dateHelpers';
import TarjetaReserva from '../components/reservas/TarjetaReserva';
import EditarReservaModal from '../components/reservas/EditarReservaModal';

export default function Aprobaciones() {
  const { perfil } = useAuth();
  const [pendientes, setPendientes] = useState([]);
  const [procesadas, setProcesadas] = useState([]);
  const [seleccionada, setSeleccionada] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [accion, setAccion] = useState(false);
  const [nota, setNota] = useState('');
  const [editarAbierto, setEditarAbierto] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    try {
      setCargando(true);
      const [pend, proc] = await Promise.all([
        obtenerReservasPendientes(),
        obtenerReservasProcesadasRecientes(15),
      ]);
      setPendientes(pend);
      setProcesadas(proc);
      if (pend.length > 0 && !seleccionada) {
        setSeleccionada(pend[0]);
      } else if (seleccionada) {
        const actual = [...pend, ...proc].find(r => r.id === seleccionada.id);
        setSeleccionada(actual || pend[0] || proc[0] || null);
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar reservas');
    } finally {
      setCargando(false);
    }
  }

  async function handleAprobar() {
    if (!seleccionada) return;
    try {
      setAccion(true);
      await aprobarReserva(seleccionada.id, perfil.uid, perfil.nombre, nota.trim());

      try {
        await crearNotificacion({
          destinatarioId: seleccionada.docenteId,
          destinatarioEmail: seleccionada.docenteEmail,
          tipo: TIPOS_NOTIFICACION.RESERVA_APROBADA,
          titulo: `Reserva aprobada: ${seleccionada.asignatura || seleccionada.motivo}`,
          mensaje: `Tu solicitud para ${seleccionada.labNombre} (${seleccionada.horaInicio}-${seleccionada.horaFin}) en ${seleccionada.ocurrencias?.length || 1} fecha(s) fue aprobada.${nota.trim() ? '\n\nNota de jefatura: ' + nota.trim() : ''}`,
          refId: seleccionada.id,
          refTipo: 'reserva',
        });
      } catch (e) {
        console.warn('Notificación no enviada:', e);
      }

      toast.success('Reserva aprobada y notificada al docente');
      setNota('');
      await cargar();
    } catch (e) {
      console.error(e);
      toast.error('Error al aprobar');
    } finally {
      setAccion(false);
    }
  }

  async function handleRechazar() {
    if (!seleccionada) return;
    if (!nota.trim()) {
      toast.error('Indica el motivo del rechazo en la nota');
      return;
    }
    try {
      setAccion(true);
      await rechazarReserva(seleccionada.id, perfil.uid, perfil.nombre, nota.trim());

      try {
        await crearNotificacion({
          destinatarioId: seleccionada.docenteId,
          destinatarioEmail: seleccionada.docenteEmail,
          tipo: TIPOS_NOTIFICACION.RESERVA_RECHAZADA,
          titulo: `Reserva rechazada: ${seleccionada.asignatura || seleccionada.motivo}`,
          mensaje: `Tu solicitud para ${seleccionada.labNombre} (${seleccionada.horaInicio}-${seleccionada.horaFin}) fue rechazada.\n\nMotivo: ${nota.trim()}`,
          refId: seleccionada.id,
          refTipo: 'reserva',
        });
      } catch (e) {
        console.warn('Notificación no enviada:', e);
      }

      toast.success('Reserva rechazada y notificada al docente');
      setNota('');
      await cargar();
    } catch (e) {
      console.error(e);
      toast.error('Error al rechazar');
    } finally {
      setAccion(false);
    }
  }

  async function handleEliminar() {
    if (!seleccionada) return;
    if (!confirm('¿Eliminar esta reserva permanentemente? El docente será notificado.')) return;
    try {
      setAccion(true);

      try {
        await crearNotificacion({
          destinatarioId: seleccionada.docenteId,
          destinatarioEmail: seleccionada.docenteEmail,
          tipo: TIPOS_NOTIFICACION.RESERVA_ELIMINADA,
          titulo: `Reserva eliminada por jefatura`,
          mensaje: `La reserva "${seleccionada.asignatura || seleccionada.motivo}" para ${seleccionada.labNombre} fue eliminada por jefatura.`,
          refId: seleccionada.id,
          refTipo: 'reserva',
        });
      } catch (e) {
        console.warn('Notificación no enviada:', e);
      }

      await eliminarReserva(seleccionada.id);
      toast.success('Reserva eliminada');
      setSeleccionada(null);
      await cargar();
    } catch (e) {
      console.error(e);
      toast.error('Error al eliminar');
    } finally {
      setAccion(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-12 h-12 text-utec-primary animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aprobación de reservas</h1>
          <p className="text-gray-600 text-sm mt-1">
            {pendientes.length} pendiente{pendientes.length === 1 ? '' : 's'} · {procesadas.length} procesada{procesadas.length === 1 ? '' : 's'} reciente{procesadas.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          onClick={cargar}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
        >
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          {pendientes.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
              <Inbox className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-700 font-medium">Bandeja vacía</p>
              <p className="text-xs text-gray-500 mt-1">No hay reservas pendientes</p>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-gray-700 uppercase mb-2">Pendientes ({pendientes.length})</p>
              <div className="space-y-2">
                {pendientes.map(r => (
                  <TarjetaReserva
                    key={r.id}
                    reserva={r}
                    onClick={() => { setSeleccionada(r); setNota(''); }}
                    seleccionada={seleccionada?.id === r.id}
                  />
                ))}
              </div>
            </div>
          )}

          {procesadas.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 uppercase mb-2 mt-4">Procesadas recientes</p>
              <div className="space-y-2">
                {procesadas.map(r => (
                  <TarjetaReserva
                    key={r.id}
                    reserva={r}
                    onClick={() => { setSeleccionada(r); setNota(''); }}
                    seleccionada={seleccionada?.id === r.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {seleccionada ? (
            <DetalleReserva
              reserva={seleccionada}
              nota={nota}
              setNota={setNota}
              accion={accion}
              onAprobar={handleAprobar}
              onRechazar={handleRechazar}
              onEliminar={handleEliminar}
              onEditar={() => setEditarAbierto(true)}
            />
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <p className="text-gray-500 text-sm">Selecciona una reserva para ver el detalle</p>
            </div>
          )}
        </div>
      </div>

      <EditarReservaModal
        reserva={seleccionada}
        abierto={editarAbierto}
        onCerrar={() => setEditarAbierto(false)}
        onGuardado={cargar}
        adminPerfil={perfil}
      />
    </div>
  );
}

function DetalleReserva({ reserva, nota, setNota, accion, onAprobar, onRechazar, onEliminar, onEditar }) {
  const colores = ESTADOS_RESERVA_COLOR[reserva.estado];
  const esPendiente = reserva.estado === ESTADOS_RESERVA.PENDIENTE;
  const esAprobada = reserva.estado === ESTADOS_RESERVA.APROBADA;
  const fechas = reserva.ocurrencias || [reserva.fechaInicio];
  const esTour = reserva.tipo === TIPOS_RESERVA.TOUR;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Solicitud</p>
            {esTour && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full border border-purple-200">
                <Bus size={10} /> Tour UTEC
              </span>
            )}
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mt-1">
            {esTour
              ? (reserva.colegio || 'Sin institución')
              : (reserva.asignatura || reserva.motivo || 'Sin título')}
          </h2>
        </div>
        <span className={`text-xs px-3 py-1 ${colores.badge} text-white rounded font-bold uppercase`}>
          {ESTADOS_RESERVA_LABEL[reserva.estado]}
        </span>
      </div>

      {esTour && reserva.colegio && (
        <div className="mb-4 flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
          <Bus size={16} className="text-purple-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-purple-700 font-semibold uppercase">Institución visitante</p>
            <p className="text-sm font-medium text-purple-900 mt-0.5">{reserva.colegio}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500 uppercase">{esTour ? 'Solicitante' : 'Docente'}</p>
          <p className="text-sm font-medium mt-1 flex items-center gap-1.5">
            <User size={14} className="text-gray-400" />
            {reserva.docenteNombre}
          </p>
          <p className="text-xs text-gray-500">{reserva.docenteEmail}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Laboratorio</p>
          <p className="text-sm font-medium mt-1 flex items-center gap-1.5">
            <MapPin size={14} className="text-gray-400" />
            {reserva.labNombre || reserva.labId}
          </p>
          {reserva.modulos?.length > 0 && (
            <p className="text-xs text-gray-500">Módulos: {reserva.modulos.join(', ').toUpperCase()}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Horario</p>
          <p className="text-sm font-medium mt-1 flex items-center gap-1.5">
            <Clock size={14} className="text-gray-400" />
            {reserva.horaInicio} – {reserva.horaFin}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Fechas ({fechas.length})</p>
          <p className="text-sm font-medium mt-1 flex items-center gap-1.5">
            <Calendar size={14} className="text-gray-400" />
            {formatearFechaCorta(fechas[0])}
            {fechas.length > 1 && <span className="text-xs text-gray-500"> al {formatearFechaCorta(fechas[fechas.length - 1])}</span>}
          </p>
        </div>
      </div>

      {fechas.length > 1 && (
        <div className="mb-4 bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
          <p className="text-xs text-gray-700 font-semibold mb-1">Todas las fechas</p>
          <div className="flex flex-wrap gap-1">
            {fechas.map(f => (
              <span key={f} className="text-[10px] bg-white px-1.5 py-0.5 rounded border border-gray-200">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {reserva.motivo && reserva.asignatura && (
        <div className="mb-4 bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase mb-1">Detalle / motivo</p>
          <p className="text-sm text-gray-800">{reserva.motivo}</p>
        </div>
      )}

      {reserva.notaJefa && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
          <MessageSquare className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-green-700 font-semibold uppercase">Nota de aprobación</p>
            <p className="text-sm text-green-900 mt-1">{reserva.notaJefa}</p>
          </div>
        </div>
      )}

      {reserva.motivoRechazo && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <MessageSquare className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-red-700 font-semibold uppercase">Motivo de rechazo</p>
            <p className="text-sm text-red-900 mt-1">{reserva.motivoRechazo}</p>
          </div>
        </div>
      )}

      {reserva.modificadaPorNombre && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-2.5 flex items-center gap-2 text-xs">
          <History className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span className="text-blue-900">
            Modificada por <strong>{reserva.modificadaPorNombre}</strong>
            {reserva.modificadaEn?.toDate && (
              <> el {reserva.modificadaEn.toDate().toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' })}</>
            )}
          </span>
        </div>
      )}

      {esPendiente && (
        <>
          <div className="mb-3">
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Nota / motivo (opcional para aprobar, requerido para rechazar)
            </label>
            <textarea
              value={nota}
              onChange={e => setNota(e.target.value)}
              rows={2}
              className="input-base text-sm"
              placeholder="Ej: Aprobada. Recuerda dejar el lab limpio."
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={onAprobar}
              disabled={accion}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
            >
              <Check size={18} />
              Aprobar
            </button>
            <button
              onClick={onRechazar}
              disabled={accion}
              className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
            >
              <XIcon size={18} />
              Rechazar
            </button>
          </div>
        </>
      )}

      {esAprobada && (
        <div className="flex gap-2">
          <button
            onClick={onEditar}
            disabled={accion}
            className="flex-1 px-4 py-3 bg-utec-primary text-white rounded-lg hover:bg-utec-dark disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
          >
            <Edit2 size={18} />
            Editar reserva
          </button>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={onEliminar}
          disabled={accion}
          className="px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 rounded flex items-center gap-1"
        >
          <Trash2 size={12} />
          Eliminar permanentemente
        </button>
      </div>
    </div>
  );
}
