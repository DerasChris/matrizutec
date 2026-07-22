import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useReloj from '../hooks/useReloj';
import {
  obtenerLaboratorios,
  obtenerCicloActivo,
  obtenerClasesDeHoyTodosLosLabs,
  obtenerReservasAprobadasDeHoyTodosLosLabs,
} from '../services/laboratoriosService';
import {
  getDiaSemanaActual,
  horaActualString,
  formatearFechaLarga,
  fechaActualISO,
  estaEnRango,
} from '../utils/dateHelpers';
import EstadoActual from '../components/dashboard/EstadoActual';
import AgendaDelDia from '../components/dashboard/AgendaDelDia';

// Disponibilidad de todos los laboratorios de un vistazo. Visible para
// cualquier rol sin restricción — a diferencia de la Matriz, que sí se
// limita a los labs asignados de cada encargado.
export default function Dashboard() {
  const { perfil } = useAuth();
  const ahora = useReloj();

  const [labs, setLabs] = useState([]);
  const [ciclo, setCiclo] = useState(null);
  const [clasesHoy, setClasesHoy] = useState([]);
  const [reservasHoy, setReservasHoy] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoAgenda, setCargandoAgenda] = useState(false);
  const [labExpandido, setLabExpandido] = useState(null);

  useEffect(() => { cargarInicial(); }, []);
  useEffect(() => { if (ciclo) cargarAgendaHoy(); }, [ciclo, ahora.toDateString()]);

  async function cargarInicial() {
    try {
      setCargando(true);
      const [labsData, cicloData] = await Promise.all([
        obtenerLaboratorios(),
        obtenerCicloActivo(),
      ]);
      setLabs(labsData);
      setCiclo(cicloData);
      if (labsData.length === 0) toast.error('No hay laboratorios configurados. Contacta al desarrollador.');
      if (!cicloData) toast.error('No hay un ciclo activo. Contacta al desarrollador.');
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar datos. Verifica las reglas de Firestore.');
    } finally {
      setCargando(false);
    }
  }

  async function cargarAgendaHoy() {
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

  const horaAhora = horaActualString();

  const labsConEstado = useMemo(() => {
    return labs.map(lab => {
      const clasesLab = clasesHoy.filter(c => c.labId === lab.id);
      const reservasLab = reservasHoy.filter(r => r.labId === lab.id);
      const claseActiva = clasesLab.find(c => estaEnRango(horaAhora, c.horaInicio, c.horaFin));
      const reservaActiva = reservasLab.find(r => estaEnRango(horaAhora, r.horaInicio, r.horaFin));
      return { lab, clasesLab, reservasLab, claseActiva, reservaActiva };
    });
  }, [labs, clasesHoy, reservasHoy, horaAhora]);

  const libresCount = labsConEstado.filter(l => !l.claseActiva && !l.reservaActiva).length;

  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-12 h-12 text-utec-primary animate-spin mb-4" />
        <p className="text-gray-600">Cargando información...</p>
      </div>
    );
  }

  return (
    <div>
      {/* ─── Header ─── */}
      <div className="mb-4 md:mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">
              Hola, {perfil?.nombre.split(' ')[0]} 👋
            </h1>
            <p className="text-gray-600 text-sm mt-0.5 capitalize">{formatearFechaLarga(ahora)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Hora actual</p>
            <p className="text-2xl md:text-3xl font-bold text-utec-primary tabular-nums">{horaAhora}</p>
          </div>
        </div>
      </div>

      {/* ─── Resumen + actualizar ─── */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm text-gray-600">
          {labs.length === 0 ? (
            'Sin laboratorios configurados'
          ) : (
            <>
              <span className="font-semibold text-green-700">{libresCount}</span> de{' '}
              <span className="font-semibold text-gray-800">{labs.length}</span> laboratorios libres ahora mismo
            </>
          )}
        </p>
        <button
          onClick={cargarAgendaHoy}
          disabled={cargandoAgenda}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40"
        >
          <RefreshCw size={12} className={cargandoAgenda ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* ─── Acordeón de laboratorios ─── */}
      {labs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500 text-sm">
          No hay laboratorios disponibles
        </div>
      ) : cargandoAgenda && clasesHoy.length === 0 && reservasHoy.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Loader2 className="w-8 h-8 text-utec-primary animate-spin mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Cargando disponibilidad...</p>
        </div>
      ) : (
        <div className="space-y-2">
          {labsConEstado.map(({ lab, clasesLab, reservasLab, claseActiva, reservaActiva }) => (
            <LabAccordionRow
              key={lab.id}
              lab={lab}
              clases={clasesLab}
              reservas={reservasLab}
              claseActiva={claseActiva}
              reservaActiva={reservaActiva}
              horaActual={horaAhora}
              expandido={labExpandido === lab.id}
              onToggle={() => setLabExpandido(id => id === lab.id ? null : lab.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LabAccordionRow({ lab, clases, reservas, claseActiva, reservaActiva, horaActual, expandido, onToggle }) {
  const ocupado = claseActiva || reservaActiva;
  const item = claseActiva || reservaActiva;
  const esReserva = !claseActiva && reservaActiva;

  const estado = !ocupado
    ? { label: 'LIBRE', dot: 'bg-green-500', badge: 'bg-green-100 text-green-700' }
    : esReserva
      ? { label: 'RESERVA', dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700' }
      : { label: 'EN CLASE', dot: 'bg-red-500', badge: 'bg-red-100 text-red-700' };

  const resumen = !ocupado
    ? 'Disponible ahora'
    : esReserva
      ? `${item.asignatura || item.motivo || 'Reserva'} · ${item.horaInicio}–${item.horaFin}`
      : `${item.codigoAsignatura || ''} ${item.nombreAsignatura || ''}`.trim() + ` · ${item.horaInicio}–${item.horaFin}`;

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-colors ${expandido ? 'border-utec-primary shadow-sm' : 'border-gray-200'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${estado.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900 truncate">{lab.nombre}</p>
            {lab.tieneModulos && <span className="text-[10px] text-gray-400 shrink-0">4 mód.</span>}
          </div>
          <p className={`text-xs truncate mt-0.5 ${ocupado ? 'text-gray-600' : 'text-gray-400'}`}>
            {resumen}
          </p>
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${estado.badge}`}>
          {estado.label}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${expandido ? 'rotate-180' : ''}`} />
      </button>

      {expandido && (
        <div className="border-t border-gray-100 bg-gray-50/60 p-4 space-y-4">
          <EstadoActual
            claseActiva={claseActiva}
            reservaActiva={reservaActiva}
            horaActual={horaActual}
            labNombre={lab.nombre}
          />
          <AgendaDelDia clases={clases} reservas={reservas} labNombre={lab.nombre} />
        </div>
      )}
    </div>
  );
}
