import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Tv, Copy, ExternalLink, RefreshCw, Plus, Loader2, Info } from 'lucide-react';
import { obtenerTokenKiosko, generarTokenKiosko } from '../../services/kioskoService';

// Igual criterio que TabQR: incluye el subpath del deploy (ej. "/laboratorios/"
// en el build IIS) para que el enlace funcione también fuera de Vercel.
function baseUrl() {
  return window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '');
}

export default function TabKiosko({ labs, perfil }) {
  const [tokens, setTokens] = useState({}); // labId -> token string
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);

  useEffect(() => { cargar(); }, [labs]);

  async function cargar() {
    if (labs.length === 0) { setCargando(false); return; }
    setCargando(true);
    try {
      const resultados = await Promise.all(labs.map(l => obtenerTokenKiosko(l.id)));
      const mapa = {};
      labs.forEach((l, i) => { if (resultados[i]) mapa[l.id] = resultados[i].token; });
      setTokens(mapa);
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar los enlaces de asistencia programada');
    } finally {
      setCargando(false);
    }
  }

  async function generar(lab, esRegenerar) {
    if (esRegenerar && !window.confirm(
      `¿Regenerar el enlace de ${lab.nombre}? El enlace actual dejará de funcionar de inmediato.`
    )) return;
    setProcesandoId(lab.id);
    try {
      const token = await generarTokenKiosko(lab, perfil?.uid);
      setTokens(t => ({ ...t, [lab.id]: token }));
      toast.success(`Enlace ${esRegenerar ? 'regenerado' : 'generado'} para ${lab.nombre}`);
    } catch (e) {
      console.error(e);
      toast.error('Error al generar el enlace');
    } finally {
      setProcesandoId(null);
    }
  }

  function copiar(token) {
    const url = `${baseUrl()}/lab/${token}`;
    navigator.clipboard?.writeText(url)
      .then(() => toast.success('Enlace copiado'))
      .catch(() => toast.error('No se pudo copiar — copia el enlace manualmente'));
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-utec-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        <Info size={16} className="flex-shrink-0 mt-0.5 text-blue-500" />
        <p>
          Genera un enlace por laboratorio y déjalo abierto en la PC del lab. Al final de la clase, el encargado
          le muestra la pantalla al docente para que marque cuántos alumnos llegaron — sin PIN. Regenerar invalida
          el enlace anterior de inmediato.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        {labs.map(lab => {
          const token = tokens[lab.id];
          const procesando = procesandoId === lab.id;
          return (
            <div key={lab.id} className="w-72 border border-gray-200 rounded-xl p-4 bg-white">
              <p className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                <Tv size={14} className="text-utec-primary" /> {lab.nombre}
              </p>

              {token ? (
                <>
                  <p className="text-[11px] text-gray-500 break-all bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
                    {baseUrl()}/lab/{token}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => copiar(token)}
                      className="flex-1 flex items-center justify-center gap-1 text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                    >
                      <Copy size={12} /> Copiar
                    </button>
                    <button
                      onClick={() => window.open(`${baseUrl()}/lab/${token}`, '_blank')}
                      className="flex-1 flex items-center justify-center gap-1 text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                    >
                      <ExternalLink size={12} /> Abrir
                    </button>
                  </div>
                  <button
                    onClick={() => generar(lab, true)}
                    disabled={procesando}
                    className="w-full flex items-center justify-center gap-1 text-xs px-2 py-1.5 mt-2 border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-50 disabled:opacity-50"
                  >
                    {procesando ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    Regenerar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => generar(lab, false)}
                  disabled={procesando}
                  className="w-full flex items-center justify-center gap-1.5 text-sm px-3 py-2 bg-utec-primary text-white rounded-lg hover:bg-utec-dark disabled:opacity-50"
                >
                  {procesando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Generar enlace
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
