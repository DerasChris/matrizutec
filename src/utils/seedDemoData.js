import { db } from '../lib/firebase';
import { doc, setDoc, collection, getDocs, query, where, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { COLECCIONES } from '../lib/constants';

export async function sembrarClasesDemo(cicloId) {
  if (!cicloId) {
    throw new Error('Debes pasar el ID del ciclo activo');
  }

  const clasesDemo = [
    {
      cicloId,
      labId: 'lab_01',
      codigoAsignatura: 'BAS1',
      nombreAsignatura: 'Bases de Datos I',
      seccion: '02',
      inscritos: 80,
      docente: 'Edwin Melgar Fuentes',
      diasSemana: ['martes', 'jueves'],
      horaInicio: '06:30',
      horaFin: '08:00',
      aula: 'BJ-304',
      activo: true,
    },
    {
      cicloId,
      labId: 'lab_01',
      codigoAsignatura: 'PRG2',
      nombreAsignatura: 'Programación II',
      seccion: '01',
      inscritos: 42,
      docente: 'Carlos Mendoza',
      diasSemana: ['lunes', 'miercoles', 'viernes'],
      horaInicio: '08:00',
      horaFin: '10:00',
      aula: 'BJ-304',
      activo: true,
    },
    {
      cicloId,
      labId: 'lab_02',
      codigoAsignatura: 'RDS',
      nombreAsignatura: 'Redes y Comunicaciones',
      seccion: '03',
      inscritos: 35,
      docente: 'Ana Hernández',
      diasSemana: ['lunes', 'miercoles', 'viernes', 'martes', 'jueves'],
      horaInicio: '09:00',
      horaFin: '10:30',
      aula: 'BJ-305',
      activo: true,
    },
    {
      cicloId,
      labId: 'lab_03',
      codigoAsignatura: 'WEB',
      nombreAsignatura: 'Desarrollo Web',
      seccion: '01',
      inscritos: 30,
      docente: 'Christian Deras',
      diasSemana: ['martes', 'jueves'],
      horaInicio: '14:00',
      horaFin: '16:00',
      aula: 'BJ-306',
      activo: true,
    },
    {
      cicloId,
      labId: 'lab_03',
      codigoAsignatura: 'IA',
      nombreAsignatura: 'Inteligencia Artificial',
      seccion: '01',
      inscritos: 28,
      docente: 'Roberto Martínez',
      diasSemana: ['lunes', 'miercoles'],
      horaInicio: '17:00',
      horaFin: '19:00',
      aula: 'BJ-306',
      activo: true,
    },
    {
      cicloId,
      labId: 'lab_04',
      codigoAsignatura: 'DAT',
      nombreAsignatura: 'DAX y Analítica Aplicada',
      seccion: '01',
      inscritos: 25,
      docente: 'Luis Ramírez',
      diasSemana: ['sabado'],
      horaInicio: '08:00',
      horaFin: '12:00',
      aula: 'BJ-307',
      activo: true,
    },
    {
      cicloId,
      labId: 'lab_05',
      codigoAsignatura: 'EST',
      nombreAsignatura: 'Estructuras de Datos',
      seccion: '01',
      inscritos: 38,
      docente: 'María González',
      diasSemana: ['lunes', 'miercoles', 'viernes', 'martes', 'jueves'],
      horaInicio: '10:30',
      horaFin: '12:30',
      aula: 'BJ-308',
      activo: true,
    },
    {
      cicloId,
      labId: 'lab_06',
      codigoAsignatura: 'SIS',
      nombreAsignatura: 'Sistemas Operativos',
      seccion: '02',
      inscritos: 32,
      docente: 'Pedro Argueta',
      diasSemana: ['martes', 'jueves'],
      horaInicio: '13:00',
      horaFin: '15:00',
      aula: 'BJ-309',
      activo: true,
    },
  ];

  const resultados = { creadas: 0, errores: 0 };

  for (const clase of clasesDemo) {
    try {
      const id = `demo_${clase.labId}_${clase.codigoAsignatura}_${clase.seccion}_${clase.horaInicio.replace(':', '')}`;
      const ref = doc(db, COLECCIONES.CLASES_REGULARES, id);
      await setDoc(ref, {
        ...clase,
        id,
        creadoEn: serverTimestamp(),
        esDemo: true,
      });
      resultados.creadas++;
    } catch (e) {
      console.error('Error creando clase demo:', e);
      resultados.errores++;
    }
  }

  return resultados;
}

export async function eliminarClasesDemo() {
  const ref = collection(db, COLECCIONES.CLASES_REGULARES);
  const q = query(ref, where('esDemo', '==', true));
  const snap = await getDocs(q);

  let eliminadas = 0;
  for (const docu of snap.docs) {
    await deleteDoc(docu.ref);
    eliminadas++;
  }

  return { eliminadas };
}
