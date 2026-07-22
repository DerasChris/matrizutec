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

// Paso 1: valida el PIN, sin escribir nada. Devuelve TODAS las clases del
// docente en ese laboratorio para que elija cuál marcar — nunca bloquea por
// horario, solo indica cuál está "en horario ahora" para orientar la
// elección cuando hay varias.
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
  const clases = await obtenerClasesDelDocenteEnLab(admin.firestore(), {
    docenteNombre: docente.nombre,
    labId,
    cicloId: ciclo.id,
  });

  if (clases.length === 0) {
    throw new functions.https.HttpsError(
      'not-found',
      'No tienes clases asignadas en este laboratorio.'
    );
  }

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

  return { docente: docente.nombre, clases: clasesConEstado };
});

// Paso 2: re-valida PIN + pertenencia de la clase de forma independiente
// (nunca confía en claseId del cliente sin re-verificar que sea una clase
// real de ese docente en ese lab) y crea o corrige el registro del día.
// Siempre permite marcar; solo etiqueta fueraDeHorario si corresponde.
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
  const fueraDeHorario = esFueraDeHorario(clase, ahora);

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
    fueraDeHorario,
    marcadoEn: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    nombreAsignatura: clase.nombreAsignatura || '',
    horaInicio: clase.horaInicio,
    horaFin: clase.horaFin,
    alumnosLlegaron: alumnos,
    fueraDeHorario,
  };
});
