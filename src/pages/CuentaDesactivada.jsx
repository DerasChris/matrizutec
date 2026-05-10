import { useAuth } from '../context/AuthContext';
import { UserX, LogOut } from 'lucide-react';

export default function CuentaDesactivada() {
  const { signOut, perfil } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-4 bg-gray-50">
      <UserX className="w-16 h-16 text-amber-500 mb-4" />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Cuenta desactivada</h1>
      <p className="text-gray-600 max-w-md mb-2">
        Tu cuenta ({perfil?.email}) fue desactivada por un administrador.
      </p>
      <p className="text-gray-500 text-sm max-w-md mb-6">
        Si crees que es un error, contacta a la jefatura de la facultad.
      </p>
      <button
        onClick={signOut}
        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
      >
        <LogOut size={18} />
        Cerrar sesión
      </button>
    </div>
  );
}
