import { db } from '../lib/firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  serverTimestamp,
  writeBatch,
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

export async function copiarEventoALab(evento, nuevoLabId) {
  const colRef = collection(db, COLECCIONES.CLASES_REGULARES);
  const { id: _id, ...datos } = evento;
  const ts = serverTimestamp();
  const docRef = await addDoc(colRef, {
    ...datos,
    labId: nuevoLabId,
    creadoEn: ts,
    actualizadoEn: ts,
  });
  return { id: docRef.id, ...datos, labId: nuevoLabId };
}

// Estandariza fechaInicio/fechaFin de las clases regulares activas de un
// ciclo. Solo aplica a tipo 'regular': en 'puntual'/'reunion'/'defensa'
// fechaInicio tiene otro significado (fecha exacta de la ocurrencia), no un
// límite de recurrencia semanal, y no deben tocarse aquí.
export async function actualizarFechasRegulares(cicloId, fechaInicio, fechaFin) {
  const colRef = collection(db, COLECCIONES.CLASES_REGULARES);
  const q = query(
    colRef,
    where('cicloId', '==', cicloId),
    where('tipo', '==', TIPOS_CLASE.REGULAR),
    where('activo', '==', true)
  );
  const snap = await getDocs(q);
  const ts = serverTimestamp();
  const CHUNK = 499;
  const docs = snap.docs;

  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    docs.slice(i, i + CHUNK).forEach(d => {
      batch.update(d.ref, { fechaInicio, fechaFin, actualizadoEn: ts });
    });
    await batch.commit();
  }

  return { actualizadas: docs.length };
}

export async function obtenerLaboratorios() {
  const snap = await getDocs(
    query(collection(db, COLECCIONES.LABORATORIOS), orderBy('nombre'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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

export async function obtenerClasesDelCiclo(cicloId, soloActivas = false) {
  const ref = collection(db, COLECCIONES.CLASES_REGULARES);
  const constraints = [where('cicloId', '==', cicloId)];
  if (soloActivas) constraints.push(where('activo', '==', true));
  const snap = await getDocs(query(ref, ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function importarClases(cicloId, clases) {
  const colRef = collection(db, COLECCIONES.CLASES_REGULARES);
  const CHUNK = 499;
  const ts = serverTimestamp();

  // Cargar todas las clases existentes del ciclo
  const q = query(colRef, where('cicloId', '==', cicloId));
  const snap = await getDocs(q);

  // Mapa de clave de identidad → doc existente
  // Clave: labId|codigoAsignatura|seccion — identifica una sección específica en un lab
  const existingMap = new Map();
  snap.docs.forEach(d => {
    const data = d.data();
    const key = `${data.labId}|${data.codigoAsignatura}|${data.seccion}`;
    existingMap.set(key, { id: d.id, ref: d.ref, data });
  });

  const toUpdate = [];   // clases del Excel que ya existían → merge
  const toCreate = [];   // clases del Excel nuevas → insert
  const matchedKeys = new Set();

  for (const clase of clases) {
    const key = `${clase.labId}|${clase.codigoAsignatura}|${clase.seccion}`;
    if (existingMap.has(key)) {
      const prev = existingMap.get(key);
      matchedKeys.add(key);
      toUpdate.push({
        ref: prev.ref,
        payload: {
          ...clase,
          // Preservar campos editados manualmente en la UI
          color: prev.data.color ?? null,
          observaciones: prev.data.observaciones || clase.observaciones || '',
          activo: true,
          actualizadoEn: ts,
        },
      });
    } else {
      toCreate.push(clase);
    }
  }

  // Clases que ya no están en el Excel → desactivar (no eliminar)
  const toDeactivate = snap.docs
    .filter(d => {
      const data = d.data();
      const key = `${data.labId}|${data.codigoAsignatura}|${data.seccion}`;
      return !matchedKeys.has(key);
    })
    .map(d => d.ref);

  // Ejecutar actualizaciones
  for (let i = 0; i < toUpdate.length; i += CHUNK) {
    const batch = writeBatch(db);
    toUpdate.slice(i, i + CHUNK).forEach(({ ref, payload }) => batch.update(ref, payload));
    await batch.commit();
  }

  // Ejecutar creaciones
  for (let i = 0; i < toCreate.length; i += CHUNK) {
    const batch = writeBatch(db);
    toCreate.slice(i, i + CHUNK).forEach(clase => {
      const newRef = doc(colRef);
      batch.set(newRef, { ...clase, creadoEn: ts, actualizadoEn: ts });
    });
    await batch.commit();
  }

  // Desactivar clases que ya no aparecen en el Excel
  for (let i = 0; i < toDeactivate.length; i += CHUNK) {
    const batch = writeBatch(db);
    toDeactivate.slice(i, i + CHUNK).forEach(ref =>
      batch.update(ref, { activo: false, actualizadoEn: ts })
    );
    await batch.commit();
  }

  return {
    actualizadas: toUpdate.length,
    creadas: toCreate.length,
    desactivadas: toDeactivate.length,
  };
}

// ── Análisis y ejecución de importación con detección de conflictos ─────────

function horaAMinImport(hora) {
  const [h = 0, m = 0] = (hora || '00:00').split(':').map(Number);
  return h * 60 + m;
}

function hayConflictoImport(a, b) {
  if (a.labId !== b.labId) return false;
  const diasComunes = (a.diasSemana || []).filter(d => (b.diasSemana || []).includes(d));
  if (!diasComunes.length) return false;
  const [ai, af] = [horaAMinImport(a.horaInicio), horaAMinImport(a.horaFin)];
  const [bi, bf] = [horaAMinImport(b.horaInicio), horaAMinImport(b.horaFin)];
  return ai < bf && af > bi;
}

// Clasifica el Excel contra las clases existentes y detecta conflictos
// sin escribir nada en Firestore.
// Alcance: solo se desactivan clases de los labs que aparecen en el Excel.
// Labs no mencionados en el Excel quedan intactos (permite imports parciales acumulativos).
export async function analizarImport(cicloId, clases) {
  const colRef = collection(db, COLECCIONES.CLASES_REGULARES);
  const snap = await getDocs(query(colRef, where('cicloId', '==', cicloId)));

  const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const activos = todos.filter(c => c.activo !== false);
  const identityKey = c => `${c.labId}|${c.codigoAsignatura}|${c.seccion}`;

  const existingMap = new Map(todos.map(c => [identityKey(c), c]));
  const toUpdate = [];
  const toCreate = [];
  const matchedKeys = new Set();

  // Scope: labs presentes en el Excel → solo estos labs se sincronizan
  const labsEnImport = new Set(clases.map(c => c.labId));

  for (const clase of clases) {
    const key = identityKey(clase);
    const existing = existingMap.get(key);
    if (existing) {
      matchedKeys.add(key);
      toUpdate.push({ claseImportada: clase, claseExistente: existing });
    } else {
      toCreate.push(clase);
    }
  }

  // Solo desactivar clases que pertenecen a labs cubiertos por este import
  // y que ya no aparecen en él. Labs fuera del scope quedan intactos.
  const toDeactivate = todos.filter(c =>
    labsEnImport.has(c.labId) && !matchedKeys.has(identityKey(c))
  );

  // Cuántas clases en labs fuera del scope se preservan sin tocar
  const preservados = todos.filter(c => !labsEnImport.has(c.labId)).length;

  // Detectar conflictos: clases nuevas (toCreate) vs activas existentes
  const conflictos = [];
  for (const nueva of toCreate) {
    for (const existente of activos) {
      if (hayConflictoImport(nueva, existente)) {
        conflictos.push({ claseImportada: nueva, claseExistente: existente });
      }
    }
  }

  return { toUpdate, toCreate, toDeactivate, conflictos, labsEnImport, preservados };
}

// Ejecuta la importación con las listas ya resueltas (sin análisis previo)
export async function ejecutarImport(cicloId, { toUpdate, toCreate, toDeactivate }) {
  const colRef = collection(db, COLECCIONES.CLASES_REGULARES);
  const CHUNK = 499;
  const ts = serverTimestamp();

  for (let i = 0; i < toUpdate.length; i += CHUNK) {
    const batch = writeBatch(db);
    toUpdate.slice(i, i + CHUNK).forEach(({ claseImportada, claseExistente }) => {
      batch.update(doc(colRef, claseExistente.id), {
        ...claseImportada,
        color: claseExistente.color ?? null,
        observaciones: claseExistente.observaciones || claseImportada.observaciones || '',
        activo: true,
        actualizadoEn: ts,
      });
    });
    await batch.commit();
  }

  for (let i = 0; i < toCreate.length; i += CHUNK) {
    const batch = writeBatch(db);
    toCreate.slice(i, i + CHUNK).forEach(clase => {
      const newRef = doc(colRef);
      batch.set(newRef, { ...clase, creadoEn: ts, actualizadoEn: ts });
    });
    await batch.commit();
  }

  for (let i = 0; i < toDeactivate.length; i += CHUNK) {
    const batch = writeBatch(db);
    toDeactivate.slice(i, i + CHUNK).forEach(clase => {
      batch.update(doc(colRef, clase.id), { activo: false, actualizadoEn: ts });
    });
    await batch.commit();
  }

  return {
    actualizadas: toUpdate.length,
    creadas: toCreate.length,
    desactivadas: toDeactivate.length,
  };
}

// ── Historial de carga ──────────────────────────────────────────────────────

const COL_HISTORIAL = 'historialCarga';

function compactarClase(clase) {
  return {
    labId: clase.labId,
    cicloId: clase.cicloId,
    tipo: clase.tipo,
    codigoAsignatura: clase.codigoAsignatura,
    nombreAsignatura: clase.nombreAsignatura,
    seccion: clase.seccion,
    docente: clase.docente,
    diasSemana: clase.diasSemana,
    horaInicio: clase.horaInicio,
    horaFin: clase.horaFin,
    modulos: clase.modulos || [],
    inscritos: clase.inscritos || 0,
    fechaInicio: clase.fechaInicio || null,
    fechaFin: clase.fechaFin || null,
    activo: clase.activo ?? true,
    color: clase.color || null,
    observaciones: clase.observaciones || '',
  };
}

export async function guardarSnapshotCarga(cicloId, cicloNombre, usuario) {
  const colRef = collection(db, COLECCIONES.CLASES_REGULARES);
  const snap = await getDocs(query(colRef, where('cicloId', '==', cicloId)));
  if (snap.empty) return null;

  const clases = snap.docs.map(d => compactarClase({ id: d.id, ...d.data() }));
  const histRef = collection(db, COL_HISTORIAL);
  const docRef = await addDoc(histRef, {
    cicloId,
    cicloNombre,
    creadoEn: serverTimestamp(),
    usuario: {
      uid: usuario?.uid || 'sistema',
      nombre: usuario?.nombre || 'Sistema',
      rol: usuario?.rol || '',
    },
    totalClases: clases.length,
    clases,
  });
  return docRef.id;
}

export async function obtenerHistorialCarga(cicloId, limite = 10) {
  const q = query(
    collection(db, COL_HISTORIAL),
    where('cicloId', '==', cicloId),
    orderBy('creadoEn', 'desc'),
    limit(limite)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      cicloId: data.cicloId,
      cicloNombre: data.cicloNombre,
      creadoEn: data.creadoEn,
      usuario: data.usuario,
      totalClases: data.totalClases,
      clases: data.clases,
    };
  });
}

export async function restaurarSnapshot(snapshotId, cicloId, cicloNombre, usuario) {
  const snapDoc = await getDoc(doc(db, COL_HISTORIAL, snapshotId));
  if (!snapDoc.exists()) throw new Error('Versión no encontrada');

  const { clases } = snapDoc.data();

  // Guarda el estado actual antes de pisar
  await guardarSnapshotCarga(cicloId, cicloNombre, usuario);

  const colRef = collection(db, COLECCIONES.CLASES_REGULARES);
  const CHUNK = 499;
  const ts = serverTimestamp();

  // Eliminar clases actuales del ciclo
  const currentSnap = await getDocs(query(colRef, where('cicloId', '==', cicloId)));
  for (let i = 0; i < currentSnap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    currentSnap.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  // Insertar las clases del snapshot
  for (let i = 0; i < clases.length; i += CHUNK) {
    const batch = writeBatch(db);
    clases.slice(i, i + CHUNK).forEach(clase => {
      const newRef = doc(colRef);
      batch.set(newRef, { ...clase, creadoEn: ts, actualizadoEn: ts });
    });
    await batch.commit();
  }

  return { restauradas: clases.length };
}

// ── Clases por mes ───────────────────────────────────────────────────────────

export async function obtenerClasesDelLabPorMes(labId, cicloId, anio, mes) {
  const todas = await obtenerClasesDelLab(labId, cicloId, true);

  const TIPOS_POR_FECHA = new Set([TIPOS_CLASE.PUNTUAL, TIPOS_CLASE.REUNION, TIPOS_CLASE.DEFENSA]);
  return todas.filter(c => {
    if (TIPOS_POR_FECHA.has(c.tipo)) {
      if (!c.fechaInicio) return false;
      const [y, m] = c.fechaInicio.split('-').map(Number);
      return y === anio && m === mes;
    }
    return true;
  });
}
