import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Users, Clock, FlaskConical, TrendingUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { obtenerTodosLosCiclos } from '../../services/ciclosService';
import { obtenerClasesDelCiclo, obtenerLaboratorios } from '../../services/clasesService';
import { obtenerAsistenciasDelCiclo } from '../../services/asistenciaService';
import { ROLES } from '../../lib/constants';
import {
  calcularUsoPorLaboratorio, calcularHorasPorMateria, calcularHorasSemanaPorLab,
} from '../../utils/estadisticasHelpers';
import GraficoBarras from '../../components/admin/GraficoBarras';

export default function Estadisticas() {
  const { perfil } = useAuth();
  const esEncargado = perfil?.rol === ROLES.ENCARGADO;
  const labsAsignadosSet = esEncargado ? new Set(perfil?.labsAsignados || []) : null;

  const [ciclo, setCiclo] = useState(null);
  const [labs, setLabs] = useState([]);
  const [clases, setClases] = useState([]);
  const [asistencias, setAsistencias] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      try {
        const [ciclosData, labsData] = await Promise.all([obtenerTodosLosCiclos(), obtenerLaboratorios()]);
        const activo = ciclosData.find(c => c.activo) || null;
        const labsEnAlcance = labsAsignadosSet ? labsData.filter(l => labsAsignadosSet.has(l.id)) : labsData;
        setCiclo(activo);
        setLabs(labsEnAlcance);

        if (activo) {
          const [clasesData, asistData] = await Promise.all([
            obtenerClasesDelCiclo(activo.id),
            obtenerAsistenciasDelCiclo(activo.id),
          ]);
          setClases(labsAsignadosSet ? clasesData.filter(c => labsAsignadosSet.has(c.labId)) : clasesData);
          setAsistencias(labsAsignadosSet ? asistData.filter(a => labsAsignadosSet.has(a.labId)) : asistData);
        } else {
          setClases([]);
          setAsistencias([]);
        }
      } catch (e) {
        console.error(e);
        toast.error('Error al cargar estadísticas');
      } finally {
        setCargando(false);
      }
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const asistenciasValidas = useMemo(
    () => asistencias.filter(a => {
      const estado = a.estado || 'aprobada';
      return estado !== 'pendiente' && estado !== 'rechazada';
    }),
    [asistencias]
  );

  const usoPorLab = useMemo(() => calcularUsoPorLaboratorio(asistenciasValidas, labs), [asistenciasValidas, labs]);
  const horasSemanaPorLab = useMemo(() => calcularHorasSemanaPorLab(clases, labs), [clases, labs]);
  const horasPorMateria = useMemo(() => calcularHorasPorMateria(clases, asistenciasValidas, ciclo), [clases, asistenciasValidas, ciclo]);

  const totalAlumnos = usoPorLab.reduce((acc, s) => acc + s.totalAlumnos, 0);
  const totalHorasReales = usoPorLab.reduce((acc, s) => acc + s.horas, 0);
  const labsConRegistro = usoPorLab.filter(s => s.registros > 0).length;
  const cumplimientosValidos = horasPorMateria.filter(m => m.cumplimiento !== null);
  const cumplimientoPromedio = cumplimientosValidos.length > 0
    ? Math.round(cumplimientosValidos.reduce((acc, m) => acc + m.cumplimiento, 0) / cumplimientosValidos.length)
    : null;

  if (cargando) {
    return <div className="p-6 text-center text-gray-400 text-sm">Cargando estadísticas…</div>;
  }

  if (!ciclo) {
    return (
      <div className="p-6">
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          No hay un ciclo activo configurado.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Estadísticas</h1>
        <p className="text-sm text-gray-500">Ciclo activo: {ciclo.nombre || ciclo.id}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <TarjetaResumen label="Alumnos llegados" value={totalAlumnos} icon={Users} color="blue" />
        <TarjetaResumen label="Horas reales impartidas" value={totalHorasReales.toFixed(1)} icon={Clock} color="green" />
        <TarjetaResumen label="Labs con registro" value={`${labsConRegistro}/${labs.length}`} icon={FlaskConical} color="violet" />
        <TarjetaResumen
          label="Cumplimiento promedio"
          value={cumplimientoPromedio === null ? '—' : `${cumplimientoPromedio}%`}
          icon={TrendingUp}
          color="amber"
        />
      </div>

      <SeccionGrafico titulo="Alumnos llegados por laboratorio">
        <GraficoBarras
          datos={usoPorLab.map(s => ({ label: s.lab.nombre.replace('Laboratorio ', 'Lab '), valor: s.totalAlumnos }))}
          colorClase="bg-blue-500"
        />
      </SeccionGrafico>

      <SeccionGrafico titulo="Horas de clase por semana, por laboratorio">
        <GraficoBarras
          datos={horasSemanaPorLab.map(s => ({ label: s.lab.nombre.replace('Laboratorio ', 'Lab '), valor: s.horasSemana }))}
          colorClase="bg-green-500"
          formatearValor={v => v.toFixed(1)}
        />
      </SeccionGrafico>

      <SeccionGrafico titulo="Horas por materia en el ciclo (reales vs. esperadas a la fecha)">
        <div className="space-y-3">
          <GraficoBarras
            datos={horasPorMateria.map(m => ({ label: m.nombre, valor: m.reales }))}
            colorClase="bg-teal-500"
            formatearValor={v => v.toFixed(1)}
          />
          <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Materia', 'Horas/semana', 'Esperadas a la fecha', 'Reales', '% cumplimiento'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {horasPorMateria.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">Sin materias en este alcance</td></tr>
                )}
                {horasPorMateria.map(m => (
                  <tr key={m.codigo || m.nombre} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900 max-w-xs truncate" title={m.nombre}>
                      {m.nombre} <span className="text-gray-400 text-xs">({m.codigo})</span>
                    </td>
                    <td className="px-3 py-2 text-center text-gray-700">{m.horasSemana.toFixed(1)}</td>
                    <td className="px-3 py-2 text-center text-gray-700">{m.esperadasAlaFecha.toFixed(1)}</td>
                    <td className="px-3 py-2 text-center text-gray-700">{m.reales.toFixed(1)}</td>
                    <td className="px-3 py-2 text-center">
                      {m.cumplimiento === null ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <span className={`font-semibold ${
                          m.cumplimiento >= 90 ? 'text-green-700' : m.cumplimiento >= 60 ? 'text-amber-700' : 'text-red-700'
                        }`}>
                          {m.cumplimiento}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SeccionGrafico>
    </div>
  );
}

function TarjetaResumen({ label, value, icon: Icon, color }) {
  const colores = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    violet: 'bg-violet-50 text-violet-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colores[color]}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-semibold text-gray-900 leading-tight truncate">{value}</p>
        <p className="text-xs text-gray-500 truncate">{label}</p>
      </div>
    </div>
  );
}

function SeccionGrafico({ titulo, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">{titulo}</h2>
      {children}
    </div>
  );
}
