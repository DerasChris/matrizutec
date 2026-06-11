import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { colorPorCodigo } from '../../lib/constants';

const INICIO_MIN = 6 * 60 + 30;  // 06:30
const FIN_MIN    = 20 * 60;       // 20:00
const SLOT_H     = 38;            // px por cada franja de 30 min
const SLOTS      = (FIN_MIN - INICIO_MIN) / 30; // 27
const TOTAL_H    = SLOTS * SLOT_H;              // 1026 px

const DIAS = [
  { key: 'lunes',     corto: 'Lun', idx: 1 },
  { key: 'martes',    corto: 'Mar', idx: 2 },
  { key: 'miercoles', corto: 'Mié', idx: 3 },
  { key: 'jueves',    corto: 'Jue', idx: 4 },
  { key: 'viernes',   corto: 'Vie', idx: 5 },
  { key: 'sabado',    corto: 'Sáb', idx: 6 },
];

function inicioSemana(fecha) {
  const d = new Date(fecha);
  const dia = d.getDay();
  d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDias(fecha, n) {
  const d = new Date(fecha);
  d.setDate(d.getDate() + n);
  return d;
}

function toISO(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function horaAY(hora) {
  const [h, m] = hora.split(':').map(Number);
  return ((h * 60 + m - INICIO_MIN) / 30) * SLOT_H;
}

function duracionH(inicio, fin) {
  const [h1, m1] = inicio.split(':').map(Number);
  const [h2, m2] = fin.split(':').map(Number);
  return ((h2 * 60 + m2) - (h1 * 60 + m1)) / 30 * SLOT_H;
}

// Genera las marcas horarias (1 cada 30 min, label solo en horas enteras)
const TICKS = Array.from({ length: SLOTS }, (_, i) => {
  const min = INICIO_MIN + i * 30;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return {
    y: i * SLOT_H,
    label: m === 0 ? `${String(h).padStart(2, '0')}:00` : '',
    esHora: m === 0,
  };
});

export default function MatrizSemanal({ clases = [], reservas = [], onClaseClick }) {
  const [lunes, setLunes] = useState(() => inicioSemana(new Date()));

  const hoyISO = toISO(new Date());

  const diasConFecha = DIAS.map((d, i) => ({
    ...d,
    fecha: addDias(lunes, i),
    iso: toISO(addDias(lunes, i)),
  }));

  const sabado = addDias(lunes, 5);
  const semanaLabel = (() => {
    const opt = { day: 'numeric', month: 'short' };
    const from = lunes.toLocaleDateString('es-SV', opt);
    const to   = sabado.toLocaleDateString('es-SV', { ...opt, year: 'numeric' });
    return `${from} – ${to}`;
  })();

  const clasesActivas = clases.filter(c => c.activo !== false);
  const reservasAprobadas = reservas.filter(r => r.estado === 'aprobada');

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* ── Navegación ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setLunes(d => addDias(d, -7))}
            className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setLunes(d => addDias(d, 7))}
            className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setLunes(inicioSemana(new Date()))}
            className="ml-1 px-2.5 py-1 text-xs font-medium text-utec-primary border border-utec-primary rounded-lg hover:bg-utec-light transition-colors"
          >
            Hoy
          </button>
        </div>
        <p className="text-sm font-semibold text-gray-700">{semanaLabel}</p>
        <div className="w-28" />
      </div>

      {/* ── Grid ── */}
      <div className="overflow-x-auto">
        <div className="flex" style={{ minWidth: 560 }}>

          {/* Columna de horas */}
          <div className="w-14 shrink-0 border-r border-gray-200">
            <div className="h-14 border-b border-gray-200" /> {/* header spacer */}
            <div className="relative" style={{ height: TOTAL_H }}>
              {TICKS.filter(t => t.esHora).map(t => (
                <span
                  key={t.label}
                  className="absolute right-2 text-[10px] leading-none text-gray-400 select-none"
                  style={{ top: t.y - 6 }}
                >
                  {t.label}
                </span>
              ))}
            </div>
          </div>

          {/* Columnas de días */}
          {diasConFecha.map(dia => {
            const esHoy = dia.iso === hoyISO;

            const clasesDelDia = clasesActivas.filter(c =>
              c.diasSemana?.includes(dia.key)
            );
            const puntualesDelDia = clasesActivas.filter(c =>
              c.tipo === 'puntual' && c.fechaInicio === dia.iso
            );
            const reservasDelDia = reservasAprobadas.filter(r =>
              r.ocurrencias?.includes(dia.iso)
            );

            const bloques = [...clasesDelDia, ...puntualesDelDia];

            return (
              <div key={dia.key} className="flex-1 border-r border-gray-200 last:border-r-0" style={{ minWidth: 80 }}>
                {/* Cabecera del día */}
                <div className={`h-14 flex flex-col items-center justify-center border-b border-gray-200 ${
                  esHoy ? 'bg-utec-primary' : 'bg-gray-50'
                }`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${esHoy ? 'text-white/80' : 'text-gray-500'}`}>
                    {dia.corto}
                  </span>
                  <span className={`text-xl font-bold leading-tight ${esHoy ? 'text-white' : 'text-gray-800'}`}>
                    {dia.fecha.getDate()}
                  </span>
                </div>

                {/* Área de eventos */}
                <div className="relative" style={{ height: TOTAL_H }}>
                  {/* Líneas de cuadrícula */}
                  {TICKS.map(t => (
                    <div
                      key={t.y}
                      className={`absolute left-0 right-0 ${t.esHora ? 'border-t border-gray-200' : 'border-t border-gray-100'}`}
                      style={{ top: t.y }}
                    />
                  ))}

                  {/* Clases regulares y puntuales */}
                  {bloques.map((clase, i) => {
                    const top    = horaAY(clase.horaInicio);
                    const height = duracionH(clase.horaInicio, clase.horaFin);
                    const color  = clase.color || colorPorCodigo(clase.codigoAsignatura);
                    const chico  = height < 44;
                    return (
                      <div
                        key={clase.id + dia.key}
                        onClick={() => onClaseClick?.(clase)}
                        style={{
                          position: 'absolute',
                          top: top + 1,
                          height: height - 2,
                          left: 2, right: 2,
                          backgroundColor: color,
                          borderRadius: 5,
                          zIndex: 10 + i,
                          cursor: onClaseClick ? 'pointer' : 'default',
                          overflow: 'hidden',
                        }}
                        title={`${clase.nombreAsignatura}\n${clase.seccion} · ${clase.horaInicio}–${clase.horaFin}\n${clase.docente}`}
                      >
                        <div className="px-1.5 py-1">
                          <p className="text-[10px] font-bold text-white leading-tight truncate">
                            {clase.nombreAsignatura}
                          </p>
                          {!chico && (
                            <p className="text-[9px] text-white/75 leading-tight mt-0.5 truncate">
                              {clase.seccion} · {clase.horaInicio}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Reservas aprobadas */}
                  {reservasDelDia.map((res, i) => {
                    const top    = horaAY(res.horaInicio);
                    const height = duracionH(res.horaInicio, res.horaFin);
                    const chico  = height < 44;
                    return (
                      <div
                        key={res.id}
                        style={{
                          position: 'absolute',
                          top: top + 1,
                          height: height - 2,
                          left: 2, right: 2,
                          borderRadius: 5,
                          zIndex: 20 + i,
                          overflow: 'hidden',
                          border: '2px solid #f59e0b',
                          backgroundColor: '#fffbeb',
                        }}
                        title={`Reserva: ${res.asignatura || res.motivo}\n${res.horaInicio}–${res.horaFin}`}
                      >
                        <div className="px-1.5 py-1">
                          <p className="text-[10px] font-bold text-amber-800 leading-tight truncate">
                            {res.asignatura || res.motivo}
                          </p>
                          {!chico && (
                            <p className="text-[9px] text-amber-600 leading-tight mt-0.5">
                              {res.horaInicio}–{res.horaFin}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
