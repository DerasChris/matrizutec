import * as XLSX from 'xlsx';
import { LABS_INICIALES } from '../lib/constants';

const HEADERS = [
  'Lab',
  'Codigo_Asignatura',
  'Nombre_Asignatura',
  'Seccion',
  'Docente',
  'Dias_Semana',
  'Hora_Inicio',
  'Hora_Fin',
  'Modulos_Lab03',
  'Inscritos',
  'Tipo',
  'Fecha_Inicio_Puntual',
  'Fecha_Fin_Puntual',
];

const FILAS_EJEMPLO = [
  ['lab_01', 'ICC-101', 'Introducción a la Computación', '01', 'Juan Pérez', 'lunes,miercoles', '07:00', '09:00', '', 30, 'regular', '', ''],
  ['lab_03', 'PRG-201', 'Programación I', '02', 'María García', 'martes,jueves', '10:00', '12:00', 'm1,m2', 45, 'regular', '', ''],
  ['lab_05', 'BD-301', 'Bases de Datos', '01', 'Carlos López', 'viernes', '14:00', '16:00', '', 25, 'puntual', '2026-06-15', '2026-06-15'],
];

function construirHojaInstrucciones() {
  const labsRef = LABS_INICIALES.map(l => [l.id, l.nombre, '', '']);

  return [
    ['CAMPO', 'REQUERIDO', 'VALORES VÁLIDOS / FORMATO', 'NOTAS'],
    ['Lab', 'Sí', 'lab_01, lab_02, ..., lab_15', 'Número de laboratorio en formato lab_NN'],
    ['Codigo_Asignatura', 'Sí', 'Texto libre (máx. 30 caracteres)', 'Código oficial, ej: ICC-101'],
    ['Nombre_Asignatura', 'Sí', 'Texto libre', 'Nombre completo de la asignatura'],
    ['Seccion', 'Sí', 'Texto libre', 'Número o letra de sección, ej: 01, A'],
    ['Docente', 'Sí', 'Texto libre', 'Nombre completo del docente'],
    ['Dias_Semana', 'Sí', 'lunes | martes | miercoles | jueves | viernes | sabado', 'Separados por coma, ej: lunes,miercoles,viernes'],
    ['Hora_Inicio', 'Sí', 'HH:MM  (mínimo 06:30)', 'Formato 24h, ej: 07:00 — 13:30'],
    ['Hora_Fin', 'Sí', 'HH:MM  (máximo 20:30)', 'Debe ser mayor que Hora_Inicio'],
    ['Modulos_Lab03', 'Solo si Lab = lab_03', 'm1 | m2 | m3 | m4', 'Separados por coma, ej: m1,m2'],
    ['Inscritos', 'No', 'Número entero', 'Estudiantes inscritos. Por defecto 0'],
    ['Tipo', 'No', 'regular  |  puntual', 'Por defecto: regular'],
    ['Fecha_Inicio_Puntual', 'Solo si Tipo = puntual', 'YYYY-MM-DD', 'Ej: 2026-06-15'],
    ['Fecha_Fin_Puntual', 'Solo si Tipo = puntual', 'YYYY-MM-DD', 'Puede ser igual a Fecha_Inicio_Puntual'],
    [],
    ['LABORATORIOS DISPONIBLES', '', '', ''],
    ['ID', 'Nombre', '', ''],
    ...labsRef,
    [],
    ['MÓDULOS LAB 03', '', '', ''],
    ['ID', 'Descripción', 'Rango de PCs', 'Equipos'],
    ['m1', 'Módulo 1', 'PCs 1 – 27', '27'],
    ['m2', 'Módulo 2', 'PCs 28 – 63', '36'],
    ['m3', 'Módulo 3', 'PCs 64 – 99', '36'],
    ['m4', 'Módulo 4', 'PCs 100 – 125', '26'],
  ];
}

export function generarTemplateClases(nombreCiclo) {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Carga (datos)
  const wsCarga = XLSX.utils.aoa_to_sheet([HEADERS, ...FILAS_EJEMPLO]);
  wsCarga['!cols'] = [
    { wch: 10 }, { wch: 22 }, { wch: 38 }, { wch: 10 },
    { wch: 28 }, { wch: 32 }, { wch: 14 }, { wch: 14 },
    { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, wsCarga, 'Carga');

  // Hoja 2: Instrucciones
  const wsRef = XLSX.utils.aoa_to_sheet(construirHojaInstrucciones());
  wsRef['!cols'] = [{ wch: 24 }, { wch: 22 }, { wch: 42 }, { wch: 48 }];
  XLSX.utils.book_append_sheet(wb, wsRef, 'Instrucciones');

  const slug = nombreCiclo.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  XLSX.writeFile(wb, `template_carga_${slug}.xlsx`);
}
