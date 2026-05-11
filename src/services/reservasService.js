import { db } from '../lib/firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  getDoc,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { COLECCIONES, ESTADOS_RESERVA } from '../lib/constants';
import { fechaActualISO } from '../utils/dateHelpers';

export async function crearReserva(datos) {
  const ref = collection(db, COLECCIONES.RESERVAS);
  const payload = {
    ...datos,
    estado: ESTADOS_RESERVA.PENDIENTE,
    creadaEn: serverTimestamp(),
    actualizadaEn: serverTimestamp(),
  };
  const docRef = await addDoc(ref, payload);
  return { id: docRef.id, ...payload };
}

export async function actualizarReserva(id, datos) {
  const ref = doc(db, COLECCIONES.RESERVAS, id);
  await updateDoc(ref, {
    ...datos,
    actualizadaEn: serverTimestamp(),
  });
  return { id, ...datos };
}

export async function modificarReservaAprobada(id, datos, adminUid, adminNombre) {
  const ref = doc(db, COLECCIONES.RESERVAS, id);
  await updateDoc(ref, {
    ...datos,
    modificadaPor: adminUid,
    modificadaPorNombre: adminNombre,
    modificadaEn: serverTimestamp(),
    actualizadaEn: serverTimestamp(),
  });
}

export async function aprobarReserva(id, jefaUid, jefaNombre, nota = '') {
  const ref = doc(db, COLECCIONES.RESERVAS, id);
  await updateDoc(ref, {
    estado: ESTADOS_RESERVA.APROBADA,
    aprobadaPor: jefaUid,
    aprobadaPorNombre: jefaNombre,
    aprobadaEn: serverTimestamp(),
    notaJefa: nota,
    actualizadaEn: serverTimestamp(),
  });
}

export async function rechazarReserva(id, jefaUid, jefaNombre, motivo = '') {
  const ref = doc(db, COLECCIONES.RESERVAS, id);
  await updateDoc(ref, {
    estado: ESTADOS_RESERVA.RECHAZADA,
    rechazadaPor: jefaUid,
    rechazadaPorNombre: jefaNombre,
    rechazadaEn: serverTimestamp(),
    motivoRechazo: motivo,
    actualizadaEn: serverTimestamp(),
  });
}

export async function cancelarReserva(id) {
  const ref = doc(db, COLECCIONES.RESERVAS, id);
  await updateDoc(ref, {
    estado: ESTADOS_RESERVA.CANCELADA,
    canceladaEn: serverTimestamp(),
    actualizadaEn: serverTimestamp(),
  });
}

export async function eliminarReserva(id) {
  const ref = doc(db, COLECCIONES.RESERVAS, id);
  await deleteDoc(ref);
}

export async function obtenerReserva(id) {
  const ref = doc(db, COLECCIONES.RESERVAS, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function obtenerMisReservas(docenteUid, soloFuturas = true) {
  const ref = collection(db, COLECCIONES.RESERVAS);
  const q = query(ref, where('docenteId', '==', docenteUid));
  const snap = await getDocs(q);
  let reservas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (soloFuturas) {
    const hoy = fechaActualISO();
    reservas = reservas.filter(r => {
      if (Array.isArray(r.ocurrencias) && r.ocurrencias.length > 0) {
        return r.ocurrencias.some(f => f >= hoy);
      }
      return (r.fechaInicio || '') >= hoy;
    });
  }

  return reservas.sort((a, b) => {
    const fa = a.creadaEn?.toMillis?.() || 0;
    const fb = b.creadaEn?.toMillis?.() || 0;
    return fb - fa;
  });
}

export async function obtenerReservasPendientes() {
  const ref = collection(db, COLECCIONES.RESERVAS);
  const q = query(ref, where('estado', '==', ESTADOS_RESERVA.PENDIENTE));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const fa = a.creadaEn?.toMillis?.() || 0;
      const fb = b.creadaEn?.toMillis?.() || 0;
      return fa - fb;
    });
}

export async function obtenerReservasProcesadasRecientes(limite = 20) {
  const ref = collection(db, COLECCIONES.RESERVAS);
  const q = query(ref, where('estado', 'in', [
    ESTADOS_RESERVA.APROBADA,
    ESTADOS_RESERVA.RECHAZADA,
    ESTADOS_RESERVA.CANCELADA,
  ]));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const fa = a.actualizadaEn?.toMillis?.() || 0;
      const fb = b.actualizadaEn?.toMillis?.() || 0;
      return fb - fa;
    })
    .slice(0, limite);
}

export async function obtenerReservasAprobadasFuturas() {
  const ref = collection(db, COLECCIONES.RESERVAS);
  const q = query(ref, where('estado', '==', ESTADOS_RESERVA.APROBADA));
  const snap = await getDocs(q);
  const hoy = fechaActualISO();

  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(r => Array.isArray(r.ocurrencias) && r.ocurrencias.some(f => f >= hoy));
}

export function suscribirseAReservasPendientes(callback) {
  const ref = collection(db, COLECCIONES.RESERVAS);
  const q = query(ref, where('estado', '==', ESTADOS_RESERVA.PENDIENTE));
  return onSnapshot(q, snap => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(items);
  });
}

export async function obtenerClasesRegularesParaValidacion(labId) {
  const ref = collection(db, COLECCIONES.CLASES_REGULARES);
  const q = query(ref, where('labId', '==', labId), where('activo', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function calcularDiferencias(original, modificada) {
  const cambios = [];
  const campos = [
    { key: 'labNombre', label: 'Laboratorio' },
    { key: 'asignatura', label: 'Asignatura' },
    { key: 'motivo', label: 'Motivo' },
    { key: 'horaInicio', label: 'Hora inicio' },
    { key: 'horaFin', label: 'Hora fin' },
    { key: 'docenteNombre', label: 'Docente' },
    { key: 'docenteEmail', label: 'Email docente' },
  ];

  for (const { key, label } of campos) {
    const a = original?.[key];
    const b = modificada?.[key];
    if ((a || '') !== (b || '')) {
      cambios.push({ campo: label, antes: a || '(vacío)', despues: b || '(vacío)' });
    }
  }

  const modA = JSON.stringify((original?.modulos || []).slice().sort());
  const modB = JSON.stringify((modificada?.modulos || []).slice().sort());
  if (modA !== modB) {
    cambios.push({
      campo: 'Módulos',
      antes: (original?.modulos || []).join(', ').toUpperCase() || '(lab completo)',
      despues: (modificada?.modulos || []).join(', ').toUpperCase() || '(lab completo)',
    });
  }

  const ocA = JSON.stringify((original?.ocurrencias || []).slice().sort());
  const ocB = JSON.stringify((modificada?.ocurrencias || []).slice().sort());
  if (ocA !== ocB) {
    const oA = original?.ocurrencias || [];
    const oB = modificada?.ocurrencias || [];
    cambios.push({
      campo: 'Fechas',
      antes: `${oA.length} fecha(s)${oA.length > 0 ? ` (${oA[0]} a ${oA[oA.length - 1]})` : ''}`,
      despues: `${oB.length} fecha(s)${oB.length > 0 ? ` (${oB[0]} a ${oB[oB.length - 1]})` : ''}`,
    });
  }

  return cambios;
}
