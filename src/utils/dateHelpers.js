import { DIAS_SEMANA, MESES } from '../lib/constants';

export function getDiaSemanaActual() {
  const indice = new Date().getDay();
  return DIAS_SEMANA.find(d => d.indice === indice);
}

export function getDiaSemanaPorIndice(indice) {
  return DIAS_SEMANA.find(d => d.indice === indice);
}

export function getDiaSemanaPorId(id) {
  return DIAS_SEMANA.find(d => d.id === id);
}

export function getMesActual() {
  return new Date().getMonth() + 1;
}

export function getMesInfo(num) {
  return MESES.find(m => m.num === num);
}

export function getAnioActual() {
  return new Date().getFullYear();
}

export function diasDelMes(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

export function fechaToISO(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isoToFecha(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const partes = iso.split('-');
  if (partes.length !== 3) return null;
  const [y, m, d] = partes.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return new Date(y, m - 1, d);
}

export function horaActualString() {
  const ahora = new Date();
  const h = String(ahora.getHours()).padStart(2, '0');
  const m = String(ahora.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function horaToMinutos(hora) {
  if (!hora) return 0;
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function minutosToHora(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function estaEnRango(horaActual, horaInicio, horaFin) {
  const actual = horaToMinutos(horaActual);
  const inicio = horaToMinutos(horaInicio);
  const fin = horaToMinutos(horaFin);
  return actual >= inicio && actual < fin;
}

export function rangosSesolapan(aIni, aFin, bIni, bFin) {
  const a1 = horaToMinutos(aIni);
  const a2 = horaToMinutos(aFin);
  const b1 = horaToMinutos(bIni);
  const b2 = horaToMinutos(bFin);
  return a1 < b2 && b1 < a2;
}

export function haPasado(horaFin) {
  return horaToMinutos(horaActualString()) >= horaToMinutos(horaFin);
}

export function ordenarPorHoraInicio(items) {
  return [...items].sort((a, b) => horaToMinutos(a.horaInicio) - horaToMinutos(b.horaInicio));
}

export function fechaActualISO() {
  return new Date().toISOString().split('T')[0];
}

export function formatearFechaLarga(fecha = new Date()) {
  if (!fecha || (fecha instanceof Date && isNaN(fecha.getTime()))) return '';
  return new Intl.DateTimeFormat('es-SV', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(fecha);
}

export function formatearFechaCorta(fecha) {
  if (!fecha) return '';
  let f = fecha;
  if (typeof fecha === 'string') {
    f = isoToFecha(fecha);
  }
  if (!f || !(f instanceof Date) || isNaN(f.getTime())) return '';
  return new Intl.DateTimeFormat('es-SV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(f);
}

export function formatearHora(hora) {
  if (!hora) return '';
  const [h, m] = hora.split(':');
  return `${h}:${m}`;
}