import { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  obtenerLaboratorios,
  obtenerCicloActivo,
  obtenerClasesDelLabHoy,
  obtenerReservasAprobadasDelLabHoy,
} from '../services/laboratoriosService';
import { COLECCIONES, FRANJAS_HORARIAS, DIAS_SEMANA } from '../lib/constants';
import {
  CheckCircle2, Clock, AlertTriangle, Send, Loader2, CalendarCheck,
  FlaskConical, User, Mail, Building2, BookOpen, MessageSquare, ChevronDown, Monitor,
} from 'lucide-react';
import { SOFTWARE_DISPONIBLE } from '../lib/constants';

/* ── helpers ── */
function horaMin(h) {
  const [hh, mm] = h.split(':').map(Number);
  return hh * 60 + mm;
}
function getDiaId(fecha) {
  if (!fecha) return null;
  const dia = new Date(fecha + 'T12:00:00').getDay();
  return DIAS_SEMANA.find(d => d.indice === dia)?.id ?? null;
}
function fmtFecha(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${parseInt(d)} de ${meses[parseInt(m)-1]} de ${y}`;
}

const FACULTADES = [
  'Facultad de Informática y Ciencias Aplicadas (FICA)',
  'Facultad de Ciencias Empresariales',
  'Facultad de Ciencias Sociales',
  'Facultad de Ingeniería y Arquitectura',
  'Postgrado',
  'Centro de Cómputo',
  'Otra unidad / Departamento',
];

const HOY = new Date().toISOString().split('T')[0];

/* ── componente de franja de disponibilidad ── */
function FranjaDisponibilidad({ franja, ocupaciones }) {
  const ini = horaMin(franja.inicio);
  const fin = horaMin(franja.fin);
  const choque = ocupaciones.find(o => ini < horaMin(o.horaFin) && fin > horaMin(o.horaInicio));

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs ${
      choque ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'
    }`}>
      <span className="font-mono w-24 flex-shrink-0">{franja.inicio} – {franja.fin}</span>
      {choque ? (
        <span className="flex items-center gap-1">
          <AlertTriangle size={11} className="flex-shrink-0" />
          Ocupado
          {choque.tipo === 'clase'
            ? ` — ${choque.codigoAsignatura || ''} ${choque.nombreAsignatura || ''}`
            : ` — Reserva aprobada`}
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <CheckCircle2 size={11} className="flex-shrink-0" />
          Disponible
        </span>
      )}
    </div>
  );
}

/* ── página principal ── */
export default function SolicitudPublica() {
  const [labs, setLabs] = useState([]);
  const [ciclo, setCiclo] = useState(null);
  const [cargandoBase, setCargandoBase] = useState(true);

  // Form state
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [facultad, setFacultad] = useState('');
  const [otraFacultad, setOtraFacultad] = useState('');
  const [labId, setLabId] = useState('');
  const [fecha, setFecha] = useState('');
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaFin, setHoraFin] = useState('10:00');
  const [proposito, setProposito] = useState('');
  const [programas, setProgramas] = useState([]);
  const [programasOtros, setProgramasOtros] = useState('');

  // Disponibilidad
  const [disponibilidad, setDisponibilidad] = useState([]);
  const [cargandoDisp, setCargandoDisp] = useState(false);

  // Form UI
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [refId, setRefId] = useState('');
  const [mostrarTodaDisp, setMostrarTodaDisp] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [labsData, cicloData] = await Promise.all([obtenerLaboratorios(), obtenerCicloActivo()]);
        setLabs(labsData);
        setCiclo(cicloData);
      } catch (e) {
        console.error(e);
      } finally {
        setCargandoBase(false);
      }
    })();
  }, []);

  // Cargar disponibilidad cuando cambia lab o fecha
  useEffect(() => {
    if (!labId || !fecha || !ciclo) { setDisponibilidad([]); return; }
    const diaId = getDiaId(fecha);
    if (!diaId) return;

    let cancelado = false;
    setCargandoDisp(true);
    (async () => {
      try {
        const [clases, reservas] = await Promise.all([
          obtenerClasesDelLabHoy(labId, diaId, ciclo.id),
          obtenerReservasAprobadasDelLabHoy(labId, fecha),
        ]);
        if (!cancelado) {
          setDisponibilidad([
            ...clases.map(c => ({ ...c, tipo: 'clase' })),
            ...reservas.map(r => ({ ...r, tipo: 'reserva' })),
          ]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelado) setCargandoDisp(false);
      }
    })();
    return () => { cancelado = true; };
  }, [labId, fecha, ciclo]);

  const hayConflicto = useMemo(() => {
    if (!horaInicio || !horaFin || disponibilidad.length === 0) return false;
    const ini = horaMin(horaInicio);
    const fin = horaMin(horaFin);
    return disponibilidad.some(o => ini < horaMin(o.horaFin) && fin > horaMin(o.horaInicio));
  }, [horaInicio, horaFin, disponibilidad]);

  // Franjas del día para mostrar timeline (filtradas a 06:30–20:00)
  const franjasTimeline = useMemo(() => {
    if (!mostrarTodaDisp) return FRANJAS_HORARIAS.slice(0, 8); // primeras 4h
    return FRANJAS_HORARIAS;
  }, [mostrarTodaDisp]);

  function validar() {
    const e = {};
    if (!nombre.trim()) e.nombre = 'El nombre es requerido';
    if (!correo.trim()) e.correo = 'El correo electrónico es requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) e.correo = 'Correo electrónico inválido';
    if (!facultad) e.facultad = 'Seleccione una facultad';
    if (facultad === 'Otra unidad / Departamento' && !otraFacultad.trim()) e.otraFacultad = 'Indique su unidad';
    if (!labId) e.labId = 'Seleccione un laboratorio';
    if (!fecha) e.fecha = 'Indique la fecha';
    else if (fecha < HOY) e.fecha = 'No es posible reservar en fechas pasadas';
    if (horaMin(horaFin) <= horaMin(horaInicio)) e.horario = 'La hora de fin debe ser posterior a la de inicio';
    if (!proposito.trim()) e.proposito = 'Describa el propósito de uso';
    else if (proposito.trim().length < 20) e.proposito = 'Por favor sea más descriptivo (mínimo 20 caracteres)';
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function handleEnviar(e) {
    e.preventDefault();
    if (!validar()) return;
    if (hayConflicto) return;
    if (!ciclo) { alert('El sistema no tiene un ciclo activo configurado. Por favor contacta a jefatura directamente.'); return; }

    setEnviando(true);
    try {
      const labInfo = labs.find(l => l.id === labId);
      const facultadFinal = facultad === 'Otra unidad / Departamento' ? otraFacultad.trim() : facultad;

      const reserva = {
        // Campos de reserva estándar
        docenteId: 'publico',
        docenteNombre: nombre.trim(),
        docenteEmail: correo.trim(),
        labId,
        labNombre: labInfo?.nombre || labId,
        modulos: [],
        tipo: 'unica',
        asignatura: proposito.trim().substring(0, 80),
        motivo: proposito.trim(),
        horaInicio,
        horaFin,
        fechaInicio: fecha,
        fechaFin: fecha,
        diasSemana: [],
        fechasEspecificas: [],
        ocurrencias: [fecha],
        estado: 'pendiente',
        // Campos extra para solicitudes externas
        esExterno: true,
        facultad: facultadFinal,
        programas,
        programasOtros: programasOtros.trim(),
        creadaEn: serverTimestamp(),
        actualizadaEn: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, COLECCIONES.RESERVAS), reserva);

      // Encolar email a la jefa
      const emailJefa = import.meta.env.VITE_EMAIL_JEFA;
      if (emailJefa) {
        try {
          await addDoc(collection(db, COLECCIONES.MAIL_QUEUE), {
            to: emailJefa,
            message: {
              subject: `[LabTrack UTEC] Nueva solicitud externa de laboratorio — ${labInfo?.nombre || labId}`,
              html: emailHtmlSolicitud({ nombre: nombre.trim(), correo: correo.trim(), facultad: facultadFinal, labNombre: labInfo?.nombre || labId, fecha, horaInicio, horaFin, proposito: proposito.trim(), refId: docRef.id }),
              text: `Nueva solicitud externa\n\nSolicitante: ${nombre.trim()}\nCorreo: ${correo.trim()}\nFacultad: ${facultadFinal}\nLaboratorio: ${labInfo?.nombre || labId}\nFecha: ${fecha}\nHorario: ${horaInicio} – ${horaFin}\nPropósito: ${proposito.trim()}\n\nID de referencia: ${docRef.id}\n\nIngresa al sistema LabTrack para aprobar o rechazar esta solicitud.`,
            },
          });
        } catch (mailErr) {
          console.warn('Email no encolado:', mailErr.message);
        }
      }

      setRefId(docRef.id.slice(0, 8).toUpperCase());
      setEnviado(true);
    } catch (err) {
      console.error(err);
      alert('Ocurrió un error al enviar su solicitud. Por favor intente de nuevo o contacte directamente a jefatura.');
    } finally {
      setEnviando(false);
    }
  }

  // ── Estado de éxito ──
  if (enviado) {
    return (
      <div className="min-h-screen bg-utec-light flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
          <CalendarCheck size={56} className="mx-auto text-green-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Solicitud enviada!</h1>
          <p className="text-gray-600 mb-4">
            Su solicitud fue registrada correctamente. Jefatura recibirá una notificación
            para revisarla y le contactará a <strong>{correo}</strong> con la respuesta.
          </p>
          <div className="bg-gray-50 rounded-xl px-6 py-4 mb-6 border border-gray-200">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Número de referencia</p>
            <p className="text-2xl font-bold font-mono text-utec-primary">{refId}</p>
            <p className="text-xs text-gray-500 mt-1">Guarde este número para cualquier consulta</p>
          </div>
          <button
            onClick={() => { setEnviado(false); setNombre(''); setCorreo(''); setFacultad(''); setOtraFacultad(''); setLabId(''); setFecha(''); setProposito(''); setProgramas([]); setProgramasOtros(''); setErrores({}); }}
            className="text-sm text-utec-primary hover:underline"
          >
            Enviar otra solicitud
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header público ── */}
      <header className="bg-utec-primary text-white py-4 px-6 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 bg-utec-accent rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-utec-primary font-bold text-sm">L</span>
          </div>
          <div>
            <p className="font-semibold leading-none text-sm md:text-base">LabTrack Horarios · UTEC FICA</p>
            <p className="text-xs text-white/70 leading-none mt-0.5">Solicitud de laboratorio</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* ── Intro ── */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            Solicita un laboratorio de la FICA
          </h1>
          <p className="text-gray-600 max-w-xl mx-auto text-sm md:text-base">
            Complete el formulario para solicitar el uso de un laboratorio de cómputo.
            Jefatura revisará su solicitud y le notificará por correo con la respuesta.
          </p>
        </div>

        {cargandoBase ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-utec-primary animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* ── Formulario (izquierda, más ancho) ── */}
            <form onSubmit={handleEnviar} className="lg:col-span-3 space-y-5">

              {/* SECCIÓN 1: Quién solicita */}
              <FormSection icon={User} titulo="¿Quién solicita?" numero="1">
                <div className="space-y-3">
                  <Campo
                    label="Nombre completo *"
                    error={errores.nombre}
                    hint="Tal como aparece en su carné o documento"
                  >
                    <input
                      type="text"
                      value={nombre}
                      onChange={e => { setNombre(e.target.value); setErrores(ev => ({...ev, nombre: null})); }}
                      placeholder="Ej. María González López"
                      className={inputCls(errores.nombre)}
                    />
                  </Campo>

                  <Campo
                    label="Correo electrónico *"
                    error={errores.correo}
                    hint="Recibirá la respuesta de jefatura en este correo"
                  >
                    <input
                      type="email"
                      value={correo}
                      onChange={e => { setCorreo(e.target.value); setErrores(ev => ({...ev, correo: null})); }}
                      placeholder="tucorreo@ejemplo.com"
                      className={inputCls(errores.correo)}
                    />
                  </Campo>

                  <Campo
                    label="Facultad / Unidad *"
                    error={errores.facultad}
                    hint="De qué unidad de la universidad proviene la solicitud"
                  >
                    <select
                      value={facultad}
                      onChange={e => { setFacultad(e.target.value); setErrores(ev => ({...ev, facultad: null})); }}
                      className={inputCls(errores.facultad)}
                    >
                      <option value="">-- Selecciona --</option>
                      {FACULTADES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </Campo>

                  {facultad === 'Otra unidad / Departamento' && (
                    <Campo label="¿Cuál unidad? *" error={errores.otraFacultad}>
                      <input
                        type="text"
                        value={otraFacultad}
                        onChange={e => { setOtraFacultad(e.target.value); setErrores(ev => ({...ev, otraFacultad: null})); }}
                        placeholder="Nombre de tu departamento o unidad"
                        className={inputCls(errores.otraFacultad)}
                      />
                    </Campo>
                  )}
                </div>
              </FormSection>

              {/* SECCIÓN 2: Laboratorio y fecha */}
              <FormSection icon={FlaskConical} titulo="¿Qué laboratorio y cuándo?" numero="2">
                <div className="space-y-3">
                  <Campo
                    label="Laboratorio *"
                    error={errores.labId}
                    hint="Todos tienen computadoras. El Laboratorio 03 tiene 4 módulos independientes."
                  >
                    <select
                      value={labId}
                      onChange={e => { setLabId(e.target.value); setErrores(ev => ({...ev, labId: null})); }}
                      className={inputCls(errores.labId)}
                    >
                      <option value="">-- Selecciona --</option>
                      {labs.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.nombre}
                          {l.tieneModulos ? ` (${l.equipos} PCs en 4 módulos)` : ` (${l.equipos || l.capacidad} PCs)`}
                        </option>
                      ))}
                    </select>
                  </Campo>

                  <Campo
                    label="Fecha *"
                    error={errores.fecha}
                    hint="Solo días hábiles. Fines de semana deben justificarse en el propósito."
                  >
                    <input
                      type="date"
                      value={fecha}
                      min={HOY}
                      onChange={e => { setFecha(e.target.value); setErrores(ev => ({...ev, fecha: null})); }}
                      className={inputCls(errores.fecha)}
                    />
                  </Campo>

                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Hora de inicio *">
                      <select value={horaInicio} onChange={e => { setHoraInicio(e.target.value); setErrores(ev => ({...ev, horario: null})); }} className="input-base text-sm">
                        {FRANJAS_HORARIAS.map(f => <option key={f.inicio} value={f.inicio}>{f.inicio}</option>)}
                      </select>
                    </Campo>
                    <Campo label="Hora de fin *">
                      <select value={horaFin} onChange={e => { setHoraFin(e.target.value); setErrores(ev => ({...ev, horario: null})); }} className="input-base text-sm">
                        {FRANJAS_HORARIAS.map(f => <option key={f.fin} value={f.fin}>{f.fin}</option>)}
                      </select>
                    </Campo>
                  </div>
                  {errores.horario && <p className="text-xs text-red-600">{errores.horario}</p>}
                </div>
              </FormSection>

              {/* SECCIÓN 3: Propósito */}
              <FormSection icon={MessageSquare} titulo="¿Para qué necesitas el laboratorio?" numero="3">
                <Campo
                  label="Propósito de uso *"
                  error={errores.proposito}
                  hint="Describe con detalle: qué actividad realizarás, cuántas personas aproximadamente, si requieres software especial, etc."
                >
                  <textarea
                    value={proposito}
                    onChange={e => { setProposito(e.target.value); setErrores(ev => ({...ev, proposito: null})); }}
                    rows={4}
                    placeholder="Ej. Práctica de laboratorio para el curso de Bases de Datos con 30 estudiantes de la carrera de Ingeniería en Computación. Se utilizará MySQL Workbench para ejercicios de consultas SQL."
                    className={`${inputCls(errores.proposito)} resize-none`}
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">{proposito.length} caracteres</p>
                </Campo>
              </FormSection>

              {/* SECCIÓN 4: Software requerido */}
              <FormSection icon={Monitor} titulo="¿Requiere software específico?" numero="4">
                <p className="text-xs text-gray-500 mb-3">
                  Opcional. Si la actividad requiere programas instalados en los equipos,
                  indíquelos para que jefatura pueda preparar el laboratorio con anticipación.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">
                  {SOFTWARE_DISPONIBLE.map(sw => (
                    <label key={sw.id} className="flex items-center gap-2 text-sm cursor-pointer hover:text-utec-primary">
                      <input
                        type="checkbox"
                        checked={programas.includes(sw.id)}
                        onChange={() => setProgramas(prev =>
                          prev.includes(sw.id) ? prev.filter(p => p !== sw.id) : [...prev, sw.id]
                        )}
                        className="rounded border-gray-300 text-utec-primary focus:ring-utec-primary"
                      />
                      <span className="text-gray-700">{sw.label}</span>
                    </label>
                  ))}
                </div>
                <Campo label="Otro software no listado">
                  <input
                    type="text"
                    value={programasOtros}
                    onChange={e => setProgramasOtros(e.target.value)}
                    placeholder="Ej. SPSS versión 25, Arduino IDE..."
                    className={inputCls(null)}
                  />
                </Campo>
              </FormSection>

              {/* Indicador de conflicto */}
              {labId && fecha && (
                hayConflicto ? (
                  <div className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-xl px-4 py-3 text-sm text-red-800">
                    <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-red-600" />
                    <div>
                      <p className="font-semibold">Horario no disponible</p>
                      <p className="text-xs mt-0.5">El laboratorio está ocupado en el horario que seleccionaste. Por favor elige un horario diferente o consulta la disponibilidad a la derecha.</p>
                    </div>
                  </div>
                ) : horaMin(horaFin) > horaMin(horaInicio) ? (
                  <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
                    <CheckCircle2 size={18} className="flex-shrink-0 text-green-600" />
                    <p className="font-medium">Horario disponible — puedes enviar tu solicitud</p>
                  </div>
                ) : null
              )}

              {/* Botón enviar */}
              <button
                type="submit"
                disabled={enviando || hayConflicto || horaMin(horaFin) <= horaMin(horaInicio)}
                className="w-full py-3.5 bg-utec-primary text-white font-semibold rounded-xl hover:bg-utec-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm transition-colors"
              >
                {enviando ? <Loader2 size={18} className="animate-spin" /> : <Send size={16} />}
                {enviando ? 'Enviando solicitud...' : 'Enviar solicitud de reserva'}
              </button>

              <p className="text-xs text-gray-400 text-center">
                Al enviar acepta que jefatura de la FICA revisará y decidirá sobre su solicitud.
                La aprobación no es automática.
              </p>
            </form>

            {/* ── Panel de disponibilidad (derecha) ── */}
            <div className="lg:col-span-2">
              <div className="bg-white border border-gray-200 rounded-2xl p-4 sticky top-4">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-1">
                  <Clock size={15} className="text-utec-primary" />
                  Disponibilidad del laboratorio
                </h2>

                {!labId || !fecha ? (
                  <div className="py-10 text-center text-gray-400">
                    <CalendarCheck size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-xs">Selecciona un laboratorio<br/>y una fecha para ver disponibilidad</p>
                  </div>
                ) : cargandoDisp ? (
                  <div className="py-10 flex justify-center">
                    <Loader2 className="w-6 h-6 text-utec-primary animate-spin" />
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 mb-3">
                      {labs.find(l => l.id === labId)?.nombre} · {fmtFecha(fecha)}
                    </p>

                    {disponibilidad.length === 0 ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 flex items-center gap-2 mb-3">
                        <CheckCircle2 size={16} />
                        <span>Sin clases ni reservas para este día. El laboratorio está disponible todo el día.</span>
                      </div>
                    ) : (
                      <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                        {disponibilidad.length} período{disponibilidad.length !== 1 ? 's' : ''} ocupado{disponibilidad.length !== 1 ? 's' : ''} este día
                      </div>
                    )}

                    <div className="space-y-1.5">
                      {franjasTimeline.map(f => (
                        <FranjaDisponibilidad key={f.inicio} franja={f} ocupaciones={disponibilidad} />
                      ))}
                    </div>

                    {FRANJAS_HORARIAS.length > 8 && (
                      <button
                        type="button"
                        onClick={() => setMostrarTodaDisp(v => !v)}
                        className="mt-3 w-full text-xs text-utec-primary hover:underline flex items-center justify-center gap-1"
                      >
                        <ChevronDown size={13} className={mostrarTodaDisp ? 'rotate-180' : ''} />
                        {mostrarTodaDisp ? 'Ver menos' : `Ver horario completo (hasta 20:00)`}
                      </button>
                    )}

                    <div className="mt-4 pt-3 border-t border-gray-100 space-y-1">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                        Disponible — puedes solicitar este horario
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
                        Ocupado — ya tiene clase o reserva aprobada
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Info adicional */}
              <div className="mt-4 bg-utec-light border border-blue-100 rounded-2xl p-4 text-xs text-utec-dark space-y-2">
                <p className="font-semibold text-sm flex items-center gap-1.5">
                  <BookOpen size={14} />
                  Información importante
                </p>
                <p>· Horario de laboratorios: <strong>06:30 – 20:00</strong></p>
                <p>· Tu solicitud quedará en estado <strong>pendiente</strong> hasta que jefatura la revise.</p>
                <p>· Recibirás una respuesta en tu correo. Revisa también tu carpeta de spam.</p>
                <p>· Si tiene urgencia, contacte directamente a jefatura de la FICA.</p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-200 mt-12 py-4 text-center text-xs text-gray-400">
        LabTrack Horarios · Universidad Tecnológica de El Salvador · FICA
      </footer>
    </div>
  );
}

/* ── sub-componentes ── */
function FormSection({ icon: Icon, titulo, numero, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-7 h-7 rounded-full bg-utec-primary text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
          {numero}
        </div>
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <Icon size={16} className="text-utec-primary" />
          {titulo}
        </h2>
      </div>
      {children}
    </div>
  );
}

function Campo({ label, error, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function inputCls(error) {
  return `input-base text-sm ${error ? 'border-red-400 focus:ring-red-400' : ''}`;
}

function emailHtmlSolicitud({ nombre, correo, facultad, labNombre, fecha, horaInicio, horaFin, proposito, refId }) {
  const fmtF = (iso) => {
    const [y, m, d] = iso.split('-');
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return `${parseInt(d)} de ${meses[parseInt(m)-1]} de ${y}`;
  };

  return `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; background: #f0f4f8;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="background: #003366; color: white; padding: 24px;">
      <p style="margin: 0; font-size: 12px; opacity: 0.8;">LabTrack UTEC FICA — Solicitud externa</p>
      <h1 style="margin: 8px 0 0; font-size: 20px;">Nueva solicitud de laboratorio</h1>
    </div>
    <div style="padding: 24px;">
      <p style="margin: 0 0 20px; color: #555; font-size: 14px;">
        Se recibió una nueva solicitud de uso de laboratorio desde el formulario público.
        Ingresa al sistema para aprobarla o rechazarla.
      </p>

      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px 0; color: #888; width: 140px; vertical-align: top;">Solicitante</td>
          <td style="padding: 10px 0; font-weight: 600; color: #111;">${nombre}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px 0; color: #888;">Correo</td>
          <td style="padding: 10px 0; color: #111;"><a href="mailto:${correo}" style="color: #003366;">${correo}</a></td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px 0; color: #888;">Facultad / Unidad</td>
          <td style="padding: 10px 0; color: #111;">${facultad}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px 0; color: #888;">Laboratorio</td>
          <td style="padding: 10px 0; font-weight: 600; color: #111;">${labNombre}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px 0; color: #888;">Fecha</td>
          <td style="padding: 10px 0; color: #111;">${fmtF(fecha)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px 0; color: #888;">Horario</td>
          <td style="padding: 10px 0; font-weight: 600; color: #111;">${horaInicio} – ${horaFin}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #888; vertical-align: top;">Propósito</td>
          <td style="padding: 10px 0; color: #111;">${proposito.replace(/\n/g, '<br>')}</td>
        </tr>
      </table>

      <div style="margin: 24px 0; background: #f5f8ff; border-radius: 8px; padding: 16px; border-left: 4px solid #003366;">
        <p style="margin: 0; font-size: 13px; color: #555;">
          Referencia: <strong style="color: #003366; font-family: monospace;">${refId.toUpperCase()}</strong>
        </p>
        <p style="margin: 8px 0 0; font-size: 13px; color: #555;">
          Ingresa al sistema LabTrack para revisar y procesar esta solicitud.
        </p>
      </div>

      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 11px; color: #aaa; margin: 0;">
        Este mensaje fue generado automáticamente por LabTrack Horarios.<br>
        Universidad Tecnológica de El Salvador · Facultad de Informática y Ciencias Aplicadas
      </p>
    </div>
  </div>
</body>
</html>`;
}
