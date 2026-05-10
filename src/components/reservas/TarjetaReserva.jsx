import { Clock, Calendar, MapPin, User, MessageSquare } from 'lucide-react';
import { ESTADOS_RESERVA_LABEL, ESTADOS_RESERVA_COLOR, TIPOS_RESERVA_LABEL } from '../../lib/constants';
import { formatearFechaCorta } from '../../utils/dateHelpers';

export default function TarjetaReserva({ reserva, onClick, seleccionada = false }) {
  const colores = ESTADOS_RESERVA_COLOR[reserva.estado] || ESTADOS_RESERVA_COLOR.pendiente;
  const fechaPrincipal = reserva.fechaInicio || (reserva.ocurrencias?.[0]) || '';
  const cantidadFechas = reserva.ocurrencias?.length || 1;

  return (
    <div
      onClick={onClick}
      className={`border rounded-lg p-3 cursor-pointer transition-all ${
        seleccionada ? `border-utec-primary ring-2 ring-utec-primary/30 ${colores.bg}` : `${colores.bg} ${colores.border} hover:border-utec-primary`
      }`}
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <p className={`text-sm font-semibold ${colores.text} truncate flex-1`}>
          {reserva.asignatura || reserva.motivo || 'Reserva'}
        </p>
        <span className={`text-[9px] px-2 py-0.5 ${colores.badge} text-white rounded font-bold uppercase whitespace-nowrap`}>
          {ESTADOS_RESERVA_LABEL[reserva.estado] || reserva.estado}
        </span>
      </div>

      <div className="space-y-1 text-xs text-gray-700">
        <div className="flex items-center gap-1.5">
          <User size={11} className="text-gray-500" />
          <span className="truncate">{reserva.docenteNombre}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin size={11} className="text-gray-500" />
          <span>{reserva.labNombre || reserva.labId}</span>
          {reserva.modulos?.length > 0 && (
            <span className="text-[10px] text-gray-500">
              · {reserva.modulos.join(', ').toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={11} className="text-gray-500" />
          <span>{reserva.horaInicio} – {reserva.horaFin}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar size={11} className="text-gray-500" />
          <span>
            {formatearFechaCorta(fechaPrincipal)}
            {cantidadFechas > 1 && (
              <span className="text-[10px] text-gray-500"> · +{cantidadFechas - 1} más</span>
            )}
          </span>
        </div>
        {reserva.motivoRechazo && (
          <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-red-200">
            <MessageSquare size={11} className="text-red-600 mt-0.5" />
            <span className="text-[11px] text-red-800">{reserva.motivoRechazo}</span>
          </div>
        )}
        {reserva.notaJefa && (
          <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-green-200">
            <MessageSquare size={11} className="text-green-600 mt-0.5" />
            <span className="text-[11px] text-green-800">{reserva.notaJefa}</span>
          </div>
        )}
      </div>
    </div>
  );
}
