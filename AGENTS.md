# LabTrack Horarios - Guía para agentes

Este archivo es la fuente principal de instrucciones para cualquier asistente que trabaje en este repositorio, incluyendo Codex, Claude y futuras herramientas de automatización.

## Inicio obligatorio de sesión

Antes de proponer o modificar código:

1. Leer `AGENTS.md`.
2. Leer `docs/HANDOFF.md`.
3. Consultar `docs/ARCHITECTURE.md` cuando la tarea toque autenticación, Firestore, reservas, importaciones, notificaciones o despliegue.
4. Ejecutar:

```bash
git status --short
git log --oneline -5
```

5. Preservar cambios locales existentes. No asumir que una modificación sin commit puede descartarse.

## Descripción breve

LabTrack Horarios administra horarios, clases, eventos especiales y reservas de los laboratorios de UTEC FICA.

Stack principal:

- React 18 + Vite 5.
- React Router 6.
- Tailwind CSS 3.
- Firebase Auth y Firestore.
- Cloud Functions 1st Gen, Node.js 20.
- Nodemailer con Gmail SMTP.
- Vercel como despliegue principal del frontend.

## Reglas de colaboración

- No hacer commit, push, deploy ni cambios externos salvo que el usuario lo solicite explícitamente.
- Cuando el usuario pida implementar, completar la funcionalidad y verificarla antes de entregar.
- Antes de cambiar de Claude a Codex o viceversa, actualizar `docs/HANDOFF.md`.
- No trabajar simultáneamente con dos asistentes sobre los mismos archivos.
- Para trabajo paralelo usar ramas separadas. En Codex, usar por defecto el prefijo `codex/`.
- Mantener commits pequeños y descriptivos.
- No mezclar refactors generales con una funcionalidad concreta.
- No eliminar datos, colecciones, reglas o cambios locales sin autorización explícita.

## Validación mínima

Después de modificar frontend:

```bash
npm run build
```

Cuando sea relevante:

```bash
npm run lint
```

Después de modificar Cloud Functions:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

Solo desplegar si el usuario lo pide. El frontend productivo se despliega desde GitHub hacia Vercel; `firebase deploy --only hosting` no actualiza Vercel.

## Git y despliegue

- Rama productiva actual: `main`.
- Remoto: `origin`.
- Repositorio: `https://github.com/DerasChris/matrizutec.git`.
- Frontend productivo: Vercel consume `main`.
- `vercel.json` contiene el rewrite SPA.
- Firestore rules e indexes se despliegan manualmente:

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

- Las funciones se despliegan manualmente:

```bash
firebase deploy --only functions
```

## Seguridad y secretos

Nunca leer en voz alta, copiar a documentación, commitear o exponer:

- `.env`
- `functions/.env`
- API keys privadas.
- Gmail App Password.
- Credenciales de Firebase o SMTP no destinadas al frontend.

Ambos archivos `.env` están ignorados por Git. Confirmarlo antes de commits sensibles:

```bash
git check-ignore -v .env functions/.env
```

No introducir secretos con prefijo `VITE_` salvo valores diseñados para ser públicos: Vite los incorpora al bundle del navegador.

## Convenciones funcionales importantes

- Roles: `docente`, `encargado`, `jefa`.
- La jefa es el superadmin.
- Los encargados solo deben operar los laboratorios incluidos en `perfil.labsAsignados`.
- Solo existe un ciclo activo global.
- Lab 03 tiene módulos `m1` a `m4`.
- Horario operativo: 06:30 a 20:00, slots de 30 minutos.
- Las reservas aprobadas y clases/eventos deben validarse contra colisiones.
- Tipos de clase/evento: `regular`, `puntual`, `reunion`, `defensa`.
- Tipos de reserva: `unica`, `rango`, `recurrente`, `multiples`, `tour`.
- No borrar reservas al importar carga académica.
- La importación usa fusión y snapshots; debe preservar colores y observaciones manuales.
- Las importaciones parciales solo sincronizan los laboratorios presentes en el Excel.
- Una clase sin docente puede importarse como `REVISAR` con `pendienteRevision: true`.

## Archivos clave

- Rutas: `src/App.jsx`
- Roles, tipos y laboratorios: `src/lib/constants.js`
- Autenticación real: `src/context/AuthContext.jsx`
- No usar como referencia: `AuthContext.jsx` en la raíz; parece un archivo legado.
- Reglas Firestore: `firestore.rules`
- Servicios de clases/importación: `src/services/clasesService.js`
- Reservas: `src/services/reservasService.js`
- Notificaciones: `src/services/notificacionesService.js`
- Email: `functions/index.js`
- Matriz: `src/pages/admin/MatrizLab.jsx`
- Gestión global de carga: `src/pages/admin/GestionCarga.jsx`
- Importación Excel: `src/utils/excelImporter.js`
- Historial y ciclos: `src/pages/admin/GestionCiclos.jsx`

## Handoff entre asistentes

Antes de terminar una sesión:

1. Ejecutar build/pruebas relevantes.
2. Registrar en `docs/HANDOFF.md`:
   - objetivo;
   - cambios realizados;
   - archivos modificados;
   - pruebas ejecutadas;
   - pendientes;
   - bloqueos;
   - último commit conocido;
   - siguiente paso recomendado.
3. Actualizar `docs/CHANGELOG_DEV.md` si hubo una decisión técnica relevante.
4. Informar si hay cambios sin commit.

El asistente entrante debe continuar desde el handoff y el estado real de Git, no desde recuerdos del chat.

## Preparación para Superpowers

No instalar ni configurar Superpowers sin autorización explícita. Cuando se incorpore:

- mantener `AGENTS.md` como política del repositorio;
- usar `docs/HANDOFF.md` como estado operativo;
- documentar cualquier skill o workflow añadido;
- evitar que nuevas automatizaciones hagan commit o deploy automáticamente;
- exigir build y revisión humana antes de integrar cambios.

