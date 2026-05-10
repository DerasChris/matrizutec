import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingScreen from '../common/LoadingScreen';

export default function ProtectedRoute({ children, rolesPermitidos = null }) {
  const { user, perfil, loading, tieneRol } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen mensaje="Verificando sesión..." />;
  }

  if (!user || !perfil) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!perfil.activo) {
    return <Navigate to="/cuenta-desactivada" replace />;
  }

  if (rolesPermitidos && !tieneRol(rolesPermitidos)) {
    return <Navigate to="/sin-permiso" replace />;
  }

  return children;
}
