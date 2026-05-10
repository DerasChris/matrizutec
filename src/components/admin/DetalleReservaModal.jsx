import { X, Clock, Calendar, MapPin, User, Bookmark, MessageSquare } from 'lucide-react';
import { ESTADOS_RESERVA_LABEL, ESTADOS_RESERVA_COLOR } from '../../lib/constants';
import { formatearFechaCorta, formatearHora } from '../../utils/dateHelpers';

export default function DetalleReservaModal({ reserva, onCerrar }) {
  if (!reserva) return null;

  const colores = ESTADOS_RESERVA_COLOR[reserva.estado] || ESTADOS_RESERVA_COLOR.aprobada;
  const fechas = Array.isArray(reserva.ocurrencias) ? reserva.ocurrencias : [reserva.fechaInicio];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold">Detalle de reserva</h2>
          </div>
          <button onClick={onCerrar} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-gray-500 uppercase">Asignatura / Motivo</p>
              <h3 className="text-lg font-semibold text-gray-900 mt-1">
                {reserva.asignatura || reserva.motivo || 'Sin título'}
              </h3>
            </div>
            <span className={`text-[10px] px-2 py-1 ${colores.badge} text-white rounded font-bold uppercase whitespace-nowrap`}>
              {ESTADOS_RESERVA_LABEL[reserva.estado]}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Docente</p>
              <p className="flex items-center gap-1.5">
                <User size={14} className="text-gray-400" />
                {reserva.docenteNombre || 'No especificado'}
              </p>
              {reserva.docenteEmail && (
                <p className="text-xs text-gray-500 ml-5">{reserva.docenteEmail}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Laboratorio</p>
              <p className="flex items-center gap-1.5">
                <MapPin size={14} className="text-gray-400" />
                {reserva.labNombre || reserva.labId}
              </p>
              {reserva.modulos?.length > 0 && (
                <p className="text-xs text-gray-500 ml-5">
                  Módulos: {reserva.modulos.join(', ').toUpperCase()}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Horario</p>
              <p className="flex items-center gap-1.5">
                <Clock size={14} className="text-gray-400" />
                {formatearHora(reserva.horaInicio)} – {formatearHora(reserva.horaFin)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Fechas ({fechas.length})</p>
              <p className="flex items-center gap-1.5">
                <Calendar size={14} className="text-gray-400" />
                {fechas.length === 1
                  ? formatearFechaCorta(fechas[0])
                  : `${formatearFechaCorta(fechas[0])} → ${formatearFechaCorta(fechas[fechas.length - 1])}`}
              </p>
            </div>
          </div>

          {fechas.length > 1 && (
            <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
              <p className="text-xs text-gray-700 font-semibold uppercase mb-2">Todas las fechas reservadas</p>
              <div className="flex flex-wrap gap-1">
                {fechas.map(f => (
                  <span key={f} className="text-[11px] bg-white px-2 py-0.5 rounded border border-gray-200 font-mono">
                    {formatearFechaCorta(f)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {reserva.motivo && reserva.asignatura && reserva.motivo !== reserva.asignatura && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase mb-1">Detalle / motivo</p>
              <p className="text-sm text-gray-800">{reserva.motivo}</p>
            </div>
          )}

          {reserva.notaJefa && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
              <MessageSquare className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-green-700 font-semibold uppercase">Nota de jefatura</p>
                <p className="text-sm text-green-900 mt-1">{reserva.notaJefa}</p>
              </div>
            </div>
          )}

          {reserva.aprobadaPorNombre && (
            <p className="text-xs text-gray-500 text-center">
              Aprobada por {reserva.aprobadaPorNombre}
            </p>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex justify-end">
          <button
            onClick={onCerrar}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
