import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { user, perfil, loading, signInEmail, signInGoogle, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (user && perfil) {
      navigate(from, { replace: true });
    }
  }, [user, perfil, navigate, from]);

  async function handleEmailLogin(e) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    try {
      setEnviando(true);
      await signInEmail(email, password);
    } catch {
    } finally {
      setEnviando(false);
    }
  }

  async function handleGoogle() {
    try {
      setEnviando(true);
      await signInGoogle();
    } catch {
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-utec-light via-white to-utec-light p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-utec-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-utec-accent text-3xl font-bold">L</span>
          </div>
          <h1 className="text-2xl font-bold text-utec-primary">LabTrack Horarios</h1>
          <p className="text-sm text-gray-600 mt-1">
            Universidad Tecnológica de El Salvador<br />
            Facultad de Informática y Ciencias Aplicadas
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-7 border border-gray-100">
          <div className="text-center mb-5">
            <h2 className="text-lg font-semibold text-gray-800">Iniciar sesión</h2>
            <p className="text-sm text-gray-500 mt-1">
              Ingresa tu correo y contraseña
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Correo</label>
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={verPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
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

            <button
              type="submit"
              disabled={enviando || loading}
              className="w-full py-2.5 bg-utec-primary text-white rounded-lg font-medium hover:bg-utec-dark disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {enviando ? <Loader2 size={16} className="animate-spin" /> : null}
              {enviando ? 'Ingresando...' : 'Iniciar sesión'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <hr className="flex-1 border-gray-200" />
            <span className="text-xs text-gray-500">o continúa con</span>
            <hr className="flex-1 border-gray-200" />
          </div>

          <button
            onClick={handleGoogle}
            disabled={enviando || loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg hover:border-utec-primary hover:bg-utec-light transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="font-medium text-gray-700">Continuar con Google</span>
          </button>

          <p className="text-center text-sm text-gray-600 mt-5">
            ¿No tienes cuenta?{' '}
            <Link to="/registro" className="text-utec-primary font-medium hover:underline">
              Regístrate
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          ¿Problemas para acceder? Contacta al administrador del sistema.
        </p>
      </div>
    </div>
  );
}
