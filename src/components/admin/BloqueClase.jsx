import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Users, Clock, Bookmark, BookOpen, GraduationCap, Hash, Award, Moon } from 'lucide-react';
import { colorPorCodigo, TIPOS_CLASE, TIPOS_CLASE_LABEL } from '../../lib/constants';
import { formatearHora } from '../../utils/dateHelpers';
import { esDispositivoTactil } from '../../utils/matrizHelpers';

const COLOR_REUNION = '#7c3aed';
const COLOR_DEFENSA = '#0d9488';

// A partir de esta hora una clase se considera de salida tardía (después del
// cierre "normal" de 20:00, aunque el horario operativo llega hasta 20:30).
const HORA_SALIDA_TARDIA = '20:00';
function esSalidaTardia(horaFin) {
  return typeof horaFin === 'string' && horaFin > HORA_SALIDA_TARDIA;
}

function TooltipCard({ clase, esReserva, pos }) {
  const W = 256;
  let left = pos.left + pos.width / 2 - W / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - W - 8));

  // Mostrar arriba si hay espacio, abajo si no
  const arriba = pos.top > 180;
  const top = arriba ? pos.top - 6 : pos.top + pos.height + 6;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top,
        left,
        width: W,
        zIndex: 9999,
        pointerEvents: 'none',
        transform: arriba ? 'translateY(-100%)' : 'none',
      }}
    >
      {/* Flecha arriba (cuando tooltip aparece abajo) */}
      {!arriba && (
        <div className="flex justify-center -mb-1">
          <div className="w-3 h-3 bg-gray-900 rotate-45 rounded-sm" />
        </div>
      )}

      <div className="bg-gray-900 text-white rounded-xl shadow-2xl overflow-hidden">
        {/* Franja de color */}
        <div
          className="h-1.5 w-full"
          style={{ backgroundColor: clase.color || colorPorCodigo(clase.codigoAsignatura || clase.asignatura || 'X') }}
        />

        <div className="p-3 space-y-2">
          {esReserva ? (
            <>
              <div className="flex items-center gap-1.5">
                <Bookmark size={11} className="text-amber-400 shrink-0" />
                <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide">
                  Reserva aprobada
                </span>
              </div>
              <p className="font-semibold text-sm leading-snug">
                {clase.asignatura || clase.motivo || 'Sin título'}
              </p>
              {clase.docenteNombre && (
                <div className="flex items-center gap-1.5 text-gray-300 text-[11px]">
                  <GraduationCap size={11} className="shrink-0" />
                  {clase.docenteNombre}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-gray-300 text-[11px]">
                <Clock size={11} className="shrink-0" />
                {formatearHora(clase.horaInicio)} – {formatearHora(clase.horaFin)}
                {esSalidaTardia(clase.horaFin) && (
                  <span className="flex items-center gap-0.5 text-amber-400"><Moon size={10} /> salida tardía</span>
                )}
              </div>
            </>
          ) : clase.tipo === TIPOS_CLASE.REUNION ? (
            <>
              <div className="flex items-center gap-1.5">
                <Users size={11} className="text-violet-300 shrink-0" />
                <span className="text-[10px] font-semibold text-violet-300 uppercase tracking-wide">Reunión</span>
              </div>
              <p className="font-semibold text-sm leading-snug mt-1">{clase.titulo || 'Reunión'}</p>
              <div className="flex items-center gap-1.5 text-gray-300 text-[11px] mt-1">
                <Clock size={11} className="shrink-0" />
                {formatearHora(clase.horaInicio)} – {formatearHora(clase.horaFin)}
                {esSalidaTardia(clase.horaFin) && (
                  <span className="flex items-center gap-0.5 text-amber-400"><Moon size={10} /> salida tardía</span>
                )}
              </div>
              {clase.observaciones && (
                <p className="text-gray-400 text-[10px] italic border-t border-gray-700 pt-2 mt-2">
                  {clase.observaciones}
                </p>
              )}
            </>
          ) : clase.tipo === TIPOS_CLASE.DEFENSA ? (
            <>
              <div className="flex items-center gap-1.5">
                <Award size={11} className="text-teal-300 shrink-0" />
                <span className="text-[10px] font-semibold text-teal-300 uppercase tracking-wide">Defensa</span>
              </div>
              <p className="font-semibold text-sm leading-snug mt-1">{clase.titulo || 'Defensa'}</p>
              <div className="border-t border-gray-700 pt-2 space-y-1 mt-2">
                {clase.docente && (
                  <div className="flex items-center gap-1.5 text-gray-300 text-[11px]">
                    <GraduationCap size={11} className="shrink-0" /> {clase.docente}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-gray-300 text-[11px]">
                  <Clock size={11} className="shrink-0" />
                  {formatearHora(clase.horaInicio)} – {formatearHora(clase.horaFin)}
                  {esSalidaTardia(clase.horaFin) && (
                    <span className="flex items-center gap-0.5 text-amber-400"><Moon size={10} /> salida tardía</span>
                  )}
                </div>
                {clase.inscritos > 0 && (
                  <div className="flex items-center gap-1.5 text-gray-300 text-[11px]">
                    <Users size={11} className="shrink-0" /> {clase.inscritos} participantes
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="font-semibold text-[13px] leading-snug">
                  {clase.nombreAsignatura || clase.codigoAsignatura}
                </p>
                <div className="flex items-center gap-1 text-gray-400 text-[10px] mt-0.5">
                  <Hash size={9} />
                  <span>
                    {clase.codigoAsignatura}{clase.seccion ? ` · Sección ${clase.seccion}` : ''}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-700 pt-2 space-y-1.5">
                {clase.docente && (
                  <div className="flex items-center gap-1.5 text-gray-300 text-[11px]">
                    <GraduationCap size={11} className="shrink-0" />
                    {clase.docente}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-gray-300 text-[11px]">
                  <Clock size={11} className="shrink-0" />
                  {formatearHora(clase.horaInicio)} – {formatearHora(clase.horaFin)}
                  {esSalidaTardia(clase.horaFin) && (
                    <span className="flex items-center gap-0.5 text-amber-400"><Moon size={10} /> salida tardía</span>
                  )}
                </div>
                {clase.inscritos > 0 && (
                  <div className="flex items-center gap-1.5 text-gray-300 text-[11px]">
                    <Users size={11} className="shrink-0" />
                    {clase.inscritos} inscritos
                  </div>
                )}
              </div>

              {clase.observaciones && (
                <p className="text-gray-400 text-[10px] italic border-t border-gray-700 pt-2">
                  {clase.observaciones}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Flecha abajo (cuando tooltip aparece arriba) */}
      {arriba && (
        <div className="flex justify-center -mt-1">
          <div className="w-3 h-3 bg-gray-900 rotate-45 rounded-sm" />
        </div>
      )}
    </div>,
    document.body
  );
}

export default function BloqueClase({ clase, onClick, compacto = false, esReserva = false, modoLectura = false }) {
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);

  const esReunion = clase.tipo === TIPOS_CLASE.REUNION;
  const esDefensa = clase.tipo === TIPOS_CLASE.DEFENSA;

  const codigo = clase.codigoAsignatura || clase.asignatura || clase.motivo || 'X';
  const color = esReunion
    ? COLOR_REUNION
    : esDefensa
    ? COLOR_DEFENSA
    : (clase.color || colorPorCodigo(codigo));

  const titulo = esReserva
    ? (clase.asignatura || clase.motivo || 'Reserva')
    : esReunion || esDefensa
    ? (clase.titulo || TIPOS_CLASE_LABEL?.[clase.tipo] || clase.tipo)
    : (clase.nombreAsignatura || clase.codigoAsignatura || '');

  const subtitulo = !esReserva && !esReunion && !esDefensa
    ? `${clase.codigoAsignatura || ''}${clase.seccion ? `-${clase.seccion}` : ''}`
    : esDefensa && clase.docente
    ? clase.docente.split(' ')[0]
    : null;

  const Icono = esReserva ? Bookmark : esReunion ? Users : esDefensa ? Award : BookOpen;

  function onEnter() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.top, left: r.left, width: r.width, height: r.height });
  }

  // En modo concentración, en un dispositivo táctil no hay hover previo al
  // clic — el primer toque muestra el tooltip en vez de abrir el editor; un
  // segundo toque sobre el mismo bloque lo cierra. En desktop (o fuera de
  // modo concentración) el clic sigue abriendo el editor como siempre.
  function handleClick(e) {
    if (modoLectura && esDispositivoTactil()) {
      e.stopPropagation();
      if (pos) { setPos(null); return; }
      onEnter();
      return;
    }
    onClick?.(e);
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleClick}
        onMouseEnter={onEnter}
        onMouseLeave={() => setPos(null)}
        className={`relative w-full h-full text-left rounded text-white px-2 py-1 hover:ring-2 hover:ring-white hover:ring-offset-1 transition-all overflow-hidden flex flex-col justify-center ${
          esReserva ? 'border-2 border-dashed border-amber-300' : ''
        }`}
        style={{ backgroundColor: color }}
      >
        {esSalidaTardia(clase.horaFin) && (
          <Moon size={10} className="absolute top-1 right-1 text-amber-300 drop-shadow" aria-label="Salida tardía" />
        )}
        <div className="flex items-center gap-1 text-[11px] font-semibold leading-tight truncate">
          <Icono size={10} className="flex-shrink-0" />
          <span className="truncate">{titulo}</span>
        </div>
        {!compacto && (
          <div className="flex items-center gap-2 text-[9px] opacity-80 leading-tight truncate mt-0.5">
            {subtitulo && <span className="truncate">{subtitulo}</span>}
            {esReserva && clase.docenteNombre && (
              <span className="truncate">{clase.docenteNombre.split(' ')[0]}</span>
            )}
          </div>
        )}
      </button>

      {pos && <TooltipCard clase={clase} esReserva={esReserva} pos={pos} />}
    </>
  );
}
