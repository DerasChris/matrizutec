import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, Plus, RefreshCw, Inbox } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { obtenerMisReservas, cancelarReserva } from '../services/reservasService';
import { ESTADOS_RESERVA } from '../lib/constants';
import TarjetaReserva from '../components/reservas/TarjetaReserva';

export default function MisReservas() {
  const { perfil } = useAuth();
  const navigate = useNavigate();
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [verHistorico, setVerHistorico] = useState(false);

  useEffect(() => {
    cargar();
  }, [verHistorico]);

  async function cargar() {
    if (!perfil?.uid) return;
    try {
      setCargando(true);
      const data = await obtenerMisReservas(perfil.uid, !verHistorico);
      setReservas(data);
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar tus reservas');
    } finally {
      setCargando(false);
    }
  }

  async function handleCancelar(id) {
    if (!confirm('¿Cancelar esta solicitud? No se puede deshacer.')) return;
    try {
      await cancelarReserva(id);
      toast.success('Reserva cancelada');
      cargar();
    } catch (e) {
      console.error(e);
      toast.error('Error al cancelar');
    }
  }

  const pendientes = reservas.filter(r => r.estado === ESTADOS_RESERVA.PENDIENTE);
  const aprobadas = reservas.filter(r => r.estado === ESTADOS_RESERVA.APROBADA);
  const otras = reservas.filter(r => ![ESTADOS_RESERVA.PENDIENTE, ESTADOS_RESERVA.APROBADA].includes(r.estado));

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis reservas</h1>
          <p className="text-gray-600 text-sm mt-1">
            {verHistorico ? 'Mostrando todas las reservas (incluido histórico)' : 'Mostrando reservas activas y futuras'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setVerHistorico(v => !v)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {verHistorico ? 'Solo activas' : 'Ver histórico'}
          </button>
          <button
            onClick={cargar}
            disabled={cargando}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button
            onClick={() => navigate('/reservar')}
            className="px-3 py-2 bg-utec-primary text-white rounded-lg hover:bg-utec-dark flex items-center gap-1.5 text-sm"
          >
            <Plus size={14} />
            Nueva
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-utec-primary animate-spin" />
        </div>
      ) : reservas.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Inbox className="w-16 h-16 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-700 font-medium">No tienes reservas {verHistorico ? '' : 'activas'}</p>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            ¿Necesitas un laboratorio? Crea una solicitud.
          </p>
          <button
            onClick={() => navigate('/reservar')}
            className="px-4 py-2 bg-utec-primary text-white rounded-lg hover:bg-utec-dark text-sm font-medium"
          >
            Solicitar reserva
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {pendientes.length > 0 && (
            <Seccion titulo="Pendientes de aprobación" reservas={pendientes} onCancelar={handleCancelar} permitirCancelar />
          )}
          {aprobadas.length > 0 && (
            <Seccion titulo="Aprobadas" reservas={aprobadas} contactarJefa />
          )}
          {otras.length > 0 && (
            <Seccion titulo={verHistorico ? 'Histórico' : 'Otras'} reservas={otras} />
          )}
        </div>
      )}
    </div>
  );
}

function Seccion({ titulo, reservas, permitirCancelar = false, contactarJefa = false, onCancelar }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
        {titulo} ({reservas.length})
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {reservas.map(r => (
          <div key={r.id}>
            <TarjetaReserva reserva={r} />
            {permitirCancelar && (
              <button
                onClick={() => onCancelar(r.id)}
                className="w-full mt-1 px-3 py-1.5 text-xs text-red-700 border border-red-200 rounded hover:bg-red-50"
              >
                Cancelar solicitud
              </button>
            )}
            {contactarJefa && (
              <p className="text-[11px] text-gray-500 text-center mt-1">
                Para cancelar una reserva aprobada, contacta a jefatura.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
