import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLES_LABEL } from '../../lib/constants';
import {
  LayoutDashboard, CalendarDays, ClipboardList, Users, LogOut, Settings, Inbox,
  Bell, Check, CheckCheck,
} from 'lucide-react';
import clsx from 'clsx';
import { suscribirseANotificaciones, marcarComoLeida, marcarTodasLeidas } from '../../services/notificacionesService';
import { formatearFechaCorta } from '../../utils/dateHelpers';

export default function Header() {
  const { perfil, signOut, esAdmin, esJefa, esDocente } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!perfil?.uid) return;
    const unsub = suscribirseANotificaciones(perfil.uid, setNotifs);
    return () => unsub();
  }, [perfil?.uid]);

  useEffect(() => {
    function clickFuera(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setAbierto(false);
      }
    }
    document.addEventListener('mousedown', clickFuera);
    return () => document.removeEventListener('mousedown', clickFuera);
  }, []);

  const noLeidas = notifs.filter(n => !n.leida).length;

  const navItems = [
    {to:'/servicios', label:'Servicios', icon: LayoutDashboard, roles: 'todos'},
    { to: '/', label: 'Estado actual', icon: LayoutDashboard, roles: 'todos' },
    { to: '/matriz', label: 'Matriz mensual', icon: CalendarDays, roles: ['encargado', 'jefa'] },
    { to: '/reservar', label: 'Reservar', icon: ClipboardList, roles: ['docente', 'encargado', 'jefa'] },
    { to: '/mis-reservas', label: 'Mis reservas', icon: Inbox, roles: ['docente'] },
    { to: '/aprobaciones', label: 'Aprobaciones', icon: Inbox, roles: ['jefa'] },
    { to: '/admin/usuarios', label: 'Usuarios', icon: Users, roles: ['jefa'] },
  ];

  const itemsVisibles = navItems.filter(item => {
    if (item.roles === 'todos') return true;
    return item.roles.includes(perfil?.rol);
  });

  async function handleLogout() {
    await signOut();
    navigate('/login');
  }

  async function clickNotif(notif) {
    if (!notif.leida) await marcarComoLeida(notif.id);
    if (notif.refTipo === 'reserva') {
      if (esJefa()) navigate('/aprobaciones');
      else navigate('/mis-reservas');
    }
    setAbierto(false);
  }

  async function leerTodas() {
    if (!perfil?.uid) return;
    await marcarTodasLeidas(perfil.uid);
  }

  return (
    <header className="bg-utec-primary text-white shadow-lg sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-utec-accent rounded-lg flex items-center justify-center">
              <span className="text-utec-primary font-bold">L</span>
            </div>
            <div>
              <p className="font-semibold leading-none">LabTrack Horarios</p>
              <p className="text-xs text-utec-light/80 leading-none mt-0.5">UTEC FICA</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {itemsVisibles.map(item => {
              const Icon = item.icon;
              const active = location.pathname === item.to ||
                            (item.to !== '/' && location.pathname.startsWith(item.to));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-white/15 text-white'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  )}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setAbierto(!abierto)}
                className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
                title="Notificaciones"
              >
                <Bell size={18} />
                {noLeidas > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                    {noLeidas > 9 ? '9+' : noLeidas}
                  </span>
                )}
              </button>

              {abierto && (
                <div className="absolute right-0 top-12 w-80 bg-white text-gray-900 rounded-lg shadow-xl border border-gray-200 max-h-[480px] overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <p className="text-sm font-semibold">Notificaciones</p>
                    {noLeidas > 0 && (
                      <button
                        onClick={leerTodas}
                        className="text-xs text-utec-primary hover:underline flex items-center gap-1"
                      >
                        <CheckCheck size={12} />
                        Marcar leídas
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {notifs.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No tienes notificaciones</p>
                      </div>
                    ) : (
                      notifs.map(n => (
                        <button
                          key={n.id}
                          onClick={() => clickNotif(n)}
                          className={clsx(
                            'w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors',
                            !n.leida && 'bg-blue-50/50'
                          )}
                        >
                          <div className="flex items-start gap-2">
                            {!n.leida && (
                              <span className="w-2 h-2 bg-utec-primary rounded-full flex-shrink-0 mt-1.5" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={clsx('text-sm', !n.leida ? 'font-semibold' : 'font-medium')}>
                                {n.titulo}
                              </p>
                              <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{n.mensaje}</p>
                              {n.creadaEn?.toDate && (
                                <p className="text-[10px] text-gray-500 mt-1">
                                  {n.creadaEn.toDate().toLocaleString('es-SV', {
                                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                                  })}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-2 text-right ml-2">
              <div>
                <p className="text-sm font-medium leading-none">{perfil?.nombre}</p>
                <p className="text-xs text-utec-light/70 leading-none mt-0.5">
                  {ROLES_LABEL[perfil?.rol]}
                </p>
              </div>
              {perfil?.foto && (
                <img
                  src={perfil.foto}
                  alt={perfil.nombre}
                  className="w-9 h-9 rounded-full border-2 border-white/30"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
