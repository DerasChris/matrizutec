import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import useReloj from '../hooks/useReloj';
import {
  obtenerLaboratorios,
  obtenerCicloActivo,
  obtenerClasesDelLabHoy,
  obtenerReservasAprobadasDelLabHoy,
} from '../services/laboratoriosService';
import {
  getDiaSemanaActual,
  horaActualString,
  formatearFechaLarga,
  fechaActualISO,
  estaEnRango,
} from '../utils/dateHelpers';
import SelectorLab from '../components/dashboard/SelectorLab';
import EstadoActual from '../components/dashboard/EstadoActual';
import AgendaDelDia from '../components/dashboard/AgendaDelDia';
import { sembrarLaboratorios, sembrarCicloActual } from '../utils/seedData';
import { sembrarClasesDemo, eliminarClasesDemo } from '../utils/seedDemoData';
import { ROLES } from '../lib/constants';
import {
  Loader2, RefreshCw, Database, AlertTriangle, FlaskConical,
  Settings, ChevronDown, ChevronUp,
} from 'lucide-react';

const LAB_LAT = 13.701234;
const LAB_LNG = -89.224567;
const RADIO_METROS = 50;

function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function verificarUbicacion() {
  if (!navigator.geolocation) { alert('Este navegador no soporta geolocalización'); return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const dist = calcularDistanciaMetros(pos.coords.latitude, pos.coords.longitude, LAB_LAT, LAB_LNG);
      alert(dist <= RADIO_METROS ? 'Estás dentro del laboratorio.' : 'Estás fuera del área permitida.');
    },
    () => alert('No se pudo obtener la ubicación.'),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

export default function Dashboard() {
  const { perfil, esAdmin } = useAuth();
  const ahora = useReloj();

  const [labs, setLabs] = useState([]);
  const [labSeleccionado, setLabSeleccionado] = useState(null);
  const [ciclo, setCiclo] = useState(null);
  const [clases, setClases] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoLab, setCargandoLab] = useState(false);
  const [setupAbierto, setSetupAbierto] = useState(false);

  useEffect(() => { cargarInicial(); }, []);

  useEffect(() => {
    if (labSeleccionado && ciclo) cargarDatosLab(labSeleccionado.id);
  }, [labSeleccionado, ciclo, ahora.toDateString()]);

  async function cargarInicial() {
    try {
      setCargando(true);
      const [labsData, cicloData] = await Promise.all([
        obtenerLaboratorios(),
        obtenerCicloActivo(),
      ]);

      // Encargados solo ven sus labs asignados
      const labsFiltrados =
        perfil?.rol === ROLES.ENCARGADO &&
        Array.isArray(perfil?.labsAsignados) &&
        perfil.labsAsignados.length > 0
          ? labsData.filter(l => perfil.labsAsignados.includes(l.id))
          : labsData;

      setLabs(labsFiltrados);
      setCiclo(cicloData);
      if (labsFiltrados.length > 0) setLabSeleccionado(labsFiltrados[0]);
      if (labsFiltrados.length === 0 || !cicloData) setSetupAbierto(true);
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar datos. Verifica las reglas de Firestore.');
    } finally {
      setCargando(false);
    }
  }

  async function cargarDatosLab(labId) {
    if (!ciclo) return;
    try {
      setCargandoLab(true);
      const dia = getDiaSemanaActual();
      const fecha = fechaActualISO();
      const [clasesData, reservasData] = await Promise.all([
        obtenerClasesDelLabHoy(labId, dia.id, ciclo.id),
        obtenerReservasAprobadasDelLabHoy(labId, fecha),
      ]);
      setClases(clasesData);
      setReservas(reservasData);
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar la agenda');
    } finally {
      setCargandoLab(false);
    }
  }

  const horaAhora = horaActualString();
  const claseActiva = clases.find(c => estaEnRango(horaAhora, c.horaInicio, c.horaFin));
  const reservaActiva = reservas.find(r => estaEnRango(horaAhora, r.horaInicio, r.horaFin));

  async function handleSembrarBase() {
    try {
      const t = toast.loading('Sembrando datos base...');
      const [labsRes, cicloRes] = await Promise.all([sembrarLaboratorios(), sembrarCicloActual()]);
      toast.dismiss(t);
      const partes = [];
      if (labsRes.creados) partes.push(`${labsRes.creados} labs creados`);
      if (labsRes.actualizados) partes.push(`${labsRes.actualizados} labs actualizados`);
      if (cicloRes.creado) partes.push('ciclo creado'); else partes.push('ciclo ya existía');
      toast.success(partes.join(' · '));
      await cargarInicial();
    } catch (e) { toast.error('Error al sembrar datos base'); }
  }

  async function handleSembrarDemo() {
    if (!ciclo) { toast.error('Primero debes crear el ciclo'); return; }
    try {
      const t = toast.loading('Sembrando clases demo...');
      const res = await sembrarClasesDemo(ciclo.id);
      toast.dismiss(t);
      toast.success(`${res.creadas} clases demo creadas`);
      if (labSeleccionado) cargarDatosLab(labSeleccionado.id);
    } catch (e) { toast.error('Error al sembrar clases demo'); }
  }

  async function handleEliminarDemo() {
    if (!confirm('¿Eliminar todas las clases marcadas como demo?')) return;
    try {
      const res = await eliminarClasesDemo();
      toast.success(`${res.eliminadas} clases demo eliminadas`);
      if (labSeleccionado) cargarDatosLab(labSeleccionado.id);
    } catch (e) { toast.error('Error al eliminar clases demo'); }
  }

  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-12 h-12 text-utec-primary animate-spin mb-4" />
        <p className="text-gray-600">Cargando información...</p>
      </div>
    );
  }

  const necesitaSetup = labs.length === 0 || !ciclo;

  // Contenido del lab seleccionado (compartido entre mobile y desktop)
  const contenidoLab = labSeleccionado ? (
    cargandoLab ? (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <Loader2 className="w-8 h-8 text-utec-primary animate-spin mx-auto mb-2" />
        <p className="text-gray-600 text-sm">Cargando agenda...</p>
      </div>
    ) : (
      <div className="space-y-4">
        <EstadoActual
          claseActiva={claseActiva}
          reservaActiva={reservaActiva}
          horaActual={horaAhora}
          labNombre={labSeleccionado.nombre}
        />
        <AgendaDelDia
          clases={clases}
          reservas={reservas}
          labNombre={labSeleccionado.nombre}
        />
      </div>
    )
  ) : (
    <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
      <p className="text-gray-600">Selecciona un laboratorio para ver su estado</p>
    </div>
  );

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
          <div className="flex items-center gap-3">
            {esAdmin() && (
              <button
                onClick={() => setSetupAbierto(!setupAbierto)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                <Settings size={14} />
                Setup
                {setupAbierto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Hora actual</p>
              <p className="text-2xl md:text-3xl font-bold text-utec-primary tabular-nums">{horaAhora}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Setup panel ─── */}
      {esAdmin() && setupAbierto && (
        <div className={`mb-6 border rounded-xl p-4 md:p-5 ${
          necesitaSetup ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-start gap-3 mb-3">
            {necesitaSetup
              ? <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              : <Settings className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
            }
            <div className="flex-1">
              <h2 className={`font-semibold text-sm ${necesitaSetup ? 'text-amber-900' : 'text-gray-900'}`}>
                {necesitaSetup ? 'Configuración inicial requerida' : 'Setup avanzado'}
              </h2>
              <p className={`text-xs mt-1 ${necesitaSetup ? 'text-amber-800' : 'text-gray-600'}`}>
                {necesitaSetup
                  ? `${labs.length === 0 ? 'No hay laboratorios. ' : ''}${!ciclo ? 'No hay ciclo activo. ' : ''}Usa los botones para inicializar.`
                  : 'Herramientas de mantenimiento.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pl-8">
            <button onClick={handleSembrarBase} className="flex items-center gap-2 px-3 py-2 bg-utec-primary text-white text-xs rounded-lg hover:bg-utec-dark">
              <Database size={13} /> Sembrar labs + ciclo
            </button>
            <button onClick={handleSembrarDemo} disabled={!ciclo} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <FlaskConical size={13} /> Sembrar demo
            </button>
            <button onClick={handleEliminarDemo} className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700">
              Eliminar demo
            </button>
            <button onClick={verificarUbicacion} className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-white text-xs rounded-lg hover:bg-gray-800">
              Validar ubicación
            </button>
          </div>
        </div>
      )}

      {/* ─── MOBILE: chip bar + contenido ─── */}
      <div className="lg:hidden space-y-4">
        {labs.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500 text-sm">
            No hay laboratorios disponibles
          </div>
        ) : (
          <>
            {/* Chip bar horizontal */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Laboratorio
              </p>
              <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 pb-2 min-w-max">
                  {labs.map(lab => {
                    const activo = labSeleccionado?.id === lab.id;
                    return (
                      <button
                        key={lab.id}
                        onClick={() => setLabSeleccionado(lab)}
                        disabled={cargandoLab}
                        className={`flex-shrink-0 flex flex-col items-center px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                          activo
                            ? 'bg-utec-primary text-white border-utec-primary shadow-md'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-utec-primary/50'
                        }`}
                      >
                        <span className="text-base font-bold">
                          {String(lab.numero).padStart(2, '0')}
                        </span>
                        {lab.tieneModulos && (
                          <span className={`text-[10px] ${activo ? 'text-white/80' : 'text-gray-400'}`}>
                            4 mód.
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {labSeleccionado && (
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-500">{labSeleccionado.nombre}</p>
                  <button
                    onClick={() => cargarDatosLab(labSeleccionado.id)}
                    disabled={cargandoLab}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40"
                  >
                    <RefreshCw size={12} className={cargandoLab ? 'animate-spin' : ''} />
                    Actualizar
                  </button>
                </div>
              )}
            </div>

            {contenidoLab}
          </>
        )}
      </div>

      {/* ─── DESKTOP: grid con sidebar ─── */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <SelectorLab
            labs={labs}
            labSeleccionado={labSeleccionado}
            onChange={setLabSeleccionado}
            cargando={cargandoLab}
          />
          {labSeleccionado && (
            <button
              onClick={() => cargarDatosLab(labSeleccionado.id)}
              disabled={cargandoLab}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={cargandoLab ? 'animate-spin' : ''} />
              Actualizar
            </button>
          )}
        </div>
        <div className="lg:col-span-2 space-y-6">
          {contenidoLab}
        </div>
      </div>
    </div>
  );
}
