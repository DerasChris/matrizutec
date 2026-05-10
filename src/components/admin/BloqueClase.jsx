import { Users, Clock, Bookmark, BookOpen } from 'lucide-react';
import { colorPorCodigo } from '../../lib/constants';
import { formatearHora } from '../../utils/dateHelpers';

export default function BloqueClase({ clase, onClick, compacto = false, esReserva = false }) {
  const codigo = clase.codigoAsignatura || clase.asignatura || clase.motivo || 'X';
  const color = colorPorCodigo(codigo);

  const titulo = esReserva
    ? (clase.asignatura || clase.motivo || 'Reserva')
    : `${clase.codigoAsignatura || ''}${clase.seccion ? `-${clase.seccion}` : ''}`;

  const Icono = esReserva ? Bookmark : BookOpen;

  const tooltip = esReserva
    ? `[RESERVA APROBADA]\n${clase.asignatura || clase.motivo || ''}\n${clase.docenteNombre || ''}\n${formatearHora(clase.horaInicio)}-${formatearHora(clase.horaFin)}`
    : `${clase.nombreAsignatura || ''}\n${clase.docente || ''}\n${formatearHora(clase.horaInicio)}-${formatearHora(clase.horaFin)}\n${clase.inscritos || 0} inscritos`;

  return (
    <button
      onClick={onClick}
      className={`w-full h-full text-left rounded text-white px-2 py-1 hover:ring-2 hover:ring-white hover:ring-offset-1 transition-all overflow-hidden flex flex-col justify-center ${
        esReserva ? 'border-2 border-dashed border-amber-300' : ''
      }`}
      style={{ backgroundColor: color }}
      title={tooltip}
    >
      <div className="flex items-center gap-1 text-[10px] font-semibold leading-tight truncate">
        <Icono size={10} className="flex-shrink-0" />
        <span className="truncate">{titulo}</span>
      </div>
      {!compacto && (
        <div className="flex items-center gap-2 text-[9px] opacity-90 leading-tight truncate mt-0.5">
          {!esReserva && clase.inscritos > 0 && (
            <span className="flex items-center gap-0.5">
              <Users size={8} />
              {clase.inscritos}
            </span>
          )}
          {esReserva && clase.docenteNombre && (
            <span className="truncate">{clase.docenteNombre.split(' ')[0]}</span>
          )}
          <span className="flex items-center gap-0.5">
            <Clock size={8} />
            {formatearHora(clase.horaInicio)}
          </span>
        </div>
      )}
    </button>
  );
}
