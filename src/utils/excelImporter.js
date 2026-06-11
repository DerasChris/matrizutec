import * as XLSX from 'xlsx';

// Mapeo de nombres alternativos de columna → nombre canónico del template
const COL_ALIASES = {
  Lab:                  ['lab', 'laboratorio', 'lab_id', 'id_lab', 'id lab', 'nro_lab', 'numero_lab'],
  Codigo_Asignatura:    ['codigo', 'código', 'cod', 'cod_asig', 'codigo asignatura', 'código asignatura', 'codigoasignatura', 'code'],
  Nombre_Asignatura:    ['nombre', 'asignatura', 'materia', 'nombre asignatura', 'nombreasignatura', 'subject', 'nombre_materia'],
  Seccion:              ['seccion', 'sección', 'sec', 'section', 'grupo', 'group', 'nrc'],
  Docente:              ['docente', 'profesor', 'teacher', 'prof', 'instructor', 'nombre_docente'],
  Dias_Semana:          ['dias', 'días', 'dias_semana', 'días_semana', 'dias semana', 'días semana', 'day', 'days'],
  Hora_Inicio:          ['hora_inicio', 'inicio', 'hora inicio', 'horainicio', 'start', 'start_time', 'hora de inicio'],
  Hora_Fin:             ['hora_fin', 'fin', 'hora fin', 'horafin', 'end', 'end_time', 'hora de fin'],
  Modulos_Lab03:        ['modulos', 'módulos', 'modulos_lab', 'módulos_lab', 'mod', 'modulo', 'módulo'],
  Inscritos:            ['inscritos', 'estudiantes', 'alumnos', 'enrolled', 'cantidad', 'num_estudiantes', 'matriculados'],
  Tipo:                 ['tipo', 'type', 'tipo_clase'],
  Fecha_Inicio_Puntual: ['fecha_inicio', 'fecha inicio', 'fecha inicio puntual', 'start_date', 'fecha_inicio_puntual'],
  Fecha_Fin_Puntual:    ['fecha_fin', 'fecha fin', 'fecha fin puntual', 'end_date', 'fecha_fin_puntual'],
};

// Lookup inverso: alias en minúsculas → nombre canónico
const ALIAS_LOOKUP = {};
for (const [canonical, aliases] of Object.entries(COL_ALIASES)) {
  ALIAS_LOOKUP[canonical.toLowerCase()] = canonical;
  for (const a of aliases) ALIAS_LOOKUP[a.toLowerCase()] = canonical;
}

function normalizarColumnas(rawRow) {
  const out = {};
  for (const [key, val] of Object.entries(rawRow)) {
    const canon = ALIAS_LOOKUP[String(key).trim().toLowerCase()] ?? String(key).trim();
    out[canon] = val;
  }
  return out;
}

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
  const r = normalizarColumnas(raw);
  return {
    lab: String(r['Lab'] ?? '').trim().toLowerCase(),
    codigoAsignatura: String(r['Codigo_Asignatura'] ?? '').trim(),
    nombreAsignatura: String(r['Nombre_Asignatura'] ?? '').trim(),
    seccion: String(r['Seccion'] ?? '').trim(),
    docente: String(r['Docente'] ?? '').trim(),
    diasRaw: String(r['Dias_Semana'] ?? '').trim(),
    horaInicio: normalizarHora(r['Hora_Inicio']),
    horaFin: normalizarHora(r['Hora_Fin']),
    modulosRaw: String(r['Modulos_Lab03'] ?? '').trim(),
    inscritos: r['Inscritos'],
    tipo: String(r['Tipo'] ?? 'regular').trim().toLowerCase() || 'regular',
    fechaInicio: normalizarFecha(r['Fecha_Inicio_Puntual']),
    fechaFin: normalizarFecha(r['Fecha_Fin_Puntual']),
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

// ──────────────────────────────────────────────────────────────
// Parser para formato UTEC institucional
// Variante 1: Escuela | CodMat | Nombre | Docente | Sección | Hora | Dias | Inscritos | Aula
// Variante 2: + CodEmp | Cupo | Disponible | Estado | Paralela | CICLO | REQ.TEAMS
// Omite automáticamente: filas con Estado=Cerrado y aulas virtuales/en-línea
// ──────────────────────────────────────────────────────────────

const DIA_ABREV_UTEC = {
  lu: 'lunes',  lun: 'lunes',
  ma: 'martes', mar: 'martes',
  mi: 'miercoles', mie: 'miercoles', 'mié': 'miercoles',
  ju: 'jueves', jue: 'jueves',
  vi: 'viernes', vie: 'viernes',
  sa: 'sabado',  sab: 'sabado', 'sáb': 'sabado',
  do: 'domingo', dom: 'domingo',
};

function parsearDiasUTEC(valor) {
  if (!valor) return [];
  return String(valor)
    .split(/[-,/\s]+/)
    .map(p => DIA_ABREV_UTEC[p.trim().toLowerCase()])
    .filter(Boolean)
    .filter((d, i, a) => a.indexOf(d) === i);
}

function parsearHoraRangoUTEC(valor) {
  if (!valor) return null;
  const match = String(valor).trim().match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  if (!match) return null;
  const pad = h => h.padStart(5, '0');
  return { horaInicio: pad(match[1]), horaFin: pad(match[2]) };
}

function parsearLabDesdeAula(valor) {
  if (!valor) return '';
  const match = String(valor).trim().match(/LAB[.\s-]*(\d+)/i);
  if (match) return `lab_${String(parseInt(match[1], 10)).padStart(2, '0')}`;
  const numSolo = String(valor).trim().match(/^(\d{1,2})$/);
  if (numSolo) return `lab_${String(parseInt(numSolo[1], 10)).padStart(2, '0')}`;
  return String(valor).trim().toLowerCase();
}

// Aulas que no corresponden a laboratorios físicos — se omiten sin reportar error
function esAulaOmitible(valor) {
  const s = String(valor ?? '').trim().toUpperCase();
  return (
    s === '' ||
    s.includes('VIRTUAL') ||
    s.includes('EN LINEA') ||
    s.includes('EN LÍNEA') ||
    s.includes('EN LíNEA')
  );
}

export function parsearExcelUTEC(buffer, cicloId) {
  let wb;
  try {
    wb = XLSX.read(buffer, { type: 'array' });
  } catch {
    throw new Error('El archivo no es un Excel válido (.xlsx).');
  }

  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('El archivo no tiene hojas.');

  const rawAll = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Detectar fila de encabezados (primeras 15 filas)
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rawAll.length, 15); i++) {
    const rowStr = rawAll[i].map(c => String(c).trim().toLowerCase()).join(' ');
    const tieneCodigo = /codmat|c[oó]digo|cod\.?\s*mat/.test(rowStr);
    const tieneNyD    = rowStr.includes('nombre') && rowStr.includes('docente');
    if (tieneCodigo || tieneNyD) { headerIdx = i; break; }
  }
  if (headerIdx === -1) {
    throw new Error(
      'No se encontró la fila de encabezados. El archivo debe tener columnas como CodMat, Nombre, Docente, Hora, Dias, Aula.'
    );
  }

  const headers = rawAll[headerIdx].map(h => String(h).trim());

  function colIdx(aliases) {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase();
      if (aliases.some(a => h.includes(a))) return i;
    }
    return -1;
  }

  const c = {
    codigo:    colIdx(['codmat', 'código', 'codigo', 'cod. mat', 'cod.mat']),
    nombre:    colIdx(['nombre']),
    docente:   colIdx(['docente', 'profesor']),
    seccion:   colIdx(['sección', 'seccion', 'sec.', "sec'"]),
    hora:      colIdx(['hora', 'horario']),
    dias:      colIdx(['días', 'dias', 'día', 'dia']),
    inscritos: colIdx(['inscrito', 'estudiante', 'alumno']),
    aula:      colIdx(['aula', 'laboratorio', 'salón', 'salon', 'sala']),
    estado:    colIdx(['estado', 'status', 'estado clase']),
  };

  const dataRows = rawAll.slice(headerIdx + 1);
  const validas = [];
  const errores = [];
  let libresCount = 0;
  let cerradas   = 0;
  let virtuales  = 0;

  dataRows.forEach((row, i) => {
    const filaNro = headerIdx + 2 + i;
    if (!row.some(cell => String(cell).trim() !== '')) return;

    const rawNombre    = c.nombre    >= 0 ? String(row[c.nombre]    ?? '').trim() : '';
    const rawCodigo    = c.codigo    >= 0 ? String(row[c.codigo]    ?? '').trim() : '';
    const rawDocente   = c.docente   >= 0 ? String(row[c.docente]   ?? '').trim() : '';
    const rawSeccion   = c.seccion   >= 0 ? String(row[c.seccion]   ?? '').trim() : '';
    const rawInscritos = c.inscritos >= 0 ? row[c.inscritos] : '';
    const rawAula      = c.aula      >= 0 ? String(row[c.aula]      ?? '').trim() : '';
    const rawHora      = c.hora      >= 0 ? row[c.hora] : '';
    const rawDias      = c.dias      >= 0 ? row[c.dias] : '';
    const rawEstado    = c.estado    >= 0 ? String(row[c.estado]    ?? '').trim().toLowerCase() : '';

    if (!rawNombre) return;

    // Filas cerradas / canceladas — omitir sin error
    if (['cerrado', 'cerrada', 'cancelado', 'cancelada', 'inactivo'].includes(rawEstado)) {
      cerradas++;
      return;
    }

    // Aulas virtuales / en línea — omitir sin error
    if (esAulaOmitible(rawAula)) {
      virtuales++;
      return;
    }

    const codigo = rawCodigo || (() => { libresCount++; return `LIBRE-${String(libresCount).padStart(2, '0')}`; })();
    const labId  = parsearLabDesdeAula(rawAula);
    const horas  = parsearHoraRangoUTEC(rawHora);
    const dias   = parsearDiasUTEC(rawDias);

    const errs = [];
    if (!LABS_VALIDOS.has(labId)) errs.push(`Aula no reconocida como laboratorio: "${rawAula}"`);
    if (!horas) {
      errs.push(`Hora inválida: "${rawHora}" — use formato HH:MM-HH:MM`);
    } else {
      if (horaAMinutos(horas.horaInicio) < MIN_MINUTOS) errs.push('Hora inicio antes de 06:30');
      if (horaAMinutos(horas.horaFin) > MAX_MINUTOS)   errs.push('Hora fin después de 20:00');
      if (horaAMinutos(horas.horaFin) <= horaAMinutos(horas.horaInicio))
        errs.push('Hora fin debe ser mayor que hora inicio');
    }
    if (dias.length === 0) errs.push(`Días no reconocidos: "${rawDias}"`);

    if (errs.length > 0) {
      errores.push({ fila: filaNro, referencia: rawCodigo || rawNombre, errores: errs });
    } else {
      validas.push({
        cicloId,
        labId,
        tipo: 'regular',
        codigoAsignatura: codigo.toUpperCase(),
        nombreAsignatura: rawNombre,
        seccion: rawSeccion || '1',
        docente: rawDocente || 'REVISAR',
        pendienteRevision: !rawDocente,
        diasSemana: dias,
        horaInicio: horas.horaInicio,
        horaFin: horas.horaFin,
        modulos: [],
        inscritos: rawInscritos !== '' ? Number(rawInscritos) : 0,
        activo: true,
      });
    }
  });

  const noVacias = dataRows.filter(r => r.some(c => String(c).trim() !== ''));
  return {
    validas,
    errores,
    total: noVacias.length,
    omitidas: cerradas + virtuales,
    desglose: { cerradas, virtuales },
  };
}
