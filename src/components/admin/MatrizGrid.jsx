import { useState, useRef, useCallback, useMemo } from 'react';
import { FRANJAS_HORARIAS, HORA_FIN_DIA } from '../../lib/constants';
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

const ANCHO_LABEL_DIA = 110;
const ANCHO_LABEL_MODULO = 42;
const ANCHO_CIERRE = 28;

const ALTURA_FILA_NORMAL = 40;
const ALTURA_FILA_MODULO = 28;

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

  const diasDelMes = useMemo(
    () => generarDiasDelMes(anio, mes),
    [anio, mes]
  );

  const filas = useMemo(() => {
    const resultado = [];

    for (const diaInfo of diasDelMes) {
      if (tieneModulos) {
        for (const modulo of lab.modulos) {
          resultado.push({
            tipo: 'modulo',
            diaInfo,
            modulo,
            esPrimeraDelDia: modulo.id === lab.modulos[0].id,
            totalModulos: lab.modulos.length,
          });
        }
      } else {
        resultado.push({ tipo: 'normal', diaInfo });
      }
    }

    return resultado;
  }, [diasDelMes, lab, tieneModulos]);

  const alturaFila = tieneModulos
    ? ALTURA_FILA_MODULO
    : ALTURA_FILA_NORMAL;

  const anchoSlot = `minmax(42px, 1fr)`;

  const gridColumns = `
    ${ANCHO_LABEL_DIA}px
    ${tieneModulos ? `${ANCHO_LABEL_MODULO}px` : ''}
    repeat(${TOTAL_SLOTS}, ${anchoSlot})
    ${ANCHO_CIERRE}px
  `;

  function calcularSlotDesdeX(rowKey, clientX) {
    const area = rowAreaRefs.current[rowKey];

    if (!area) return null;

    const rect = area.getBoundingClientRect();

    const x = clientX - rect.left;

    if (x < 0 || x > rect.width) return null;

    const slot = Math.floor((x / rect.width) * TOTAL_SLOTS);

    return Math.max(0, Math.min(TOTAL_SLOTS - 1, slot));
  }

  const handleMouseDown = useCallback((e, fila) => {
    if (e.button !== 0) return;
    if (e.target.closest('button')) return;

    const rowKey =
      fila.tipo === 'modulo'
        ? `${fila.diaInfo.fechaISO}_${fila.modulo.id}`
        : fila.diaInfo.fechaISO;

    const slot = calcularSlotDesdeX(rowKey, e.clientX);

    if (slot === null) return;

    setDragState({
      rowKey,
      fila,
      slotInicio: slot,
      slotFin: slot,
    });
  }, []);

  const handleMouseMove = useCallback(
    (e) => {
      if (!dragState) return;

      const slot = calcularSlotDesdeX(
        dragState.rowKey,
        e.clientX
      );

      if (slot === null) return;

      setDragState((s) => ({
        ...s,
        slotFin: slot,
      }));
    },
    [dragState]
  );

  const handleMouseUp = useCallback(() => {
    if (!dragState) return;

    const { fila, slotInicio, slotFin } = dragState;

    const sIni = Math.min(slotInicio, slotFin);
    const sFin = Math.max(slotInicio, slotFin) + 1;

    const horaInicio = slotIndexAHora(sIni);
    const horaFin = slotIndexAHora(sFin);

    onCrearClase?.({
      diaSugerido: fila.diaInfo.diaSemana.id,
      fechaSugerida: fila.diaInfo.fechaISO,
      moduloSugerido:
        fila.tipo === 'modulo'
          ? fila.modulo.id
          : null,
      horaInicio,
      horaFin,
    });

    setDragState(null);
  }, [dragState, onCrearClase]);

  const handleMouseLeave = useCallback(() => {
    if (dragState) setDragState(null);
  }, [dragState]);

  const colSlotsStart = tieneModulos ? 3 : 2;

  return (
    <div
      className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm select-none"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <div
        style={{
          minWidth: `${
            ANCHO_LABEL_DIA +
            (tieneModulos
              ? ANCHO_LABEL_MODULO
              : 0) +
            TOTAL_SLOTS * 42 +
            ANCHO_CIERRE
          }px`,
        }}
      >
        {/* HEADER */}
        <div
          className="grid sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm"
          style={{
            gridTemplateColumns: gridColumns,
          }}
        >
          <div className="px-3 py-2 text-[10px] font-semibold uppercase text-gray-500 border-r border-gray-200">
            Fecha
          </div>

          {tieneModulos && (
            <div className="px-1 py-2 text-[10px] font-semibold uppercase text-center text-gray-500 border-r border-gray-200">
              Mód
            </div>
          )}

          {FRANJAS_HORARIAS.map((f, i) => {
            const esHoraCompleta =
              f.inicio.endsWith(':00');

            return (
              <div
                key={f.inicio}
                className={`
                  py-2 text-center border-r border-gray-100
                  ${
                    esHoraCompleta
                      ? 'text-[10px] font-semibold text-gray-700'
                      : 'text-[9px] text-gray-400'
                  }
                `}
              >
                {f.inicio}
              </div>
            );
          })}

          <div className="py-2 text-[10px] font-bold text-center text-gray-700 border-l border-gray-200 bg-gray-50">
            {HORA_FIN_DIA}
          </div>
        </div>

        {filas.map((fila) => {
          const { diaInfo } = fila;

          const rowKey =
            fila.tipo === 'modulo'
              ? `${diaInfo.fechaISO}_${fila.modulo.id}`
              : diaInfo.fechaISO;

          const moduloId =
            fila.tipo === 'modulo'
              ? fila.modulo.id
              : null;

          const clasesFila =
            clasesQueAplicanEnFecha(
              clases,
              diaInfo.fechaISO,
              diaInfo.diaSemana.id,
              moduloId
            );

          const reservasFila =
            reservasQueAplicanEnFecha(
              reservas,
              diaInfo.fechaISO,
              moduloId
            );

          const dragActivo =
            dragState?.rowKey === rowKey;

          const sIni = dragActivo
            ? Math.min(
                dragState.slotInicio,
                dragState.slotFin
              )
            : 0;

          const sFin = dragActivo
            ? Math.max(
                dragState.slotInicio,
                dragState.slotFin
              ) + 1
            : 0;

          const filasDelDia = tieneModulos
            ? lab.modulos.length
            : 1;

          const esUltimaFila =
            fila.tipo === 'normal' ||
            fila.modulo.id ===
              lab.modulos[
                lab.modulos.length - 1
              ].id;

          const esHoy =
            diaInfo.fechaISO === hoy;

          const esFinde =
            diaInfo.esFinDeSemana;

          const fondoFila = esFinde
            ? 'bg-gray-50/70'
            : diaInfo.numeroDia % 2 === 0
            ? 'bg-white'
            : 'bg-gray-50/30';

          return (
            <div
              key={rowKey}
              className={`
                grid relative mb-[2px]
                ${
                  esUltimaFila
                    ? 'border-b border-gray-200'
                    : 'border-b border-gray-100'
                }
                ${fondoFila}
              `}
              style={{
                gridTemplateColumns:
                  gridColumns,
                height: `${alturaFila}px`,
              }}
            >
              {/* LABEL DÍA */}
              {(fila.tipo === 'normal' ||
                fila.esPrimeraDelDia) && (
                <div
                  className={`
                    px-3 border-r border-gray-200
                    flex items-center gap-2
                    ${
                      esHoy
                        ? 'bg-blue-50'
                        : esFinde
                        ? 'bg-gray-100/80'
                        : 'bg-white/80'
                    }
                  `}
                  style={{
                    gridRow: tieneModulos
                      ? `span ${filasDelDia}`
                      : 'span 1',
                    gridColumn: '1 / 2',
                  }}
                >
                  <span
                    className={`
                      text-base font-semibold tabular-nums
                      ${
                        esHoy
                          ? 'text-blue-600'
                          : 'text-gray-800'
                      }
                    `}
                  >
                    {diaInfo.numeroDia}
                  </span>

                  <div className="flex flex-col leading-tight">
                    <span
                      className={`
                        text-[11px]
                        ${
                          esHoy
                            ? 'text-blue-600 font-medium'
                            : 'text-gray-500'
                        }
                      `}
                    >
                      {diaInfo.diaSemana.corto}
                    </span>

                    {esHoy && (
                      <span className="text-[9px] uppercase font-semibold text-blue-500">
                        Hoy
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* MODULO */}
              {tieneModulos && (
                <div
                  className="
                    text-[10px]
                    text-gray-500
                    border-r border-gray-200
                    flex items-center justify-center
                    bg-white/60
                    font-medium
                  "
                  style={{
                    gridColumn: '2 / 3',
                  }}
                >
                  {fila.modulo.corto}
                </div>
              )}

              {/* GRID */}
              <div
                ref={(el) => {
                  rowAreaRefs.current[rowKey] =
                    el;
                }}
                className="relative cursor-crosshair"
                style={{
                  gridColumn: `${colSlotsStart} / span ${TOTAL_SLOTS}`,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${TOTAL_SLOTS}, ${anchoSlot})`,
                  height: '100%',
                }}
                onMouseDown={(e) =>
                  handleMouseDown(e, fila)
                }
                onMouseMove={handleMouseMove}
              >
                {/* BG CELLS */}
                {FRANJAS_HORARIAS.map(
                  (f, i) => {
                    const esHoraCompleta =
                      f.inicio.endsWith(':00');

                    return (
                      <div
                        key={`bg-${rowKey}-${i}`}
                        className={`
                          transition-colors
                          hover:bg-blue-50/50
                          ${
                            esHoraCompleta
                              ? 'border-r border-gray-200'
                              : 'border-r border-gray-100'
                          }
                        `}
                        style={{
                          gridColumn: `${
                            i + 1
                          } / span 1`,
                          gridRow: '1 / 2',
                        }}
                      />
                    );
                  }
                )}

                {/* CLASES */}
                {clasesFila.map((clase) => {
                  const slotInicio =
                    horaASlotIndex(
                      clase.horaInicio
                    );

                  const slotFin =
                    horaASlotIndex(
                      clase.horaFin
                    );

                  const span = Math.max(
                    1,
                    slotFin - slotInicio
                  );

                  return (
                    <div
                      key={`cls-${clase.id}-${diaInfo.fechaISO}`}
                      style={{
                        gridColumn: `${
                          slotInicio + 1
                        } / span ${span}`,
                        gridRow: '1 / 2',
                      }}
                      className="z-[2] h-full px-[2px] py-[3px]"
                    >
                      <BloqueClase
                        clase={clase}
                        onClick={(e) => {
                          e.stopPropagation();

                          onEditarClase?.(
                            clase
                          );
                        }}
                        compacto={
                          tieneModulos
                        }
                        esReserva={false}
                      />
                    </div>
                  );
                })}

                {/* RESERVAS */}
                {reservasFila.map(
                  (reserva) => {
                    const slotInicio =
                      horaASlotIndex(
                        reserva.horaInicio
                      );

                    const slotFin =
                      horaASlotIndex(
                        reserva.horaFin
                      );

                    const span = Math.max(
                      1,
                      slotFin - slotInicio
                    );

                    return (
                      <div
                        key={`res-${reserva.id}-${diaInfo.fechaISO}`}
                        style={{
                          gridColumn: `${
                            slotInicio + 1
                          } / span ${span}`,
                          gridRow: '1 / 2',
                        }}
                        className="z-[3] h-full px-[2px] py-[3px]"
                      >
                        <BloqueClase
                          clase={reserva}
                          onClick={(e) => {
                            e.stopPropagation();

                            onClickReserva?.(
                              reserva
                            );
                          }}
                          compacto={
                            tieneModulos
                          }
                          esReserva={true}
                        />
                      </div>
                    );
                  }
                )}

                {/* DRAG */}
                {dragActivo && (
                  <div
                    className="
                      bg-blue-400/20
                      border border-blue-500
                      rounded-lg
                      z-[4]
                      pointer-events-none
                      flex items-center justify-center
                      text-[10px]
                      font-semibold
                      text-blue-800
                      backdrop-blur-sm
                      m-[2px]
                    "
                    style={{
                      gridColumn: `${
                        sIni + 1
                      } / span ${sFin - sIni}`,
                      gridRow: '1 / 2',
                    }}
                  >
                    {slotIndexAHora(sIni)} –{' '}
                    {slotIndexAHora(sFin)}
                  </div>
                )}
              </div>

              {/* CIERRE */}
              <div
                className="border-l border-gray-200 bg-gray-50/60"
                style={{
                  gridColumn: `${
                    colSlotsStart +
                    TOTAL_SLOTS
                  } / span 1`,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}