import { db, functions } from '../lib/firebase';
import { collection, doc, setDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

const COLECCION = 'kioskos';

// Uso admin (autenticado) — lee el token vigente de un lab, si existe.
export async function obtenerTokenKiosko(labId) {
  const ref = collection(db, COLECCION);
  const snap = await getDocs(query(ref, where('labId', '==', labId)));
  if (snap.empty) return null;
  return { token: snap.docs[0].id, ...snap.docs[0].data() };
}

// El "token" es simplemente el número del laboratorio (/lab/1, /lab/2...)
// — a pedido explícito, priorizando que sea fácil de comunicar/escribir en
// el momento sobre que sea difícil de adivinar. Borra los tokens previos de
// ese lab (por si tenía uno ofuscado de antes) y crea el nuevo con el
// número como id — un lab tiene un solo enlace de kiosko vigente a la vez.
export async function generarTokenKiosko(lab, adminUid) {
  const ref = collection(db, COLECCION);
  const existentes = await getDocs(query(ref, where('labId', '==', lab.id)));
  await Promise.all(existentes.docs.map(d => deleteDoc(d.ref)));

  const token = String(lab.numero);
  await setDoc(doc(db, COLECCION, token), {
    labId: lab.id,
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
