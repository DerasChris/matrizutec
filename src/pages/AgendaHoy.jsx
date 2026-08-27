import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Loader2, RefreshCw, CalendarClock, BookOpen, Bookmark, Bus, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useReloj from '../hooks/useReloj';
import {
  obtenerLaboratorios,
  obtenerCicloActivo,
  obtenerClasesDeHoyTodosLosLabs,
  obtenerReservasAprobadasDeHoyTodosLosLabs,
} from '../services/laboratoriosService';
import {
  getDiaSemanaActual, formatearFechaLarga, fechaActualISO,
  horaActualString, estaEnRango, ordenarPorHoraInicio,
} from '../utils/dateHelpers';
import { ROLES, TIPOS_RESERVA } from '../lib/constants';

// Vista compacta de "qué está pasando hoy" en los laboratorios propios del
// usuario — para ojear rápido, no para leer en detalle: labs sin nada
// programado hoy no aparecen, siempre muestra el día completo (no hay que
// elegir "estado actual" primero), y cada actividad en curso se marca.
export default function AgendaHoy() {
  const { perfil } = useAuth();
  const ahora = useReloj();
  const esEncargado = perfil?.rol === ROLES.ENCARGADO;
  const horaActual = horaActualString();

  const [labs, setLabs] = useState([]);
  const [ciclo, setCiclo] = useState(null);
  const [clasesHoy, setClasesHoy] = useState([]);
  const [reservasHoy, setReservasHoy] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoAgenda, setCargandoAgenda] = useState(false);

  useEffect(() => { cargarInicial(); }, []);
  useEffect(() => { if (ciclo) cargarAgenda(); }, [ciclo, ahora.toDateString()]);

  async function cargarInicial() {
    try {
      setCargando(true);
      const [labsData, cicloData] = await Promise.all([
        obtenerLaboratorios(),
        obtenerCicloActivo(),
      ]);
      const labsPropios = esEncargado
        ? labsData.filter(l => (perfil?.labsAsignados || []).includes(l.id))
        : labsData;
      setLabs(labsPropios);
      setCiclo(cicloData);
      if (esEncargado && labsPropios.length === 0) {
        toast.error('Todavía no tienes laboratorios asignados. Pide a la jefa que te asigne uno.');
      }
      if (!cicloData) toast.error('No hay un ciclo activo.');
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar la agenda');
    } finally {
      setCargando(false);
    }
  }

  async function cargarAgenda() {
    if (!ciclo) return;
    try {
      setCargandoAgenda(true);
      const dia = getDiaSemanaActual();
      const fecha = fechaActualISO();
      const [clasesData, reservasData] = await Promise.all([
        obtenerClasesDeHoyTodosLosLabs(ciclo.id, dia.id),
        obtenerReservasAprobadasDeHoyTodosLosLabs(fecha),
      ]);
      setClasesHoy(clasesData);
      setReservasHoy(reservasData);
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar la agenda');
    } finally {
      setCargandoAgenda(false);
    }
  }

  // Solo labs con algo programado hoy, cada uno con su lista ya armada y
  // ordenada — así el render no repite este trabajo por cada card.
  const labsConAgenda = useMemo(() => {
    return labs
      .map(lab => {
        const items = ordenarPorHoraInicio([
          ...clasesHoy.filter(c => c.labId === lab.id).map(c => ({
            id: c.id,
            tipo: 'clase',
            horaInicio: c.horaInicio,
            horaFin: c.horaFin,
            titulo: `${c.codigoAsignatura || ''} ${c.nombreAsignatura || ''}`.trim(),
            subtitulo: [c.seccion ? `Sec. ${c.seccion}` : null, c.docente].filter(Boolean).join(' · '),
          })),
          ...reservasHoy.filter(r => r.labId === lab.id).map(r => ({
            id: r.id,
            tipo: r.tipo === TIPOS_RESERVA.TOUR ? 'tour' : 'reserva',
            horaInicio: r.horaInicio,
            horaFin: r.horaFin,
            titulo: r.tipo === TIPOS_RESERVA.TOUR ? `Tour – ${r.colegio || ''}` : (r.asignatura || r.motivo || 'Reserva'),
            subtitulo: r.tipo === TIPOS_RESERVA.TOUR ? 'Tour UTEC' : r.docenteNombre,
          })),
        ]).map(item => ({ ...item, activa: estaEnRango(horaActual, item.horaInicio, item.horaFin) }));
        return { lab, items };
      })
      .filter(({ items }) => items.length > 0);
  }, [labs, clasesHoy, reservasHoy, horaActual]);

  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-12 h-12 text-utec-primary animate-spin mb-4" />
        <p className="text-gray-600">Cargando agenda...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarClock size={22} className="text-utec-primary" />
            Agenda del día
          </h1>
          <p className="text-gray-600 text-sm mt-0.5 capitalize">
            {formatearFechaLarga(ahora)} · {esEncargado ? 'Tus laboratorios' : 'Todos los laboratorios'}
          </p>
        </div>
        <button
          onClick={cargarAgenda}
          disabled={cargandoAgenda}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40"
        >
          <RefreshCw size={12} className={cargandoAgenda ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {labs.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <p className="text-amber-900 font-medium mb-1">Todavía no tienes laboratorios asignados</p>
          <p className="text-sm text-amber-800">Pide a la jefa que te asigne uno o más desde Gestión de usuarios.</p>
        </div>
      ) : cargandoAgenda && clasesHoy.length === 0 && reservasHoy.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Loader2 className="w-8 h-8 text-utec-primary animate-spin mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Cargando disponibilidad...</p>
        </div>
      ) : labsConAgenda.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <CalendarClock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-600 text-sm font-medium">Ningún laboratorio tiene actividad hoy</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {labsConAgenda.map(({ lab, items }) => (
            <LabCard key={lab.id} lab={lab} items={items} />
          ))}
        </div>
      )}
    </div>
  );
}

function LabCard({ lab, items }) {
  const enCurso = items.some(i => i.activa);
  return (
    <div className={`bg-white border rounded-xl p-3 ${enCurso ? 'border-red-300 shadow-sm' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm font-bold text-gray-900 truncate">{lab.nombre}</p>
        {enCurso && (
          <span className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" /> EN CURSO
          </span>
        )}
      </div>
      <div className="space-y-1">
        {items.map(item => <ItemFila key={`${item.tipo}-${item.id}`} item={item} />)}
      </div>
    </div>
  );
}

function ItemFila({ item }) {
  const Icono = item.tipo === 'tour' ? Bus : item.tipo === 'reserva' ? Bookmark : BookOpen;
  const colorIcono = item.tipo === 'tour' ? 'text-purple-500' : item.tipo === 'reserva' ? 'text-orange-500' : 'text-blue-500';

  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${item.activa ? 'bg-red-50' : 'bg-gray-50'}`}>
      <Icono size={12} className={`shrink-0 ${colorIcono}`} />
      <span className="shrink-0 flex items-center gap-1 text-[11px] font-mono text-gray-600">
        <Clock size={10} />
        {item.horaInicio}–{item.horaFin}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-900 truncate">{item.titulo}</p>
        {item.subtitulo && <p className="text-[11px] text-gray-500 truncate">{item.subtitulo}</p>}
      </div>
      {item.activa && (
        <span className="shrink-0 text-[10px] font-semibold text-red-700">En curso</span>
      )}
    </div>
  );
}
