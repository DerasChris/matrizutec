import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, KeyRound, Loader2, AlertTriangle, Users, Clock } from 'lucide-react';
import { obtenerLaboratorio } from '../services/laboratoriosService';
import { buscarClaseParaAsistencia, registrarAsistencia } from '../services/asistenciaService';

const FASES = { CARGANDO_LAB: 'cargando_lab', PIN: 'pin', CONFIRMAR: 'confirmar', EXITO: 'exito' };

export default function AsistenciaEscaneo() {
  const { labId } = useParams();
  const [fase, setFase] = useState(FASES.CARGANDO_LAB);
  const [lab, setLab] = useState(null);
  const [pin, setPin] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [errorPin, setErrorPin] = useState('');
  const [clase, setClase] = useState(null);
  const [alumnos, setAlumnos] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    obtenerLaboratorio(labId)
      .then(l => { setLab(l); setFase(FASES.PIN); })
      .catch(() => setFase(FASES.PIN));
  }, [labId]);

  async function handleVerificarPin(e) {
    e.preventDefault();
    if (pin.length !== 4) { setErrorPin('El PIN debe tener 4 dígitos'); return; }
    setVerificando(true);
    setErrorPin('');
    try {
      const res = await buscarClaseParaAsistencia({ labId, pin });
      setClase(res);
      setAlumnos(res.yaMarcada && res.alumnosPrevios != null ? String(res.alumnosPrevios) : '');
      setFase(FASES.CONFIRMAR);
    } catch (err) {
      setErrorPin(err.message || 'No se pudo verificar el PIN');
    } finally {
      setVerificando(false);
    }
  }

  async function handleConfirmar(e) {
    e.preventDefault();
    const n = Number(alumnos);
    if (!Number.isInteger(n) || n < 0) { return; }
    setGuardando(true);
    try {
      const res = await registrarAsistencia({ labId, pin, claseId: clase.claseId, alumnosLlegaron: n });
      setResultado(res);
      setFase(FASES.EXITO);
    } catch (err) {
      setErrorPin(err.message || 'No se pudo registrar la asistencia');
      setFase(FASES.PIN);
    } finally {
      setGuardando(false);
    }
  }

  function reiniciar() {
    setPin(''); setErrorPin(''); setClase(null); setAlumnos(''); setResultado(null);
    setFase(FASES.PIN);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-lg font-bold text-utec-primary">LabTrack UTEC</h1>
          <p className="text-sm text-gray-500 mt-0.5">Asistencia docente</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          {fase === FASES.CARGANDO_LAB && (
            <div className="py-10 text-center">
              <Loader2 className="w-8 h-8 text-utec-primary animate-spin mx-auto" />
            </div>
          )}

          {fase !== FASES.CARGANDO_LAB && (
            <p className="text-center text-sm font-semibold text-gray-700 mb-5">
              {lab?.nombre || labId}
            </p>
          )}

          {fase === FASES.PIN && (
            <form onSubmit={handleVerificarPin} className="space-y-4">
              <div className="flex flex-col items-center gap-2">
                <KeyRound size={28} className="text-utec-primary" />
                <label className="text-sm text-gray-600">Ingresa tu PIN de 4 dígitos</label>
              </div>
              <input
                type="password"
                inputMode="numeric"
                pattern="\d*"
                maxLength={4}
                autoFocus
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full text-center text-3xl tracking-[0.5em] font-mono border-2 border-gray-300 rounded-xl py-3 focus:outline-none focus:border-utec-primary"
                placeholder="••••"
              />
              {errorPin && (
                <p className="flex items-center gap-1.5 text-sm text-red-600">
                  <AlertTriangle size={14} className="shrink-0" /> {errorPin}
                </p>
              )}
              <button
                type="submit"
                disabled={verificando || pin.length !== 4}
                className="w-full py-3 text-sm font-semibold text-white bg-utec-primary rounded-xl hover:bg-utec-dark disabled:opacity-40"
              >
                {verificando ? 'Verificando…' : 'Continuar'}
              </button>
            </form>
          )}

          {fase === FASES.CONFIRMAR && clase && (
            <form onSubmit={handleConfirmar} className="space-y-4">
              <div className="bg-utec-light rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Confirmando asistencia</p>
                <p className="text-base font-bold text-gray-900 mt-1">{clase.nombreAsignatura}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {clase.codigoAsignatura}{clase.seccion ? ` · Sec. ${clase.seccion}` : ''}
                </p>
                <p className="flex items-center justify-center gap-1.5 text-xs text-gray-600 mt-1.5">
                  <Clock size={12} /> {clase.horaInicio}–{clase.horaFin}
                </p>
                <p className="text-xs text-gray-500 mt-1">{clase.docente}</p>
              </div>

              {clase.yaMarcada && (
                <p className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle size={13} className="shrink-0" />
                  Ya habías marcado {clase.alumnosPrevios} alumnos hoy — puedes corregirlo.
                </p>
              )}

              <div>
                <label className="flex items-center gap-1.5 text-sm text-gray-700 mb-1.5">
                  <Users size={14} /> ¿Cuántos alumnos llegaron?
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  autoFocus
                  value={alumnos}
                  onChange={e => setAlumnos(e.target.value)}
                  className="w-full text-center text-2xl font-semibold border-2 border-gray-300 rounded-xl py-3 focus:outline-none focus:border-utec-primary"
                  placeholder="0"
                />
                {clase.inscritos > 0 && (
                  <p className="text-xs text-gray-400 text-center mt-1">{clase.inscritos} inscritos en la sección</p>
                )}
              </div>

              <button
                type="submit"
                disabled={guardando || alumnos === ''}
                className="w-full py-3 text-sm font-semibold text-white bg-utec-primary rounded-xl hover:bg-utec-dark disabled:opacity-40"
              >
                {guardando ? 'Guardando…' : 'Marcar asistencia'}
              </button>
              <button
                type="button"
                onClick={reiniciar}
                className="w-full text-xs text-gray-400 hover:text-gray-600"
              >
                Cancelar
              </button>
            </form>
          )}

          {fase === FASES.EXITO && resultado && (
            <div className="text-center space-y-3 py-2">
              <CheckCircle2 size={48} className="text-green-500 mx-auto" />
              <p className="text-base font-bold text-gray-900">Asistencia registrada</p>
              <p className="text-sm text-gray-600">{resultado.nombreAsignatura}</p>
              <p className="text-xs text-gray-500">{resultado.horaInicio}–{resultado.horaFin}</p>
              <p className="text-2xl font-bold text-utec-primary">{resultado.alumnosLlegaron} alumnos</p>
              <button
                onClick={reiniciar}
                className="mt-2 text-xs text-gray-400 hover:text-gray-600"
              >
                Marcar otra clase
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
