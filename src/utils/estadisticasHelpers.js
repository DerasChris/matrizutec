import { duracionHoras, fechaActualISO } from './dateHelpers';
import { contarOcurrenciasClaseEnRango } from './matrizHelpers';
import { TIPOS_CLASE } from '../lib/constants';

// Uso por laboratorio: registros, horas, alumnos llegados, clases y
// docentes distintos, última fecha. Usado por Reportes → Uso de
// laboratorios y por Estadísticas → alumnos llegados por laboratorio.
export function calcularUsoPorLaboratorio(asistenciasValidas, labs) {
  const porLab = {};
  for (const lab of labs) {
    porLab[lab.id] = {
      lab, registros: 0, horas: 0, totalAlumnos: 0,
      clases: new Set(), docentes: new Set(), ultimaFecha: null,
    };
  }
  for (const a of asistenciasValidas) {
    const s = porLab[a.labId];
    if (!s) continue; // lab fuera de alcance (inactivo o no asignado)
    s.registros++;
    s.horas += duracionHoras(a.horaInicio, a.horaFin);
    s.totalAlumnos += Number(a.alumnosLlegaron) || 0;
    if (a.claseId) s.clases.add(a.claseId);
    if (a.docente) s.docentes.add(a.docente);
    if (!s.ultimaFecha || a.fecha > s.ultimaFecha) s.ultimaFecha = a.fecha;
  }
  return Object.values(porLab).sort((a, b) => (a.lab.numero || 0) - (b.lab.numero || 0));
}

// Horas por materia: horas/semana, proyección fin de ciclo, esperadas a
// la fecha (conteo día por día real, no aproximación /7) y reales según
// asistencia aprobada. Usado por Reportes → Horas por materia y por
// Estadísticas → horas por materia.
export function calcularHorasPorMateria(clases, asistenciasValidas, ciclo) {
  const hoy = fechaActualISO();
  const cicloInicio = ciclo?.fechaInicio || hoy;
  const cicloFin = ciclo?.fechaFin || hoy;

  const porMateria = {};
  const regulares = clases.filter(c => c.tipo === TIPOS_CLASE.REGULAR && c.activo !== false);

  for (const c of regulares) {
    const key = c.codigoAsignatura || c.nombreAsignatura;
    if (!key) continue;
    if (!porMateria[key]) {
      porMateria[key] = {
        codigo: c.codigoAsignatura,
        nombre: c.nombreAsignatura,
        secciones: new Set(),
        horasSemana: 0,
        proyectadas: 0,
        esperadasAlaFecha: 0,
        reales: 0,
      };
    }
    const m = porMateria[key];
    m.secciones.add(c.seccion);
    const horasClase = duracionHoras(c.horaInicio, c.horaFin);
    m.horasSemana += horasClase * (c.diasSemana?.length || 0);

    const desde = c.fechaInicio || cicloInicio;
    const finVigencia = c.fechaFin || cicloFin;
    m.proyectadas += contarOcurrenciasClaseEnRango(c, desde, finVigencia) * horasClase;

    const hastaHoy = hoy < finVigencia ? hoy : finVigencia;
    m.esperadasAlaFecha += contarOcurrenciasClaseEnRango(c, desde, hastaHoy) * horasClase;
  }

  for (const a of asistenciasValidas) {
    const key = a.codigoAsignatura || a.nombreAsignatura;
    const m = porMateria[key];
    if (!m) continue; // asistencia de una clase que ya no está activa en este alcance
    m.reales += duracionHoras(a.horaInicio, a.horaFin);
  }

  return Object.values(porMateria)
    .map(m => ({
      ...m,
      cumplimiento: m.esperadasAlaFecha > 0 ? Math.round((m.reales / m.esperadasAlaFecha) * 100) : null,
    }))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
}

// Horas de clase regular por semana, agrupadas por laboratorio (duración ×
// días por semana, sumado por sección) — misma metodología de
// calcularHorasPorMateria pero agrupada por labId en vez de materia.
export function calcularHorasSemanaPorLab(clases, labs) {
  const porLab = {};
  for (const lab of labs) {
    porLab[lab.id] = { lab, horasSemana: 0 };
  }
  const regulares = clases.filter(c => c.tipo === TIPOS_CLASE.REGULAR && c.activo !== false);
  for (const c of regulares) {
    const s = porLab[c.labId];
    if (!s) continue;
    s.horasSemana += duracionHoras(c.horaInicio, c.horaFin) * (c.diasSemana?.length || 0);
  }
  return Object.values(porLab).sort((a, b) => (a.lab.numero || 0) - (b.lab.numero || 0));
}
