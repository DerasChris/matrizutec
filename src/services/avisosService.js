import { db } from '../lib/firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { COLECCIONES } from '../lib/constants';

export async function obtenerAvisosActivos() {
  const ref = collection(db, COLECCIONES.AVISOS);
  const snap = await getDocs(query(ref, where('activo', '==', true), orderBy('creadoEn', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function obtenerTodosLosAvisos() {
  const ref = collection(db, COLECCIONES.AVISOS);
  const snap = await getDocs(query(ref, orderBy('creadoEn', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function crearAviso({ titulo, mensaje, urgente = true }, autor) {
  const ref = collection(db, COLECCIONES.AVISOS);
  await addDoc(ref, {
    titulo,
    mensaje,
    urgente,
    activo: true,
    creadoPor: autor?.uid || null,
    creadoPorNombre: autor?.nombre || null,
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  });
}

export async function actualizarAviso(id, { titulo, mensaje, urgente, activo }) {
  await updateDoc(doc(db, COLECCIONES.AVISOS, id), {
    titulo,
    mensaje,
    urgente,
    activo,
    actualizadoEn: serverTimestamp(),
  });
}

export async function eliminarAviso(id) {
  await deleteDoc(doc(db, COLECCIONES.AVISOS, id));
}
