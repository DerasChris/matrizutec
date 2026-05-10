import { db, getSecondaryAuth } from '../lib/firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut as authSignOut, updateProfile } from 'firebase/auth';
import { COLECCIONES, ROLES } from '../lib/constants';

export async function obtenerTodosUsuarios() {
  const ref = collection(db, COLECCIONES.USUARIOS);
  const snap = await getDocs(ref);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
}

export async function obtenerUsuario(uid) {
  const ref = doc(db, COLECCIONES.USUARIOS, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function actualizarRol(uid, nuevoRol) {
  if (!Object.values(ROLES).includes(nuevoRol)) {
    throw new Error('Rol inválido');
  }
  const ref = doc(db, COLECCIONES.USUARIOS, uid);
  await updateDoc(ref, {
    rol: nuevoRol,
    actualizadoEn: serverTimestamp(),
  });
}

export async function actualizarUsuario(uid, datos) {
  const ref = doc(db, COLECCIONES.USUARIOS, uid);
  await updateDoc(ref, {
    ...datos,
    actualizadoEn: serverTimestamp(),
  });
}

export async function activarUsuario(uid) {
  const ref = doc(db, COLECCIONES.USUARIOS, uid);
  await updateDoc(ref, {
    activo: true,
    actualizadoEn: serverTimestamp(),
  });
}

export async function desactivarUsuario(uid) {
  const ref = doc(db, COLECCIONES.USUARIOS, uid);
  await updateDoc(ref, {
    activo: false,
    actualizadoEn: serverTimestamp(),
  });
}

export async function eliminarUsuario(uid) {
  const ref = doc(db, COLECCIONES.USUARIOS, uid);
  await deleteDoc(ref);
}

export async function crearUsuarioDesdeAdmin({ nombre, email, password, rol = ROLES.DOCENTE, departamento = '' }) {
  const secondaryAuth = getSecondaryAuth();

  try {
    const result = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password);

    if (nombre) {
      try {
        await updateProfile(result.user, { displayName: nombre });
      } catch {}
    }

    const uid = result.user.uid;
    const ref = doc(db, COLECCIONES.USUARIOS, uid);
    await setDoc(ref, {
      uid,
      email: email.trim(),
      nombre: nombre.trim(),
      foto: null,
      rol,
      departamento,
      activo: true,
      proveedor: 'password',
      creadoEn: serverTimestamp(),
      ultimoAcceso: null,
      creadoPorAdmin: true,
    });

    await authSignOut(secondaryAuth);

    return { uid, email, nombre, rol };
  } catch (e) {
    try { await authSignOut(secondaryAuth); } catch {}
    throw e;
  }
}
