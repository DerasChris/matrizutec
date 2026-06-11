import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLES_LABEL } from '../../lib/constants';
import { LogOut, Bell, CheckCheck, Menu } from 'lucide-react';
import clsx from 'clsx';
import { suscribirseANotificaciones, marcarComoLeida, marcarTodasLeidas } from '../../services/notificacionesService';

export default function Header({ onMenuClick }) {
  const { perfil, signOut, esJefa } = useAuth();
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
    <header className="bg-utec-primary text-white shadow-lg sticky top-0 z-40 h-16">
      <div className="flex items-center justify-between h-full px-4 max-w-full">

        {/* Izquierda: hamburger (mobile) + logo */}
        <div className="flex items-center gap-2">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>

          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-utec-accent rounded-lg flex items-center justify-center shrink-0">
              <span className="text-utec-primary font-bold text-sm">L</span>
            </div>
            <div className="hidden sm:block">
              <p className="font-semibold leading-none text-sm">LabTrack Horarios</p>
              <p className="text-[10px] text-utec-light/80 leading-none mt-0.5">UTEC FICA</p>
            </div>
          </Link>
        </div>

        {/* Derecha: notificaciones + usuario + logout */}
        <div className="flex items-center gap-1">

          {/* Notificaciones */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setAbierto(!abierto)}
              className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
              title="Notificaciones"
            >
              <Bell size={18} />
              {noLeidas > 0 && (
                <span className="absolute top-0.5 right-0.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-0.5 text-[9px] font-bold text-white bg-red-500 rounded-full">
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
                            <span className="w-2 h-2 bg-utec-primary rounded-full shrink-0 mt-1.5" />
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

          {/* Info usuario */}
          <div className="hidden sm:flex items-center gap-2 ml-1 pl-3 border-l border-white/20">
            {perfil?.foto && (
              <img
                src={perfil.foto}
                alt={perfil?.nombre}
                className="w-8 h-8 rounded-full border-2 border-white/30 shrink-0"
                referrerPolicy="no-referrer"
              />
            )}
            <div className="text-right">
              <p className="text-sm font-medium leading-none">{perfil?.nombre}</p>
              <p className="text-[11px] text-utec-light/70 leading-none mt-0.5">
                {ROLES_LABEL[perfil?.rol]}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors ml-1"
            title="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
