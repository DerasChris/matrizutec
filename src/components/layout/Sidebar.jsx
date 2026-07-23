import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, CalendarDays, ClipboardList, Users,
  BookOpen, Inbox, ClipboardCheck, Wrench, X, ActivitySquare, TableProperties, QrCode, Megaphone,
} from 'lucide-react';
import clsx from 'clsx';

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: 'todos', exact: true },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { to: '/servicios', label: 'Servicios', icon: Wrench, roles: ['encargado', 'jefa'] },
      { to: '/matriz', label: 'Matriz mensual', icon: CalendarDays, roles: ['encargado', 'jefa'] },
      { to: '/admin/carga', label: 'Carga académica', icon: TableProperties, roles: ['encargado', 'jefa'] },
      { to: '/admin/asistencia', label: 'Asistencia', icon: QrCode, roles: ['encargado', 'jefa'] },
      { to: '/admin/ciclos', label: 'Ciclos', icon: BookOpen, roles: ['encargado', 'jefa'] },
      { to: '/admin/usuarios', label: 'Usuarios', icon: Users, roles: ['jefa'] },
      { to: '/admin/registro', label: 'Registro', icon: ActivitySquare, roles: ['jefa'] },
      { to: '/admin/avisos', label: 'Avisos', icon: Megaphone, roles: ['jefa'] },
    ],
  },
  {
    label: 'Reservas',
    items: [
      { to: '/reservar', label: 'Reservar', icon: ClipboardList, roles: 'todos' },
      { to: '/mis-reservas', label: 'Mis reservas', icon: Inbox, roles: ['docente'] },
      { to: '/aprobaciones', label: 'Aprobaciones', icon: ClipboardCheck, roles: ['jefa'] },
    ],
  },
];

function NavContent({ perfil, location, onClose }) {
  function visible(roles) {
    if (roles === 'todos') return true;
    return roles.includes(perfil?.rol);
  }

  function isActive(to, exact) {
    if (exact) return location.pathname === to;
    return location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
  }

  return (
    <nav className="flex-1 px-3 py-4 overflow-y-auto">
      {NAV_GROUPS.map((group, gi) => {
        const visibleItems = group.items.filter(i => visible(i.roles));
        if (visibleItems.length === 0) return null;
        return (
          <div key={gi} className={gi > 0 ? 'mt-6' : ''}>
            {group.label && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {visibleItems.map(item => {
                const Icon = item.icon;
                const active = isActive(item.to, item.exact);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      active
                        ? 'bg-utec-primary text-white'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    )}
                  >
                    <Icon size={17} className="shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export default function Sidebar({ open, onClose }) {
  const { perfil } = useAuth();
  const location = useLocation();

  return (
    <>
      {/* Desktop sidebar — sticky bajo el header */}
      <aside className="hidden lg:flex lg:flex-col w-56 shrink-0 bg-white border-r border-gray-200 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
        <NavContent perfil={perfil} location={location} onClose={() => {}} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <aside className="relative w-64 h-full bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <p className="text-sm font-semibold text-gray-800">Menú</p>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <X size={18} />
              </button>
            </div>
            <NavContent perfil={perfil} location={location} onClose={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
