import { db } from '../lib/firebase';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  orderBy,
  limit,
  writeBatch,
  arrayUnion,
} from 'firebase/firestore';
import { COLECCIONES, TIPOS_NOTIFICACION } from '../lib/constants';

// ── Alertas broadcast para administradores ─────────────────────────────────

const COL_ADMIN = 'adminAlerts';

export async function crearAlertaAdmin({ tipo, titulo, mensaje, refId = null, refTipo = null }) {
  try {
    await addDoc(collection(db, COL_ADMIN), {
      tipo,
      titulo,
      mensaje,
      refId,
      refTipo,
      leidaPor: [],
      creadaEn: serverTimestamp(),
    });
  } catch (e) {
    console.warn('[adminAlert]', e.message);
  }
}

export function suscribirseAAlertas(callback) {
  const q = query(
    collection(db, COL_ADMIN),
    orderBy('creadaEn', 'desc'),
    limit(30)
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function marcarAlertaLeida(alertaId, uid) {
  try {
    await updateDoc(doc(db, COL_ADMIN, alertaId), { leidaPor: arrayUnion(uid) });
  } catch (e) {
    console.warn('[adminAlert] marcar leída:', e.message);
  }
}

export async function marcarTodasAlertasLeidas(alertas, uid) {
  const pendientes = alertas.filter(a => !a.leidaPor?.includes(uid));
  if (!pendientes.length) return;
  const batch = writeBatch(db);
  pendientes.forEach(a =>
    batch.update(doc(db, COL_ADMIN, a.id), { leidaPor: arrayUnion(uid) })
  );
  await batch.commit();
}

export async function crearNotificacion({
  destinatarioId,
  destinatarioEmail = null,
  tipo,
  titulo,
  mensaje,
  refId = null,
  refTipo = null,
  enviarEmail = true,
}) {
  const ref = collection(db, COLECCIONES.NOTIFICACIONES);
  const docRef = await addDoc(ref, {
    destinatarioId,
    destinatarioEmail,
    tipo,
    titulo,
    mensaje,
    refId,
    refTipo,
    leida: false,
    creadaEn: serverTimestamp(),
  });

  if (enviarEmail && destinatarioEmail) {
    try {
      await encolarEmail({
        destinatarioEmail,
        titulo,
        mensaje,
        tipo,
      });
    } catch (e) {
      console.warn('No se pudo encolar email (extensión Trigger Email no instalada):', e.message);
    }
  }

  return docRef.id;
}

async function encolarEmail({ destinatarioEmail, titulo, mensaje, tipo }) {
  const ref = collection(db, COLECCIONES.MAIL_QUEUE);
  await addDoc(ref, {
    to: destinatarioEmail,
    message: {
      subject: `[LabTrack UTEC] ${titulo}`,
      html: emailHtml({ titulo, mensaje, tipo }),
      text: `${titulo}\n\n${mensaje}\n\n---\nLabTrack Horarios · UTEC FICA`,
    },
  });
}

function emailHtml({ titulo, mensaje, tipo }) {
  const colorPorTipo = {
    [TIPOS_NOTIFICACION.RESERVA_APROBADA]: '#16a34a',
    [TIPOS_NOTIFICACION.RESERVA_RECHAZADA]: '#dc2626',
    [TIPOS_NOTIFICACION.RESERVA_MODIFICADA]: '#0066cc',
    [TIPOS_NOTIFICACION.RESERVA_ELIMINADA]: '#dc2626',
    [TIPOS_NOTIFICACION.RESERVA_CREADA]: '#0066cc',
  };
  const color = colorPorTipo[tipo] || '#003366';

  return `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    <div style="background: ${color}; color: white; padding: 24px;">
      <p style="margin: 0; font-size: 12px; opacity: 0.9;">LabTrack UTEC FICA</p>
      <h1 style="margin: 8px 0 0; font-size: 22px;">${titulo}</h1>
    </div>
    <div style="padding: 24px;">
      <p style="margin: 0 0 16px; line-height: 1.6; color: #333;">${mensaje.replace(/\n/g, '<br>')}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="font-size: 12px; color: #999; margin: 0;">
        Este es un mensaje automático del sistema LabTrack Horarios.<br>
        Universidad Tecnológica de El Salvador · Facultad de Informática y Ciencias Aplicadas
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function obtenerMisNotificaciones(uid, limite = 20) {
  const ref = collection(db, COLECCIONES.NOTIFICACIONES);
  const q = query(
    ref,
    where('destinatarioId', '==', uid),
    orderBy('creadaEn', 'desc'),
    limit(limite)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function suscribirseANotificaciones(uid, callback) {
  const ref = collection(db, COLECCIONES.NOTIFICACIONES);
  const q = query(
    ref,
    where('destinatarioId', '==', uid),
    orderBy('creadaEn', 'desc'),
    limit(20)
  );
  return onSnapshot(q, snap => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(items);
  });
}

export async function marcarComoLeida(notifId) {
  const ref = doc(db, COLECCIONES.NOTIFICACIONES, notifId);
  await updateDoc(ref, { leida: true, leidaEn: serverTimestamp() });
}

export async function marcarTodasLeidas(uid) {
  const ref = collection(db, COLECCIONES.NOTIFICACIONES);
  const q = query(ref, where('destinatarioId', '==', uid), where('leida', '==', false));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { leida: true, leidaEn: serverTimestamp() }));
  await batch.commit();
}
