import { db } from '../lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
} from 'firebase/firestore';
import { COLECCIONES } from '../lib/constants';

export async function obtenerLaboratorios() {
  const ref = collection(db, COLECCIONES.LABORATORIOS);
  const q = query(ref, where('activo', '==', true));
  const snap = await getDocs(q);
  const labs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return labs.sort((a, b) => a.numero - b.numero);
}

export async function obtenerLaboratorio(labId) {
  const ref = doc(db, COLECCIONES.LABORATORIOS, labId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function obtenerCicloActivo() {
  const ref = collection(db, COLECCIONES.CICLOS);
  const q = query(ref, where('activo', '==', true));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function obtenerClasesDelLabHoy(labId, diaSemanaId, cicloId) {
  if (!labId || !diaSemanaId || !cicloId) return [];

  const ref = collection(db, COLECCIONES.CLASES_REGULARES);
  const q = query(
    ref,
    where('cicloId', '==', cicloId),
    where('labId', '==', labId),
    where('activo', '==', true)
  );
  const snap = await getDocs(q);

  const clases = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(c => Array.isArray(c.diasSemana) && c.diasSemana.includes(diaSemanaId));

  return clases.sort((a, b) => {
    const [ha, ma] = (a.horaInicio || '00:00').split(':').map(Number);
    const [hb, mb] = (b.horaInicio || '00:00').split(':').map(Number);
    return (ha * 60 + ma) - (hb * 60 + mb);
  });
}

export async function obtenerReservasAprobadasDelLabHoy(labId, fechaISO) {
  if (!labId || !fechaISO) return [];

  const ref = collection(db, COLECCIONES.RESERVAS);
  const q = query(
    ref,
    where('labId', '==', labId),
    where('estado', '==', 'aprobada')
  );
  const snap = await getDocs(q);

  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(r => {
      if (Array.isArray(r.ocurrencias)) {
        return r.ocurrencias.some(o => o.fecha === fechaISO && o.estado === 'aprobada');
      }
      return r.fechaInicio === fechaISO;
    });
}

// Igual que obtenerClasesDelLabHoy pero para todos los labs a la vez — usado
// por el Dashboard para mostrar la disponibilidad de todos los laboratorios
// de un vistazo, sin hacer una consulta por laboratorio.
export async function obtenerClasesDeHoyTodosLosLabs(cicloId, diaSemanaId) {
  if (!cicloId || !diaSemanaId) return [];

  const ref = collection(db, COLECCIONES.CLASES_REGULARES);
  const q = query(ref, where('cicloId', '==', cicloId), where('activo', '==', true));
  const snap = await getDocs(q);

  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(c => Array.isArray(c.diasSemana) && c.diasSemana.includes(diaSemanaId));
}

// Igual que obtenerReservasAprobadasDelLabHoy pero para todos los labs a la vez.
export async function obtenerReservasAprobadasDeHoyTodosLosLabs(fechaISO) {
  if (!fechaISO) return [];

  const ref = collection(db, COLECCIONES.RESERVAS);
  const q = query(ref, where('estado', '==', 'aprobada'));
  const snap = await getDocs(q);

  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(r => {
      if (Array.isArray(r.ocurrencias)) {
        return r.ocurrencias.some(o => o.fecha === fechaISO && o.estado === 'aprobada');
      }
      return r.fechaInicio === fechaISO;
    });
}
