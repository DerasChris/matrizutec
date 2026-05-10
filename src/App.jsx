import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/Login';
import Registro from './pages/Registro';
import Dashboard from './pages/Dashboard';
import SinPermiso from './pages/SinPermiso';
import CuentaDesactivada from './pages/CuentaDesactivada';
import MatrizLab from './pages/admin/MatrizLab';
import GestionUsuarios from './pages/admin/GestionUsuarios';
import Reservar from './pages/Reservar';
import MisReservas from './pages/MisReservas';
import Aprobaciones from './pages/Aprobaciones';
import { ROLES } from './lib/constants';
import Servicios from './pages/Servicios';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: { fontSize: '14px' },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/cuenta-desactivada" element={<CuentaDesactivada />} />

          <Route element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sin-permiso" element={<SinPermiso />} />

            <Route path="/matriz" element={
              <ProtectedRoute rolesPermitidos={[ROLES.ENCARGADO, ROLES.JEFA]}>
                <MatrizLab />
              </ProtectedRoute>
            } />

            <Route path="/servicios" element={
              <ProtectedRoute rolesPermitidos={[ROLES.ENCARGADO, ROLES.JEFA]}>
                <Servicios />
              </ProtectedRoute>
            } />

            <Route path="/admin/clases" element={
              <ProtectedRoute rolesPermitidos={[ROLES.ENCARGADO, ROLES.JEFA]}>
                <MatrizLab />
              </ProtectedRoute>
            } />

            <Route path="/admin/usuarios" element={
              <ProtectedRoute rolesPermitidos={[ROLES.JEFA]}>
                <GestionUsuarios />
              </ProtectedRoute>
            } />

            <Route path="/reservar" element={
              <ProtectedRoute rolesPermitidos={[ROLES.DOCENTE, ROLES.ENCARGADO, ROLES.JEFA]}>
                <Reservar />
              </ProtectedRoute>
            } />

            <Route path="/mis-reservas" element={
              <ProtectedRoute>
                <MisReservas />
              </ProtectedRoute>
            } />

            <Route path="/aprobaciones" element={
              <ProtectedRoute rolesPermitidos={[ROLES.JEFA]}>
                <Aprobaciones />
              </ProtectedRoute>
            } />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
