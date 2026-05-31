import { db } from '../lib/firebase';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { COLECCIONES } from '../lib/constants';

export async function obtenerTodosLosCiclos() {
  const ref = collection(db, COLECCIONES.CICLOS);
  const snap = await getDocs(ref);
  const ciclos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return ciclos.sort((a, b) => {
    if (b.anio !== a.anio) return b.anio - a.anio;
    return a.numero - b.numero;
  });
}

export async function obtenerCiclo(cicloId) {
  const ref = doc(db, COLECCIONES.CICLOS, cicloId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function crearCiclo({ anio, numero, nombre, fechaInicio, fechaFin }) {
  const codigo = String(numero).padStart(2, '0');
  const id = `ciclo_${codigo}_${anio}`;

  const ref = doc(db, COLECCIONES.CICLOS, id);
  const snap = await getDoc(ref);
  if (snap.exists()) throw new Error(`Ya existe un ciclo con el ID "${id}".`);

  await setDoc(ref, {
    id,
    anio,
    numero,
    nombre,
    fechaInicio,
    fechaFin,
    activo: false,
    creadoEn: serverTimestamp(),
  });

  return { id, anio, numero, nombre, fechaInicio, fechaFin, activo: false };
}

export async function activarCiclo(cicloId) {
  const batch = writeBatch(db);

  const q = query(collection(db, COLECCIONES.CICLOS), where('activo', '==', true));
  const snap = await getDocs(q);
  snap.docs.forEach(d => {
    if (d.id !== cicloId) batch.update(d.ref, { activo: false });
  });

  batch.update(doc(db, COLECCIONES.CICLOS, cicloId), { activo: true });

  await batch.commit();
}

export async function contarClasesPorCiclo(cicloId) {
  const ref = collection(db, COLECCIONES.CLASES_REGULARES);
  const q = query(ref, where('cicloId', '==', cicloId), where('activo', '==', true));
  const snap = await getDocs(q);
  return snap.size;
}
