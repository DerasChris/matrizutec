import { useState, useEffect, useCallback } from 'react';
import { Plus, Download, Upload, Zap, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  obtenerTodosLosCiclos,
  activarCiclo,
  contarClasesPorCiclo,
} from '../../services/ciclosService';
import { generarTemplateClases } from '../../utils/excelTemplate';
import NuevoCicloModal from '../../components/admin/NuevoCicloModal';
import ImportarClasesModal from '../../components/admin/ImportarClasesModal';
import { TIPOS_CICLO_MAP } from '../../lib/constants';
import toast from 'react-hot-toast';

const BADGE_TIPO = {
  1: 'bg-blue-100 text-blue-800 border-blue-200',
  2: 'bg-green-100 text-green-800 border-green-200',
  3: 'bg-amber-100 text-amber-800 border-amber-200',
};

function formatearFecha(fechaISO) {
  if (!fechaISO) return '—';
  const [y, m, d] = fechaISO.split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d} ${meses[Number(m) - 1]} ${y}`;
}

function CicloCard({ ciclo, conteo, cargandoConteo, onActivar, onImportar, onTemplate, esJefa }) {
  const tipoDef = TIPOS_CICLO_MAP[ciclo.numero] ?? {};
  const badgeClass = BADGE_TIPO[ciclo.numero] ?? 'bg-gray-100 text-gray-700';

  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border transition-colors ${
      ciclo.activo ? 'border-utec-primary bg-utec-light/30' : 'border-gray-200 bg-white'
    }`}>
      {/* Badge tipo */}
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${badgeClass} flex-shrink-0`}>
        {tipoDef.corto ?? `C0${ciclo.numero}`}
      </span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-gray-900 text-sm">{ciclo.nombre}</h3>
          {ciclo.activo && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-utec-primary text-white text-[11px] font-bold">
              <Zap size={10} /> ACTIVO
            </span>
          )}
          {tipoDef.esInterciclo && (
            <span className="text-[11px] text-amber-600 font-medium">Interciclo</span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {formatearFecha(ciclo.fechaInicio)} — {formatearFecha(ciclo.fechaFin)}
          &nbsp;·&nbsp;
          {cargandoConteo
            ? <span className="animate-pulse">cargando...</span>
            : <span>{conteo ?? 0} {(conteo ?? 0) === 1 ? 'clase' : 'clases'}</span>
          }
        </p>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
        {!ciclo.activo && esJefa && (
          <button
            onClick={() => onActivar(ciclo)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-utec-primary border border-utec-primary rounded-lg hover:bg-utec-primary hover:text-white transition-colors"
          >
            <Zap size={13} />
            Activar
          </button>
        )}
        <button
          onClick={() => onTemplate(ciclo)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          title="Descargar template Excel"
        >
          <Download size={13} />
          Template
        </button>
        <button
          onClick={() => onImportar(ciclo)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-utec-primary rounded-lg hover:bg-utec-dark transition-colors"
        >
          <Upload size={13} />
          Importar
        </button>
      </div>
    </div>
  );
}

export default function GestionCiclos() {
  const { esJefa } = useAuth();
  const [ciclos, setCiclos] = useState([]);
  const [conteos, setConteos] = useState({});
  const [cargandoConteos, setCargandoConteos] = useState({});
  const [cargando, setCargando] = useState(true);
  const [aniosExpandidos, setAniosExpandidos] = useState({});

  const [showNuevo, setShowNuevo] = useState(false);
  const [cicloImportar, setCicloImportar] = useState(null);

  const cargarCiclos = useCallback(async () => {
    setCargando(true);
    try {
      const data = await obtenerTodosLosCiclos();
      setCiclos(data);

      const anioActual = new Date().getFullYear();
      const expandidos = {};
      data.forEach(c => {
        if (c.anio === anioActual || c.activo) expandidos[c.anio] = true;
      });
      setAniosExpandidos(expandidos);

      const pendientes = {};
      data.forEach(c => { pendientes[c.id] = true; });
      setCargandoConteos(pendientes);

      data.forEach(async (ciclo) => {
        const n = await contarClasesPorCiclo(ciclo.id);
        setConteos(prev => ({ ...prev, [ciclo.id]: n }));
        setCargandoConteos(prev => { const next = { ...prev }; delete next[ciclo.id]; return next; });
      });
    } catch {
      toast.error('Error al cargar los ciclos.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarCiclos(); }, [cargarCiclos]);

  async function handleActivar(ciclo) {
    if (!window.confirm(`¿Activar "${ciclo.nombre}"? El ciclo actualmente activo se desactivará.`)) return;
    try {
      await activarCiclo(ciclo.id);
      toast.success(`"${ciclo.nombre}" es ahora el ciclo activo.`);
      cargarCiclos();
    } catch {
      toast.error('Error al activar el ciclo.');
    }
  }

  function handleTemplate(ciclo) {
    generarTemplateClases(ciclo.nombre);
    toast.success('Template descargado.');
  }

  function handleImportado(stats) {
    setConteos(prev => ({ ...prev, [cicloImportar.id]: stats.importadas }));
    setCicloImportar(null);
  }

  const ciclosPorAnio = ciclos.reduce((acc, c) => {
    if (!acc[c.anio]) acc[c.anio] = [];
    acc[c.anio].push(c);
    return acc;
  }, {});

  const aniosOrdenados = Object.keys(ciclosPorAnio).map(Number).sort((a, b) => b - a);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-utec-primary rounded-xl flex items-center justify-center">
            <BookOpen size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Gestión de Ciclos Académicos</h1>
            <p className="text-sm text-gray-500">Administra los ciclos y carga académica de cada uno</p>
          </div>
        </div>
        {esJefa() && (
          <button
            onClick={() => setShowNuevo(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-utec-primary rounded-lg hover:bg-utec-dark"
          >
            <Plus size={16} />
            Nuevo ciclo
          </button>
        )}
      </div>

      {cargando ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : ciclos.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <BookOpen size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No hay ciclos registrados</p>
          {esJefa() && (
            <p className="text-sm mt-1">
              Crea el primer ciclo con el botón <strong>Nuevo ciclo</strong>.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {aniosOrdenados.map(anio => {
            const abierto = aniosExpandidos[anio] ?? false;
            return (
              <div key={anio}>
                <button
                  className="flex items-center gap-2 text-base font-bold text-gray-700 mb-3 hover:text-utec-primary transition-colors"
                  onClick={() => setAniosExpandidos(prev => ({ ...prev, [anio]: !prev[anio] }))}
                >
                  {abierto ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                  {anio}
                  <span className="text-xs font-normal text-gray-400">
                    ({ciclosPorAnio[anio].length} {ciclosPorAnio[anio].length === 1 ? 'ciclo' : 'ciclos'})
                  </span>
                </button>

                {abierto && (
                  <div className="space-y-3 pl-2 border-l-2 border-gray-100">
                    {ciclosPorAnio[anio].map(ciclo => (
                      <CicloCard
                        key={ciclo.id}
                        ciclo={ciclo}
                        conteo={conteos[ciclo.id]}
                        cargandoConteo={!!cargandoConteos[ciclo.id]}
                        onActivar={handleActivar}
                        onImportar={setCicloImportar}
                        onTemplate={handleTemplate}
                        esJefa={esJefa()}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showNuevo && (
        <NuevoCicloModal
          onClose={() => setShowNuevo(false)}
          onCreado={nuevo => { setCiclos(prev => [nuevo, ...prev]); }}
        />
      )}

      {cicloImportar && (
        <ImportarClasesModal
          ciclo={cicloImportar}
          clasesExistentes={conteos[cicloImportar.id] ?? 0}
          onClose={() => setCicloImportar(null)}
          onImportado={handleImportado}
        />
      )}
    </div>
  );
}
