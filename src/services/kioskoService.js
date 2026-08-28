import { db, functions } from '../lib/firebase';
import { collection, doc, setDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

const COLECCION = 'kioskos';

function generarToken() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, 16);
}

// Uso admin (autenticado) — lee el token vigente de un lab, si existe.
export async function obtenerTokenKiosko(labId) {
  const ref = collection(db, COLECCION);
  const snap = await getDocs(query(ref, where('labId', '==', labId)));
  if (snap.empty) return null;
  return { token: snap.docs[0].id, ...snap.docs[0].data() };
}

// Borra los tokens previos de ese lab (invalida el enlace viejo) y crea uno
// nuevo — un lab tiene un solo enlace de kiosko vigente a la vez.
export async function generarTokenKiosko(labId, adminUid) {
  const ref = collection(db, COLECCION);
  const existentes = await getDocs(query(ref, where('labId', '==', labId)));
  await Promise.all(existentes.docs.map(d => deleteDoc(d.ref)));

  const token = generarToken();
  await setDoc(doc(db, COLECCION, token), {
    labId,
    creadoPor: adminUid || null,
    creadoEn: new Date().toISOString(),
  });
  return token;
}

// ── Página pública del kiosko (sin sesión) — vía Cloud Functions ───────────

export async function obtenerAgendaKiosko(token) {
  const fn = httpsCallable(functions, 'obtenerAgendaKiosko');
  const res = await fn({ token });
  return res.data;
}

export async function registrarAsistenciaKiosko({ token, claseId, fecha, alumnosLlegaron, tipo }) {
  const fn = httpsCallable(functions, 'registrarAsistenciaKiosko');
  const res = await fn({ token, claseId, fecha, alumnosLlegaron, tipo });
  return res.data;
}
