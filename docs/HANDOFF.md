# Handoff de LabTrack Horarios

Actualizado: 2026-07-20
Rama observada: `codex/iis-onpremise`
Rama productiva preservada: `main`

## Estado del repositorio

- El árbol de trabajo estaba limpio al iniciar esta documentación.
- La sesión de documentación añadió estos cinco archivos:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `docs/HANDOFF.md`
  - `docs/ARCHITECTURE.md`
  - `docs/CHANGELOG_DEV.md`
- Frontend principal conectado a GitHub y desplegado por Vercel.
- Firebase se usa para Auth, Firestore, reglas, índices y Cloud Functions.
- Firebase Hosting existe, pero no es el despliegue principal consumido por el usuario.
- `.env` y `functions/.env` están ignorados por Git.

## Funcionalidades vigentes

- Autenticación con email/contraseña y Google.
- Roles `docente`, `encargado`, `jefa`.
- Asignación de laboratorios a encargados.
- Dashboard de estado actual y agenda diaria.
- Matriz mensual y semanal.
- Clases regulares, puntuales, reuniones y defensas de proyecto/tesis.
- Movimiento de clases entre laboratorios con validación.
- Eventos especiales y copia de reuniones a otros laboratorios.
- Reservas internas, Tour UTEC y solicitud pública.
- Solicitudes con software requerido.
- Aprobación/rechazo y correos al solicitante.
- Gestión de ciclos C01, C02 y C03.
- Importación Excel en tres formatos.
- Fusión de carga, detección/resolución de conflictos y snapshots restaurables.
- Gestión global de carga académica.
- Log de actividad.
- Notificaciones personales y alertas admin en tiempo real.
- Exportación imprimible de matriz.

## Cambios más recientes

El commit `f923915` añadió alertas broadcast para admins:

- nueva reserva;
- nuevo usuario;
- navegación desde campana a aprobaciones o usuarios;
- lectura individual mediante `leidaPor`.

Las reglas de `adminAlerts` fueron desplegadas durante esa implementación.

### 2026-07-20 — Fix de importador UTEC + Lab 15 + horario extendido

Se validó la carga real de 3 reportes UTEC (`cupos_Diseño`, `cupos_industrial`,
`cupos_Informatica`, ciclo 02-2026) contra `parsearExcelUTEC` y aparecieron
varios defectos de datos que se corrigieron:

- **Entidades HTML sin decodificar**: los reportes UTEC exportan HTML y las
  tildes/ñ llegaban como `&#243;` etc., incluido el encabezado `Sección`, lo
  que rompía la detección de esa columna y colapsaba todas las secciones a
  `"1"` (causaba colisiones de identidad reales). Se agregó decodificación de
  entidades en `excelImporter.js` para encabezados y valores.
- **Aulas normales vs laboratorios**: el parser reportaba como "error" toda
  aula que no fuera uno de los 14 labs (salones, talleres, auditorios). Ahora
  solo se considera candidato a laboratorio un valor con patrón `LAB.N`; el
  resto se omite en silencio (nueva categoría `aulasRegulares` en el
  desglose), igual que las aulas virtuales/cerradas.
- **Lab 15 agregado**: apareció `SB-LAB.15` en datos reales de Informática.
  Se extendió `LABS_VALIDOS` (`excelImporter.js`) y `LABS_INICIALES`
  (`lib/constants.js`) de 14 a 15. **El documento `laboratorios/lab_15` en
  Firestore todavía no existe** — se crea solo, con valores por defecto
  (nombre "Laboratorio 15", capacidad 40, sin módulos), la próxima vez que
  `sembrarLaboratorios()` corra desde el Dashboard (`Dashboard.jsx:130`).
  Confirmar que esos valores por defecto sean correctos o editarlos en
  Firestore después de que se cree.
- **Horario operativo extendido a 06:30–20:30** (antes 20:00): hay secciones
  reales `18:40-20:10` que antes se rechazaban como error. Cambió
  `HORA_FIN_DIA` en `lib/constants.js` (que ahora también genera
  `FRANJAS_HORARIAS` dinámicamente en vez de un rango hardcodeado), el
  `MAX_MINUTOS` del importador, `MatrizSemanal.jsx` (altura del grid) y los
  textos de `excelTemplate.js`/`AGENTS.md`/`ARCHITECTURE.md`. Se agregó una
  marca visual "salida tardía" (ícono de luna) en `BloqueClase.jsx` (matriz
  mensual y semanal) y `EstadoActual.jsx` (Dashboard) para clases que
  terminan después de las 20:00.
- **Lab 03 sin módulo especificado**: el reporte UTEC casi nunca indica qué
  módulo (M1–M4) usa una sección de Lab 03. El sistema ya no deja
  `modulos: []` en silencio: calcula una sugerencia a partir de la capacidad
  de cada módulo (M1=27, M2=36, M3=36, M4=26, ya definida en
  `MODULOS_LAB_03`) cuando no hay ambigüedad, marca la clase
  `pendienteRevision: true` con `motivosRevision` (`'docente'` y/o
  `'modulo'`) y dejó la sugerencia en `observaciones`. Nunca asigna el
  módulo automáticamente porque M2 y M3 comparten capacidad y son
  indistinguibles solo con el número de inscritos.
- **Importación multi-archivo**: `ImportarClasesModal.jsx` ahora acepta
  varios `.xlsx` a la vez (input y drag-and-drop) y fusiona sus resultados en
  un solo análisis antes de llamar `analizarImport`/`ejecutarImport`. Es
  necesario porque algunos laboratorios aparecen en más de un reporte de
  escuela (en los 3 archivos de prueba: `lab_06` en Diseño e Informática,
  `lab_09` en Diseño e Industrial) — importarlos por separado hacía que el
  segundo archivo desactivara las clases del primero en ese lab, porque el
  alcance de sincronización es "los labs presentes en el Excel".

Validación: los 3 archivos reales fusionados dieron 58 clases válidas, 0
errores, 0 colisiones de identidad. `npm run build` corrido varias veces
durante la sesión, sin errores. No se tocó Firestore en ningún momento de la
sesión (todas las pruebas fueron parseo en memoria).

## Pendiente de validar

Ejecutar pruebas manuales con dos sesiones/navegadores:

1. Jefa autenticada en una ventana.
2. Crear un usuario nuevo en otra ventana.
3. Verificar aparición inmediata de alerta y navegación a `/admin/usuarios`.
4. Crear una reserva.
5. Verificar alerta en tiempo real y navegación a `/aprobaciones`.
6. Marcar alertas como leídas y comprobar que el estado sea individual por admin.

También conviene probar:

- crear, editar, eliminar y copiar reuniones;
- crear defensas;
- validación de colisiones al copiar/mover;
- importación acumulativa entre varios laboratorios;
- restauración de snapshot;
- envío de correo a dominios `@mail.utec.edu.sv`.

Pendiente específico de la carga de ciclo 02-2026 (recién commiteada, el
usuario va a probar en producción):

1. Confirmar que se creó `laboratorios/lab_15` en Firestore con datos
   correctos (o corregirlos si el nombre/capacidad por defecto no sirve).
2. Importar los 3 `.xlsx` convertidos (Diseño, Industrial, Informática) **en
   una sola operación** desde el modal (selección múltiple), no por separado.
3. Revisar el banner de "7 clases de Lab 03 sin módulo" y completar el
   módulo manualmente en cada una desde la matriz.
4. Completar docente en las clases marcadas `REVISAR`.

## Riesgos técnicos conocidos

- `README.md` está desactualizado y su salida en consola muestra texto mal codificado.
- Existe un `AuthContext.jsx` en la raíz que parece legado; el usado por la app es `src/context/AuthContext.jsx`.
- `reservas` tiene lectura pública en reglas para soportar disponibilidad; esto expone más datos de los necesarios.
- `mail` permite creación pública; debe endurecerse contra abuso.
- `adminAlerts` permite creación a cualquier usuario autenticado; validar payload o mover creación sensible a backend sería más seguro.
- Las reglas de encargado no restringen por sí mismas escrituras a `labsAsignados`; el filtrado principal ocurre en frontend.
- Cloud Functions 1st Gen usa Node.js 20 y Firebase Functions v5; hay deuda futura de actualización.
- El bundle supera 500 kB por Firebase/XLSX; considerar code splitting.
- No hay pruebas automatizadas.

## Próximo paso recomendado

Probar el build paralelo IIS:

1. Agregar `tecnologica.utec.edu.sv` a Authorized domains en Firebase Auth.
2. Ejecutar `npm run build:onpremise`.
3. Copiar `dist-onpremise/` a `C:\inetpub\wwwroot\tecnologica\laboratorios\`.
4. Validar rutas directas y refresh; el `web.config` limpia reglas heredadas
   de WordPress y reescribe a `/laboratorios/index.html`.
5. Validar login y conexión con Firebase.
6. Mantener Vercel/main como producción estable durante el piloto.

## Protocolo para continuar

El siguiente asistente debe:

1. leer `AGENTS.md`;
2. revisar `git status --short`;
3. no asumir que este archivo sustituye al estado real;
4. ejecutar build antes de entregar cambios;
5. no hacer commit ni deploy salvo solicitud explícita.
