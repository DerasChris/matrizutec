import { db } from '../lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { COLECCIONES, LABS_INICIALES } from '../lib/constants';

export async function sembrarLaboratorios() {
  const resultados = { creados: 0, actualizados: 0, errores: 0 };

  for (const lab of LABS_INICIALES) {
    try {
      const ref = doc(db, COLECCIONES.LABORATORIOS, lab.id);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const existente = snap.data();
        if (lab.numero === 3 && !existente.tieneModulos) {
          await setDoc(ref, {
            ...existente,
            tieneModulos: true,
            modulos: lab.modulos,
            capacidad: lab.capacidad,
            equipos: lab.equipos,
          }, { merge: true });
          resultados.actualizados++;
        }
        continue;
      }

      await setDoc(ref, {
        ...lab,
        creadoEn: serverTimestamp(),
      });
      resultados.creados++;
    } catch (e) {
      console.error(`Error creando ${lab.id}:`, e);
      resultados.errores++;
    }
  }

  return resultados;
}

export async function sembrarCicloActual() {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = ahora.getMonth() + 1;
  const cicloNum = mes <= 6 ? '01' : '02';
  const cicloId = `ciclo_${cicloNum}_${anio}`;

  const ref = doc(db, COLECCIONES.CICLOS, cicloId);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return { id: cicloId, creado: false };
  }

  const inicio = cicloNum === '01' ? new Date(anio, 0, 15) : new Date(anio, 6, 15);
  const fin = cicloNum === '01' ? new Date(anio, 5, 30) : new Date(anio, 10, 30);

  await setDoc(ref, {
    id: cicloId,
    anio,
    numero: parseInt(cicloNum),
    nombre: `Ciclo ${cicloNum}-${anio}`,
    fechaInicio: inicio.toISOString().split('T')[0],
    fechaFin: fin.toISOString().split('T')[0],
    activo: true,
    creadoEn: serverTimestamp(),
  });

  return { id: cicloId, creado: true };
}
