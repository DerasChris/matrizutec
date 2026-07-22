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

// Clases del docente en ese lab, en este momento, dentro de la ventana
// [horaInicio, horaFin + 10min]. Devuelve la(s) que califican, ordenadas por
// cercanía a la hora fin (la más probable si hay más de una, caso raro).
async function buscarClasesActivas(db, { docenteNombre, labId, cicloId, ahora }) {
  const snap = await db.collection('clasesRegulares')
    .where('cicloId', '==', cicloId)
    .where('labId', '==', labId)
    .where('docente', '==', docenteNombre)
    .where('tipo', '==', 'regular')
    .where('activo', '==', true)
    .get();

  const minutosAhora = horaAMinutos(ahora.horaHHMM);
  const candidatas = [];

  snap.forEach((doc) => {
    const c = doc.data();
    if (!Array.isArray(c.diasSemana) || !c.diasSemana.includes(ahora.diaSemanaId)) return;
    if (c.fechaInicio && ahora.fecha < c.fechaInicio) return;
    if (c.fechaFin && ahora.fecha > c.fechaFin) return;

    const inicio = horaAMinutos(c.horaInicio);
    const finConGracia = horaAMinutos(c.horaFin) + GRACIA_MINUTOS;
    if (minutosAhora < inicio || minutosAhora > finConGracia) return;

    candidatas.push({
      id: doc.id,
      ...c,
      _distanciaFin: Math.abs(horaAMinutos(c.horaFin) - minutosAhora),
    });
  });

  candidatas.sort((a, b) => a._distanciaFin - b._distanciaFin);
  return candidatas;
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

// Paso 1: valida PIN + ventana horaria, sin escribir nada. Devuelve los
// datos de la clase para que el docente confirme antes de marcar.
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
  const candidatas = await buscarClasesActivas(admin.firestore(), {
    docenteNombre: docente.nombre,
    labId,
    cicloId: ciclo.id,
    ahora,
  });

  if (candidatas.length === 0) {
    throw new functions.https.HttpsError(
      'not-found',
      'No tienes clase activa en este laboratorio en este momento.'
    );
  }

  const clase = candidatas[0];
  const asistenciaRef = admin.firestore().collection('asistencias').doc(`${clase.id}_${ahora.fecha}`);
  const existente = await asistenciaRef.get();

  return {
    claseId: clase.id,
    docente: docente.nombre,
    codigoAsignatura: clase.codigoAsignatura || '',
    nombreAsignatura: clase.nombreAsignatura || '',
    seccion: clase.seccion || '',
    horaInicio: clase.horaInicio,
    horaFin: clase.horaFin,
    inscritos: clase.inscritos || 0,
    yaMarcada: existente.exists,
    alumnosPrevios: existente.exists ? existente.data().alumnosLlegaron : null,
  };
});

// Paso 2: re-valida todo de forma independiente (nunca confía en claseId
// del cliente sin re-verificar que siga siendo válido para ese PIN/momento)
// y crea o corrige el registro de asistencia del día.
exports.registrarAsistencia = functions.https.onCall(async (data) => {
  const labId = data?.labId;
  const pin = data?.pin;
  const claseId = data?.claseId;
  const alumnos = Number(data?.alumnosLlegaron);

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

  const ahora = ahoraElSalvador();
  const candidatas = await buscarClasesActivas(admin.firestore(), {
    docenteNombre: docente.nombre,
    labId,
    cicloId: ciclo.id,
    ahora,
  });

  const clase = candidatas.find((c) => c.id === claseId);
  if (!clase) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Esa clase ya no está activa para marcar asistencia.'
    );
  }

  await admin.firestore().collection('asistencias').doc(`${clase.id}_${ahora.fecha}`).set({
    claseId: clase.id,
    cicloId: ciclo.id,
    labId,
    codigoAsignatura: clase.codigoAsignatura || '',
    nombreAsignatura: clase.nombreAsignatura || '',
    seccion: clase.seccion || '',
    docente: docente.nombre,
    diaSemana: ahora.diaSemanaId,
    fecha: ahora.fecha,
    horaInicio: clase.horaInicio,
    horaFin: clase.horaFin,
    horaMarcado: ahora.horaHHMM,
    alumnosLlegaron: alumnos,
    inscritos: clase.inscritos || 0,
    marcadoEn: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    nombreAsignatura: clase.nombreAsignatura || '',
    horaInicio: clase.horaInicio,
    horaFin: clase.horaFin,
    alumnosLlegaron: alumnos,
  };
});
