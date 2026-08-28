import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, CheckCircle2, AlertTriangle, Clock, Users, X, CalendarDays } from 'lucide-react';
import { obtenerAgendaKiosko, registrarAsistenciaKiosko } from '../services/kioskoService';

const TIPOS = [
  { id: 'clase', label: 'Clase', corto: 'C' },
  { id: 'parcial', label: 'Parcial', corto: 'P' },
  { id: 'reposicion', label: 'Reposición', corto: 'R' },
];

const MESES_LABEL = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function construirSemanas(anio, mesIdx, totalDiasMes) {
  const primerDia = new Date(anio, mesIdx, 1);
  const offset = (primerDia.getDay() + 6) % 7; // 0 = lunes
  const celdas = Array(offset).fill(null);
  for (let dia = 1; dia <= totalDiasMes; dia++) celdas.push(dia);
  while (celdas.length % 7 !== 0) celdas.push(null);
  const semanas = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return semanas;
}

export default function KioskoAsistencia() {
  const { token } = useParams();
  const [fase, setFase] = useState('cargando'); // cargando | error | lista
  const [agenda, setAgenda] = useState(null);
  const [marcando, setMarcando] = useState(null); // { claseId, fecha, nombreAsignatura, docente, horaInicio, horaFin, alumnosPrevios, tipoPrevio }
  const [eligiendoDia, setEligiendoDia] = useState(null); // { fecha, clases } cuando un día tiene varias clases
  const [alumnos, setAlumnos] = useState('');
  const [tipo, setTipo] = useState('clase');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { cargar(); }, [token]);

  async function cargar() {
    setFase('cargando');
    try {
      const data = await obtenerAgendaKiosko(token);
      setAgenda(data);
      setFase('lista');
    } catch (err) {
      console.error(err);
      setFase('error');
    }
  }

  const calendarioPorFecha = useMemo(() => {
    if (!agenda) return {};
    return Object.fromEntries(agenda.calendario.map(d => [d.fecha, d]));
  }, [agenda]);

  const hoy = hoyISO();
  const [anio, mes] = hoy.split('-').map(Number);
  const totalDiasMes = new Date(anio, mes, 0).getDate();
  const semanas = useMemo(() => construirSemanas(anio, mes - 1, totalDiasMes), [anio, mes, totalDiasMes]);

  function abrirMarcar(clase, fecha) {
    setEligiendoDia(null);
    setMarcando({
      claseId: clase.claseId,
      fecha,
      nombreAsignatura: clase.nombreAsignatura,
      docente: clase.docente,
      horaInicio: clase.horaInicio,
      horaFin: clase.horaFin,
    });
    setAlumnos(clase.alumnosLlegaron != null ? String(clase.alumnosLlegaron) : '');
    setTipo(clase.tipo || 'clase');
  }

  function abrirDia(entry) {
    if (entry.clases.length === 1) {
      abrirMarcar(entry.clases[0], entry.fecha);
    } else {
      setEligiendoDia(entry);
    }
  }

  function cancelar() {
    setMarcando(null);
    setEligiendoDia(null);
    setAlumnos('');
    setTipo('clase');
  }

  async function guardar(e) {
    e.preventDefault();
    const n = Number(alumnos);
    if (!Number.isInteger(n) || n < 0) { toast.error('Cantidad de alumnos inválida'); return; }
    setGuardando(true);
    try {
      await registrarAsistenciaKiosko({
        token, claseId: marcando.claseId, fecha: marcando.fecha, alumnosLlegaron: n, tipo,
      });
      toast.success('Asistencia guardada');
      cancelar();
      cargar();
    } catch (err) {
      toast.error(err.message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  if (fase === 'cargando') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-utec-primary animate-spin" />
      </div>
    );
  }

  if (fase === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="text-lg font-semibold text-gray-800">Enlace no disponible</p>
          <p className="text-sm text-gray-500 mt-1">Pide al encargado del laboratorio que revise el enlace.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-utec-primary">{agenda.lab.nombre}</h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">Asistencia docente · {MESES_LABEL[mes - 1]} {anio}</p>
        </div>

        {/* Clases de hoy */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Clases de hoy</p>
          {agenda.clasesHoy.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No hay clases programadas hoy en este laboratorio.</p>
          ) : (
            <div className="space-y-2">
              {agenda.clasesHoy.map(c => (
                <button
                  key={c.claseId}
                  onClick={() => abrirMarcar(c, hoy)}
                  className={`w-full flex items-center gap-3 text-left border-2 rounded-xl px-4 py-3 transition-colors ${
                    c.marcada ? 'border-green-200 bg-green-50 hover:border-green-400' : 'border-gray-200 hover:border-utec-primary'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-gray-900 truncate">{c.nombreAsignatura}</p>
                    <p className="text-sm text-gray-500 truncate">
                      {c.docente}{c.seccion ? ` · Sec. ${c.seccion}` : ''}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                      <Clock size={12} /> {c.horaInicio}–{c.horaFin}
                    </p>
                  </div>
                  {c.marcada ? (
                    <div className="text-right shrink-0">
                      <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto" />
                      <p className="text-[11px] text-green-700 font-semibold mt-0.5">{c.alumnosLlegaron} · corregir</p>
                    </div>
                  ) : (
                    <span className="shrink-0 text-xs font-semibold text-utec-primary">Marcar</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Calendario del mes */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            <CalendarDays size={13} /> Calendario de {MESES_LABEL[mes - 1]}
          </p>
          <div className="grid grid-cols-7 gap-1.5 text-center mb-1.5">
            {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map(d => (
              <span key={d} className="text-[10px] font-semibold text-gray-400">{d}</span>
            ))}
          </div>
          <div className="space-y-1.5">
            {semanas.map((semana, i) => (
              <div key={i} className="grid grid-cols-7 gap-1.5">
                {semana.map((dia, j) => {
                  if (!dia) return <div key={j} />;
                  const fechaISO = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
                  const esFuturo = fechaISO > hoy;
                  const entry = calendarioPorFecha[fechaISO];
                  const todasMarcadas = entry && entry.clases.every(c => c.marcada);
                  return (
                    <button
                      key={j}
                      disabled={esFuturo || !entry}
                      onClick={() => entry && abrirDia(entry)}
                      className={`aspect-square rounded-lg text-xs font-semibold transition-colors ${
                        esFuturo || !entry
                          ? 'text-gray-300'
                          : todasMarcadas
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      } ${fechaISO === hoy ? 'ring-2 ring-utec-primary' : ''}`}
                    >
                      {dia}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-green-200" /> Marcado</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-200" /> Falta</span>
          </div>
        </div>
      </div>

      {/* Elegir clase cuando un día tiene varias */}
      {eligiendoDia && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-800">{eligiendoDia.fecha}</p>
              <button onClick={cancelar} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="space-y-2">
              {eligiendoDia.clases.map(c => (
                <button
                  key={c.claseId}
                  onClick={() => abrirMarcar(c, eligiendoDia.fecha)}
                  className="w-full text-left border-2 border-gray-200 hover:border-utec-primary rounded-xl px-3 py-2.5"
                >
                  <p className="text-sm font-semibold text-gray-900">{c.nombreAsignatura}</p>
                  <p className="text-xs text-gray-500">{c.docente} · {c.horaInicio}–{c.horaFin}{c.marcada ? ` · ya marcada (${c.alumnosLlegaron})` : ''}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Confirmar asistencia */}
      {marcando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={guardar} className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400 uppercase tracking-wide">{marcando.fecha}</p>
              <button type="button" onClick={cancelar} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{marcando.nombreAsignatura}</p>
              <p className="text-sm text-gray-500">{marcando.docente}</p>
              <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mt-1">
                <Clock size={12} /> {marcando.horaInicio}–{marcando.horaFin}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo</label>
              <div className="grid grid-cols-3 gap-2">
                {TIPOS.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTipo(t.id)}
                    className={`py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                      tipo === t.id ? 'bg-utec-primary text-white border-utec-primary' : 'border-gray-200 text-gray-600 hover:border-utec-primary'
                    }`}
                  >
                    {t.corto}
                  </button>
                ))}
              </div>
            </div>

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
            </div>

            <button
              type="submit"
              disabled={guardando || alumnos === ''}
              className="w-full py-3 text-sm font-semibold text-white bg-utec-primary rounded-xl hover:bg-utec-dark disabled:opacity-40"
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
