import { useState, useEffect } from 'react';
import {
  Users, Award, Save, Trash2, X, Copy, CheckCircle, AlertTriangle, Loader,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { FRANJAS_HORARIAS, TIPOS_CLASE } from '../../lib/constants';
import { crearClase, actualizarClase, eliminarClase, obtenerLaboratorios, obtenerClasesDelLab, copiarEventoALab } from '../../services/clasesService';
import { getDiaSemanaPorIndice } from '../../utils/dateHelpers';
import { clasesQueAplicanEnFecha } from '../../utils/matrizHelpers';
import { rangosSesolapan } from '../../utils/dateHelpers';
import { registrarActividad } from '../../services/logService';
import { useAuth } from '../../context/AuthContext';
import { fechaActualISO } from '../../utils/dateHelpers';

const HORAS = FRANJAS_HORARIAS.map(f => f.inicio);

function diaSemanaDeISO(fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  return getDiaSemanaPorIndice(new Date(y, m - 1, d).getDay())?.id || 'lunes';
}

export default function EventoEspecialForm({
  labId,
  cicloId,
  eventoEditando,
  labs = [],
  onGuardado,
  onCerrar,
}) {
  const { perfil } = useAuth();

  const [tipo,          setTipo]          = useState(eventoEditando?.tipo || TIPOS_CLASE.REUNION);
  const [titulo,        setTitulo]        = useState(eventoEditando?.titulo || '');
  const [fecha,         setFecha]         = useState(eventoEditando?.fechaInicio || fechaActualISO());
  const [horaInicio,    setHoraInicio]    = useState(eventoEditando?.horaInicio || '08:00');
  const [horaFin,       setHoraFin]       = useState(eventoEditando?.horaFin || '10:00');
  const [docente,       setDocente]       = useState(eventoEditando?.docente || '');
  const [participantes, setParticipantes] = useState(eventoEditando?.inscritos ?? '');
  const [observaciones, setObservaciones] = useState(eventoEditando?.observaciones || '');

  const [errores,     setErrores]     = useState({});
  const [guardando,   setGuardando]   = useState(false);
  const [eliminando,  setEliminando]  = useState(false);
  const [conflictos,  setConflictos]  = useState(null); // null | []

  // Copiar a otro lab (solo REUNION)
  const [labDestino,      setLabDestino]      = useState(null);
  const [conflictosCopia, setConflictosCopia] = useState(null); // null | 'checking' | []
  const [copiando,        setCopiando]        = useState(false);
  const [copiadoEn,       setCopiadoEn]       = useState([]);  // ids de labs ya copiados

  const labsDisponibles = labs.filter(l => l.id !== labId && l.activo !== false);

  async function verificarConflictos(labTarget, fi, ff, fe) {
    const clasesFila = await obtenerClasesDelLab(labTarget, cicloId, true);
    const diaSemana = diaSemanaDeISO(fe);
    const aplicables = clasesQueAplicanEnFecha(clasesFila, fe, diaSemana, null);
    return aplicables.filter(c =>
      c.id !== eventoEditando?.id &&
      rangosSesolapan(c.horaInicio, c.horaFin, fi, ff)
    );
  }

  useEffect(() => {
    setConflictos(null);
  }, [fecha, horaInicio, horaFin]);

  useEffect(() => {
    setConflictosCopia(null);
    setLabDestino(null);
  }, [fecha, horaInicio, horaFin]);

  async function seleccionarLabDestino(lab) {
    setLabDestino(lab);
    setConflictosCopia('checking');
    const cols = await verificarConflictos(lab.id, horaInicio, horaFin, fecha);
    setConflictosCopia(cols);
  }

  function validar() {
    const e = {};
    if (!titulo.trim())     e.titulo = 'El título es requerido';
    if (!fecha)             e.fecha  = 'La fecha es requerida';
    if (!horaInicio)        e.horaInicio = 'Requerido';
    if (!horaFin)           e.horaFin    = 'Requerido';
    if (horaInicio >= horaFin) e.horaFin = 'Debe ser después de la hora de inicio';
    if (tipo === TIPOS_CLASE.DEFENSA && !docente.trim()) e.docente = 'El docente encargado es requerido';
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function handleGuardar() {
    if (!validar()) return;
    setGuardando(true);
    try {
      const cols = await verificarConflictos(labId, horaInicio, horaFin, fecha);
      if (cols.length > 0) {
        setConflictos(cols);
        setGuardando(false);
        return;
      }

      const payload = {
        tipo,
        titulo: titulo.trim(),
        labId,
        cicloId,
        fechaInicio: fecha,
        horaInicio,
        horaFin,
        docente: tipo === TIPOS_CLASE.DEFENSA ? docente.trim() : '',
        inscritos: tipo === TIPOS_CLASE.DEFENSA && participantes !== '' ? Number(participantes) : 0,
        observaciones: observaciones.trim(),
        activo: true,
      };

      if (eventoEditando) {
        await actualizarClase(eventoEditando.id, payload);
        await registrarActividad({ tipo: 'editar_evento', descripcion: `Evento editado: ${titulo}`, usuario: perfil, entidad: { tipoEvento: tipo, labId } });
        toast.success('Evento actualizado');
      } else {
        await crearClase(payload);
        await registrarActividad({ tipo: 'crear_evento', descripcion: `Evento creado: ${titulo}`, usuario: perfil, entidad: { tipoEvento: tipo, labId } });
        toast.success('Evento creado');
      }
      onGuardado?.();
    } catch (e) {
      console.error(e);
      toast.error('Error al guardar el evento');
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar() {
    if (!eventoEditando) return;
    if (!confirm(`¿Eliminar "${eventoEditando.titulo || 'este evento'}"?`)) return;
    setEliminando(true);
    try {
      await eliminarClase(eventoEditando.id);
      await registrarActividad({ tipo: 'eliminar_evento', descripcion: `Evento eliminado: ${eventoEditando.titulo}`, usuario: perfil, entidad: { tipoEvento: tipo, labId } });
      toast.success('Evento eliminado');
      onGuardado?.();
    } catch {
      toast.error('Error al eliminar');
    } finally {
      setEliminando(false);
    }
  }

  async function handleCopiar() {
    if (!labDestino || !eventoEditando) return;
    setCopiando(true);
    try {
      await copiarEventoALab(eventoEditando, labDestino.id);
      await registrarActividad({ tipo: 'copiar_evento', descripcion: `Reunión copiada a ${labDestino.nombre}`, usuario: perfil, entidad: { labId: labDestino.id } });
      toast.success(`Copiado a ${labDestino.nombre}`);
      setCopiadoEn(prev => [...prev, labDestino.id]);
      setLabDestino(null);
      setConflictosCopia(null);
    } catch {
      toast.error('Error al copiar');
    } finally {
      setCopiando(false);
    }
  }

  const inputCls = (err) =>
    `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-utec-primary ${err ? 'border-red-400' : 'border-gray-300'}`;

  return (
    <div className="flex flex-col h-full">
      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Tipo selector */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Tipo de evento</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: TIPOS_CLASE.REUNION, label: 'Reunión', icon: Users,  desc: 'Sin docente ni código' },
              { id: TIPOS_CLASE.DEFENSA, label: 'Defensa', icon: Award,  desc: 'Proyecto o tesis' },
            ].map(({ id, label, icon: Icon, desc }) => (
              <button
                key={id}
                type="button"
                onClick={() => { setTipo(id); setErrores({}); }}
                className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 text-left transition-all ${
                  tipo === id
                    ? id === TIPOS_CLASE.REUNION
                      ? 'border-violet-500 bg-violet-50 text-violet-800'
                      : 'border-teal-500 bg-teal-50 text-teal-800'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs opacity-70">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Título */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Título *</label>
          <input
            type="text"
            value={titulo}
            onChange={e => { setTitulo(e.target.value); setErrores(v => ({...v, titulo: null})); }}
            placeholder={tipo === TIPOS_CLASE.REUNION ? 'Ej. Reunión de docentes de FICA' : 'Ej. Defensa de tesis — Ing. Sistemas'}
            className={inputCls(errores.titulo)}
          />
          {errores.titulo && <p className="text-xs text-red-500 mt-0.5">{errores.titulo}</p>}
        </div>

        {/* Fecha + horario */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-3 sm:col-span-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha *</label>
            <input
              type="date"
              value={fecha}
              onChange={e => { setFecha(e.target.value); setErrores(v => ({...v, fecha: null})); }}
              className={inputCls(errores.fecha)}
            />
            {errores.fecha && <p className="text-xs text-red-500 mt-0.5">{errores.fecha}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Inicio *</label>
            <select
              value={horaInicio}
              onChange={e => { setHoraInicio(e.target.value); setErrores(v => ({...v, horaInicio: null, horaFin: null})); }}
              className={inputCls(errores.horaInicio)}
            >
              {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fin *</label>
            <select
              value={horaFin}
              onChange={e => { setHoraFin(e.target.value); setErrores(v => ({...v, horaFin: null})); }}
              className={inputCls(errores.horaFin)}
            >
              {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            {errores.horaFin && <p className="text-xs text-red-500 mt-0.5">{errores.horaFin}</p>}
          </div>
        </div>

        {/* Campos específicos de DEFENSA */}
        {tipo === TIPOS_CLASE.DEFENSA && (
          <div className="space-y-3 p-4 bg-teal-50 border border-teal-200 rounded-xl">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Docente encargado *</label>
              <input
                type="text"
                value={docente}
                onChange={e => { setDocente(e.target.value); setErrores(v => ({...v, docente: null})); }}
                placeholder="Nombre del docente o jurado principal"
                className={inputCls(errores.docente)}
              />
              {errores.docente && <p className="text-xs text-red-500 mt-0.5">{errores.docente}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Participantes</label>
              <input
                type="number"
                min={1}
                value={participantes}
                onChange={e => setParticipantes(e.target.value)}
                placeholder="Cantidad estimada"
                className={inputCls(null)}
              />
            </div>
          </div>
        )}

        {/* Observaciones */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones</label>
          <textarea
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            rows={2}
            placeholder="Notas adicionales..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-utec-primary resize-none"
          />
        </div>

        {/* Alerta de conflictos */}
        {conflictos && conflictos.length > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
              <AlertTriangle size={14} /> Conflicto de horario
            </p>
            {conflictos.map(c => (
              <p key={c.id} className="text-xs text-red-600 mt-1">
                · {c.titulo || c.nombreAsignatura || c.codigoAsignatura} ({c.horaInicio}–{c.horaFin})
              </p>
            ))}
          </div>
        )}

        {/* ── Sección Copiar a otro lab (solo REUNION editando) ── */}
        {tipo === TIPOS_CLASE.REUNION && eventoEditando && (
          <div className="border border-violet-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-violet-50 border-b border-violet-100 flex items-center gap-2">
              <Copy size={14} className="text-violet-600" />
              <span className="text-sm font-semibold text-violet-800">Copiar a otro laboratorio</span>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-gray-500">
                Crea una copia de esta reunión en otro lab (para reuniones paralelas).
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {labsDisponibles.map(lab => {
                  const yaCopiado = copiadoEn.includes(lab.id);
                  return (
                    <button
                      key={lab.id}
                      type="button"
                      onClick={() => !yaCopiado && seleccionarLabDestino(lab)}
                      className={`text-left px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        yaCopiado
                          ? 'border-green-300 bg-green-50 text-green-700 cursor-default'
                          : labDestino?.id === lab.id
                          ? 'border-violet-500 bg-violet-50 text-violet-800'
                          : 'border-gray-200 hover:border-violet-300 text-gray-700'
                      }`}
                    >
                      {yaCopiado && <CheckCircle size={10} className="inline mr-1 text-green-600" />}
                      {lab.nombre.replace('Laboratorio ', 'Lab ')}
                    </button>
                  );
                })}
              </div>

              {labDestino && (
                <div className="mt-2">
                  {conflictosCopia === 'checking' && (
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Loader size={11} className="animate-spin" /> Verificando conflictos…
                    </p>
                  )}
                  {Array.isArray(conflictosCopia) && conflictosCopia.length > 0 && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                      <p className="font-semibold flex items-center gap-1"><AlertTriangle size={11} /> Hay conflicto en {labDestino.nombre}:</p>
                      {conflictosCopia.map(c => (
                        <p key={c.id} className="mt-0.5 ml-3">· {c.titulo || c.nombreAsignatura || c.codigoAsignatura} ({c.horaInicio}–{c.horaFin})</p>
                      ))}
                    </div>
                  )}
                  {Array.isArray(conflictosCopia) && conflictosCopia.length === 0 && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-green-700 flex items-center gap-1">
                        <CheckCircle size={11} /> Sin conflictos en {labDestino.nombre}
                      </p>
                      <button
                        type="button"
                        onClick={handleCopiar}
                        disabled={copiando}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
                      >
                        {copiando ? <Loader size={11} className="animate-spin" /> : <Copy size={11} />}
                        {copiando ? 'Copiando…' : `Copiar a ${labDestino.nombre.replace('Laboratorio ', 'Lab ')}`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-5 py-4 border-t border-gray-200 bg-gray-50">
        <div>
          {eventoEditando && (
            <button
              type="button"
              onClick={handleEliminar}
              disabled={eliminando}
              className="px-3 py-2 text-sm text-red-700 hover:bg-red-50 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 size={14} /> {eliminando ? 'Eliminando…' : 'Eliminar'}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGuardar}
            disabled={guardando}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-utec-primary text-white rounded-lg hover:bg-utec-dark disabled:opacity-50"
          >
            <Save size={14} /> {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
