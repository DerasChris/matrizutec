import { useState, useEffect, useMemo } from 'react';
import { X, AlertTriangle, Calendar, Repeat, Clock, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DIAS_SEMANA,
  TIPOS_CLASE,
  TIPOS_CLASE_LABEL,
  FRANJAS_HORARIAS,
} from '../../lib/constants';
import { detectarColisiones } from '../../utils/matrizHelpers';
import { horaToMinutos, formatearHora } from '../../utils/dateHelpers';
import { crearClase, actualizarClase, desactivarClase, eliminarClase } from '../../services/clasesService';

const ESTADO_VACIO = {
  tipo: TIPOS_CLASE.REGULAR,
  codigoAsignatura: '',
  nombreAsignatura: '',
  seccion: '',
  inscritos: '',
  docente: '',
  diasSemana: [],
  horaInicio: '06:30',
  horaFin: '08:00',
  modulos: [],
  fechaInicio: '',
  fechaFin: '',
  observaciones: '',
};

export default function ClaseFormulario({
  abierto,
  onCerrar,
  onGuardado,
  lab,
  ciclo,
  claseEditando,
  sugerencia,
  todasLasClases = [],
}) {
  const [form, setForm] = useState(ESTADO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});

  useEffect(() => {
    if (!abierto) return;

    if (claseEditando) {
      setForm({
        ...ESTADO_VACIO,
        ...claseEditando,
        inscritos: claseEditando.inscritos ?? '',
        modulos: claseEditando.modulos || [],
        diasSemana: claseEditando.diasSemana || [],
      });
    } else {
      setForm({
        ...ESTADO_VACIO,
        diasSemana: sugerencia?.diaSugerido ? [sugerencia.diaSugerido] : [],
        modulos: sugerencia?.moduloSugerido ? [sugerencia.moduloSugerido] : [],
        horaInicio: sugerencia?.horaInicio || '06:30',
        horaFin: sugerencia?.horaFin || '08:00',
        fechaInicio: ciclo?.fechaInicio || '',
        fechaFin: ciclo?.fechaFin || '',
      });
    }
    setErrores({});
  }, [abierto, claseEditando, sugerencia, ciclo]);

  const tieneModulos = lab?.tieneModulos && Array.isArray(lab?.modulos) && lab.modulos.length > 0;

  const colisiones = useMemo(() => {
    if (!form.horaInicio || !form.horaFin || form.diasSemana.length === 0) return [];
    return detectarColisiones(
      {
        labId: lab?.id,
        diasSemana: form.diasSemana,
        horaInicio: form.horaInicio,
        horaFin: form.horaFin,
        modulos: form.modulos,
      },
      todasLasClases,
      claseEditando?.id
    );
  }, [form, todasLasClases, lab, claseEditando]);

  const capacidadModulosSeleccionados = useMemo(() => {
    if (!tieneModulos || form.modulos.length === 0) return null;
    return lab.modulos
      .filter(m => form.modulos.includes(m.id))
      .reduce((sum, m) => sum + (m.equipos || 0), 0);
  }, [form.modulos, lab, tieneModulos]);

  function actualizar(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }));
    setErrores(e => ({ ...e, [campo]: null }));
  }

  function toggleDia(diaId) {
    setForm(f => ({
      ...f,
      diasSemana: f.diasSemana.includes(diaId)
        ? f.diasSemana.filter(d => d !== diaId)
        : [...f.diasSemana, diaId],
    }));
  }

  function toggleModulo(moduloId) {
    setForm(f => ({
      ...f,
      modulos: f.modulos.includes(moduloId)
        ? f.modulos.filter(m => m !== moduloId)
        : [...f.modulos, moduloId],
    }));
  }

  function todosLosModulos() {
    if (!tieneModulos) return;
    setForm(f => ({
      ...f,
      modulos: f.modulos.length === lab.modulos.length ? [] : lab.modulos.map(m => m.id),
    }));
  }

  function validar() {
    const e = {};
    if (!form.codigoAsignatura.trim()) e.codigoAsignatura = 'Requerido';
    if (!form.nombreAsignatura.trim()) e.nombreAsignatura = 'Requerido';
    if (!form.docente.trim()) e.docente = 'Requerido';
    if (!form.seccion.trim()) e.seccion = 'Requerido';
    if (!form.inscritos || isNaN(form.inscritos) || form.inscritos < 1) e.inscritos = 'Inválido';
    if (form.diasSemana.length === 0) e.diasSemana = 'Selecciona al menos un día';
    if (!form.horaInicio || !form.horaFin) e.horario = 'Horario requerido';
    if (form.horaInicio && form.horaFin && horaToMinutos(form.horaFin) <= horaToMinutos(form.horaInicio)) {
      e.horario = 'La hora fin debe ser después de la hora inicio';
    }
    if (form.tipo === TIPOS_CLASE.REGULAR && (!form.fechaInicio || !form.fechaFin)) {
      e.fechas = 'Las clases regulares requieren rango de fechas';
    }
    if (form.tipo === TIPOS_CLASE.PUNTUAL && !form.fechaInicio) {
      e.fechas = 'La práctica puntual requiere una fecha';
    }
    if (tieneModulos && form.modulos.length === 0) {
      e.modulos = 'Selecciona al menos un módulo (o todos para lab completo)';
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function handleGuardar() {
    if (!validar()) {
      toast.error('Revisa los campos marcados');
      return;
    }
    if (colisiones.length > 0) {
      const ok = confirm(`Hay ${colisiones.length} colisión(es) con clases existentes. ¿Guardar de todos modos?`);
      if (!ok) return;
    }

    try {
      setGuardando(true);
      const payload = {
        labId: lab.id,
        cicloId: ciclo.id,
        tipo: form.tipo,
        codigoAsignatura: form.codigoAsignatura.trim().toUpperCase(),
        nombreAsignatura: form.nombreAsignatura.trim(),
        seccion: form.seccion.trim(),
        inscritos: parseInt(form.inscritos),
        docente: form.docente.trim(),
        diasSemana: form.diasSemana,
        horaInicio: form.horaInicio,
        horaFin: form.horaFin,
        modulos: tieneModulos ? form.modulos : [],
        fechaInicio: form.fechaInicio,
        fechaFin: form.tipo === TIPOS_CLASE.PUNTUAL ? form.fechaInicio : form.fechaFin,
        observaciones: form.observaciones.trim(),
      };

      if (claseEditando) {
        await actualizarClase(claseEditando.id, payload);
        toast.success('Clase actualizada');
      } else {
        await crearClase(payload);
        toast.success('Clase creada');
      }
      onGuardado?.();
      onCerrar();
    } catch (e) {
      console.error(e);
      toast.error('Error al guardar la clase');
    } finally {
      setGuardando(false);
    }
  }

  async function handleDesactivar() {
    if (!claseEditando) return;
    if (!confirm('¿Desactivar esta clase? Dejará de aparecer en la matriz pero se conserva el histórico.')) return;
    try {
      await desactivarClase(claseEditando.id);
      toast.success('Clase desactivada');
      onGuardado?.();
      onCerrar();
    } catch (e) {
      console.error(e);
      toast.error('Error al desactivar');
    }
  }

  async function handleEliminar() {
    if (!claseEditando) return;
    if (!confirm('¿Eliminar permanentemente esta clase? Esta acción no se puede deshacer.')) return;
    try {
      await eliminarClase(claseEditando.id);
      toast.success('Clase eliminada');
      onGuardado?.();
      onCerrar();
    } catch (e) {
      console.error(e);
      toast.error('Error al eliminar');
    }
  }

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold">
              {claseEditando ? 'Editar clase' : 'Nueva clase'}
            </h2>
            <p className="text-xs text-gray-500">{lab?.nombre} · {ciclo?.nombre}</p>
          </div>
          <button onClick={onCerrar} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de clase</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => actualizar('tipo', TIPOS_CLASE.REGULAR)}
                className={`p-3 border-2 rounded-lg text-left transition-colors ${
                  form.tipo === TIPOS_CLASE.REGULAR
                    ? 'border-utec-primary bg-utec-light'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-sm">
                  <Repeat size={14} /> Regular
                </div>
                <p className="text-xs text-gray-600 mt-1">Se repite todos los días seleccionados durante el ciclo</p>
              </button>
              <button
                type="button"
                onClick={() => actualizar('tipo', TIPOS_CLASE.PUNTUAL)}
                className={`p-3 border-2 rounded-lg text-left transition-colors ${
                  form.tipo === TIPOS_CLASE.PUNTUAL
                    ? 'border-utec-primary bg-utec-light'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-sm">
                  <Calendar size={14} /> Práctica única
                </div>
                <p className="text-xs text-gray-600 mt-1">Solo un día específico (no se repite)</p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
              <input
                type="text"
                value={form.codigoAsignatura}
                onChange={e => actualizar('codigoAsignatura', e.target.value)}
                placeholder="Ej. PROE-I"
                className={`input-base uppercase ${errores.codigoAsignatura ? 'border-red-500' : ''}`}
              />
              {errores.codigoAsignatura && <p className="text-xs text-red-600 mt-1">{errores.codigoAsignatura}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sección *</label>
              <input
                type="text"
                value={form.seccion}
                onChange={e => actualizar('seccion', e.target.value)}
                placeholder="Ej. 01"
                className={`input-base ${errores.seccion ? 'border-red-500' : ''}`}
              />
              {errores.seccion && <p className="text-xs text-red-600 mt-1">{errores.seccion}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Asignatura *</label>
            <input
              type="text"
              value={form.nombreAsignatura}
              onChange={e => actualizar('nombreAsignatura', e.target.value)}
              placeholder="Ej. Programación Orientada a Objetos"
              className={`input-base ${errores.nombreAsignatura ? 'border-red-500' : ''}`}
            />
            {errores.nombreAsignatura && <p className="text-xs text-red-600 mt-1">{errores.nombreAsignatura}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Docente *</label>
              <input
                type="text"
                value={form.docente}
                onChange={e => actualizar('docente', e.target.value)}
                placeholder="Ej. Lic. Lilian de Leiva"
                className={`input-base ${errores.docente ? 'border-red-500' : ''}`}
              />
              {errores.docente && <p className="text-xs text-red-600 mt-1">{errores.docente}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Inscritos *</label>
              <input
                type="number"
                value={form.inscritos}
                onChange={e => actualizar('inscritos', e.target.value)}
                min="1"
                className={`input-base ${errores.inscritos ? 'border-red-500' : ''}`}
              />
              {errores.inscritos && <p className="text-xs text-red-600 mt-1">{errores.inscritos}</p>}
            </div>
          </div>

          {form.tipo === TIPOS_CLASE.REGULAR && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Días de la semana *</label>
              <div className="flex flex-wrap gap-1.5">
                {DIAS_SEMANA.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDia(d.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      form.diasSemana.includes(d.id)
                        ? 'bg-utec-primary text-white border-utec-primary'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {d.corto}
                  </button>
                ))}
              </div>
              {errores.diasSemana && <p className="text-xs text-red-600 mt-1">{errores.diasSemana}</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Clock size={14} className="inline mr-1" />
                Hora inicio *
              </label>
              <select
                value={form.horaInicio}
                onChange={e => actualizar('horaInicio', e.target.value)}
                className="input-base"
              >
                {FRANJAS_HORARIAS.map(f => (
                  <option key={f.inicio} value={f.inicio}>{f.inicio}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin *</label>
              <select
                value={form.horaFin}
                onChange={e => actualizar('horaFin', e.target.value)}
                className="input-base"
              >
                {FRANJAS_HORARIAS.map(f => (
                  <option key={f.fin} value={f.fin}>{f.fin}</option>
                ))}
              </select>
            </div>
          </div>
          {errores.horario && <p className="text-xs text-red-600 -mt-3">{errores.horario}</p>}

          {form.tipo === TIPOS_CLASE.REGULAR ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vigente desde *</label>
                <input
                  type="date"
                  value={form.fechaInicio}
                  onChange={e => actualizar('fechaInicio', e.target.value)}
                  className="input-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vigente hasta *</label>
                <input
                  type="date"
                  value={form.fechaFin}
                  onChange={e => actualizar('fechaFin', e.target.value)}
                  className="input-base"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de la práctica *</label>
              <input
                type="date"
                value={form.fechaInicio}
                onChange={e => actualizar('fechaInicio', e.target.value)}
                className="input-base"
              />
            </div>
          )}
          {errores.fechas && <p className="text-xs text-red-600 -mt-3">{errores.fechas}</p>}

          {tieneModulos && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-blue-900">Módulos del Lab 03 *</label>
                <button
                  type="button"
                  onClick={todosLosModulos}
                  className="text-xs text-blue-700 hover:underline"
                >
                  {form.modulos.length === lab.modulos.length ? 'Quitar todos' : 'Lab completo'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {lab.modulos.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleModulo(m.id)}
                    className={`p-2 rounded-md text-left text-xs border transition-colors ${
                      form.modulos.includes(m.id)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-blue-900 border-blue-200 hover:border-blue-400'
                    }`}
                  >
                    <div className="font-semibold">{m.nombre}</div>
                    <div className="opacity-80">PC {m.pcInicio}-{m.pcFin} · {m.equipos} eq.</div>
                  </button>
                ))}
              </div>
              {errores.modulos && <p className="text-xs text-red-600 mt-1">{errores.modulos}</p>}
              {capacidadModulosSeleccionados !== null && form.inscritos > 0 && (
                <p className={`text-xs mt-2 ${
                  parseInt(form.inscritos) > capacidadModulosSeleccionados ? 'text-red-700' : 'text-blue-800'
                }`}>
                  Capacidad seleccionada: {capacidadModulosSeleccionados} equipos · Inscritos: {form.inscritos}
                  {parseInt(form.inscritos) > capacidadModulosSeleccionados && ' ⚠️ Excede capacidad'}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea
              value={form.observaciones}
              onChange={e => actualizar('observaciones', e.target.value)}
              rows={2}
              className="input-base"
              placeholder="Notas adicionales (opcional)"
            />
          </div>

          {colisiones.length > 0 && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-900">
                    {colisiones.length} colisión(es) detectada(s)
                  </p>
                  <ul className="mt-1 text-xs text-red-800 space-y-1">
                    {colisiones.slice(0, 5).map((col, i) => (
                      <li key={i}>
                        • {col.clase.codigoAsignatura}-{col.clase.seccion} en {col.diasComunes.join(', ')} ({formatearHora(col.clase.horaInicio)}-{formatearHora(col.clase.horaFin)}) — {col.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-2">
            {claseEditando && (
              <>
                <button
                  onClick={handleDesactivar}
                  className="px-3 py-2 text-sm text-amber-700 hover:bg-amber-100 rounded-lg flex items-center gap-1.5"
                >
                  Desactivar
                </button>
                <button
                  onClick={handleEliminar}
                  className="px-3 py-2 text-sm text-red-700 hover:bg-red-100 rounded-lg flex items-center gap-1.5"
                >
                  <Trash2 size={14} /> Eliminar
                </button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onCerrar}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="px-4 py-2 text-sm bg-utec-primary text-white rounded-lg hover:bg-utec-dark disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save size={14} /> {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
