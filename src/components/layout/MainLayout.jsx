import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import AvisoUrgenteModal from './AvisoUrgenteModal';

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AvisoUrgenteModal />
      <Header onMenuClick={() => setSidebarOpen(true)} />

      <div className="flex flex-1">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 min-w-0 flex flex-col">
          <main className="flex-1 px-4 py-6 max-w-6xl w-full mx-auto">
            <Outlet />
          </main>
          <footer className="border-t border-gray-200 mt-8">
            <div className="px-4 py-4 text-center text-xs text-gray-500">
              LabTrack Horarios · UTEC Facultad de Informática y Ciencias Aplicadas · {new Date().getFullYear()}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
