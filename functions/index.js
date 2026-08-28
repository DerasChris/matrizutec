const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

const FROM_ADDRESS = 'LabTrack UTEC <labtrackutec@gmail.com>';

function crearTransporte() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

exports.procesarEmailQueue = functions.firestore
  .document('mail/{mailId}')
  .onCreate(async (snap) => {
    const data = snap.data();
    const { to, message } = data;

    if (!to || !message?.subject) {
      await snap.ref.update({
        'delivery.state': 'ERROR',
        'delivery.error': 'Documento inválido: faltan campos to o message.subject',
        'delivery.attempts': 1,
      });
      return null;
    }

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      functions.logger.error('GMAIL_USER o GMAIL_APP_PASSWORD no configurados');
      await snap.ref.update({
        'delivery.state': 'ERROR',
        'delivery.error': 'Credenciales Gmail no configuradas en functions/.env',
        'delivery.attempts': 1,
      });
      return null;
    }

    const finalTo = Array.isArray(to) ? to : [to];

    try {
      const transporte = crearTransporte();
      const info = await transporte.sendMail({
        from: FROM_ADDRESS,
        to: finalTo.join(', '),
        subject: message.subject,
        ...(message.html && { html: message.html }),
        ...(message.text && { text: message.text }),
      });

      functions.logger.info(`Email enviado a ${finalTo.join(', ')} — ID: ${info.messageId}`);

      await snap.ref.update({
        'delivery.state': 'SUCCESS',
        'delivery.attempts': 1,
        'delivery.messageId': info.messageId ?? null,
        'delivery.endTime': new Date().toISOString(),
      });
    } catch (err) {
      functions.logger.error('Error Gmail SMTP:', err.message);
      await snap.ref.update({
        'delivery.state': 'ERROR',
        'delivery.error': err.message,
        'delivery.attempts': 1,
      });
    }

    return null;
  });

// ──────────────────────────────────────────────────────────────
// Asistencia docente por QR + PIN
// ──────────────────────────────────────────────────────────────

const GRACIA_MINUTOS = 10;
const DIA_EN_A_ID = {
  Monday: 'lunes', Tuesday: 'martes', Wednesday: 'miercoles',
  Thursday: 'jueves', Friday: 'viernes', Saturday: 'sabado', Sunday: 'domingo',
};

// Rangos de vacación que no cuentan como "falta marcar" en ningún flujo
// (QR+PIN ni Modo Kiosko). Ajustar cada ciclo según el calendario académico
// real.
const VACACIONES = [
  { desde: '2026-08-01', hasta: '2026-08-09' },
];
function esFechaDeVacacion(fechaISO) {
  return VACACIONES.some(v => fechaISO >= v.desde && fechaISO <= v.hasta);
}

// Cloud Functions corre en UTC por defecto; El Salvador es UTC-6 todo el
// año (sin horario de verano). Se calcula la hora local explícitamente en
// vez de confiar en la zona horaria del servidor.
function ahoraElSalvador() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/El_Salvador',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
    weekday: 'long',
  }).formatToParts(new Date());

  const map = {};
  for (const p of partes) map[p.type] = p.value;

  return {
    fecha: `${map.year}-${map.month}-${map.day}`,
    horaHHMM: `${map.hour === '24' ? '00' : map.hour}:${map.minute}`,
    diaSemanaId: DIA_EN_A_ID[map.weekday],
  };
}

function horaAMinutos(hora) {
  const [h, m] = String(hora || '0:0').split(':').map(Number);
  return h * 60 + m;
}

// Si la clase NO está en su día/horario oficial ahora mismo (con 10 min de
// gracia tras la hora fin). Se usa solo para etiquetar el registro — nunca
// para bloquear: el docente siempre puede marcar.
function esFueraDeHorario(clase, ahora) {
  if (!Array.isArray(clase.diasSemana) || !clase.diasSemana.includes(ahora.diaSemanaId)) return true;
  if (clase.fechaInicio && ahora.fecha < clase.fechaInicio) return true;
  if (clase.fechaFin && ahora.fecha > clase.fechaFin) return true;

  const minutosAhora = horaAMinutos(ahora.horaHHMM);
  const inicio = horaAMinutos(clase.horaInicio);
  const finConGracia = horaAMinutos(clase.horaFin) + GRACIA_MINUTOS;
  return minutosAhora < inicio || minutosAhora > finConGracia;
}

const DIAS_SEMANA_POR_INDICE = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

// Día de semana de una fecha calendario, sin ambigüedad de zona horaria —
// anclar a mediodía UTC evita que el parseo caiga en el día anterior (El
// Salvador no tiene horario de verano, así que esto es seguro todo el año).
function diaSemanaIdDeFecha(fechaISO) {
  const d = new Date(`${fechaISO}T12:00:00Z`);
  return DIAS_SEMANA_POR_INDICE[d.getUTCDay()];
}

function restarDias(fechaISO, n) {
  const d = new Date(`${fechaISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// Los últimos `n` días calendario anteriores a `fechaHoy` (sin incluir hoy),
// del más reciente al más antiguo. Es la ventana server-side contra la que
// se valida cualquier fecha retroactiva que mande el cliente — nunca se
// confía en una fecha arbitraria sin este chequeo.
function ventanaRetroactiva(fechaHoy, n = 7) {
  return Array.from({ length: n }, (_, i) => restarDias(fechaHoy, i + 1));
}

// ¿Esta clase tenía sesión programada este día? Mismo criterio que
// clasesQueAplicanEnFecha en src/utils/matrizHelpers.js (día de semana +
// rango fechaInicio/fechaFin), reimplementado aquí porque functions/ no
// importa código de src/ — no evalúa hora, solo el día.
function claseAplicaEnFecha(clase, fechaISO, diaSemanaId) {
  if (!Array.isArray(clase.diasSemana) || !clase.diasSemana.includes(diaSemanaId)) return false;
  if (clase.fechaInicio && fechaISO < clase.fechaInicio) return false;
  if (clase.fechaFin && fechaISO > clase.fechaFin) return false;
  return true;
}

// Todas las clases regulares activas del docente en ese lab/ciclo — sin
// filtrar por día ni hora. El docente elige cuál marcar; nunca se le
// bloquea por no estar "en horario", solo se etiqueta el registro.
async function obtenerClasesDelDocenteEnLab(db, { docenteNombre, labId, cicloId }) {
  const snap = await db.collection('clasesRegulares')
    .where('cicloId', '==', cicloId)
    .where('labId', '==', labId)
    .where('docente', '==', docenteNombre)
    .where('tipo', '==', 'regular')
    .where('activo', '==', true)
    .get();

  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function buscarDocentePorPin(pin) {
  const snap = await admin.firestore().collection('docentes')
    .where('pin', '==', String(pin))
    .where('activo', '==', true)
    .get();
  if (snap.size !== 1) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function obtenerCicloActivo() {
  const snap = await admin.firestore().collection('ciclos').where('activo', '==', true).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// Paso 1: valida el PIN, sin escribir nada. Devuelve las clases del docente
// que SÍ tienen sesión programada hoy en ese laboratorio — "fuera de
// horario" es para llegar/salir tarde el mismo día, no aplica a cualquier
// día de la semana. Si hoy no le toca ninguna, igual se devuelven los días
// recientes sin marcar y el historial, para que pueda marcar un día pasado
// (con aprobación de jefatura) aunque hoy no tenga clase en este lab.
exports.buscarClaseParaAsistencia = functions.https.onCall(async (data) => {
  const labId = data?.labId;
  const pin = data?.pin;
  if (!labId || !pin) {
    throw new functions.https.HttpsError('invalid-argument', 'Faltan datos.');
  }

  const docente = await buscarDocentePorPin(pin);
  if (!docente) {
    throw new functions.https.HttpsError('not-found', 'PIN incorrecto.');
  }

  const ciclo = await obtenerCicloActivo();
  if (!ciclo) {
    throw new functions.https.HttpsError('failed-precondition', 'No hay un ciclo activo.');
  }

  const ahora = ahoraElSalvador();
  const todasLasClases = await obtenerClasesDelDocenteEnLab(admin.firestore(), {
    docenteNombre: docente.nombre,
    labId,
    cicloId: ciclo.id,
  });

  if (todasLasClases.length === 0) {
    throw new functions.https.HttpsError(
      'not-found',
      'No tienes clases asignadas en este laboratorio.'
    );
  }

  const clases = todasLasClases.filter(c => claseAplicaEnFecha(c, ahora.fecha, ahora.diaSemanaId));

  const db = admin.firestore();
  const clasesConEstado = await Promise.all(clases.map(async (clase) => {
    const existente = await db.collection('asistencias').doc(`${clase.id}_${ahora.fecha}`).get();
    return {
      claseId: clase.id,
      codigoAsignatura: clase.codigoAsignatura || '',
      nombreAsignatura: clase.nombreAsignatura || '',
      seccion: clase.seccion || '',
      diasSemana: clase.diasSemana || [],
      horaInicio: clase.horaInicio,
      horaFin: clase.horaFin,
      inscritos: clase.inscritos || 0,
      fueraDeHorario: esFueraDeHorario(clase, ahora),
      yaMarcada: existente.exists,
      alumnosPrevios: existente.exists ? existente.data().alumnosLlegaron : null,
    };
  }));

  // Las que están en horario ahora primero, para que sean la opción obvia.
  clasesConEstado.sort((a, b) => Number(a.fueraDeHorario) - Number(b.fueraDeHorario));

  // Días recientes sin marcar: por cada clase, cada fecha de la ventana en
  // que aplicaba y no tiene ya un doc de asistencia (en ningún estado, para
  // no re-sugerir un día ya pendiente o aprobado).
  const ventana = ventanaRetroactiva(ahora.fecha, 7);
  const combinaciones = [];
  for (const clase of todasLasClases) {
    for (const fecha of ventana) {
      if (esFechaDeVacacion(fecha)) continue;
      const diaSemanaFecha = diaSemanaIdDeFecha(fecha);
      if (claseAplicaEnFecha(clase, fecha, diaSemanaFecha)) {
        combinaciones.push({ clase, fecha, diaSemanaFecha });
      }
    }
  }
  const chequeos = await Promise.all(combinaciones.map(async ({ clase, fecha, diaSemanaFecha }) => {
    const existe = await db.collection('asistencias').doc(`${clase.id}_${fecha}`).get();
    return existe.exists ? null : { clase, fecha, diaSemanaFecha };
  }));
  const diasSinMarcar = chequeos
    .filter(Boolean)
    .map(({ clase, fecha, diaSemanaFecha }) => ({
      claseId: clase.id,
      fecha,
      diaSemana: diaSemanaFecha,
      codigoAsignatura: clase.codigoAsignatura || '',
      nombreAsignatura: clase.nombreAsignatura || '',
      seccion: clase.seccion || '',
      horaInicio: clase.horaInicio,
      horaFin: clase.horaFin,
      inscritos: clase.inscritos || 0,
    }))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  // Últimos 5 registros del docente en ESTE lab (mismo alcance que el QR),
  // con hora programada y hora real de marcado.
  const historialSnap = await db.collection('asistencias')
    .where('docente', '==', docente.nombre)
    .where('labId', '==', labId)
    .orderBy('fecha', 'desc')
    .limit(5)
    .get();
  const historialReciente = historialSnap.docs.map((d) => {
    const h = d.data();
    return {
      fecha: h.fecha,
      diaSemana: h.diaSemana,
      nombreAsignatura: h.nombreAsignatura || '',
      codigoAsignatura: h.codigoAsignatura || '',
      seccion: h.seccion || '',
      horaInicio: h.horaInicio,
      horaFin: h.horaFin,
      horaMarcado: h.horaMarcado,
      alumnosLlegaron: h.alumnosLlegaron,
      estado: h.estado || 'aprobada',
      retroactivo: !!h.retroactivo,
    };
  });

  return { docente: docente.nombre, clases: clasesConEstado, diasSinMarcar, historialReciente };
});

// Paso 2: re-valida PIN + pertenencia de la clase de forma independiente
// (nunca confía en claseId del cliente sin re-verificar que sea una clase
// real de ese docente en ese lab) y crea o corrige el registro del día.
// Siempre permite marcar; solo etiqueta fueraDeHorario si corresponde.
//
// Si viene `fechaRetroactiva` (docente marcando un día olvidado, distinto a
// hoy), la fecha se re-valida por completo en el servidor — nunca se confía
// en que el cliente la haya calculado bien — y el registro nace en estado
// 'pendiente' en vez de 'aprobada': queda sujeto a revisión de jefatura
// antes de contar como asistencia confirmada, porque ya no hay presencia
// física verificable en tiempo real como en un marcado del mismo día.
exports.registrarAsistencia = functions.https.onCall(async (data) => {
  const labId = data?.labId;
  const pin = data?.pin;
  const claseId = data?.claseId;
  const alumnos = Number(data?.alumnosLlegaron);
  const fechaRetroactivaRaw = data?.fechaRetroactiva || null;

  if (!labId || !pin || !claseId || !Number.isInteger(alumnos) || alumnos < 0 || alumnos > 500) {
    throw new functions.https.HttpsError('invalid-argument', 'Datos inválidos.');
  }

  const docente = await buscarDocentePorPin(pin);
  if (!docente) {
    throw new functions.https.HttpsError('not-found', 'PIN incorrecto.');
  }

  const ciclo = await obtenerCicloActivo();
  if (!ciclo) {
    throw new functions.https.HttpsError('failed-precondition', 'No hay un ciclo activo.');
  }

  const clases = await obtenerClasesDelDocenteEnLab(admin.firestore(), {
    docenteNombre: docente.nombre,
    labId,
    cicloId: ciclo.id,
  });

  const clase = clases.find((c) => c.id === claseId);
  if (!clase) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Esa clase no te pertenece en este laboratorio.'
    );
  }

  const ahora = ahoraElSalvador();

  let fecha = ahora.fecha;
  let esRetroactivo = false;
  if (fechaRetroactivaRaw && fechaRetroactivaRaw !== ahora.fecha) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaRetroactivaRaw)) {
      throw new functions.https.HttpsError('invalid-argument', 'Fecha retroactiva inválida.');
    }
    if (!ventanaRetroactiva(ahora.fecha, 7).includes(fechaRetroactivaRaw)) {
      throw new functions.https.HttpsError('invalid-argument', 'La fecha está fuera de la ventana de 7 días permitida.');
    }
    if (esFechaDeVacacion(fechaRetroactivaRaw)) {
      throw new functions.https.HttpsError('invalid-argument', 'Esa fecha es un día de vacación.');
    }
    const diaSemanaFecha = diaSemanaIdDeFecha(fechaRetroactivaRaw);
    if (!claseAplicaEnFecha(clase, fechaRetroactivaRaw, diaSemanaFecha)) {
      throw new functions.https.HttpsError('failed-precondition', 'Esa clase no tenía sesión programada ese día.');
    }
    fecha = fechaRetroactivaRaw;
    esRetroactivo = true;
  } else if (!claseAplicaEnFecha(clase, ahora.fecha, ahora.diaSemanaId)) {
    // No es un día en que esta clase tenga sesión — "fuera de horario" es
    // para llegar/salir tarde el mismo día, no para marcar cualquier día de
    // la semana. Si es un día pasado que sí le tocaba, debe venir con
    // fechaRetroactiva (rama de arriba).
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Esta clase no tiene sesión programada hoy.'
    );
  }

  const db = admin.firestore();
  const docId = `${clase.id}_${fecha}`;

  if (esRetroactivo) {
    // No se puede sobrescribir un día que jefatura ya decidió — solo se
    // puede (re)marcar mientras siga pendiente.
    const existente = await db.collection('asistencias').doc(docId).get();
    if (existente.exists && existente.data().estado !== 'pendiente') {
      throw new functions.https.HttpsError('already-exists', 'Ese día ya fue revisado por jefatura y no se puede modificar.');
    }
  }

  const fueraDeHorario = esRetroactivo ? false : esFueraDeHorario(clase, ahora);
  const diaSemana = esRetroactivo ? diaSemanaIdDeFecha(fecha) : ahora.diaSemanaId;
  const estado = esRetroactivo ? 'pendiente' : 'aprobada';

  await db.collection('asistencias').doc(docId).set({
    claseId: clase.id,
    cicloId: ciclo.id,
    labId,
    codigoAsignatura: clase.codigoAsignatura || '',
    nombreAsignatura: clase.nombreAsignatura || '',
    seccion: clase.seccion || '',
    docente: docente.nombre,
    diaSemana,
    fecha,
    horaInicio: clase.horaInicio,
    horaFin: clase.horaFin,
    horaMarcado: ahora.horaHHMM, // hora real del clic, siempre — aunque el día sea retroactivo
    alumnosLlegaron: alumnos,
    inscritos: clase.inscritos || 0,
    fueraDeHorario,
    retroactivo: esRetroactivo,
    estado,
    marcadoEn: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    nombreAsignatura: clase.nombreAsignatura || '',
    horaInicio: clase.horaInicio,
    horaFin: clase.horaFin,
    fecha,
    alumnosLlegaron: alumnos,
    fueraDeHorario,
    retroactivo: esRetroactivo,
    pendiente: esRetroactivo,
  };
});

// ──────────────────────────────────────────────────────────────
// API externa: recibir asistencia desde otro software
// ──────────────────────────────────────────────────────────────
//
// Endpoint HTTP plano (no requiere Firebase SDK del lado del cliente que
// llama) protegido por una API key fija en el header X-Api-Key, comparada
// contra process.env.ASISTENCIA_API_KEY (configurar en functions/.env,
// nunca en el código). No usa Firebase Auth porque el sistema externo no
// tiene sesión de usuario — el mismo motivo por el que el flujo QR+PIN
// tampoco la usa.
//
// La clase se identifica por labId + codigoAsignatura + seccion (no por el
// id interno de Firestore, que el sistema externo no tiene forma de
// conocer) dentro del ciclo activo (o el que se indique explícitamente).
// Reusa exactamente la misma validación de "¿esta clase tiene sesión ese
// día?" que ya usan el flujo QR retroactivo y el ingreso manual.

const LAB_ID_REGEX = /^lab_(0[1-9]|1[0-5])$/;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function setCorsHeaders(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');
}

exports.registrarAsistenciaExterna = functions.https.onRequest(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método no permitido, usa POST.' });
    return;
  }

  const apiKey = req.get('X-Api-Key');
  if (!process.env.ASISTENCIA_API_KEY || apiKey !== process.env.ASISTENCIA_API_KEY) {
    res.status(401).json({ ok: false, error: 'API key inválida o faltante.' });
    return;
  }

  const body = req.body || {};
  const { labId, codigoAsignatura, fecha, horaMarcado, cicloId: cicloIdRaw } = body;
  const seccion = body.seccion;
  const alumnosLlegaron = body.alumnosLlegaron;

  if (!labId || !LAB_ID_REGEX.test(labId)) {
    res.status(400).json({ ok: false, error: 'labId inválido (esperado lab_01..lab_15).' });
    return;
  }
  if (!codigoAsignatura || typeof codigoAsignatura !== 'string') {
    res.status(400).json({ ok: false, error: 'codigoAsignatura es requerido.' });
    return;
  }
  if (seccion === undefined || seccion === null || seccion === '') {
    res.status(400).json({ ok: false, error: 'seccion es requerida.' });
    return;
  }
  if (!fecha || !FECHA_REGEX.test(fecha)) {
    res.status(400).json({ ok: false, error: 'fecha inválida (formato YYYY-MM-DD).' });
    return;
  }
  const alumnos = Number(alumnosLlegaron);
  if (!Number.isInteger(alumnos) || alumnos < 0 || alumnos > 500) {
    res.status(400).json({ ok: false, error: 'alumnosLlegaron inválido (entero 0-500).' });
    return;
  }

  const db = admin.firestore();

  let ciclo;
  if (cicloIdRaw) {
    const cicloSnap = await db.collection('ciclos').doc(String(cicloIdRaw)).get();
    if (!cicloSnap.exists) { res.status(404).json({ ok: false, error: 'cicloId no existe.' }); return; }
    ciclo = { id: cicloSnap.id, ...cicloSnap.data() };
  } else {
    ciclo = await obtenerCicloActivo();
    if (!ciclo) { res.status(412).json({ ok: false, error: 'No hay un ciclo activo.' }); return; }
  }

  const clasesSnap = await db.collection('clasesRegulares')
    .where('cicloId', '==', ciclo.id)
    .where('labId', '==', labId)
    .where('codigoAsignatura', '==', String(codigoAsignatura).toUpperCase())
    .where('seccion', '==', String(seccion))
    .where('tipo', '==', 'regular')
    .where('activo', '==', true)
    .get();

  if (clasesSnap.empty) {
    res.status(404).json({ ok: false, error: 'No se encontró una clase activa con ese labId/codigoAsignatura/seccion en el ciclo.' });
    return;
  }
  if (clasesSnap.size > 1) {
    res.status(409).json({ ok: false, error: 'Se encontró más de una clase con esos datos — no se pudo identificar de forma única.' });
    return;
  }
  const clase = { id: clasesSnap.docs[0].id, ...clasesSnap.docs[0].data() };

  const diaSemanaId = diaSemanaIdDeFecha(fecha);
  if (!claseAplicaEnFecha(clase, fecha, diaSemanaId)) {
    res.status(422).json({ ok: false, error: 'Esa clase no tiene sesión programada en esa fecha.' });
    return;
  }

  await db.collection('asistencias').doc(`${clase.id}_${fecha}`).set({
    claseId: clase.id,
    cicloId: ciclo.id,
    labId,
    codigoAsignatura: clase.codigoAsignatura || '',
    nombreAsignatura: clase.nombreAsignatura || '',
    seccion: clase.seccion || '',
    docente: clase.docente || '',
    diaSemana: diaSemanaId,
    fecha,
    horaInicio: clase.horaInicio,
    horaFin: clase.horaFin,
    horaMarcado: horaMarcado || null,
    alumnosLlegaron: alumnos,
    inscritos: clase.inscritos || 0,
    fueraDeHorario: false,
    retroactivo: false,
    estado: 'aprobada',
    origen: 'api_externa',
    marcadoEn: admin.firestore.FieldValue.serverTimestamp(),
  });

  res.status(200).json({
    ok: true,
    claseId: clase.id,
    nombreAsignatura: clase.nombreAsignatura || '',
    fecha,
    alumnosLlegaron: alumnos,
    estado: 'aprobada',
  });
});

// ──────────────────────────────────────────────────────────────
// Modo Kiosko: PC fija en el laboratorio, sin PIN
// ──────────────────────────────────────────────────────────────
//
// El encargado muestra la página (URL con un token ofuscado) al docente al
// final de la clase; el docente elige su clase de una lista y marca cuántos
// alumnos llegaron — no hay PIN ni sesión, el control de acceso es físico
// (el encargado media cuándo se muestra la pantalla). Por eso el token
// nunca se resuelve del lado del cliente: ambas funciones lo reciben como
// parámetro y lo resuelven leyendo `kioskos/{token}` con Admin SDK — esa
// colección no tiene lectura pública en firestore.rules.

async function resolverLabIdDesdeToken(db, token) {
  if (!token) return null;
  const snap = await db.collection('kioskos').doc(String(token)).get();
  if (!snap.exists) return null;
  return snap.data().labId || null;
}

const TIPOS_ASISTENCIA_KIOSKO = new Set(['clase', 'parcial', 'reposicion']);

exports.obtenerAgendaKiosko = functions.https.onCall(async (data) => {
  const token = data?.token;
  const db = admin.firestore();
  const labId = await resolverLabIdDesdeToken(db, token);
  if (!labId) {
    throw new functions.https.HttpsError('not-found', 'Enlace no válido.');
  }

  const labSnap = await db.collection('laboratorios').doc(labId).get();
  const labNombre = labSnap.exists ? (labSnap.data().nombre || labId) : labId;

  const ciclo = await obtenerCicloActivo();
  if (!ciclo) {
    throw new functions.https.HttpsError('failed-precondition', 'No hay un ciclo activo.');
  }

  const clasesSnap = await db.collection('clasesRegulares')
    .where('cicloId', '==', ciclo.id)
    .where('labId', '==', labId)
    .where('tipo', '==', 'regular')
    .where('activo', '==', true)
    .get();
  const clases = clasesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const ahora = ahoraElSalvador();

  const clasesHoy = await Promise.all(
    clases
      .filter((c) => claseAplicaEnFecha(c, ahora.fecha, ahora.diaSemanaId))
      .map(async (c) => {
        const doc = await db.collection('asistencias').doc(`${c.id}_${ahora.fecha}`).get();
        return {
          claseId: c.id,
          codigoAsignatura: c.codigoAsignatura || '',
          nombreAsignatura: c.nombreAsignatura || '',
          seccion: c.seccion || '',
          docente: c.docente || '',
          horaInicio: c.horaInicio,
          horaFin: c.horaFin,
          marcada: doc.exists,
          alumnosLlegaron: doc.exists ? doc.data().alumnosLlegaron : null,
          tipo: doc.exists ? (doc.data().tipo || null) : null,
        };
      })
  );

  // Calendario del mes actual, desde el día 1 hasta hoy (nunca fechas
  // futuras) — un día por fila, con las clases que le tocaban ese día y si
  // ya se marcaron, saltando los días de vacación.
  const [anioStr, mesStr, diaStr] = ahora.fecha.split('-');
  const anio = Number(anioStr);
  const mesIdx = Number(mesStr) - 1;
  const hoyNum = Number(diaStr);
  const calendario = [];
  for (let dia = 1; dia <= hoyNum; dia++) {
    const cursor = new Date(anio, mesIdx, dia);
    const fechaISO = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (esFechaDeVacacion(fechaISO)) continue;
    const diaSemanaId = diaSemanaIdDeFecha(fechaISO);
    const clasesDelDia = clases.filter((c) => claseAplicaEnFecha(c, fechaISO, diaSemanaId));
    if (clasesDelDia.length === 0) continue;

    const detalle = await Promise.all(clasesDelDia.map(async (c) => {
      const doc = await db.collection('asistencias').doc(`${c.id}_${fechaISO}`).get();
      return {
        claseId: c.id,
        nombreAsignatura: c.nombreAsignatura || '',
        docente: c.docente || '',
        horaInicio: c.horaInicio,
        horaFin: c.horaFin,
        marcada: doc.exists,
        alumnosLlegaron: doc.exists ? doc.data().alumnosLlegaron : null,
      };
    }));
    calendario.push({ fecha: fechaISO, clases: detalle });
  }

  return {
    lab: { id: labId, nombre: labNombre },
    clasesHoy,
    calendario,
  };
});

exports.registrarAsistenciaKiosko = functions.https.onCall(async (data) => {
  const token = data?.token;
  const claseId = data?.claseId;
  const fecha = data?.fecha;
  const tipo = data?.tipo;
  const alumnos = Number(data?.alumnosLlegaron);

  const db = admin.firestore();
  const labId = await resolverLabIdDesdeToken(db, token);
  if (!labId) {
    throw new functions.https.HttpsError('not-found', 'Enlace no válido.');
  }

  if (!claseId || !fecha || !TIPOS_ASISTENCIA_KIOSKO.has(tipo)) {
    throw new functions.https.HttpsError('invalid-argument', 'Datos inválidos.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new functions.https.HttpsError('invalid-argument', 'Fecha inválida.');
  }
  if (!Number.isInteger(alumnos) || alumnos < 0 || alumnos > 500) {
    throw new functions.https.HttpsError('invalid-argument', 'Cantidad de alumnos inválida.');
  }

  const ciclo = await obtenerCicloActivo();
  if (!ciclo) {
    throw new functions.https.HttpsError('failed-precondition', 'No hay un ciclo activo.');
  }

  const ahora = ahoraElSalvador();
  if (fecha > ahora.fecha) {
    throw new functions.https.HttpsError('invalid-argument', 'No se puede marcar una fecha futura.');
  }
  const inicioMes = `${ahora.fecha.slice(0, 7)}-01`;
  if (fecha < inicioMes) {
    throw new functions.https.HttpsError('invalid-argument', 'Solo se puede marcar dentro del mes actual.');
  }
  if (esFechaDeVacacion(fecha)) {
    throw new functions.https.HttpsError('invalid-argument', 'Esa fecha es un día de vacación.');
  }

  const claseSnap = await db.collection('clasesRegulares').doc(claseId).get();
  if (!claseSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Clase no encontrada.');
  }
  const clase = { id: claseSnap.id, ...claseSnap.data() };
  if (clase.labId !== labId || clase.cicloId !== ciclo.id || clase.tipo !== 'regular' || clase.activo === false) {
    throw new functions.https.HttpsError('failed-precondition', 'Esa clase no pertenece a este laboratorio/ciclo.');
  }

  const diaSemanaId = diaSemanaIdDeFecha(fecha);
  if (!claseAplicaEnFecha(clase, fecha, diaSemanaId)) {
    throw new functions.https.HttpsError('failed-precondition', 'Esa clase no tiene sesión programada esa fecha.');
  }

  await db.collection('asistencias').doc(`${clase.id}_${fecha}`).set({
    claseId: clase.id,
    cicloId: ciclo.id,
    labId,
    codigoAsignatura: clase.codigoAsignatura || '',
    nombreAsignatura: clase.nombreAsignatura || '',
    seccion: clase.seccion || '',
    docente: clase.docente || '',
    diaSemana: diaSemanaId,
    fecha,
    horaInicio: clase.horaInicio,
    horaFin: clase.horaFin,
    horaMarcado: ahora.horaHHMM,
    alumnosLlegaron: alumnos,
    inscritos: clase.inscritos || 0,
    fueraDeHorario: false,
    retroactivo: fecha !== ahora.fecha,
    estado: 'aprobada',
    origen: 'kiosko',
    tipo,
    marcadoEn: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    claseId: clase.id,
    nombreAsignatura: clase.nombreAsignatura || '',
    fecha,
    alumnosLlegaron: alumnos,
    tipo,
  };
});
