import { Clock, Users, User, BookOpen, CheckCircle2, Circle, Bookmark } from 'lucide-react';
import { formatearHora } from '../../utils/dateHelpers';

export default function EstadoActual({ claseActiva, reservaActiva, horaActual, labNombre }) {
  const ocupado = claseActiva || reservaActiva;
  const item = claseActiva || reservaActiva;
  const esReserva = !claseActiva && reservaActiva;

  if (!ocupado) {
    return (
      <div className="bg-green-50 border-l-4 border-green-600 rounded-xl p-5 shadow-sm">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-xs font-medium text-green-700 uppercase tracking-wider">
              Ahora mismo · {horaActual}
            </p>
            <h3 className="text-2xl font-bold text-green-900 mt-1">
              {labNombre} · Disponible
            </h3>
          </div>
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-full">
            <CheckCircle2 size={12} />
            LIBRE
          </span>
        </div>
        <p className="text-sm text-green-800 mt-2">
          No hay clases ni reservas activas en este momento.
        </p>
      </div>
    );
  }

  const colorBase = esReserva ? 'orange' : 'red';
  const colores = {
    red: {
      bg: 'bg-red-50',
      border: 'border-red-600',
      textPrimary: 'text-red-900',
      textSecondary: 'text-red-800',
      textMuted: 'text-red-700',
      badge: 'bg-red-600',
    },
    orange: {
      bg: 'bg-orange-50',
      border: 'border-orange-600',
      textPrimary: 'text-orange-900',
      textSecondary: 'text-orange-800',
      textMuted: 'text-orange-700',
      badge: 'bg-orange-600',
    },
  }[colorBase];

  return (
    <div className={`${colores.bg} border-l-4 ${colores.border} rounded-xl p-5 shadow-sm`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className={`text-xs font-medium ${colores.textMuted} uppercase tracking-wider`}>
            Ahora mismo · {horaActual}
          </p>
          <h3 className={`text-2xl font-bold ${colores.textPrimary} mt-1`}>
            {labNombre} · Ocupado
          </h3>
        </div>
        <span className={`inline-flex items-center gap-1 px-3 py-1 ${colores.badge} text-white text-xs font-semibold rounded-full`}>
          <Circle size={8} fill="currentColor" />
          {esReserva ? 'RESERVA' : 'EN CLASE'}
        </span>
      </div>

      <div className="space-y-2">
        {esReserva ? (
          <>
            <div className="flex items-center gap-2">
              <Bookmark size={16} className={colores.textMuted} />
              <span className={`text-sm font-semibold ${colores.textPrimary}`}>
                {item.asignatura || item.motivo || 'Reserva docente'}
              </span>
            </div>
            {item.docenteNombre && (
              <div className="flex items-center gap-2">
                <User size={16} className={colores.textMuted} />
                <span className={`text-sm ${colores.textSecondary}`}>{item.docenteNombre}</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <BookOpen size={16} className={colores.textMuted} />
              <span className={`text-sm font-semibold ${colores.textPrimary}`}>
                {item.codigoAsignatura} · {item.nombreAsignatura}
              </span>
            </div>
            {item.docente && (
              <div className="flex items-center gap-2">
                <User size={16} className={colores.textMuted} />
                <span className={`text-sm ${colores.textSecondary}`}>{item.docente}</span>
              </div>
            )}
            {item.inscritos && (
              <div className="flex items-center gap-2">
                <Users size={16} className={colores.textMuted} />
                <span className={`text-sm ${colores.textSecondary}`}>
                  Sección {item.seccion} · {item.inscritos} inscritos
                </span>
              </div>
            )}
          </>
        )}
        <div className="flex items-center gap-2">
          <Clock size={16} className={colores.textMuted} />
          <span className={`text-sm ${colores.textSecondary}`}>
            {formatearHora(item.horaInicio)} – {formatearHora(item.horaFin)}
          </span>
        </div>
      </div>
    </div>
  );
}
