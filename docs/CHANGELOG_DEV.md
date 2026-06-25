# Changelog técnico de desarrollo

Este archivo registra decisiones de arquitectura y cambios que importan para futuras sesiones. No sustituye el historial de Git.

## 2026-06-25 - Documentación compartida Claude/Codex

- Se añadió `AGENTS.md` como guía canónica para asistentes.
- Se añadió `CLAUDE.md` como punto de entrada específico para Claude.
- Se añadió `docs/HANDOFF.md` para transferencia de contexto.
- Se añadió `docs/ARCHITECTURE.md` con rutas, colecciones, despliegue y decisiones.
- Se documentó el protocolo previo a incorporar Superpowers.
- No se modificó lógica de aplicación.
- No se modificó lógica de aplicación ni se hizo deploy.

## 2026-06 - Notificaciones admin en tiempo real

- Se añadió `adminAlerts`.
- Las nuevas reservas y usuarios generan alertas broadcast.
- Cada admin conserva estado de lectura mediante `leidaPor`.
- El header mezcla alertas admin y notificaciones personales.

## 2026-06 - Eventos especiales

- Se añadieron reuniones y defensas como tipos de `clasesRegulares`.
- Reuniones pueden copiarse a otro laboratorio con validación.
- Defensas incluyen docente y participantes.
- La matriz y tooltips distinguen tipos por color e icono.

## 2026-06 - Gestión global de carga

- Se añadió `/admin/carga`.
- Tabla maestra, filtros, edición y detector de conflictos.
- Se añadió movimiento entre laboratorios con validación.

## 2026-06 - Importación académica robusta

- Tres formatos Excel.
- Importación por fusión.
- Desactivación limitada a los labs presentes en el archivo.
- Resolución de conflictos antes de aplicar.
- Snapshots y restauración.
- Docente faltante marcado como `REVISAR`.

## 2026-06 - Correo

- Se sustituyó Resend por Gmail SMTP con Nodemailer.
- La cola `mail` se procesa mediante Cloud Function.
- Solicitudes externas envían confirmación al solicitante.

## 2026-06 - Navegación y matriz

- Sidebar en escritorio y drawer móvil.
- Matriz mensual y semanal.
- Encabezado horario sticky.
- Exportación imprimible.
- Colores editables y tooltips enriquecidos.

## Plantilla para próximas entradas

```md
## YYYY-MM-DD - Título

- Objetivo:
- Decisión:
- Archivos clave:
- Validación:
- Riesgos o pendientes:
```
