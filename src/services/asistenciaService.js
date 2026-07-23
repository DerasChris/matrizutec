import { db, functions } from '../lib/firebase';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { COLECCIONES } from '../lib/constants';

// ── PINs de docentes (colección `docentes`) ─────────────────────────────────

export async function obtenerDocentes() {
  const ref = collection(db, COLECCIONES.DOCENTES);
  const snap = await getDocs(query(ref, orderBy('nombre')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Genera un PIN de 4 dígitos que no esté en uso por otro docente activo.
export function generarPinUnico(docentesExistentes, excluirId = null) {
  const enUso = new Set(
    docentesExistentes
      .filter(d => d.activo !== false && d.id !== excluirId)
      .map(d => d.pin)
  );
  let intento;
  let vueltas = 0;
  do {
    intento = String(Math.floor(1000 + Math.random() * 9000));
    vueltas++;
  } while (enUso.has(intento) && vueltas < 200);
  return intento;
}

// Crea o actualiza el PIN de un docente. `nombre` debe coincidir exactamente
// con el string usado en clasesRegulares.docente para que la Cloud Function
// pueda encontrar sus clases activas.
export async function guardarPinDocente({ id, nombre, pin }) {
  if (id) {
    await updateDoc(doc(db, COLECCIONES.DOCENTES, id), {
      nombre,
      pin,
      actualizadoEn: serverTimestamp(),
    });
    return id;
  }
  const ref = doc(collection(db, COLECCIONES.DOCENTES));
  await setDoc(ref, {
    nombre,
    pin,
    activo: true,
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  });
  return ref.id;
}

export async function desactivarDocente(id) {
  await updateDoc(doc(db, COLECCIONES.DOCENTES, id), {
    activo: false,
    actualizadoEn: serverTimestamp(),
  });
}

// ── Escaneo (Cloud Functions) ────────────────────────────────────────────────

export async function buscarClaseParaAsistencia({ labId, pin }) {
  const fn = httpsCallable(functions, 'buscarClaseParaAsistencia');
  const res = await fn({ labId, pin });
  return res.data;
}

export async function registrarAsistencia({ labId, pin, claseId, alumnosLlegaron, fechaRetroactiva = null }) {
  const fn = httpsCallable(functions, 'registrarAsistencia');
  const res = await fn({ labId, pin, claseId, alumnosLlegaron, fechaRetroactiva });
  return res.data;
}

// ── Reportes (colección `asistencias`) ───────────────────────────────────────
// Incluye docs en cualquier estado (aprobada/pendiente/rechazada/legado sin
// campo) — quien consume esto decide cómo filtrar por estado.

export async function obtenerAsistenciasDelCiclo(cicloId) {
  const ref = collection(db, COLECCIONES.ASISTENCIAS);
  const snap = await getDocs(query(ref, where('cicloId', '==', cicloId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Aprobación de marcados retroactivos ──────────────────────────────────────
// Escritura directa de cliente (la jefa sí tiene sesión de Firebase Auth) —
// firestore.rules solo permite este update si el rol es jefa y el doc sigue
// 'pendiente'. Mismo patrón que aprobarReserva/rechazarReserva.

export async function aprobarAsistenciaPendiente(id, jefaUid, jefaNombre, nota = '') {
  const ref = doc(db, COLECCIONES.ASISTENCIAS, id);
  await updateDoc(ref, {
    estado: 'aprobada',
    aprobadaPor: jefaUid,
    aprobadaPorNombre: jefaNombre,
    aprobadaEn: serverTimestamp(),
    notaJefa: nota,
    actualizadaEn: serverTimestamp(),
  });
}

export async function rechazarAsistenciaPendiente(id, jefaUid, jefaNombre, motivo = '') {
  const ref = doc(db, COLECCIONES.ASISTENCIAS, id);
  await updateDoc(ref, {
    estado: 'rechazada',
    rechazadaPor: jefaUid,
    rechazadaPorNombre: jefaNombre,
    rechazadaEn: serverTimestamp(),
    motivoRechazo: motivo,
    actualizadaEn: serverTimestamp(),
  });
}
