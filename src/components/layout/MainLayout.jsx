import { Outlet } from 'react-router-dom';
import Header from './Header';

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-xs text-gray-500">
          LabTrack Horarios · UTEC Facultad de Informática y Ciencias Aplicadas · {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
