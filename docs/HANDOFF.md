# Handoff de LabTrack Horarios

Actualizado: 2026-06-25  
Rama observada: `main`  
Último commit observado: `f923915 feat: notificaciones en tiempo real para admins`

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

La sesión actual solo añadió documentación de coordinación entre asistentes. No se cambió código, no se ejecutó build ni se hizo deploy.

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

Antes de añadir Superpowers:

1. Probar las alertas admin en tiempo real.
2. Corregir cualquier problema encontrado.
3. Actualizar este handoff.
4. Definir qué partes de Superpowers se incorporarán: planificación, pruebas, revisión o handoff.
5. Mantener commit/deploy bajo confirmación humana.

## Protocolo para continuar

El siguiente asistente debe:

1. leer `AGENTS.md`;
2. revisar `git status --short`;
3. no asumir que este archivo sustituye al estado real;
4. ejecutar build antes de entregar cambios;
5. no hacer commit ni deploy salvo solicitud explícita.
