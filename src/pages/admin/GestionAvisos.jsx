import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Megaphone, Plus, Pencil, Trash2, Eye, EyeOff, X, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  obtenerTodosLosAvisos, crearAviso, actualizarAviso, eliminarAviso,
} from '../../services/avisosService';

function fmtTimestamp(ts) {
  if (!ts?.toDate) return '—';
  return ts.toDate().toLocaleString('es-SV', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function GestionAvisos() {
  const { perfil } = useAuth();
  const [avisos, setAvisos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [avisoEditando, setAvisoEditando] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setAvisos(await obtenerTodosLosAvisos());
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar avisos');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function abrirNuevo() {
    setAvisoEditando(null);
    setFormAbierto(true);
  }

  function abrirEditar(aviso) {
    setAvisoEditando(aviso);
    setFormAbierto(true);
  }

  async function toggleActivo(aviso) {
    try {
      await actualizarAviso(aviso.id, {
        titulo: aviso.titulo,
        mensaje: aviso.mensaje,
        urgente: aviso.urgente,
        activo: !aviso.activo,
      });
      toast.success(aviso.activo ? 'Aviso desactivado' : 'Aviso activado');
      cargar();
    } catch (e) {
      console.error(e);
      toast.error('Error al actualizar el aviso');
    }
  }

  async function eliminar(aviso) {
    if (!window.confirm(`¿Eliminar el aviso "${aviso.titulo}"? Esto no se puede deshacer.`)) return;
    try {
      await eliminarAviso(aviso.id);
      toast.success('Aviso eliminado');
      cargar();
    } catch (e) {
      console.error(e);
      toast.error('Error al eliminar el aviso');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-utec-primary rounded-xl flex items-center justify-center">
            <Megaphone size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Avisos</h1>
            <p className="text-sm text-gray-500">Banner que ven todos los usuarios al entrar mientras esté activo</p>
          </div>
        </div>
        <button
          onClick={abrirNuevo}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-utec-primary rounded-lg hover:bg-utec-dark"
        >
          <Plus size={16} /> Nuevo aviso
        </button>
      </div>

      {cargando ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : avisos.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Megaphone size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No hay avisos creados</p>
          <p className="text-sm mt-1">Crea uno con el botón <strong>Nuevo aviso</strong>.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {avisos.map(a => (
            <div
              key={a.id}
              className={`flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border ${
                a.activo ? 'border-red-200 bg-red-50/40' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900 text-sm">{a.titulo}</h3>
                  {a.activo ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-bold">
                      ACTIVO
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 text-[11px] font-bold">
                      INACTIVO
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2 whitespace-pre-wrap">{a.mensaje}</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  Creado {fmtTimestamp(a.creadoEn)}{a.creadoPorNombre ? ` · ${a.creadoPorNombre}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                <button
                  onClick={() => toggleActivo(a)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  title={a.activo ? 'Desactivar' : 'Activar'}
                >
                  {a.activo ? <EyeOff size={13} /> : <Eye size={13} />}
                  {a.activo ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  onClick={() => abrirEditar(a)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Pencil size={13} /> Editar
                </button>
                <button
                  onClick={() => eliminar(a)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                >
                  <Trash2 size={13} /> Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formAbierto && (
        <AvisoFormModal
          aviso={avisoEditando}
          perfil={perfil}
          onClose={() => setFormAbierto(false)}
          onGuardado={() => { setFormAbierto(false); cargar(); }}
        />
      )}
    </div>
  );
}

function AvisoFormModal({ aviso, perfil, onClose, onGuardado }) {
  const [titulo, setTitulo] = useState(aviso?.titulo || '');
  const [mensaje, setMensaje] = useState(aviso?.mensaje || '');
  const [activo, setActivo] = useState(aviso?.activo ?? true);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!titulo.trim() || !mensaje.trim()) {
      toast.error('Completa título y mensaje');
      return;
    }
    setGuardando(true);
    try {
      if (aviso) {
        await actualizarAviso(aviso.id, { titulo: titulo.trim(), mensaje: mensaje.trim(), urgente: true, activo });
      } else {
        await crearAviso({ titulo: titulo.trim(), mensaje: mensaje.trim(), urgente: true }, perfil);
      }
      toast.success(aviso ? 'Aviso actualizado' : 'Aviso creado');
      onGuardado();
    } catch (e) {
      console.error(e);
      toast.error('Error al guardar el aviso');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{aviso ? 'Editar aviso' : 'Nuevo aviso'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              className="input-base"
              placeholder="Ej: Cambios de laboratorio esta semana"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje</label>
            <textarea
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
              rows={6}
              className="input-base"
              placeholder="Explica los movimientos para que todos estén enterados..."
            />
          </div>
          {aviso && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} />
              Activo (visible para todos al entrar)
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-utec-primary text-white rounded-lg hover:bg-utec-dark disabled:opacity-50"
          >
            {guardando && <Loader2 size={14} className="animate-spin" />}
            {aviso ? 'Guardar cambios' : 'Crear aviso'}
          </button>
        </div>
      </div>
    </div>
  );
}
