import { TIPOS_RESERVA, DIAS_SEMANA } from '../lib/constants';
import { fechaToISO, isoToFecha } from './dateHelpers';

export function expandirOcurrencias(datos) {
  const { tipo, fechaInicio, fechaFin, diasSemana, fechasEspecificas } = datos;

  let resultado = [];

  switch (tipo) {
    case TIPOS_RESERVA.UNICA:
    case TIPOS_RESERVA.TOUR:
      resultado = fechaInicio ? [fechaInicio] : [];
      break;

    case TIPOS_RESERVA.RANGO:
      resultado = rangoFechas(fechaInicio, fechaFin);
      break;

    case TIPOS_RESERVA.RECURRENTE:
      resultado = recurrente(fechaInicio, fechaFin, diasSemana || []);
      break;

    case TIPOS_RESERVA.MULTIPLES:
      resultado = Array.isArray(fechasEspecificas) ? [...fechasEspecificas] : [];
      break;

    default:
      resultado = [];
  }

  return resultado.filter(f => typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f)).sort();
}

function rangoFechas(inicioISO, finISO) {
  if (!inicioISO || !finISO) return [];
  const inicio = isoToFecha(inicioISO);
  const fin = isoToFecha(finISO);
  if (!inicio || !fin || inicio > fin) return [];

  const fechas = [];
  for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
    const iso = fechaToISO(d);
    if (iso) fechas.push(iso);
  }
  return fechas;
}

function recurrente(inicioISO, finISO, diasIds) {
  if (!inicioISO || !finISO || diasIds.length === 0) return [];
  const inicio = isoToFecha(inicioISO);
  const fin = isoToFecha(finISO);
  if (!inicio || !fin || inicio > fin) return [];

  const indices = diasIds
    .map(id => DIAS_SEMANA.find(d => d.id === id)?.indice)
    .filter(i => i !== undefined);

  if (indices.length === 0) return [];

  const fechas = [];
  for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
    if (indices.includes(d.getDay())) {
      const iso = fechaToISO(d);
      if (iso) fechas.push(iso);
    }
  }
  return fechas;
}

export function obtenerDiaSemanaDeFecha(fechaISO) {
  const fecha = isoToFecha(fechaISO);
  if (!fecha) return null;
  const indice = fecha.getDay();
  return DIAS_SEMANA.find(d => d.indice === indice);
}