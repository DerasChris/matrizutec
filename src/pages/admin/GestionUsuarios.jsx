import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Loader2, RefreshCw, Plus, Search, UserPlus, UserMinus, UserCheck,
  Trash2, X, Save, Eye, EyeOff, AlertTriangle, FlaskConical,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  obtenerTodosUsuarios,
  actualizarRol,
  actualizarLabsAsignados,
  desactivarUsuario,
  activarUsuario,
  eliminarUsuario,
  crearUsuarioDesdeAdmin,
} from '../../services/usuariosService';
import { obtenerLaboratorios } from '../../services/laboratoriosService';
import { ROLES, ROLES_LABEL, LABS_INICIALES } from '../../lib/constants';

export default function GestionUsuarios() {
  const { perfil } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('activos');
  const [modalNuevo, setModalNuevo] = useState(false);
  const [accionEnCurso, setAccionEnCurso] = useState(null);
  const [usuarioAsignandoLabs, setUsuarioAsignandoLabs] = useState(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      setCargando(true);
      const data = await obtenerTodosUsuarios();
      setUsuarios(data);
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar usuarios');
    } finally {
      setCargando(false);
    }
  }

  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter(u => {
      if (busqueda) {
        const q = busqueda.toLowerCase();
        const match = (u.nombre || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filtroRol !== 'todos' && u.rol !== filtroRol) return false;
      if (filtroEstado === 'activos' && !u.activo) return false;
      if (filtroEstado === 'inactivos' && u.activo) return false;
      return true;
    });
  }, [usuarios, busqueda, filtroRol, filtroEstado]);

  async function handleCambiarRol(uid, nuevoRol) {
    try {
      setAccionEnCurso(uid);
      await actualizarRol(uid, nuevoRol);
      if (nuevoRol !== ROLES.ENCARGADO) {
        await actualizarLabsAsignados(uid, []);
      }
      toast.success('Rol actualizado');
      await cargar();
    } catch (e) {
      console.error(e);
      toast.error('Error al cambiar rol');
    } finally {
      setAccionEnCurso(null);
    }
  }

  async function handleToggleActivo(usuario) {
    try {
      setAccionEnCurso(usuario.uid);
      if (usuario.activo) {
        await desactivarUsuario(usuario.uid);
        toast.success(`${usuario.nombre} desactivado`);
      } else {
        await activarUsuario(usuario.uid);
        toast.success(`${usuario.nombre} reactivado`);
      }
      await cargar();
    } catch (e) {
      console.error(e);
      toast.error('Error al cambiar estado');
    } finally {
      setAccionEnCurso(null);
    }
  }

  async function handleEliminar(usuario) {
    if (!confirm(`¿Eliminar permanentemente a ${usuario.nombre}?\n\nNota: esto solo borra el documento de Firestore. La cuenta de autenticación debe eliminarse manualmente desde la consola de Firebase.`)) {
      return;
    }
    try {
      setAccionEnCurso(usuario.uid);
      await eliminarUsuario(usuario.uid);
      toast.success('Usuario eliminado');
      await cargar();
    } catch (e) {
      console.error(e);
      toast.error('Error al eliminar');
    } finally {
      setAccionEnCurso(null);
    }
  }

  async function handleGuardarLabs(uid, labIds) {
    try {
      await actualizarLabsAsignados(uid, labIds);
      toast.success(`Labs asignados correctamente`);
      setUsuarioAsignandoLabs(null);
      await cargar();
    } catch (e) {
      console.error(e);
      toast.error('Error al asignar labs');
    }
  }

  const stats = useMemo(() => ({
    total: usuarios.length,
    activos: usuarios.filter(u => u.activo).length,
    inactivos: usuarios.filter(u => !u.activo).length,
    docentes: usuarios.filter(u => u.rol === ROLES.DOCENTE).length,
    encargados: usuarios.filter(u => u.rol === ROLES.ENCARGADO).length,
    jefas: usuarios.filter(u => u.rol === ROLES.JEFA).length,
  }), [usuarios]);

  return (
    <div>
      <div className="mb-4 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de usuarios</h1>
          <p className="text-gray-600 text-sm mt-1">
            {stats.total} usuarios · {stats.activos} activos · {stats.inactivos} desactivados
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={cargar}
            disabled={cargando}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button
            onClick={() => setModalNuevo(true)}
            className="px-3 py-2 bg-utec-primary text-white rounded-lg hover:bg-utec-dark flex items-center gap-1.5 text-sm font-medium"
          >
            <Plus size={14} />
            Nuevo usuario
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <Stat label="Docentes" valor={stats.docentes} color="bg-blue-50 text-blue-900" />
        <Stat label="Encargados" valor={stats.encargados} color="bg-purple-50 text-purple-900" />
        <Stat label="Jefatura" valor={stats.jefas} color="bg-green-50 text-green-900" />
        <Stat label="Inactivos" valor={stats.inactivos} color="bg-gray-100 text-gray-700" />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3 mb-4 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-utec-primary"
          />
        </div>
        <select value={filtroRol} onChange={e => setFiltroRol(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="todos">Todos los roles</option>
          <option value={ROLES.DOCENTE}>Docente</option>
          <option value={ROLES.ENCARGADO}>Encargado</option>
          <option value={ROLES.JEFA}>Jefa</option>
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
          <option value="todos">Todos</option>
        </select>
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-utec-primary animate-spin" />
        </div>
      ) : usuariosFiltrados.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-700 font-medium">No hay usuarios que coincidan con los filtros</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-600 uppercase">Usuario</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-600 uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-600 uppercase">Rol / Labs</th>
                  <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-600 uppercase">Estado</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-600 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map(u => {
                  const esYo = u.uid === perfil?.uid;
                  const enAccion = accionEnCurso === u.uid;
                  const esEncargado = u.rol === ROLES.ENCARGADO;
                  const labsAsignados = u.labsAsignados || [];

                  return (
                    <tr key={u.uid} className={`border-b border-gray-100 hover:bg-gray-50 ${!u.activo ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {u.foto ? (
                            <img src={u.foto} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-utec-primary text-white flex items-center justify-center text-xs font-bold">
                              {(u.nombre || '?').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">
                              {u.nombre}
                              {esYo && <span className="ml-1 text-[10px] text-utec-primary">(tú)</span>}
                            </p>
                            {u.proveedor && (
                              <p className="text-[10px] text-gray-500 capitalize">
                                {u.proveedor.replace('.com', '')}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-xs">{u.email}</td>
                      <td className="px-4 py-3">
                        <select
                          value={u.rol}
                          onChange={e => handleCambiarRol(u.uid, e.target.value)}
                          disabled={esYo || enAccion || !u.activo}
                          className="text-xs px-2 py-1 border border-gray-300 rounded disabled:opacity-50"
                          title={esYo ? 'No puedes cambiar tu propio rol' : ''}
                        >
                          <option value={ROLES.DOCENTE}>Docente</option>
                          <option value={ROLES.ENCARGADO}>Encargado</option>
                          <option value={ROLES.JEFA}>Jefa</option>
                        </select>

                        {esEncargado && (
                          <button
                            onClick={() => setUsuarioAsignandoLabs(u)}
                            disabled={!u.activo}
                            className="mt-1.5 flex items-center gap-1 text-[11px] font-medium disabled:opacity-40"
                          >
                            {labsAsignados.length > 0 ? (
                              <span className="text-utec-primary hover:underline">
                                <FlaskConical size={11} className="inline mr-0.5" />
                                {labsAsignados.length} lab{labsAsignados.length !== 1 ? 's' : ''} asignado{labsAsignados.length !== 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span className="text-amber-600 hover:underline">
                                <AlertTriangle size={11} className="inline mr-0.5" />
                                Sin labs asignados
                              </span>
                            )}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {u.activo ? (
                          <span className="text-[10px] px-2 py-0.5 bg-green-600 text-white rounded font-bold uppercase">Activo</span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 bg-gray-500 text-white rounded font-bold uppercase">Inactivo</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleToggleActivo(u)}
                            disabled={esYo || enAccion}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30"
                            title={u.activo ? 'Desactivar' : 'Reactivar'}
                          >
                            {u.activo ? <UserMinus size={14} /> : <UserCheck size={14} />}
                          </button>
                          <button
                            onClick={() => handleEliminar(u)}
                            disabled={esYo || enAccion}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded disabled:opacity-30"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalNuevo && (
        <ModalNuevoUsuario
          onCerrar={() => setModalNuevo(false)}
          onCreado={() => { setModalNuevo(false); cargar(); }}
        />
      )}

      {usuarioAsignandoLabs && (
        <AsignarLabsModal
          usuario={usuarioAsignandoLabs}
          onCerrar={() => setUsuarioAsignandoLabs(null)}
          onGuardar={(labIds) => handleGuardarLabs(usuarioAsignandoLabs.uid, labIds)}
        />
      )}
    </div>
  );
}

function Stat({ label, valor, color }) {
  return (
    <div className={`rounded-lg p-3 ${color}`}>
      <p className="text-[10px] uppercase font-semibold opacity-70">{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-1">{valor}</p>
    </div>
  );
}

function AsignarLabsModal({ usuario, onCerrar, onGuardar }) {
  const [seleccionados, setSeleccionados] = useState(usuario.labsAsignados || []);
  const [guardando, setGuardando] = useState(false);

  function toggleLab(labId) {
    setSeleccionados(prev =>
      prev.includes(labId) ? prev.filter(id => id !== labId) : [...prev, labId]
    );
  }

  async function handleGuardar() {
    setGuardando(true);
    try {
      await onGuardar(seleccionados);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Asignar laboratorios</h2>
            <p className="text-xs text-gray-500 mt-0.5">{usuario.nombre}</p>
          </div>
          <button onClick={onCerrar} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs text-gray-500 mb-3">
            Selecciona los laboratorios que este encargado puede administrar.
            Solo verá estos labs en el dashboard y la matriz mensual.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {LABS_INICIALES.map(lab => {
              const marcado = seleccionados.includes(lab.id);
              return (
                <label
                  key={lab.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    marcado
                      ? 'bg-utec-light border-utec-primary'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => toggleLab(lab.id)}
                    className="w-4 h-4 text-utec-primary rounded border-gray-300 focus:ring-utec-primary"
                  />
                  <div>
                    <p className={`text-sm font-medium ${marcado ? 'text-utec-primary' : 'text-gray-800'}`}>
                      Lab {String(lab.numero).padStart(2, '0')}
                    </p>
                    {lab.tieneModulos && (
                      <p className="text-[10px] text-gray-500">4 módulos</p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex-shrink-0 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            {seleccionados.length === 0
              ? 'Ningún lab seleccionado'
              : `${seleccionados.length} lab${seleccionados.length !== 1 ? 's' : ''} seleccionado${seleccionados.length !== 1 ? 's' : ''}`
            }
          </p>
          <div className="flex gap-2">
            <button
              onClick={onCerrar}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="flex items-center gap-1.5 px-4 py-2 bg-utec-primary text-white rounded-lg text-sm font-medium hover:bg-utec-dark disabled:opacity-50"
            >
              {guardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalNuevoUsuario({ onCerrar, onCreado }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState(ROLES.DOCENTE);
  const [departamento, setDepartamento] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function handleCrear(e) {
    e.preventDefault();
    setError('');
    if (!nombre.trim()) return setError('Ingresa el nombre');
    if (!email.trim()) return setError('Ingresa el email');
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres');

    try {
      setEnviando(true);
      await crearUsuarioDesdeAdmin({
        nombre: nombre.trim(),
        email: email.trim(),
        password,
        rol,
        departamento: departamento.trim(),
      });
      toast.success(`Usuario ${nombre} creado correctamente`);
      onCreado();
    } catch (e) {
      console.error(e);
      if (e.code === 'auth/email-already-in-use') {
        setError('Ya existe una cuenta con ese correo.');
      } else if (e.code === 'auth/weak-password') {
        setError('La contraseña es muy débil.');
      } else if (e.code === 'auth/invalid-email') {
        setError('El correo no es válido.');
      } else {
        setError(e.message || 'Error al crear usuario.');
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UserPlus size={18} />
            Nuevo usuario
          </h2>
          <button onClick={onCerrar} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleCrear} className="px-5 py-4 space-y-3">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre completo *</label>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} required className="input-base text-sm" placeholder="Ej. Juan Pérez" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="input-base text-sm" placeholder="usuario@ejemplo.com" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña inicial * <span className="text-gray-400">(mín 6 caract.)</span></label>
            <div className="relative">
              <input
                type={verPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required minLength={6}
                className="input-base text-sm pr-10"
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setVerPassword(!verPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {verPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Rol *</label>
            <select value={rol} onChange={e => setRol(e.target.value)} className="input-base text-sm">
              <option value={ROLES.DOCENTE}>Docente</option>
              <option value={ROLES.ENCARGADO}>Encargado</option>
              <option value={ROLES.JEFA}>Jefa</option>
            </select>
            {rol === ROLES.ENCARGADO && (
              <p className="text-xs text-amber-600 mt-1">
                Recuerda asignarle labs desde la tabla de usuarios después de crearlo.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Departamento (opcional)</label>
            <input type="text" value={departamento} onChange={e => setDepartamento(e.target.value)} className="input-base text-sm" placeholder="Ej. FICA, Ingeniería" />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-800">
            El usuario podrá iniciar sesión inmediatamente con este email y contraseña.
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onCerrar} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={enviando} className="flex-1 px-3 py-2 bg-utec-primary text-white rounded-lg text-sm font-medium hover:bg-utec-dark disabled:opacity-50 flex items-center justify-center gap-1.5">
              {enviando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {enviando ? 'Creando...' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
