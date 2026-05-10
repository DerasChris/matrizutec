import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, User, Mail, Lock, Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function Registro() {
  const { user, perfil, registrarConEmail, error } = useAuth();
  const navigate = useNavigate();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorLocal, setErrorLocal] = useState('');

  useEffect(() => {
    if (user && perfil) {
      navigate('/', { replace: true });
    }
  }, [user, perfil, navigate]);

  async function handleRegistro(e) {
    e.preventDefault();
    setErrorLocal('');

    if (!nombre.trim()) return setErrorLocal('Ingresa tu nombre completo');
    if (!email.trim()) return setErrorLocal('Ingresa tu correo');
    if (password.length < 6) return setErrorLocal('La contraseña debe tener al menos 6 caracteres');
    if (password !== confirmar) return setErrorLocal('Las contraseñas no coinciden');

    try {
      setEnviando(true);
      await registrarConEmail(email, password, nombre.trim());
    } catch {
    } finally {
      setEnviando(false);
    }
  }

  const errorMostrar = errorLocal || error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-utec-light via-white to-utec-light p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-utec-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-utec-accent text-3xl font-bold">L</span>
          </div>
          <h1 className="text-2xl font-bold text-utec-primary">Crear cuenta</h1>
          <p className="text-sm text-gray-600 mt-1">
            LabTrack Horarios — UTEC FICA
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-7 border border-gray-100">
          {errorMostrar && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{errorMostrar}</p>
            </div>
          )}

          <form onSubmit={handleRegistro} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo *</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  required
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-utec-primary focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Correo *</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu.correo@ejemplo.com"
                  required
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-utec-primary focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña * <span className="text-gray-400">(mín 6 caracteres)</span></label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={verPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-utec-primary focus:border-transparent text-sm"
                />
                <button
                  type="button"
                  onClick={() => setVerPassword(!verPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {verPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Confirmar contraseña *</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={verPassword ? 'text' : 'password'}
                  value={confirmar}
                  onChange={e => setConfirmar(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-utec-primary focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-800">
              💡 Tu cuenta se creará con rol de <strong>docente</strong>. Si necesitas otro nivel de acceso, jefatura te lo asignará.
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="w-full py-2.5 bg-utec-primary text-white rounded-lg font-medium hover:bg-utec-dark disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {enviando ? <Loader2 size={16} className="animate-spin" /> : null}
              {enviando ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-5">
            <Link to="/login" className="text-utec-primary font-medium hover:underline inline-flex items-center gap-1">
              <ArrowLeft size={14} />
              Volver al inicio de sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
