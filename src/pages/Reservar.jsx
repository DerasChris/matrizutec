import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Inbox } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { obtenerLaboratorios } from '../services/laboratoriosService';
import { EMAIL_JEFA } from '../lib/firebase';
import FormularioReserva from '../components/reservas/FormularioReserva';

export default function Reservar() {
  const { perfil } = useAuth();
  const navigate = useNavigate();
  const [labs, setLabs] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await obtenerLaboratorios();
        setLabs(data);
      } catch (e) {
        console.error(e);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-12 h-12 text-utec-primary animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Solicitar reserva de laboratorio</h1>
          <p className="text-gray-600 text-sm mt-1">
            Elige el tipo de reserva que necesitas. El sistema validará disponibilidad antes de enviar.
          </p>
        </div>
        <button
          onClick={() => navigate('/mis-reservas')}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Inbox size={14} />
          Mis reservas
        </button>
      </div>

      <FormularioReserva
        labs={labs}
        perfil={perfil}
        emailJefa={EMAIL_JEFA}
        onCreado={() => navigate('/mis-reservas')}
      />
    </div>
  );
}
