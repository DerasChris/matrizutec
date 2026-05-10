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
  serverTimestamp,
} from 'firebase/firestore';
import { COLECCIONES, TIPOS_CLASE } from '../lib/constants';

export async function crearClase(datos) {
  const ref = collection(db, COLECCIONES.CLASES_REGULARES);
  const payload = {
    ...datos,
    activo: datos.activo ?? true,
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  };
  const docRef = await addDoc(ref, payload);
  return { id: docRef.id, ...payload };
}

export async function actualizarClase(id, datos) {
  const ref = doc(db, COLECCIONES.CLASES_REGULARES, id);
  await updateDoc(ref, {
    ...datos,
    actualizadoEn: serverTimestamp(),
  });
  return { id, ...datos };
}

export async function desactivarClase(id) {
  const ref = doc(db, COLECCIONES.CLASES_REGULARES, id);
  await updateDoc(ref, {
    activo: false,
    actualizadoEn: serverTimestamp(),
  });
}

export async function eliminarClase(id) {
  const ref = doc(db, COLECCIONES.CLASES_REGULARES, id);
  await deleteDoc(ref);
}

export async function obtenerClase(id) {
  const ref = doc(db, COLECCIONES.CLASES_REGULARES, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function obtenerClasesDelLab(labId, cicloId, soloActivas = true) {
  const ref = collection(db, COLECCIONES.CLASES_REGULARES);
  let q;
  if (soloActivas) {
    q = query(ref,
      where('cicloId', '==', cicloId),
      where('labId', '==', labId),
      where('activo', '==', true)
    );
  } else {
    q = query(ref,
      where('cicloId', '==', cicloId),
      where('labId', '==', labId)
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function obtenerClasesDelLabPorMes(labId, cicloId, anio, mes) {
  const todas = await obtenerClasesDelLab(labId, cicloId, true);

  return todas.filter(c => {
    if (c.tipo === TIPOS_CLASE.PUNTUAL) {
      if (!c.fechaInicio) return false;
      const [y, m] = c.fechaInicio.split('-').map(Number);
      return y === anio && m === mes;
    }
    return true;
  });
}
