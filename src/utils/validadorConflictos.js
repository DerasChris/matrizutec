import { TIPOS_CLASE } from '../lib/constants';
import { rangosSesolapan } from './dateHelpers';
import { obtenerDiaSemanaDeFecha } from './expansorOcurrencias';

function modulosColisionan(modA, modB) {
  const a = Array.isArray(modA) ? modA : [];
  const b = Array.isArray(modB) ? modB : [];
  if (a.length === 0 || b.length === 0) return true;
  return a.some(m => b.includes(m));
}

export function validarConflictosReserva({
  reserva,
  ocurrencias,
  clasesRegulares = [],
  reservasAprobadas = [],
  ignorarReservaId = null,
}) {
  const conflictos = [];

  for (const fechaISO of ocurrencias) {
    const diaSemana = obtenerDiaSemanaDeFecha(fechaISO);

    for (const clase of clasesRegulares) {
      if (clase.labId !== reserva.labId) continue;
      if (clase.activo === false) continue;

      const aplicaPorTipo =
        clase.tipo === TIPOS_CLASE.PUNTUAL
          ? clase.fechaInicio === fechaISO
          : Array.isArray(clase.diasSemana) &&
            clase.diasSemana.includes(diaSemana?.id) &&
            (!clase.fechaInicio || fechaISO >= clase.fechaInicio) &&
            (!clase.fechaFin || fechaISO <= clase.fechaFin);

      if (!aplicaPorTipo) continue;

      if (!rangosSesolapan(clase.horaInicio, clase.horaFin, reserva.horaInicio, reserva.horaFin)) continue;

      if (!modulosColisionan(clase.modulos, reserva.modulos)) continue;

      conflictos.push({
        fecha: fechaISO,
        tipo: 'clase_regular',
        motivo: `Choca con clase regular ${clase.codigoAsignatura || ''}-${clase.seccion || ''} (${clase.horaInicio}-${clase.horaFin})`,
        contraId: clase.id,
        contraNombre: `${clase.codigoAsignatura} ${clase.nombreAsignatura}`,
      });
    }

    for (const otra of reservasAprobadas) {
      if (ignorarReservaId && otra.id === ignorarReservaId) continue;
      if (otra.labId !== reserva.labId) continue;
      if (otra.estado !== 'aprobada') continue;

      const aplicaEnFecha = Array.isArray(otra.ocurrencias) && otra.ocurrencias.includes(fechaISO);
      if (!aplicaEnFecha) continue;

      if (!rangosSesolapan(otra.horaInicio, otra.horaFin, reserva.horaInicio, reserva.horaFin)) continue;

      if (!modulosColisionan(otra.modulos, reserva.modulos)) continue;

      conflictos.push({
        fecha: fechaISO,
        tipo: 'reserva_aprobada',
        motivo: `Choca con reserva aprobada de ${otra.docenteNombre} (${otra.horaInicio}-${otra.horaFin})`,
        contraId: otra.id,
        contraNombre: otra.asignatura || otra.motivo || 'Reserva',
      });
    }
  }

  return conflictos;
}
