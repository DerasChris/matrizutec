import { CheckCircle2, AlertTriangle, Calendar } from 'lucide-react';
import { formatearFechaCorta } from '../../utils/dateHelpers';

export default function PreviewOcurrencias({ ocurrencias, conflictos = [], cargando = false }) {
  if (cargando) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center text-sm text-gray-500">
        Validando disponibilidad...
      </div>
    );
  }

  if (ocurrencias.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center text-sm text-gray-500">
        Completa el formulario para ver las fechas que se reservarán
      </div>
    );
  }

  const fechasConConflicto = new Set(conflictos.map(c => c.fecha));
  const sinConflictos = conflictos.length === 0;

  return (
    <div className={`border rounded-lg p-3 ${
      sinConflictos ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
    }`}>
      <div className="flex items-start gap-2 mb-3">
        {sinConflictos ? (
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1">
          <p className={`text-sm font-semibold ${sinConflictos ? 'text-green-900' : 'text-red-900'}`}>
            {sinConflictos
              ? `Disponible · ${ocurrencias.length} fecha${ocurrencias.length === 1 ? '' : 's'} a reservar`
              : `${conflictos.length} conflicto${conflictos.length === 1 ? '' : 's'} detectado${conflictos.length === 1 ? '' : 's'}`}
          </p>
          {!sinConflictos && (
            <p className="text-xs text-red-800 mt-0.5">
              No puedes enviar la solicitud. Ajusta el horario, lab o módulos para evitar choques.
            </p>
          )}
        </div>
      </div>

      <div className="max-h-40 overflow-y-auto space-y-1">
        {ocurrencias.map(fecha => {
          const conflictosDeEsta = conflictos.filter(c => c.fecha === fecha);
          const tieneConflicto = conflictosDeEsta.length > 0;
          return (
            <div
              key={fecha}
              className={`text-xs flex items-start gap-2 px-2 py-1 rounded ${
                tieneConflicto ? 'bg-white border border-red-200' : 'text-green-900'
              }`}
            >
              <Calendar size={12} className={tieneConflicto ? 'text-red-600 mt-0.5' : 'text-green-600 mt-0.5'} />
              <div className="flex-1">
                <span className={tieneConflicto ? 'text-red-900 font-medium' : ''}>
                  {formatearFechaCorta(fecha)}
                </span>
                {tieneConflicto && (
                  <ul className="mt-1 space-y-0.5">
                    {conflictosDeEsta.map((c, i) => (
                      <li key={i} className="text-[11px] text-red-800">• {c.motivo}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
