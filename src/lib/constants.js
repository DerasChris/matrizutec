export const ROLES = {
  ENCARGADO: 'encargado',
  JEFA: 'jefa',
  DOCENTE: 'docente',
};

export const ROLES_LABEL = {
  encargado: 'Encargado de laboratorio',
  jefa: 'Jefatura',
  docente: 'Docente',
};

export const ESTADOS_RESERVA = {
  PENDIENTE: 'pendiente',
  APROBADA: 'aprobada',
  RECHAZADA: 'rechazada',
  CANCELADA: 'cancelada',
};

export const ESTADOS_RESERVA_LABEL = {
  pendiente: 'Pendiente de aprobación',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
};

export const ESTADOS_RESERVA_COLOR = {
  pendiente: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-900', badge: 'bg-amber-500' },
  aprobada: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-900', badge: 'bg-green-600' },
  rechazada: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-900', badge: 'bg-red-600' },
  cancelada: { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-700', badge: 'bg-gray-500' },
};

export const TIPOS_RESERVA = {
  UNICA: 'unica',
  RANGO: 'rango',
  RECURRENTE: 'recurrente',
  MULTIPLES: 'multiples',
  TOUR: 'tour',
};

export const TIPOS_RESERVA_LABEL = {
  unica: 'Día único',
  rango: 'Rango de días consecutivos',
  recurrente: 'Recurrente (varios días por semana)',
  multiples: 'Fechas específicas',
  tour: 'Tour UTEC',
};

export const TIPOS_NOTIFICACION = {
  RESERVA_CREADA: 'reserva_creada',
  RESERVA_APROBADA: 'reserva_aprobada',
  RESERVA_RECHAZADA: 'reserva_rechazada',
  RESERVA_MODIFICADA: 'reserva_modificada',
  RESERVA_ELIMINADA: 'reserva_eliminada',
  RESERVA_CANCELADA: 'reserva_cancelada',
};

export const TIPOS_CLASE = {
  REGULAR: 'regular',
  PUNTUAL: 'puntual',
};

export const TIPOS_CLASE_LABEL = {
  regular: 'Clase regular del ciclo',
  puntual: 'Práctica puntual (un solo día)',
};

export const TIPOS_CICLO = [
  { numero: 1, codigo: '01', nombre: 'Primer Ciclo', corto: 'C01', esInterciclo: false,
    fechaInicioSugerida: (anio) => `${anio}-01-15`,
    fechaFinSugerida: (anio) => `${anio}-06-30` },
  { numero: 2, codigo: '02', nombre: 'Segundo Ciclo', corto: 'C02', esInterciclo: false,
    fechaInicioSugerida: (anio) => `${anio}-08-01`,
    fechaFinSugerida: (anio) => `${anio}-11-30` },
  { numero: 3, codigo: '03', nombre: 'Interciclo', corto: 'C03', esInterciclo: true,
    fechaInicioSugerida: (anio) => `${anio}-07-01`,
    fechaFinSugerida: (anio) => `${anio}-07-31` },
];

export const TIPOS_CICLO_MAP = {
  1: TIPOS_CICLO[0],
  2: TIPOS_CICLO[1],
  3: TIPOS_CICLO[2],
};

export const DIAS_SEMANA = [
  { id: 'lunes', label: 'Lunes', corto: 'Lun', indice: 1 },
  { id: 'martes', label: 'Martes', corto: 'Mar', indice: 2 },
  { id: 'miercoles', label: 'Miércoles', corto: 'Mié', indice: 3 },
  { id: 'jueves', label: 'Jueves', corto: 'Jue', indice: 4 },
  { id: 'viernes', label: 'Viernes', corto: 'Vie', indice: 5 },
  { id: 'sabado', label: 'Sábado', corto: 'Sáb', indice: 6 },
  { id: 'domingo', label: 'Domingo', corto: 'Dom', indice: 0 },
];

export const MESES = [
  { num: 1, id: 'enero', label: 'Enero' },
  { num: 2, id: 'febrero', label: 'Febrero' },
  { num: 3, id: 'marzo', label: 'Marzo' },
  { num: 4, id: 'abril', label: 'Abril' },
  { num: 5, id: 'mayo', label: 'Mayo' },
  { num: 6, id: 'junio', label: 'Junio' },
  { num: 7, id: 'julio', label: 'Julio' },
  { num: 8, id: 'agosto', label: 'Agosto' },
  { num: 9, id: 'septiembre', label: 'Septiembre' },
  { num: 10, id: 'octubre', label: 'Octubre' },
  { num: 11, id: 'noviembre', label: 'Noviembre' },
  { num: 12, id: 'diciembre', label: 'Diciembre' },
];

export const FRANJAS_HORARIAS = (() => {
  const franjas = [];
  let h = 6, m = 30;
  while (h < 20 || (h === 20 && m === 0)) {
    const hora = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const sigM = m + 30;
    const sigH = sigM >= 60 ? h + 1 : h;
    const sigMin = sigM >= 60 ? sigM - 60 : sigM;
    const horaFin = `${String(sigH).padStart(2, '0')}:${String(sigMin).padStart(2, '0')}`;
    franjas.push({ inicio: hora, fin: horaFin, label: `${hora}-${horaFin}` });
    m += 30;
    if (m >= 60) { h++; m = 0; }
  }
  return franjas;
})();

export const HORA_INICIO_DIA = '06:30';
export const HORA_FIN_DIA = '20:00';
export const SLOT_MINUTOS = 30;

export const COLECCIONES = {
  USUARIOS: 'usuarios',
  LABORATORIOS: 'laboratorios',
  CICLOS: 'ciclos',
  CLASES_REGULARES: 'clasesRegulares',
  RESERVAS: 'reservas',
  NOTIFICACIONES: 'notificaciones',
  CONFIGURACION: 'configuracion',
  MAIL_QUEUE: 'mail',
};

export const MODULOS_LAB_03 = [
  { id: 'm1', nombre: 'Módulo 1', corto: 'M1', pcInicio: 1, pcFin: 27, equipos: 27 },
  { id: 'm2', nombre: 'Módulo 2', corto: 'M2', pcInicio: 28, pcFin: 63, equipos: 36 },
  { id: 'm3', nombre: 'Módulo 3', corto: 'M3', pcInicio: 64, pcFin: 99, equipos: 36 },
  { id: 'm4', nombre: 'Módulo 4', corto: 'M4', pcInicio: 100, pcFin: 125, equipos: 26 },
];

export const LABS_INICIALES = Array.from({ length: 14 }, (_, i) => {
  const numero = i + 1;
  const id = `lab_${String(numero).padStart(2, '0')}`;
  const tieneModulos = numero === 3;

  return {
    id,
    numero,
    nombre: `Laboratorio ${String(numero).padStart(2, '0')}`,
    ubicacion: '',
    capacidad: tieneModulos ? 125 : 40,
    equipos: tieneModulos ? 125 : 35,
    activo: true,
    tieneModulos,
    modulos: tieneModulos ? MODULOS_LAB_03 : [],
  };
});

export const SOFTWARE_DISPONIBLE = [
  { id: 'office',        label: 'Microsoft Office (Word, Excel, PowerPoint)' },
  { id: 'autocad',       label: 'AutoCAD' },
  { id: 'adobe',         label: 'Adobe Creative Suite (Photoshop, Illustrator, Premiere)' },
  { id: 'netbeans',      label: 'NetBeans / Eclipse / IntelliJ IDEA' },
  { id: 'vscode',        label: 'Visual Studio / VS Code' },
  { id: 'mysql',         label: 'MySQL Workbench / SQL Server / pgAdmin' },
  { id: 'packet_tracer', label: 'Cisco Packet Tracer' },
  { id: 'matlab',        label: 'MATLAB / Octave' },
  { id: 'python',        label: 'Python / Anaconda / Jupyter Notebook' },
  { id: 'r_studio',      label: 'R / RStudio' },
  { id: 'unity',         label: 'Unity / Unreal Engine' },
  { id: 'solidworks',    label: 'SolidWorks / Inventor / Fusion 360' },
  { id: 'spss',          label: 'SPSS / STATA / SAS (estadística)' },
];

export const PALETA_COLORES_CLASES = [
  '#185FA5', '#5C2C8A', '#2D8F60', '#854F0B', '#A32D2D',
  '#0E7490', '#9333EA', '#15803D', '#B45309', '#BE123C',
  '#1E40AF', '#7C2D12', '#166534', '#92400E', '#991B1B',
];

export function colorPorCodigo(codigo) {
  if (!codigo) return PALETA_COLORES_CLASES[0];
  let hash = 0;
  for (let i = 0; i < codigo.length; i++) {
    hash = codigo.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETA_COLORES_CLASES[Math.abs(hash) % PALETA_COLORES_CLASES.length];
}
