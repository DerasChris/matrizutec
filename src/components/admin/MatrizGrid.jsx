import { useState, useRef, useCallback, useMemo } from 'react';
import { FRANJAS_HORARIAS } from '../../lib/constants';
import {
  TOTAL_SLOTS,
  slotIndexAHora,
  horaASlotIndex,
  generarDiasDelMes,
  clasesQueAplicanEnFecha,
  reservasQueAplicanEnFecha,
} from '../../utils/matrizHelpers';
import { fechaActualISO } from '../../utils/dateHelpers';
import BloqueClase from './BloqueClase';

// Slots 11 y 12 = 12:00-12:30 y 12:30-13:00 (almuerzo)
const SLOTS_ALMUERZO = new Set([11, 12]);

const ANCHO_FECHA   = 52;
const ANCHO_DIA     = 96;
const ANCHO_MODULO  = 46;
const ANCHO_TOTAL   = 80;

const ALTURA_FILA_NORMAL = 54;
const ALTURA_FILA_MODULO = 38;

function formatTotalHoras(totalSlots) {
  const mins = totalSlots * 30;
  if (mins === 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function MatrizGrid({
  lab,
  clases,
  reservas = [],
  anio,
  mes,
  onCrearClase,
  onEditarClase,
  onClickReserva,
}) {
  const [dragState, setDragState] = useState(null);
  const rowAreaRefs = useRef({});

  const tieneModulos =
    lab?.tieneModulos &&
    Array.isArray(lab?.modulos) &&
    lab.modulos.length > 0;

  const hoy = fechaActualISO();

  const diasDelMes = useMemo(() => generarDiasDelMes(anio, mes), [anio, mes]);

  // Clases importadas/creadas sin módulo asignado (p. ej. Lab 03 pendiente de
  // revisión tras una importación). Sin esta fila extra quedan invisibles en
  // la matriz, porque las demás filas solo iteran m1–m4.
  const hayClasesSinModulo = tieneModulos && clases.some(
    c => !Array.isArray(c.modulos) || c.modulos.length === 0
  );

  const modulosDelGrid = useMemo(() => {
    if (!tieneModulos) return null;
    return hayClasesSinModulo
      ? [...lab.modulos, { id: null, corto: 'S/M' }]
      : lab.modulos;
  }, [tieneModulos, hayClasesSinModulo, lab]);

  const filas = useMemo(() => {
    const resultado = [];
    for (const diaInfo of diasDelMes) {
      if (tieneModulos) {
        modulosDelGrid.forEach((modulo, idx) => {
          resultado.push({
            tipo: 'modulo',
            diaInfo,
            modulo,
            esPrimeraDelDia: idx === 0,
            esUltimaDelDia: idx === modulosDelGrid.length - 1,
            totalModulos: modulosDelGrid.length,
          });
        });
      } else {
        resultado.push({ tipo: 'normal', diaInfo });
      }
    }
    return resultado;
  }, [diasDelMes, tieneModulos, modulosDelGrid]);

  // Total horas programadas por fecha (sumando todos los módulos si aplica)
  const totalesPorFecha = useMemo(() => {
    const map = {};
    for (const diaInfo of diasDelMes) {
      let slots = 0;
      const modulos = tieneModulos ? [...lab.modulos.map(m => m.id), null] : [null];
      for (const modId of modulos) {
        const cf = clasesQueAplicanEnFecha(clases, diaInfo.fechaISO, diaInfo.diaSemana.id, modId);
        const rf = reservasQueAplicanEnFecha(reservas, diaInfo.fechaISO, modId);
        for (const c of cf) slots += horaASlotIndex(c.horaFin) - horaASlotIndex(c.horaInicio);
        for (const r of rf) slots += horaASlotIndex(r.horaFin) - horaASlotIndex(r.horaInicio);
      }
      map[diaInfo.fechaISO] = formatTotalHoras(slots);
    }
    return map;
  }, [clases, reservas, diasDelMes, lab, tieneModulos]);

  const alturaFila = tieneModulos ? ALTURA_FILA_MODULO : ALTURA_FILA_NORMAL;
  const anchoSlot = 'minmax(46px, 1fr)';

  const gridColumns = [
    `${ANCHO_FECHA}px`,
    `${ANCHO_DIA}px`,
    tieneModulos ? `${ANCHO_MODULO}px` : null,
    `repeat(${TOTAL_SLOTS}, ${anchoSlot})`,
    `${ANCHO_TOTAL}px`,
  ].filter(Boolean).join(' ');

  const colSlotsStart = tieneModulos ? 4 : 3;
  const colTotal = colSlotsStart + TOTAL_SLOTS;

  function calcularSlotDesdeX(rowKey, clientX) {
    const area = rowAreaRefs.current[rowKey];
    if (!area) return null;
    const rect = area.getBoundingClientRect();
    const x = clientX - rect.left;
    if (x < 0 || x > rect.width) return null;
    return Math.max(0, Math.min(TOTAL_SLOTS - 1, Math.floor((x / rect.width) * TOTAL_SLOTS)));
  }

  const handleMouseDown = useCallback((e, fila) => {
    if (e.button !== 0) return;
    if (e.target.closest('button')) return;
    const rowKey = fila.tipo === 'modulo'
      ? `${fila.diaInfo.fechaISO}_${fila.modulo.id}`
      : fila.diaInfo.fechaISO;
    const slot = calcularSlotDesdeX(rowKey, e.clientX);
    if (slot === null) return;
    setDragState({ rowKey, fila, slotInicio: slot, slotFin: slot });
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!dragState) return;
    const slot = calcularSlotDesdeX(dragState.rowKey, e.clientX);
    if (slot === null) return;
    setDragState(s => ({ ...s, slotFin: slot }));
  }, [dragState]);

  const handleMouseUp = useCallback(() => {
    if (!dragState) return;
    const { fila, slotInicio, slotFin } = dragState;
    const sIni = Math.min(slotInicio, slotFin);
    const sFin = Math.max(slotInicio, slotFin) + 1;
    onCrearClase?.({
      diaSugerido: fila.diaInfo.diaSemana.id,
      fechaSugerida: fila.diaInfo.fechaISO,
      moduloSugerido: fila.tipo === 'modulo' ? fila.modulo.id : null,
      horaInicio: slotIndexAHora(sIni),
      horaFin: slotIndexAHora(sFin),
    });
    setDragState(null);
  }, [dragState, onCrearClase]);

  const handleMouseLeave = useCallback(() => {
    if (dragState) setDragState(null);
  }, [dragState]);

  const minWidth = ANCHO_FECHA + ANCHO_DIA + (tieneModulos ? ANCHO_MODULO : 0) + TOTAL_SLOTS * 46 + ANCHO_TOTAL;

  return (
    <div
      className="overflow-auto rounded-2xl border border-gray-200 bg-white shadow-sm select-none"
      style={{ maxHeight: 'calc(100vh - 248px)' }}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <div style={{ minWidth: `${minWidth}px` }}>

        {/* ── HEADER ── */}
        <div
          className="grid sticky top-0 z-20 bg-white border-b-2 border-gray-300 shadow-sm"
          style={{ gridTemplateColumns: gridColumns }}
        >
          {/* FECHA */}
          <div className="flex items-end justify-center pb-2 border-r border-gray-200 bg-gray-50 text-[10px] font-semibold uppercase text-gray-500">
            FECHA
          </div>

          {/* Días */}
          <div className="flex items-end justify-center pb-2 border-r border-gray-200 bg-gray-50 text-[10px] font-semibold uppercase text-gray-500">
            Días
          </div>

          {/* Módulo */}
          {tieneModulos && (
            <div className="flex items-end justify-center pb-2 border-r border-gray-200 bg-gray-50 text-[10px] font-semibold uppercase text-gray-500">
              Mód
            </div>
          )}

          {/* Franjas horarias — texto rotado */}
          {FRANJAS_HORARIAS.map((f, i) => {
            const esHoraCompleta = f.inicio.endsWith(':00');
            const esAlmuerzo = SLOTS_ALMUERZO.has(i);
            return (
              <div
                key={f.inicio}
                className={`flex items-end justify-center pb-1 overflow-hidden ${
                  esHoraCompleta ? 'border-r border-gray-300' : 'border-r border-gray-100'
                } ${esAlmuerzo ? 'bg-gray-200/70' : 'bg-gray-50'}`}
              >
                <span
                  className={`leading-none whitespace-nowrap ${
                    esHoraCompleta ? 'text-[11px] font-semibold text-gray-700' : 'text-[10px] font-medium text-gray-500'
                  }`}
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  {f.label}
                </span>
              </div>
            );
          })}

          {/* Total Horas Programadas */}
          <div className="flex items-end justify-center pb-1 border-l-2 border-blue-200 bg-blue-50 overflow-hidden">
            <span
              className="text-[11px] font-semibold text-blue-700 leading-none whitespace-nowrap"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              Total Horas Programadas
            </span>
          </div>
        </div>

        {/* ── FILAS ── */}
        {filas.map((fila) => {
          const { diaInfo } = fila;
          const rowKey = fila.tipo === 'modulo'
            ? `${diaInfo.fechaISO}_${fila.modulo.id}`
            : diaInfo.fechaISO;
          const moduloId = fila.tipo === 'modulo' ? fila.modulo.id : null;

          const clasesFila = clasesQueAplicanEnFecha(clases, diaInfo.fechaISO, diaInfo.diaSemana.id, moduloId);
          const reservasFila = reservasQueAplicanEnFecha(reservas, diaInfo.fechaISO, moduloId);

          const dragActivo = dragState?.rowKey === rowKey;
          const sIni = dragActivo ? Math.min(dragState.slotInicio, dragState.slotFin) : 0;
          const sFin = dragActivo ? Math.max(dragState.slotInicio, dragState.slotFin) + 1 : 0;

          const filasDelDia = fila.tipo === 'modulo' ? fila.totalModulos : 1;
          const esUltimaFila = fila.tipo === 'normal' || fila.esUltimaDelDia;
          const esPrimeraFila = fila.tipo === 'normal' || fila.esPrimeraDelDia;

          const esHoy = diaInfo.fechaISO === hoy;
          const esFinde = diaInfo.esFinDeSemana;

          const fondoFila = esFinde
            ? 'bg-gray-50/70'
            : diaInfo.numeroDia % 2 === 0 ? 'bg-white' : 'bg-gray-50/30';

          return (
            <div
              key={rowKey}
              className={`grid relative ${
                esUltimaFila ? 'border-b border-gray-200' : 'border-b border-gray-100'
              } ${fondoFila}`}
              style={{ gridTemplateColumns: gridColumns, height: `${alturaFila}px` }}
            >
              {/* FECHA — número del día */}
              {esPrimeraFila && (
                <div
                  className={`border-r border-gray-200 flex items-center justify-center ${
                    esHoy ? 'bg-blue-50' : esFinde ? 'bg-gray-100/80' : 'bg-white/80'
                  }`}
                  style={{
                    gridColumn: '1 / 2',
                    gridRow: tieneModulos ? `span ${filasDelDia}` : 'span 1',
                  }}
                >
                  <span className={`text-sm font-bold tabular-nums ${esHoy ? 'text-blue-600' : 'text-gray-800'}`}>
                    {diaInfo.numeroDia}
                  </span>
                </div>
              )}

              {/* DÍAS — nombre del día */}
              {esPrimeraFila && (
                <div
                  className={`border-r border-gray-200 flex items-center pl-2 ${
                    esHoy ? 'bg-blue-50' : esFinde ? 'bg-gray-100/80' : 'bg-white/80'
                  }`}
                  style={{
                    gridColumn: '2 / 3',
                    gridRow: tieneModulos ? `span ${filasDelDia}` : 'span 1',
                  }}
                >
                  <div className="leading-tight">
                    <p className={`text-[11px] font-medium capitalize ${esHoy ? 'text-blue-600' : 'text-gray-700'}`}>
                      {diaInfo.diaSemana.label}
                    </p>
                    {esHoy && (
                      <p className="text-[9px] uppercase font-semibold text-blue-500">Hoy</p>
                    )}
                  </div>
                </div>
              )}

              {/* MÓDULO */}
              {tieneModulos && (
                <div
                  className={`text-[10px] border-r border-gray-200 flex items-center justify-center font-medium ${
                    fila.modulo.id === null ? 'bg-amber-50 text-amber-700' : 'text-gray-500 bg-white/60'
                  }`}
                  style={{ gridColumn: '3 / 4' }}
                  title={fila.modulo.id === null ? 'Sin módulo asignado — pendiente de revisión' : undefined}
                >
                  {fila.modulo.corto}
                </div>
              )}

              {/* ÁREA DE SLOTS */}
              <div
                ref={(el) => { rowAreaRefs.current[rowKey] = el; }}
                className="relative cursor-crosshair"
                style={{
                  gridColumn: `${colSlotsStart} / span ${TOTAL_SLOTS}`,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${TOTAL_SLOTS}, ${anchoSlot})`,
                  height: '100%',
                }}
                onMouseDown={(e) => handleMouseDown(e, fila)}
                onMouseMove={handleMouseMove}
              >
                {/* Celdas de fondo */}
                {FRANJAS_HORARIAS.map((f, i) => {
                  const esHoraCompleta = f.inicio.endsWith(':00');
                  const esAlmuerzo = SLOTS_ALMUERZO.has(i);
                  return (
                    <div
                      key={`bg-${rowKey}-${i}`}
                      className={`transition-colors hover:bg-blue-50/50 ${
                        esHoraCompleta ? 'border-r border-gray-200' : 'border-r border-gray-100'
                      } ${esAlmuerzo ? 'bg-gray-100/80' : ''}`}
                      style={{ gridColumn: `${i + 1} / span 1`, gridRow: '1 / 2' }}
                    />
                  );
                })}

                {/* Clases regulares */}
                {clasesFila.map((clase) => {
                  const slotInicio = horaASlotIndex(clase.horaInicio);
                  const slotFin = horaASlotIndex(clase.horaFin);
                  const span = Math.max(1, slotFin - slotInicio);
                  return (
                    <div
                      key={`cls-${clase.id}-${diaInfo.fechaISO}`}
                      style={{ gridColumn: `${slotInicio + 1} / span ${span}`, gridRow: '1 / 2' }}
                      className="z-[2] h-full px-[2px] py-[3px]"
                    >
                      <BloqueClase
                        clase={clase}
                        onClick={(e) => { e.stopPropagation(); onEditarClase?.(clase); }}
                        compacto={tieneModulos}
                        esReserva={false}
                      />
                    </div>
                  );
                })}

                {/* Reservas aprobadas */}
                {reservasFila.map((reserva) => {
                  const slotInicio = horaASlotIndex(reserva.horaInicio);
                  const slotFin = horaASlotIndex(reserva.horaFin);
                  const span = Math.max(1, slotFin - slotInicio);
                  return (
                    <div
                      key={`res-${reserva.id}-${diaInfo.fechaISO}`}
                      style={{ gridColumn: `${slotInicio + 1} / span ${span}`, gridRow: '1 / 2' }}
                      className="z-[3] h-full px-[2px] py-[3px]"
                    >
                      <BloqueClase
                        clase={reserva}
                        onClick={(e) => { e.stopPropagation(); onClickReserva?.(reserva); }}
                        compacto={tieneModulos}
                        esReserva={true}
                      />
                    </div>
                  );
                })}

                {/* Selección por drag */}
                {dragActivo && (
                  <div
                    className="bg-blue-400/20 border border-blue-500 rounded-lg z-[4] pointer-events-none flex items-center justify-center text-[10px] font-semibold text-blue-800 backdrop-blur-sm m-[2px]"
                    style={{ gridColumn: `${sIni + 1} / span ${sFin - sIni}`, gridRow: '1 / 2' }}
                  >
                    {slotIndexAHora(sIni)} – {slotIndexAHora(sFin)}
                  </div>
                )}
              </div>

              {/* TOTAL HORAS — solo en la primera fila del día */}
              {esPrimeraFila && (
                <div
                  className="border-l-2 border-blue-200 bg-blue-50/40 flex items-center justify-center"
                  style={{
                    gridColumn: `${colTotal} / span 1`,
                    gridRow: tieneModulos ? `span ${filasDelDia}` : 'span 1',
                  }}
                >
                  {totalesPorFecha[diaInfo.fechaISO] && (
                    <span className="text-[10px] font-semibold text-blue-700 tabular-nums">
                      {totalesPorFecha[diaInfo.fechaISO]}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
