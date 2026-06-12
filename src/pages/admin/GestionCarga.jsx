import { useState, useEffect, useMemo } from 'react';
import {
  Search, AlertTriangle, CheckCircle2, BookOpen, RefreshCw,
  Edit2, ChevronUp, ChevronDown, ChevronsUpDown, AlertCircle,
  Clock, Plus, X,
} from 'lucide-react';
import { obtenerTodosLosCiclos } from '../../services/ciclosService';
import { obtenerClasesDelCiclo, obtenerLaboratorios } from '../../services/clasesService';
import ClaseFormulario from '../../components/admin/ClaseFormulario';
import { DIAS_SEMANA } from '../../lib/constants';

const DIA_CORTO = {
  lunes: 'Lu', martes: 'Ma', miercoles: 'Mi',
  jueves: 'Ju', viernes: 'Vi', sabado: 'Sá', domingo: 'Do',
};

function horaAMin(hora) {
  const [h = 0, m = 0] = (hora || '00:00').split(':').map(Number);
  return h * 60 + m;
}

function detectarConflictos(clases) {
  const activas = clases.filter(c => c.activo !== false);
  const pares = [];
  for (let i = 0; i < activas.length; i++) {
    for (let j = i + 1; j < activas.length; j++) {
      const a = activas[i], b = activas[j];
      if (a.labId !== b.labId) continue;
      const diasComunes = (a.diasSemana || []).filter(d => (b.diasSemana || []).includes(d));
      if (!diasComunes.length) continue;
      const [ai, af] = [horaAMin(a.horaInicio), horaAMin(a.horaFin)];
      const [bi, bf] = [horaAMin(b.horaInicio), horaAMin(b.horaFin)];
      if (ai < bf && af > bi) pares.push({ a, b, diasComunes });
    }
  }
  return pares;
}

function StatCard({ label, value, icon: Icon, color, onClick }) {
  const cm = {
    blue:  { bg: 'bg-blue-50',   val: 'text-blue-700',   ic: 'text-blue-400'  },
    red:   { bg: 'bg-red-50',    val: 'text-red-700',    ic: 'text-red-400'   },
    green: { bg: 'bg-green-50',  val: 'text-green-700',  ic: 'text-green-400' },
    amber: { bg: 'bg-amber-50',  val: 'text-amber-700',  ic: 'text-amber-400' },
    gray:  { bg: 'bg-gray-50',   val: 'text-gray-700',   ic: 'text-gray-400'  },
  };
  const c = cm[color] || cm.gray;
  return (
    <div
      onClick={onClick}
      className={`${c.bg} rounded-xl px-4 py-3 flex items-center gap-3 ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
    >
      {Icon && <Icon size={20} className={c.ic} />}
      <div>
        <p className={`text-2xl font-bold leading-none ${c.val}`}>{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

function SortIcon({ col, ordenCol, ordenDir }) {
  if (ordenCol !== col) return <ChevronsUpDown size={11} className="text-gray-300 ml-1 shrink-0" />;
  return ordenDir === 'asc'
    ? <ChevronUp size={11} className="text-utec-primary ml-1 shrink-0" />
    : <ChevronDown size={11} className="text-utec-primary ml-1 shrink-0" />;
}

const COLS = [
  { key: 'labId',            label: 'Laboratorio' },
  { key: 'codigoAsignatura', label: 'Código'      },
  { key: 'nombreAsignatura', label: 'Asignatura'  },
  { key: 'docente',          label: 'Docente'     },
  { key: 'dias',             label: 'Días',   noSort: true },
  { key: 'horaInicio',       label: 'Horario'     },
  { key: 'seccion',          label: 'Sección'     },
  { key: 'inscritos',        label: 'Ins.',   noSort: true },
  { key: 'estado',           label: 'Estado', noSort: true },
  { key: '_edit',            label: '',       noSort: true },
];

export default function GestionCarga() {
  const [ciclos,        setCiclos]        = useState([]);
  const [cicloId,       setCicloId]       = useState('');
  const [clases,        setClases]        = useState([]);
  const [labs,          setLabs]          = useState([]);
  const [cargando,      setCargando]      = useState(false);
  const [tab,           setTab]           = useState('carga');
  const [busqueda,      setBusqueda]      = useState('');
  const [filtroLab,     setFiltroLab]     = useState('');
  const [filtroDia,     setFiltroDia]     = useState('');
  const [filtroEstado,  setFiltroEstado]  = useState('activas');
  const [soloConflicto, setSoloConflicto] = useState(false);
  const [formAbierto,   setFormAbierto]   = useState(false);
  const [claseEditando, setClaseEditando] = useState(null);
  const [labNueva,      setLabNueva]      = useState('');
  const [pickLab,       setPickLab]       = useState(false);
  const [ordenCol,      setOrdenCol]      = useState('labId');
  const [ordenDir,      setOrdenDir]      = useState('asc');

  useEffect(() => {
    Promise.all([obtenerTodosLosCiclos(), obtenerLaboratorios()]).then(([c, l]) => {
      setCiclos(c);
      setLabs(l);
      const activo = c.find(x => x.activo);
      if (activo) setCicloId(activo.id);
    });
  }, []);

  useEffect(() => {
    if (!cicloId) return;
    recargar();
  }, [cicloId]);

  function recargar() {
    setCargando(true);
    obtenerClasesDelCiclo(cicloId)
      .then(setClases)
      .finally(() => setCargando(false));
  }

  const labMap = useMemo(
    () => Object.fromEntries(labs.map(l => [l.id, l])),
    [labs]
  );

  const conflictos = useMemo(() => detectarConflictos(clases), [clases]);
  const conflictIds = useMemo(
    () => new Set(conflictos.flatMap(p => [p.a.id, p.b.id])),
    [conflictos]
  );
  const pendientesCount = useMemo(
    () => clases.filter(c => c.pendienteRevision && c.activo !== false).length,
    [clases]
  );

  const clasesFiltradas = useMemo(() => {
    let r = [...clases];
    if (filtroEstado === 'activas')   r = r.filter(c => c.activo !== false);
    if (filtroEstado === 'inactivas') r = r.filter(c => c.activo === false);
    if (filtroLab)  r = r.filter(c => c.labId === filtroLab);
    if (filtroDia)  r = r.filter(c => (c.diasSemana || []).includes(filtroDia));
    if (soloConflicto) r = r.filter(c => conflictIds.has(c.id));
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      r = r.filter(c =>
        c.docente?.toLowerCase().includes(q) ||
        c.nombreAsignatura?.toLowerCase().includes(q) ||
        c.codigoAsignatura?.toLowerCase().includes(q) ||
        c.seccion?.toLowerCase().includes(q)
      );
    }
    r.sort((a, b) => {
      let va, vb;
      if (ordenCol === 'labId') {
        va = labMap[a.labId]?.nombre || a.labId;
        vb = labMap[b.labId]?.nombre || b.labId;
      } else if (ordenCol === 'horaInicio') {
        const diff = horaAMin(a.horaInicio) - horaAMin(b.horaInicio);
        return ordenDir === 'asc' ? diff : -diff;
      } else {
        va = String(a[ordenCol] || '');
        vb = String(b[ordenCol] || '');
      }
      return ordenDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return r;
  }, [clases, filtroEstado, filtroLab, filtroDia, busqueda, soloConflicto, ordenCol, ordenDir, labMap, conflictIds]);

  const conflictGroups = useMemo(() => {
    const byLab = {};
    for (const par of conflictos) {
      if (!byLab[par.a.labId]) byLab[par.a.labId] = [];
      byLab[par.a.labId].push(par);
    }
    return Object.entries(byLab)
      .map(([labId, pares]) => ({ labId, labNombre: labMap[labId]?.nombre || labId, pares }))
      .sort((a, b) => a.labNombre.localeCompare(b.labNombre));
  }, [conflictos, labMap]);

  function toggleOrden(col) {
    if (ordenCol === col) setOrdenDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setOrdenCol(col); setOrdenDir('asc'); }
  }

  function abrirEditar(clase) {
    setClaseEditando(clase);
    setLabNueva('');
    setFormAbierto(true);
  }

  function abrirNueva(labId) {
    setClaseEditando(null);
    setLabNueva(labId);
    setPickLab(false);
    setFormAbierto(true);
  }

  function cerrarForm() {
    setFormAbierto(false);
    setClaseEditando(null);
    setLabNueva('');
  }

  function onGuardado() {
    cerrarForm();
    recargar();
  }

  const labIdForm = claseEditando ? claseEditando.labId : labNueva;
  const clasesActivas = clases.filter(c => c.activo !== false);
  const labsConClases = new Set(clasesActivas.map(c => c.labId)).size;

  return (
    <div className="flex flex-col min-h-full">

      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Carga académica</h1>
            <p className="text-sm text-gray-500 mt-0.5">Gestión y validación de horarios</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Ciclo selector */}
            <select
              value={cicloId}
              onChange={e => setCicloId(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-utec-primary"
            >
              {ciclos.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.anio}{c.activo ? ' ★' : ''}
                </option>
              ))}
            </select>

            {/* Nueva clase */}
            <div className="relative">
              <button
                onClick={() => setPickLab(p => !p)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-utec-primary text-white rounded-lg hover:bg-utec-dark"
              >
                <Plus size={14} /> Nueva clase
              </button>
              {pickLab && (
                <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 max-h-72 overflow-y-auto">
                  <p className="px-3 py-1.5 text-xs text-gray-400 font-semibold uppercase">Selecciona laboratorio</p>
                  {labs.filter(l => l.activo !== false).map(l => (
                    <button
                      key={l.id}
                      onClick={() => abrirNueva(l.id)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {l.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={recargar}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
              title="Actualizar"
            >
              <RefreshCw size={15} className={cargando ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <StatCard label="Clases activas"     value={clasesActivas.length}  icon={BookOpen}       color="blue" />
          <StatCard label="Laboratorios en uso" value={labsConClases}          icon={null}           color="gray" />
          <StatCard
            label="Conflictos"
            value={conflictos.length}
            icon={AlertTriangle}
            color={conflictos.length > 0 ? 'red' : 'green'}
            onClick={conflictos.length > 0 ? () => setTab('conflictos') : undefined}
          />
          <StatCard
            label="Por revisar"
            value={pendientesCount}
            icon={Clock}
            color={pendientesCount > 0 ? 'amber' : 'green'}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-gray-200 bg-white flex gap-1 shrink-0">
        {[
          { id: 'carga',      label: 'Carga académica' },
          { id: 'conflictos', label: `Conflictos${conflictos.length > 0 ? ` (${conflictos.length})` : ''}` },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id
                ? 'border-utec-primary text-utec-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB CARGA ── */}
      {tab === 'carga' && (
        <>
          {/* Filtros */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-2 items-center shrink-0">
            <div className="relative flex-1 min-w-44">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar docente, asignatura, código…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-utec-primary"
              />
            </div>
            <select
              value={filtroLab}
              onChange={e => setFiltroLab(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-utec-primary"
            >
              <option value="">Todos los labs</option>
              {labs.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
            <select
              value={filtroDia}
              onChange={e => setFiltroDia(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-utec-primary"
            >
              <option value="">Todos los días</option>
              {DIAS_SEMANA.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
            <select
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-utec-primary"
            >
              <option value="activas">Activas</option>
              <option value="inactivas">Inactivas</option>
              <option value="todas">Todas</option>
            </select>
            {conflictos.length > 0 && (
              <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={soloConflicto}
                  onChange={e => setSoloConflicto(e.target.checked)}
                  className="rounded text-red-500 focus:ring-red-400"
                />
                Solo conflictos
              </label>
            )}
            <span className="text-xs text-gray-400 ml-auto">{clasesFiltradas.length} resultado{clasesFiltradas.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Tabla */}
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  {COLS.map(col => (
                    <th
                      key={col.key}
                      onClick={col.noSort ? undefined : () => toggleOrden(col.key)}
                      className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${
                        !col.noSort ? 'cursor-pointer select-none hover:text-gray-800' : ''
                      }`}
                    >
                      <span className="inline-flex items-center">
                        {col.label}
                        {!col.noSort && <SortIcon col={col.key} ordenCol={ordenCol} ordenDir={ordenDir} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cargando && clases.length === 0 && (
                  <tr>
                    <td colSpan={COLS.length} className="px-6 py-12 text-center text-gray-400 text-sm">
                      Cargando clases…
                    </td>
                  </tr>
                )}
                {!cargando && clasesFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={COLS.length} className="px-6 py-12 text-center text-gray-400 text-sm">
                      No hay clases con los filtros seleccionados
                    </td>
                  </tr>
                )}
                {clasesFiltradas.map(clase => {
                  const esConflicto = conflictIds.has(clase.id);
                  const esPendiente = clase.pendienteRevision && clase.activo !== false;
                  const inactiva    = clase.activo === false;
                  return (
                    <tr
                      key={clase.id}
                      className={`transition-colors hover:bg-blue-50/40 ${
                        esConflicto ? 'bg-red-50 border-l-2 border-l-red-400' : ''
                      } ${inactiva ? 'opacity-50' : ''}`}
                    >
                      <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-semibold">
                          {labMap[clase.labId]?.nombre?.replace('Laboratorio ', 'Lab ') || clase.labId}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500 font-mono text-xs whitespace-nowrap">
                        {clase.codigoAsignatura || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-900 max-w-xs">
                        <span className="block truncate" title={clase.nombreAsignatura}>
                          {clase.nombreAsignatura || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {esPendiente ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-full">
                            <AlertCircle size={10} /> REVISAR
                          </span>
                        ) : (
                          <span className="text-gray-700 text-xs">{clase.docente || '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-0.5">
                          {(clase.diasSemana || []).map(d => (
                            <span key={d} className="text-xs px-1 py-0.5 bg-gray-100 text-gray-600 rounded font-medium">
                              {DIA_CORTO[d] || d}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700 whitespace-nowrap">
                        {clase.horaInicio}–{clase.horaFin}
                      </td>
                      <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">
                        {clase.seccion || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs text-center">
                        {clase.inscritos ?? 0}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {inactiva ? (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Inactiva</span>
                        ) : esConflicto ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                            <AlertTriangle size={9} /> Conflicto
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Activa</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => abrirEditar(clase)}
                          className="p-1.5 text-gray-400 hover:text-utec-primary hover:bg-utec-light rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── TAB CONFLICTOS ── */}
      {tab === 'conflictos' && (
        <div className="flex-1 overflow-auto p-6">
          {conflictGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <CheckCircle2 size={44} className="text-green-400 mb-3" />
              <p className="text-gray-700 font-medium">Sin conflictos detectados</p>
              <p className="text-sm text-gray-400 mt-1">Todos los horarios del ciclo son compatibles</p>
            </div>
          ) : (
            <div className="space-y-8 max-w-3xl">
              {conflictGroups.map(group => (
                <div key={group.labId}>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    {group.labNombre} · {group.pares.length} conflicto{group.pares.length !== 1 ? 's' : ''}
                  </h3>
                  <div className="space-y-3">
                    {group.pares.map((par, i) => (
                      <div key={i} className="border border-red-200 rounded-xl overflow-hidden bg-white shadow-sm">
                        <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2">
                          <AlertTriangle size={13} className="text-red-500 shrink-0" />
                          <span className="text-xs font-semibold text-red-700">
                            Solapan en: {par.diasComunes.map(d => DIA_CORTO[d]).join(', ')}
                          </span>
                        </div>
                        {[par.a, par.b].map(clase => (
                          <div key={clase.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 last:border-0">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {clase.nombreAsignatura || clase.codigoAsignatura}
                                {clase.seccion ? <span className="font-normal text-gray-500"> · Sec. {clase.seccion}</span> : null}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {clase.docente || 'Docente —'}
                                {' · '}
                                <span className="font-mono">{clase.horaInicio}–{clase.horaFin}</span>
                              </p>
                            </div>
                            <button
                              onClick={() => { setTab('carga'); abrirEditar(clase); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-utec-primary border border-utec-primary rounded-lg hover:bg-utec-light transition-colors shrink-0"
                            >
                              <Edit2 size={11} /> Editar
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ClaseFormulario — panel lateral */}
      {formAbierto && labIdForm && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={cerrarForm}
          />
          <div className="relative w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
              <p className="text-sm font-semibold text-gray-700">
                {claseEditando ? 'Editar clase' : 'Nueva clase'}
                {' · '}
                <span className="text-utec-primary">{labMap[labIdForm]?.nombre || labIdForm}</span>
              </p>
              <button onClick={cerrarForm} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ClaseFormulario
                labId={labIdForm}
                cicloId={cicloId}
                claseEditando={claseEditando}
                onGuardado={onGuardado}
                onCerrar={cerrarForm}
              />
            </div>
          </div>
        </div>
      )}

      {/* Overlay al hacer click fuera del picker de lab */}
      {pickLab && (
        <div className="fixed inset-0 z-10" onClick={() => setPickLab(false)} />
      )}
    </div>
  );
}
