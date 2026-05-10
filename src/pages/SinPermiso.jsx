import { Link } from 'react-router-dom';
import { ShieldX, Home } from 'lucide-react';

export default function SinPermiso() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-4">
      <ShieldX className="w-16 h-16 text-red-500 mb-4" />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceso restringido</h1>
      <p className="text-gray-600 max-w-md mb-6">
        No tienes permiso para acceder a esta sección. Si crees que es un error,
        contacta al administrador.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-4 py-2 bg-utec-primary text-white rounded-lg hover:bg-utec-dark transition-colors"
      >
        <Home size={18} />
        Volver al inicio
      </Link>
    </div>
  );
}
