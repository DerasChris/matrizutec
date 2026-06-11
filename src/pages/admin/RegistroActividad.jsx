import { useEffect, useState, useMemo } from 'react';
import { Loader2, RefreshCw, ClipboardList, BookOpen, Users, Calendar, Package } from 'lucide-react';
import { obtenerActividadReciente } from '../../services/logService';

const TIPOS = {
  clase_creada:        { label: 'Clase creada',        color: 'green',  grupo: 'clases' },
  clase_editada:       { label: 'Clase editada',        color: 'blue',   grupo: 'clases' },
  clase_eliminada:     { label: 'Clase eliminada',      color: 'red',    grupo: 'clases' },
  clase_desactivada:   { label: 'Clase desactivada',    color: 'amber',  grupo: 'clases' },
  clases_importadas:   { label: 'Clases importadas',    color: 'purple', grupo: 'clases' },
  reserva_aprobada:    { label: 'Reserva aprobada',     color: 'green',  grupo: 'reservas' },
  reserva_rechazada:   { label: 'Reserva rechazada',    color: 'red',    grupo: 'reservas' },
  reserva_eliminada:   { label: 'Reserva eliminada',    color: 'red',    grupo: 'reservas' },
  ciclo_activado:      { label: 'Ciclo activado',       color: 'blue',   grupo: 'ciclos' },
  usuario_rol_cambiado:  { label: 'Rol cambiado',       color: 'amber',  grupo: 'usuarios' },
  usuario_activado:    { label: 'Usuario activado',     color: 'green',  grupo: 'usuarios' },
  usuario_desactivado: { label: 'Usuario desactivado',  color: 'red',    grupo: 'usuarios' },
};

const COLOR_DOT = {
  green:  'bg-green-500',
  blue:   'bg-blue-500',
  red:    'bg-red-500',
  amber:  'bg-amber-500',
  purple: 'bg-purple-500',
};

const COLOR_BADGE = {
  green:  'bg-green-100 text-green-800',
  blue:   'bg-blue-100 text-blue-800',
  red:    'bg-red-100 text-red-800',
  amber:  'bg-amber-100 text-amber-800',
  purple: 'bg-purple-100 text-purple-800',
};

const FILTROS = [
  { id: 'todos',    label: 'Todos',    icon: ClipboardList },
  { id: 'clases',   label: 'Clases',   icon: BookOpen },
  { id: 'reservas', label: 'Reservas', icon: Calendar },
  { id: 'usuarios', label: 'Usuarios', icon: Users },
  { id: 'ciclos',   label: 'Ciclos',   icon: Package },
];

function fmtTimestamp(ts) {
  if (!ts?.toDate) return '—';
  const d = ts.toDate();
  return d.toLocaleString('es-SV', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDiaAgrupado(ts) {
  if (!ts?.toDate) return 'Sin fecha';
  const d = ts.toDate();
  const hoy = new Date();
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return 'Hoy';
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-SV', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function RegistroActividad() {
  const [entradas, setEntradas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      setCargando(true);
      const data = await obtenerActividadReciente(200);
      setEntradas(data);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }

  const entradasFiltradas = useMemo(() => {
    if (filtro === 'todos') return entradas;
    return entradas.filter(e => TIPOS[e.tipo]?.grupo === filtro);
  }, [entradas, filtro]);

  // Agrupar por día
  const grupos = useMemo(() => {
    const map = new Map();
    for (const e of entradasFiltradas) {
      const dia = fmtDiaAgrupado(e.timestamp);
      if (!map.has(dia)) map.set(dia, []);
      map.get(dia).push(e);
    }
    return [...map.entries()];
  }, [entradasFiltradas]);

  return (
    <div>
      <div className="mb-5 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registro de actividad</h1>
          <p className="text-gray-600 text-sm mt-1">Historial de acciones realizadas en el sistema</p>
        </div>
        <button
          onClick={cargar}
          disabled={cargando}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-5">
        {FILTROS.map(f => {
          const Icon = f.icon;
          const activo = filtro === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                activo
                  ? 'bg-utec-primary text-white border-utec-primary'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              <Icon size={14} />
              {f.label}
            </button>
          );
        })}
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-utec-primary animate-spin" />
        </div>
      ) : grupos.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay actividad registrada</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map(([dia, items]) => (
            <div key={dia}>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{dia}</p>
                <div className="flex-1 border-t border-gray-200" />
                <p className="text-xs text-gray-400">{items.length} acción{items.length !== 1 ? 'es' : ''}</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                {items.map(entrada => {
                  const meta = TIPOS[entrada.tipo] || { label: entrada.tipo, color: 'blue' };
                  return (
                    <div key={entrada.id} className="flex items-start gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                      {/* Dot */}
                      <div className="flex flex-col items-center pt-1 shrink-0">
                        <div className={`w-2.5 h-2.5 rounded-full ${COLOR_DOT[meta.color] || 'bg-gray-400'}`} />
                      </div>

                      {/* Contenido */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${COLOR_BADGE[meta.color] || 'bg-gray-100 text-gray-700'}`}>
                            {meta.label}
                          </span>
                          <span className="text-xs text-gray-500">
                            {fmtTimestamp(entrada.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 mt-0.5">{entrada.descripcion}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {entrada.usuario?.nombre}
                          {entrada.usuario?.rol && (
                            <span className="ml-1 opacity-60">({entrada.usuario.rol})</span>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
