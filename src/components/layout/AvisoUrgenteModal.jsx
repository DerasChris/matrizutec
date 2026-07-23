import { useState, useEffect } from 'react';
import { AlertTriangle, Megaphone, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { obtenerAvisosActivos } from '../../services/avisosService';

const STORAGE_KEY = 'labtrack_avisos_vistos';

export default function AvisoUrgenteModal() {
  const { perfil } = useAuth();
  const [avisos, setAvisos] = useState([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!perfil) return;
    obtenerAvisosActivos()
      .then(lista => {
        if (lista.length === 0) return;
        const idsActuales = lista.map(a => a.id).sort().join(',');
        const vistos = sessionStorage.getItem(STORAGE_KEY);
        if (vistos === idsActuales) return; // ya se vieron estos mismos avisos en esta sesión
        setAvisos(lista);
        setVisible(true);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  function cerrar() {
    const idsActuales = avisos.map(a => a.id).sort().join(',');
    sessionStorage.setItem(STORAGE_KEY, idsActuales);
    setVisible(false);
  }

  if (!visible || avisos.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <div className="bg-red-600 px-6 py-4 flex items-center gap-2 shrink-0">
          <AlertTriangle size={20} className="text-white shrink-0" />
          <h2 className="text-white font-bold text-lg tracking-wide">AVISO URGENTE</h2>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {avisos.map(a => (
            <div key={a.id}>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                <Megaphone size={14} className="text-red-600 shrink-0" /> {a.titulo}
              </p>
              <p className="text-sm text-gray-700 mt-1.5 whitespace-pre-wrap">{a.mensaje}</p>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 shrink-0">
          <button
            onClick={cerrar}
            className="w-full py-2.5 text-sm font-semibold text-white bg-utec-primary rounded-lg hover:bg-utec-dark flex items-center justify-center gap-1.5"
          >
            <X size={15} /> Entendido, cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
