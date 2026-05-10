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
import { Loader2, RefreshCw, Database, AlertTriangle, FlaskConical, Settings, ChevronDown, ChevronUp } from 'lucide-react';

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

  useEffect(() => {
    cargarInicial();
  }, []);

  useEffect(() => {
    if (labSeleccionado && ciclo) {
      cargarDatosLab(labSeleccionado.id);
    }
  }, [labSeleccionado, ciclo, ahora.toDateString()]);

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
    Math.cos(lat1 * rad) *
      Math.cos(lat2 * rad) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function verificarUbicacion() {
  if (!navigator.geolocation) {
    alert("Este navegador no soporta geolocalización");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      const distancia = calcularDistanciaMetros(
        userLat,
        userLng,
        LAB_LAT,
        LAB_LNG
      );

      console.log("Distancia:", distancia, "metros");

      if (distancia <= RADIO_METROS) {
        alert("Estás dentro del laboratorio. Puedes registrar asistencia.");
      } else {
        alert("Estás fuera del área permitida.");
      }
    },
    (error) => {
      console.error(error);
      alert("No se pudo obtener la ubicación.");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );
}

  async function cargarInicial() {
    try {
      setCargando(true);
      const [labsData, cicloData] = await Promise.all([
        obtenerLaboratorios(),
        obtenerCicloActivo(),
      ]);
      setLabs(labsData);
      setCiclo(cicloData);

      if (labsData.length > 0) {
        setLabSeleccionado(labsData[0]);
      }

      if (labsData.length === 0 || !cicloData) {
        setSetupAbierto(true);
      }
    } catch (e) {
      console.error('Error cargando datos iniciales:', e);
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
      console.error('Error cargando datos del lab:', e);
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
      const [labsRes, cicloRes] = await Promise.all([
        sembrarLaboratorios(),
        sembrarCicloActual(),
      ]);
      toast.dismiss(t);
      const partes = [];
      if (labsRes.creados) partes.push(`${labsRes.creados} labs creados`);
      if (labsRes.actualizados) partes.push(`${labsRes.actualizados} labs actualizados`);
      if (labsRes.existentes) partes.push(`${labsRes.existentes} ya existían`);
      if (cicloRes.creado) partes.push('ciclo creado');
      else partes.push('ciclo ya existía');
      toast.success(partes.join(' · '));
      await cargarInicial();
    } catch (e) {
      console.error(e);
      toast.error('Error al sembrar datos base');
    }
  }

  async function handleSembrarDemo() {
    if (!ciclo) {
      toast.error('Primero debes crear el ciclo');
      return;
    }
    try {
      const t = toast.loading('Sembrando clases demo...');
      const res = await sembrarClasesDemo(ciclo.id);
      toast.dismiss(t);
      toast.success(`${res.creadas} clases demo creadas`);
      if (labSeleccionado) cargarDatosLab(labSeleccionado.id);
    } catch (e) {
      console.error(e);
      toast.error('Error al sembrar clases demo');
    }
  }

  async function handleEliminarDemo() {
    if (!confirm('¿Eliminar todas las clases marcadas como demo?')) return;
    try {
      const res = await eliminarClasesDemo();
      toast.success(`${res.eliminadas} clases demo eliminadas`);
      if (labSeleccionado) cargarDatosLab(labSeleccionado.id);
    } catch (e) {
      console.error(e);
      toast.error('Error al eliminar clases demo');
    }
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

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Hola, {perfil?.nombre.split(' ')[0]} 👋</h1>
            <p className="text-gray-600 mt-1 capitalize">{formatearFechaLarga(ahora)}</p>
          </div>
          <div className="flex items-center gap-3">
            {esAdmin() && (
              <button
                onClick={() => setSetupAbierto(!setupAbierto)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                title="Setup avanzado"
              >
                <Settings size={14} />
                Setup
                {setupAbierto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Hora actual</p>
              <p className="text-3xl font-bold text-utec-primary tabular-nums">{horaAhora}</p>
            </div>
          </div>
        </div>
      </div>

      {esAdmin() && setupAbierto && (
        <div className={`mb-6 border rounded-xl p-5 ${
          necesitaSetup ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-start gap-3 mb-3">
            {necesitaSetup ? (
              <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            ) : (
              <Settings className="w-6 h-6 text-gray-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <h2 className={`font-semibold ${necesitaSetup ? 'text-amber-900' : 'text-gray-900'}`}>
                {necesitaSetup ? 'Configuración inicial requerida' : 'Setup avanzado'}
              </h2>
              <p className={`text-sm mt-1 ${necesitaSetup ? 'text-amber-800' : 'text-gray-600'}`}>
                {necesitaSetup
                  ? `${labs.length === 0 ? 'No hay laboratorios creados. ' : ''}${!ciclo ? 'No hay un ciclo activo. ' : ''}Usa los botones de abajo para sembrar datos iniciales.`
                  : 'Herramientas para mantenimiento de datos. Usa solo si sabes lo que estás haciendo.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pl-9">
            <button
              onClick={handleSembrarBase}
              className="flex items-center gap-2 px-3 py-2 bg-utec-primary text-white text-sm rounded-lg hover:bg-utec-dark"
              title="Crea o actualiza los 14 labs (incluye módulos del Lab 03) y el ciclo actual"
            >
              <Database size={14} />
              Sembrar/actualizar labs + ciclo
            </button>
            <button
              onClick={handleSembrarDemo}
              disabled={!ciclo}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              title="Crea 8 clases demo distribuidas en varios labs"
            >
              <FlaskConical size={14} />
              Sembrar clases demo
            </button>
            <button
              onClick={handleEliminarDemo}
              className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
              title="Elimina solo las clases marcadas como esDemo"
            >
              Eliminar clases demo
            </button>
          </div>

          <div className="mt-3 pl-9 text-[11px] text-gray-500">
            💡 <strong>Sembrar/actualizar</strong> es seguro: si los labs ya existen, solo actualiza los que necesiten cambios (ej. el Lab 03 obtiene sus 4 módulos).
          </div>

          <button className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50" onClick={verificarUbicacion}>
            Validar ubicación
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
          {labSeleccionado ? (
            <>
              {cargandoLab ? (
                <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                  <Loader2 className="w-8 h-8 text-utec-primary animate-spin mx-auto mb-2" />
                  <p className="text-gray-600 text-sm">Cargando agenda...</p>
                </div>
              ) : (
                <>
                  <EstadoActual
                    claseActiva={claseActiva}
                    reservaActiva={reservaActiva}
                    horaActual={horaAhora}
                    labNombre={labSeleccionado.nombre}
                  />
                  <AgendaDelDia clases={clases} reservas={reservas} />
                </>
              )}
            </>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <p className="text-gray-600">Selecciona un laboratorio para ver su estado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
