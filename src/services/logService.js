import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

const COLECCION = 'actividadLog';

/**
 * Registra una acción en el log de auditoría.
 * Falla silenciosamente para no interrumpir el flujo principal.
 */
export async function registrarActividad({ tipo, descripcion, usuario, entidad = null }) {
  try {
    await addDoc(collection(db, COLECCION), {
      tipo,
      descripcion,
      usuario: {
        uid:    usuario?.uid    || 'sistema',
        nombre: usuario?.nombre || 'Sistema',
        rol:    usuario?.rol    || '',
      },
      entidad,
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    console.warn('[log]', e.message);
  }
}

export async function obtenerActividadReciente(limite = 200) {
  const q = query(
    collection(db, COLECCION),
    orderBy('timestamp', 'desc'),
    limit(limite)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
