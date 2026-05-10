import { Clock, Bookmark, BookOpen, CalendarPlus } from 'lucide-react';
import { estaEnRango, haPasado, horaActualString, formatearHora, ordenarPorHoraInicio } from '../../utils/dateHelpers';

export default function AgendaDelDia({ clases, reservas }) {
  const horaActual = horaActualString();

  const items = [
    ...clases.map(c => ({
      ...c,
      tipo: 'clase',
      titulo: `${c.codigoAsignatura} · ${c.nombreAsignatura}`,
      subtitulo: c.docente,
      meta: c.inscritos ? `${c.inscritos} inscritos` : null,
      modulos: c.modulos || [],
    })),
    ...reservas.map(r => ({
      ...r,
      tipo: 'reserva',
      titulo: r.asignatura || r.motivo || 'Reserva docente',
      subtitulo: r.docenteNombre,
      meta: 'Reserva aprobada',
    })),
  ];

  const ordenados = ordenarPorHoraInicio(items);

  if (ordenados.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <CalendarPlus className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-700 font-medium">No hay actividad programada hoy</p>
        <p className="text-sm text-gray-500 mt-1">
          Este laboratorio está completamente disponible para reservas.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
        Agenda del día
      </h3>
      <div className="space-y-2">
        {ordenados.map(item => {
          const activa = estaEnRango(horaActual, item.horaInicio, item.horaFin);
          const pasada = haPasado(item.horaFin);

          let estilos;
          if (activa) {
            estilos = item.tipo === 'reserva'
              ? 'bg-orange-50 border-orange-300 ring-2 ring-orange-400'
              : 'bg-red-50 border-red-300 ring-2 ring-red-400';
          } else if (pasada) {
            estilos = 'bg-gray-50 border-gray-200 opacity-60';
          } else {
            estilos = 'bg-white border-gray-200 hover:border-gray-300';
          }

          const Icono = item.tipo === 'reserva' ? Bookmark : BookOpen;
          const colorIcono = item.tipo === 'reserva' ? 'text-orange-600' : 'text-blue-600';

          return (
            <div
              key={`${item.tipo}-${item.id}`}
              className={`flex items-center gap-3 p-3 border rounded-lg transition-all ${estilos}`}
            >
              <div className={`flex-shrink-0 ${colorIcono}`}>
                <Icono size={18} />
              </div>

              <div className="flex-shrink-0 flex items-center gap-1.5 text-xs font-mono text-gray-700 min-w-[110px]">
                <Clock size={12} />
                <span>{formatearHora(item.horaInicio)} – {formatearHora(item.horaFin)}</span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {item.titulo}
                </p>
                {item.subtitulo && (
                  <p className="text-xs text-gray-600 truncate">{item.subtitulo}</p>
                )}
              </div>

              <div className="flex-shrink-0 text-right">
                {activa && (
                  <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full text-white ${
                    item.tipo === 'reserva' ? 'bg-orange-600' : 'bg-red-600'
                  }`}>
                    AHORA
                  </span>
                )}
                {!activa && item.meta && (
                  <span className="text-xs text-gray-500">{item.meta}</span>
                )}
              </div>

                {item.modulos?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.modulos.map((modulo, index) => (
                      <span
                        key={index}
                        className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200"
                      >
                        {modulo === 'm1' ? 'MODULO 1' : modulo === 'm2' ? 'MODULO 2' : modulo === 'm3' ? 'MODULO 3' : 'MODULO 4'}
                      </span>
                    ))}
                  </div>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
