import { MapPin, CheckCircle } from 'lucide-react';

export default function SelectorLab({ labs, labSeleccionado, onChange, cargando }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <label className="block text-sm font-medium text-gray-700 mb-3">
        Selecciona un laboratorio
      </label>

      {cargando ? (
        <div className="text-sm text-gray-500 py-3">
          Cargando laboratorios...
        </div>
      ) : labs.length === 0 ? (
        <div className="text-sm text-gray-500 py-3">
          No hay laboratorios disponibles
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
          {labs.map(lab => {
            const activo = labSeleccionado?.id === lab.id;

            return (
              <button
                key={lab.id}
                type="button"
                onClick={() => onChange(lab)}
                disabled={cargando}
                className={`
                  w-full text-left rounded-xl border px-4 py-3 transition-all
                  flex items-center justify-between gap-3
                  ${activo
                    ? 'bg-blue-50 border-blue-600 shadow-sm'
                    : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-blue-300'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                <div className="min-w-0">
                  <div
                    className={`
                      text-sm font-semibold truncate
                      ${activo ? 'text-blue-700' : 'text-gray-900'}
                    `}
                  >
                    {lab.nombre}
                  </div>

                  <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                    <MapPin size={13} />
                    <span className="truncate">
                      {lab.ubicacion || 'Ubicación no definida'}
                    </span>
                  </div>

                  {(lab.capacidad || lab.equipos) && (
                    <div className="mt-1 text-xs text-gray-500">
                      {lab.capacidad && `Capacidad ${lab.capacidad}`}
                      {lab.capacidad && lab.equipos && ' · '}
                      {lab.equipos && `${lab.equipos} equipos`}
                    </div>
                  )}
                </div>

                {activo && (
                  <CheckCircle className="w-5 h-5 text-blue-600 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {labSeleccionado && (
        <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <MapPin size={14} />
            <span>
              {labSeleccionado.ubicacion || 'Ubicación no definida'}
              {labSeleccionado.capacidad && ` · Capacidad ${labSeleccionado.capacidad}`}
              {labSeleccionado.equipos && ` · ${labSeleccionado.equipos} equipos`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}