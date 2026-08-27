import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, RefreshCw, CalendarClock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useReloj from '../hooks/useReloj';
import {
  obtenerLaboratorios,
  obtenerCicloActivo,
  obtenerClasesDeHoyTodosLosLabs,
  obtenerReservasAprobadasDeHoyTodosLosLabs,
} from '../services/laboratoriosService';
import { getDiaSemanaActual, formatearFechaLarga, fechaActualISO } from '../utils/dateHelpers';
import { ROLES } from '../lib/constants';
import AgendaDelDia from '../components/dashboard/AgendaDelDia';

// Vista directa de "qué está pasando hoy" en los laboratorios propios del
// usuario — a diferencia del Dashboard (todos los labs, agenda detrás de un
// acordeón que hay que abrir uno por uno), aquí se ve todo de una vez.
export default function AgendaHoy() {
  const { perfil } = useAuth();
  const ahora = useReloj();
  const esEncargado = perfil?.rol === ROLES.ENCARGADO;

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
      ) : (
        <div className="space-y-6">
          {labs.map(lab => (
            <div key={lab.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <AgendaDelDia
                clases={clasesHoy.filter(c => c.labId === lab.id)}
                reservas={reservasHoy.filter(r => r.labId === lab.id)}
                labNombre={lab.nombre}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
