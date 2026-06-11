import { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, EMAIL_JEFA } from '../lib/firebase';
import { COLECCIONES, ROLES } from '../lib/constants';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          setUser(fbUser);
          const perfilData = await obtenerOCrearPerfil(fbUser);
          setPerfil(perfilData);
          setError(null);
        } else {
          setUser(null);
          setPerfil(null);
        }
      } catch (e) {
        console.error('Error en autenticación:', e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  async function obtenerOCrearPerfil(fbUser) {
    const ref = doc(db, COLECCIONES.USUARIOS, fbUser.uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const datos = snap.data();
      try {
        await updateDoc(ref, { ultimoAcceso: serverTimestamp() });
      } catch (e) {
        console.warn('No se pudo actualizar último acceso:', e);
      }
      return { id: snap.id, ...datos };
    }

    const rolInicial = (EMAIL_JEFA && fbUser.email?.toLowerCase() === EMAIL_JEFA.toLowerCase())
      ? ROLES.JEFA
      : ROLES.DOCENTE;

    const nuevoPerfil = {
      uid: fbUser.uid,
      email: fbUser.email,
      nombre: fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuario',
      foto: fbUser.photoURL || null,
      rol: rolInicial,
      departamento: '',
      activo: true,
      proveedor: fbUser.providerData?.[0]?.providerId || 'password',
      creadoEn: serverTimestamp(),
      ultimoAcceso: serverTimestamp(),
    };

    await setDoc(ref, nuevoPerfil);
    return { id: fbUser.uid, ...nuevoPerfil };
  }

  async function signInGoogle() {
    try {
      setError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error('Error de login Google:', e);
      if (e.code === 'auth/popup-closed-by-user') {
        setError('Se cerró la ventana de inicio de sesión.');
      } else if (e.code === 'auth/popup-blocked') {
        setError('El navegador bloqueó el popup. Permite popups e intenta de nuevo.');
      } else {
        setError('No se pudo iniciar sesión con Google. Intenta de nuevo.');
      }
      throw e;
    }
  }

  async function signInEmail(email, password) {
    try {
      setError(null);
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      console.error('Error login email:', e);
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found') {
        setError('Correo o contraseña incorrectos.');
      } else if (e.code === 'auth/invalid-email') {
        setError('El correo no tiene formato válido.');
      } else if (e.code === 'auth/user-disabled') {
        setError('Esta cuenta está deshabilitada.');
      } else if (e.code === 'auth/too-many-requests') {
        setError('Demasiados intentos. Espera unos minutos e intenta de nuevo.');
      } else {
        setError('Error al iniciar sesión.');
      }
      throw e;
    }
  }

  async function registrarConEmail(email, password, nombre) {
    try {
      setError(null);
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);

      if (nombre) {
        try {
          await updateProfile(result.user, { displayName: nombre });
        } catch {}
      }

      const ref = doc(db, COLECCIONES.USUARIOS, result.user.uid);
      const rolInicial = (EMAIL_JEFA && email.toLowerCase() === EMAIL_JEFA.toLowerCase())
        ? ROLES.JEFA
        : ROLES.DOCENTE;

      const nuevoPerfil = {
        uid: result.user.uid,
        email: email.trim(),
        nombre: nombre || email.split('@')[0],
        foto: null,
        rol: rolInicial,
        departamento: '',
        activo: true,
        proveedor: 'password',
        creadoEn: serverTimestamp(),
        ultimoAcceso: serverTimestamp(),
      };

      await setDoc(ref, nuevoPerfil);
      // Setear perfil directo para no depender de que onAuthStateChanged lo re-lea
      setPerfil({ id: result.user.uid, ...nuevoPerfil });

      return result.user;
    } catch (e) {
      console.error('Error registro:', e);
      if (e.code === 'auth/email-already-in-use') {
        setError('Ya existe una cuenta con ese correo.');
      } else if (e.code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres.');
      } else if (e.code === 'auth/invalid-email') {
        setError('El correo no tiene formato válido.');
      } else {
        setError('Error al crear la cuenta.');
      }
      throw e;
    }
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  const tieneRol = (rolesPermitidos) => {
    if (!perfil) return false;
    const lista = Array.isArray(rolesPermitidos) ? rolesPermitidos : [rolesPermitidos];
    return lista.includes(perfil.rol);
  };

  const esAdmin = () => tieneRol([ROLES.ENCARGADO, ROLES.JEFA]);
  const esJefa = () => tieneRol(ROLES.JEFA);
  const esEncargado = () => tieneRol(ROLES.ENCARGADO);
  const esDocente = () => tieneRol(ROLES.DOCENTE);

  return (
    <AuthContext.Provider value={{
      user,
      perfil,
      loading,
      error,
      signIn: signInGoogle,
      signInGoogle,
      signInEmail,
      registrarConEmail,
      signOut,
      tieneRol,
      esAdmin,
      esJefa,
      esEncargado,
      esDocente,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
