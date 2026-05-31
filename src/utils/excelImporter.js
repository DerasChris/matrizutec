import * as XLSX from 'xlsx';

const DIAS_VALIDOS = new Set(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']);
const MODULOS_VALIDOS = new Set(['m1', 'm2', 'm3', 'm4']);
const LABS_VALIDOS = new Set(
  Array.from({ length: 14 }, (_, i) => `lab_${String(i + 1).padStart(2, '0')}`)
);
const MIN_MINUTOS = 6 * 60 + 30;  // 06:30
const MAX_MINUTOS = 20 * 60;       // 20:00

function horaAMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function normalizarHora(valor) {
  if (typeof valor === 'number') {
    const totalMin = Math.round(valor * 24 * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return String(valor ?? '').trim();
}

function normalizarFecha(valor) {
  if (!valor) return '';
  if (typeof valor === 'number') {
    const info = XLSX.SSF.parse_date_code(valor);
    return `${info.y}-${String(info.m).padStart(2, '0')}-${String(info.d).padStart(2, '0')}`;
  }
  return String(valor).trim();
}

function normalizarFila(raw) {
  return {
    lab: String(raw['Lab'] ?? '').trim().toLowerCase(),
    codigoAsignatura: String(raw['Codigo_Asignatura'] ?? '').trim(),
    nombreAsignatura: String(raw['Nombre_Asignatura'] ?? '').trim(),
    seccion: String(raw['Seccion'] ?? '').trim(),
    docente: String(raw['Docente'] ?? '').trim(),
    diasRaw: String(raw['Dias_Semana'] ?? '').trim(),
    horaInicio: normalizarHora(raw['Hora_Inicio']),
    horaFin: normalizarHora(raw['Hora_Fin']),
    modulosRaw: String(raw['Modulos_Lab03'] ?? '').trim(),
    inscritos: raw['Inscritos'],
    tipo: String(raw['Tipo'] ?? 'regular').trim().toLowerCase() || 'regular',
    fechaInicio: normalizarFecha(raw['Fecha_Inicio_Puntual']),
    fechaFin: normalizarFecha(raw['Fecha_Fin_Puntual']),
  };
}

function validarFila(f) {
  const errores = [];

  if (!LABS_VALIDOS.has(f.lab)) errores.push(`Lab inválido: "${f.lab}"`);
  if (!f.codigoAsignatura) errores.push('Codigo_Asignatura es requerido');
  if (!f.nombreAsignatura) errores.push('Nombre_Asignatura es requerida');
  if (!f.seccion) errores.push('Seccion es requerida');
  if (!f.docente) errores.push('Docente es requerido');

  const dias = f.diasRaw ? f.diasRaw.split(',').map(d => d.trim().toLowerCase()).filter(Boolean) : [];
  if (dias.length === 0) {
    errores.push('Dias_Semana es requerido');
  } else {
    const invalidos = dias.filter(d => !DIAS_VALIDOS.has(d));
    if (invalidos.length) errores.push(`Días inválidos: ${invalidos.join(', ')}`);
  }

  const hiValida = /^\d{2}:\d{2}$/.test(f.horaInicio);
  const hfValida = /^\d{2}:\d{2}$/.test(f.horaFin);

  if (!hiValida) {
    errores.push('Hora_Inicio inválida — use formato HH:MM');
  } else if (horaAMinutos(f.horaInicio) < MIN_MINUTOS) {
    errores.push('Hora_Inicio no puede ser antes de 06:30');
  }

  if (!hfValida) {
    errores.push('Hora_Fin inválida — use formato HH:MM');
  } else if (horaAMinutos(f.horaFin) > MAX_MINUTOS) {
    errores.push('Hora_Fin no puede ser después de 20:00');
  }

  if (hiValida && hfValida && horaAMinutos(f.horaFin) <= horaAMinutos(f.horaInicio)) {
    errores.push('Hora_Fin debe ser mayor que Hora_Inicio');
  }

  if (!['regular', 'puntual'].includes(f.tipo)) errores.push(`Tipo inválido: "${f.tipo}"`);

  if (f.tipo === 'puntual') {
    if (!f.fechaInicio) errores.push('Fecha_Inicio_Puntual es requerida para tipo puntual');
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fechaInicio)) errores.push('Fecha_Inicio_Puntual debe ser YYYY-MM-DD');
  }

  if (f.lab === 'lab_03') {
    if (!f.modulosRaw) {
      errores.push('Modulos_Lab03 es requerido para lab_03');
    } else {
      const mods = f.modulosRaw.split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
      const invalidos = mods.filter(m => !MODULOS_VALIDOS.has(m));
      if (invalidos.length) errores.push(`Módulos inválidos: ${invalidos.join(', ')}`);
    }
  }

  return errores;
}

function filaAClase(f, cicloId) {
  const diasSemana = f.diasRaw.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
  const modulos = f.modulosRaw
    ? f.modulosRaw.split(',').map(m => m.trim().toLowerCase()).filter(Boolean)
    : [];

  const clase = {
    cicloId,
    labId: f.lab,
    codigoAsignatura: f.codigoAsignatura,
    nombreAsignatura: f.nombreAsignatura,
    seccion: f.seccion,
    docente: f.docente,
    diasSemana,
    horaInicio: f.horaInicio,
    horaFin: f.horaFin,
    modulos,
    inscritos: f.inscritos != null && f.inscritos !== '' ? Number(f.inscritos) : 0,
    tipo: f.tipo,
    activo: true,
  };

  if (f.tipo === 'puntual') {
    clase.fechaInicio = f.fechaInicio;
    clase.fechaFin = f.fechaFin || f.fechaInicio;
  }

  return clase;
}

export function parsearExcelClases(buffer, cicloId) {
  let wb;
  try {
    wb = XLSX.read(buffer, { type: 'array' });
  } catch {
    throw new Error('El archivo no es un Excel válido (.xlsx).');
  }

  const ws = wb.Sheets['Carga'];
  if (!ws) throw new Error('No se encontró la hoja "Carga". Asegúrate de usar el template oficial.');

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  if (rows.length === 0) throw new Error('La hoja "Carga" está vacía.');

  const validas = [];
  const errores = [];

  rows.forEach((raw, i) => {
    const fila = normalizarFila(raw);
    const filaNro = i + 2;
    const errs = validarFila(fila);
    if (errs.length === 0) {
      validas.push(filaAClase(fila, cicloId));
    } else {
      errores.push({
        fila: filaNro,
        referencia: fila.codigoAsignatura || `Fila ${filaNro}`,
        errores: errs,
      });
    }
  });

  return { validas, errores, total: rows.length };
}
