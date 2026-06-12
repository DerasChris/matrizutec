import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLES_LABEL } from '../../lib/constants';
import { LogOut, Bell, CheckCheck, Menu, CalendarCheck, UserPlus } from 'lucide-react';
import clsx from 'clsx';
import {
  suscribirseANotificaciones, marcarComoLeida, marcarTodasLeidas,
  suscribirseAAlertas, marcarAlertaLeida, marcarTodasAlertasLeidas,
} from '../../services/notificacionesService';

function formatearFecha(ts) {
  if (!ts?.toDate) return '';
  return ts.toDate().toLocaleString('es-SV', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function AlertaAdminItem({ alerta, uid, onClick }) {
  const leida = alerta.leidaPor?.includes(uid);
  const esReserva = alerta.refTipo === 'reserva';
  const Icon = esReserva ? CalendarCheck : UserPlus;
  const color = esReserva ? 'text-blue-500' : 'text-amber-500';
  const badge = esReserva ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800';
  const label = esReserva ? 'Reserva' : 'Nuevo usuario';

  return (
    <button
      onClick={() => onClick(alerta)}
      className={clsx(
        'w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors',
        !leida && 'bg-blue-50/40'
      )}
    >
      <div className="flex items-start gap-2">
        <Icon size={14} className={clsx('shrink-0 mt-1', color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {!leida && <span className="w-1.5 h-1.5 bg-utec-primary rounded-full shrink-0" />}
            <span className={clsx('text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full', badge)}>
              {label}
            </span>
          </div>
          <p className={clsx('text-sm leading-snug', !leida ? 'font-semibold' : 'font-medium')}>
            {alerta.titulo}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{alerta.mensaje}</p>
          <p className="text-[10px] text-gray-400 mt-1">{formatearFecha(alerta.creadaEn)}</p>
        </div>
      </div>
    </button>
  );
}

function NotifItem({ notif, onClick }) {
  return (
    <button
      onClick={() => onClick(notif)}
      className={clsx(
        'w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors',
        !notif.leida && 'bg-blue-50/30'
      )}
    >
      <div className="flex items-start gap-2">
        {!notif.leida && <span className="w-2 h-2 bg-utec-primary rounded-full shrink-0 mt-1.5" />}
        <div className="flex-1 min-w-0">
          <p className={clsx('text-sm', !notif.leida ? 'font-semibold' : 'font-medium')}>
            {notif.titulo}
          </p>
          <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{notif.mensaje}</p>
          <p className="text-[10px] text-gray-500 mt-1">{formatearFecha(notif.creadaEn)}</p>
        </div>
      </div>
    </button>
  );
}

export default function Header({ onMenuClick }) {
  const { perfil, signOut, esAdmin, esJefa } = useAuth();
  const navigate = useNavigate();
  const [notifs,  setNotifs]  = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const dropdownRef = useRef(null);

  // Notificaciones personales
  useEffect(() => {
    if (!perfil?.uid) return;
    const unsub = suscribirseANotificaciones(perfil.uid, setNotifs);
    return () => unsub();
  }, [perfil?.uid]);

  // Alertas admin (broadcast) — solo para encargado/jefa
  useEffect(() => {
    if (!perfil?.uid || !esAdmin()) return;
    const unsub = suscribirseAAlertas(setAlertas);
    return () => unsub();
  }, [perfil?.uid, perfil?.rol]);

  useEffect(() => {
    function clickFuera(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setAbierto(false);
      }
    }
    document.addEventListener('mousedown', clickFuera);
    return () => document.removeEventListener('mousedown', clickFuera);
  }, []);

  const noLeidasPersonales = notifs.filter(n => !n.leida).length;
  const noLeidasAdmin = alertas.filter(a => !a.leidaPor?.includes(perfil?.uid)).length;
  const totalNoLeidas = noLeidasPersonales + noLeidasAdmin;

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

  async function clickAlerta(alerta) {
    if (!alerta.leidaPor?.includes(perfil?.uid)) {
      await marcarAlertaLeida(alerta.id, perfil.uid);
    }
    if (alerta.refTipo === 'reserva')  navigate('/aprobaciones');
    if (alerta.refTipo === 'usuario')  navigate('/admin/usuarios');
    setAbierto(false);
  }

  async function leerTodas() {
    if (!perfil?.uid) return;
    await Promise.all([
      marcarTodasLeidas(perfil.uid),
      marcarTodasAlertasLeidas(alertas, perfil.uid),
    ]);
  }

  // Mezclar y ordenar cronológicamente (más reciente primero)
  const todosOrdenados = [
    ...alertas.map(a => ({ ...a, _esAdmin: true })),
    ...notifs.map(n => ({ ...n, _esAdmin: false })),
  ].sort((a, b) => {
    const ta = a.creadaEn?.toMillis?.() ?? 0;
    const tb = b.creadaEn?.toMillis?.() ?? 0;
    return tb - ta;
  });

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

          {/* Campana */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setAbierto(!abierto)}
              className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
              title="Notificaciones"
            >
              <Bell size={18} />
              {totalNoLeidas > 0 && (
                <span className="absolute top-0.5 right-0.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-0.5 text-[9px] font-bold text-white bg-red-500 rounded-full animate-pulse">
                  {totalNoLeidas > 9 ? '9+' : totalNoLeidas}
                </span>
              )}
            </button>

            {abierto && (
              <div className="absolute right-0 top-12 w-80 bg-white text-gray-900 rounded-xl shadow-2xl border border-gray-200 max-h-[520px] overflow-hidden flex flex-col">
                {/* Header del panel */}
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">Notificaciones</p>
                    {totalNoLeidas > 0 && (
                      <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                        {totalNoLeidas}
                      </span>
                    )}
                  </div>
                  {totalNoLeidas > 0 && (
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
                  {todosOrdenados.length === 0 ? (
                    <div className="p-8 text-center">
                      <Bell className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Sin notificaciones</p>
                    </div>
                  ) : (
                    todosOrdenados.map(item =>
                      item._esAdmin
                        ? <AlertaAdminItem key={`a-${item.id}`} alerta={item} uid={perfil?.uid} onClick={clickAlerta} />
                        : <NotifItem key={`n-${item.id}`} notif={item} onClick={clickNotif} />
                    )
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
