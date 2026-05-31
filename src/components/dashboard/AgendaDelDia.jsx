import { useState, useMemo } from 'react';
import { Clock, Bookmark, BookOpen, CalendarPlus, Calendar, Bus } from 'lucide-react';
import {
  estaEnRango,
  haPasado,
  horaActualString,
  formatearHora,
  ordenarPorHoraInicio,
} from '../../utils/dateHelpers';
import { MODULOS_LAB_03, TIPOS_RESERVA } from '../../lib/constants';

export default function AgendaDelDia({ clases = [], reservas = [], labNombre }) {
  const [vista, setVista] = useState('actual');
  const horaActual = horaActualString();

  const items = useMemo(() => {
    const todos = [
      ...clases.map(c => ({
        ...c,
        _tipoItem: 'clase',
        titulo: `${c.codigoAsignatura || ''} · ${c.nombreAsignatura || ''}`.trim().replace(/^·\s*/, ''),
        subtitulo: c.docente,
        meta: c.inscritos ? `${c.inscritos} inscritos` : null,
        esTour: false,
        modulos: c.modulos || [],
      })),
      ...reservas.map(r => ({
        ...r,
        _tipoItem: 'reserva',
        titulo: r.tipo === TIPOS_RESERVA.TOUR
          ? `Tour UTEC – ${r.colegio || ''}`
          : (r.asignatura || r.motivo || 'Reserva docente'),
        subtitulo: r.tipo === TIPOS_RESERVA.TOUR ? r.colegio : r.docenteNombre,
        meta: r.tipo === TIPOS_RESERVA.TOUR ? 'Tour UTEC' : 'Reserva aprobada',
        esTour: r.tipo === TIPOS_RESERVA.TOUR,
        modulos: r.modulos || [],
      })),
    ];
    return ordenarPorHoraInicio(todos);
  }, [clases, reservas]);

  const itemsClasificados = useMemo(() => {
    return items.map(item => {
      const activa = estaEnRango(horaActual, item.horaInicio, item.horaFin);
      const pasada = !activa && haPasado(item.horaFin);
      return { ...item, activa, pasada };
    });
  }, [items, horaActual]);

  const itemsFiltrados = vista === 'actual'
    ? itemsClasificados.filter(i => !i.pasada)
    : itemsClasificados;

  const stats = useMemo(() => ({
    total: itemsClasificados.length,
    pasadas: itemsClasificados.filter(i => i.pasada).length,
    activas: itemsClasificados.filter(i => i.activa).length,
    futuras: itemsClasificados.filter(i => !i.pasada && !i.activa).length,
  }), [itemsClasificados]);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar size={14} className="text-utec-primary" />
            Agenda del día
          </h3>
          {labNombre && (
            <p className="text-[11px] text-gray-500 mt-0.5">{labNombre}</p>
          )}
        </div>

        {itemsClasificados.length > 0 && (
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setVista('actual')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                vista === 'actual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Estado actual
            </button>
            <button
              onClick={() => setVista('completo')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                vista === 'completo' ? 'bg-utec-primary text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Día completo
            </button>
          </div>
        )}
      </div>

      {itemsFiltrados.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <CalendarPlus className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-700 font-medium">
            {vista === 'actual' && itemsClasificados.length > 0
              ? 'No hay actividad pendiente'
              : 'No hay actividad programada hoy'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {vista === 'actual' && itemsClasificados.length > 0
              ? `Todas las ${itemsClasificados.length} actividades del día ya finalizaron.`
              : 'Este laboratorio está completamente disponible para reservas.'}
          </p>
          {vista === 'actual' && itemsClasificados.length > 0 && (
            <button
              onClick={() => setVista('completo')}
              className="mt-3 text-xs text-utec-primary hover:underline font-medium"
            >
              Ver día completo
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {itemsFiltrados.map(item => (
              <ItemAgenda key={`${item.tipo}-${item.id}`} item={item} />
            ))}
          </div>

          {vista === 'completo' && stats.total > 0 && (
            <p className="text-[11px] text-gray-500 text-center mt-3">
              {stats.total} actividad{stats.total === 1 ? '' : 'es'} hoy
              {' · '}{stats.pasadas} finalizada{stats.pasadas === 1 ? '' : 's'}
              {' · '}{stats.activas} en curso
              {' · '}{stats.futuras} próxima{stats.futuras === 1 ? '' : 's'}
            </p>
          )}

          {vista === 'actual' && stats.pasadas > 0 && (
            <button
              onClick={() => setVista('completo')}
              className="w-full text-[11px] text-utec-primary hover:underline mt-3 py-1"
            >
              Ver también las {stats.pasadas} ya finalizada{stats.pasadas === 1 ? '' : 's'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ItemAgenda({ item }) {
  const { activa, pasada, _tipoItem: tipo } = item;

  let estilos;
  if (activa) {
    estilos = item.esTour
      ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-400'
      : tipo === 'reserva'
        ? 'bg-orange-50 border-orange-300 ring-2 ring-orange-400'
        : 'bg-red-50 border-red-300 ring-2 ring-red-400';
  } else if (pasada) {
    estilos = 'bg-gray-50 border-gray-200 opacity-60';
  } else {
    estilos = 'bg-white border-gray-200 hover:border-gray-300';
  }

  const Icono = item.esTour ? Bus : (tipo === 'reserva' ? Bookmark : BookOpen);
  const colorIcono = item.esTour ? 'text-purple-600' : (tipo === 'reserva' ? 'text-orange-600' : 'text-blue-600');

  return (
    <div className={`flex items-start gap-3 p-3 border rounded-lg transition-all ${estilos}`}>
      <div className={`flex-shrink-0 ${colorIcono} mt-0.5`}>
        <Icono size={18} />
      </div>

      <div className="flex-shrink-0 flex items-center gap-1.5 text-xs font-mono text-gray-700 min-w-[110px] mt-0.5">
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
        {item.modulos?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.modulos.map(moduloId => {
              const mod = MODULOS_LAB_03.find(m => m.id === moduloId);
              return (
                <span
                  key={moduloId}
                  className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200"
                >
                  {mod?.nombre || moduloId.toUpperCase()}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 text-right mt-0.5">
        {activa && (
          <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full text-white ${
            item.esTour ? 'bg-purple-600' : tipo === 'reserva' ? 'bg-orange-600' : 'bg-red-600'
          } animate-pulse`}>
            AHORA
          </span>
        )}
        {pasada && (
          <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-400 text-white">
            FINALIZADA
          </span>
        )}
        {!activa && !pasada && item.meta && (
          <span className="text-xs text-gray-500">{item.meta}</span>
        )}
      </div>
    </div>
  );
}
