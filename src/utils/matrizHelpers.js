import { FRANJAS_HORARIAS, HORA_INICIO_DIA, SLOT_MINUTOS, DIAS_SEMANA, TIPOS_CLASE } from '../lib/constants';
import { horaToMinutos, minutosToHora, rangosSesolapan, getDiaSemanaPorIndice, fechaToISO, diasDelMes } from './dateHelpers';

export const TOTAL_SLOTS = FRANJAS_HORARIAS.length;

// Dispositivo sin hover real (touch) — en modo concentración, tocar una
// clase en estos dispositivos muestra el tooltip en vez de abrir el editor,
// porque no hay forma de "pasar el mouse" antes de dar clic.
export function esDispositivoTactil() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(hover: none)').matches;
}

export function slotIndexAHora(slotIndex) {
  const minutosBase = horaToMinutos(HORA_INICIO_DIA);
  return minutosToHora(minutosBase + slotIndex * SLOT_MINUTOS);
}

export function horaASlotIndex(hora) {
  const minutos = horaToMinutos(hora) - horaToMinutos(HORA_INICIO_DIA);
  return Math.max(0, Math.floor(minutos / SLOT_MINUTOS));
}

export function rangoHorasASlots(horaInicio, horaFin) {
  const inicio = horaASlotIndex(horaInicio);
  const fin = horaASlotIndex(horaFin);
  return { inicio, fin, span: Math.max(1, fin - inicio) };
}

export function detectarColisiones(claseNueva, clasesExistentes, claseEditandoId = null) {
  const colisiones = [];

  for (const c of clasesExistentes) {
    if (claseEditandoId && c.id === claseEditandoId) continue;
    if (c.labId !== claseNueva.labId) continue;
    if (!Array.isArray(c.diasSemana) || !Array.isArray(claseNueva.diasSemana)) continue;

    const diasComunes = c.diasSemana.filter(d => claseNueva.diasSemana.includes(d));
    if (diasComunes.length === 0) continue;

    if (!rangosSesolapan(c.horaInicio, c.horaFin, claseNueva.horaInicio, claseNueva.horaFin)) {
      continue;
    }

    const modA = Array.isArray(c.modulos) ? c.modulos : [];
    const modB = Array.isArray(claseNueva.modulos) ? claseNueva.modulos : [];

    if (modA.length === 0 && modB.length === 0) {
      colisiones.push({ clase: c, diasComunes, motivo: 'Solapamiento de horario' });
      continue;
    }

    const modulosComunes = modA.filter(m => modB.includes(m));
    if (modA.length === 0 || modB.length === 0 || modulosComunes.length > 0) {
      colisiones.push({
        clase: c,
        diasComunes,
        modulosComunes: modulosComunes.length > 0 ? modulosComunes : null,
        motivo: modulosComunes.length > 0
          ? `Solapamiento en módulos: ${modulosComunes.join(', ')}`
          : 'Una de las clases ocupa el lab completo',
      });
    }
  }

  return colisiones;
}

export function clasesDelDiaModulo(clases, dia, moduloId) {
  return clases.filter(c => {
    if (!Array.isArray(c.diasSemana) || !c.diasSemana.includes(dia)) return false;
    if (!moduloId) return !Array.isArray(c.modulos) || c.modulos.length === 0;
    return Array.isArray(c.modulos) && c.modulos.includes(moduloId);
  });
}

export function snapToSlot(value) {
  return Math.max(0, Math.min(TOTAL_SLOTS - 1, Math.round(value)));
}

export function generarDiasDelMes(anio, mes) {
  const total = diasDelMes(anio, mes);
  const dias = [];
  for (let dia = 1; dia <= total; dia++) {
    const fecha = new Date(anio, mes - 1, dia);
    const indiceDia = fecha.getDay();
    const diaSemana = getDiaSemanaPorIndice(indiceDia);
    dias.push({
      numeroDia: dia,
      fecha,
      fechaISO: fechaToISO(fecha),
      diaSemana,
      esFinDeSemana: indiceDia === 0 || indiceDia === 6,
    });
  }
  return dias;
}

const TIPOS_FECHA_EXACTA = new Set([TIPOS_CLASE.PUNTUAL, TIPOS_CLASE.REUNION, TIPOS_CLASE.DEFENSA]);

export function clasesQueAplicanEnFecha(clases, fechaISO, diaSemanaId, moduloId = null) {
  return clases.filter(c => {
    if (TIPOS_FECHA_EXACTA.has(c.tipo)) {
      if (c.fechaInicio !== fechaISO) return false;
    } else {
      if (!Array.isArray(c.diasSemana) || !c.diasSemana.includes(diaSemanaId)) return false;
      if (c.fechaInicio && fechaISO < c.fechaInicio) return false;
      if (c.fechaFin && fechaISO > c.fechaFin) return false;
    }

    if (!moduloId) {
      return !Array.isArray(c.modulos) || c.modulos.length === 0;
    }
    return Array.isArray(c.modulos) && c.modulos.includes(moduloId);
  });
}

export function reservasQueAplicanEnFecha(reservas, fechaISO, moduloId = null) {
  return reservas.filter(r => {
    if (r.estado !== 'aprobada') return false;
    if (!Array.isArray(r.ocurrencias) || !r.ocurrencias.includes(fechaISO)) return false;

    if (!moduloId) {
      return !Array.isArray(r.modulos) || r.modulos.length === 0;
    }
    return Array.isArray(r.modulos) && r.modulos.includes(moduloId);
  });
}
