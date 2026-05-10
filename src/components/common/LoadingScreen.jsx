import { Loader2 } from 'lucide-react';

export default function LoadingScreen({ mensaje = 'Cargando...' }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-utec-light">
      <Loader2 className="w-12 h-12 text-utec-primary animate-spin mb-4" />
      <p className="text-utec-primary font-medium">{mensaje}</p>
    </div>
  );
}
