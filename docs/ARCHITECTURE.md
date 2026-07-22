# Arquitectura de LabTrack Horarios

## Visión general

Aplicación SPA de React que usa Firebase como backend y Vercel como hosting principal del frontend.

```text
Navegador
  |
  +-- React Router + AuthContext
  |
  +-- Firebase Auth
  |
  +-- Firestore
  |     +-- usuarios
  |     +-- laboratorios
  |     +-- ciclos
  |     +-- clasesRegulares
  |     +-- reservas
  |     +-- notificaciones
  |     +-- adminAlerts
  |     +-- actividadLog
  |     +-- historialCarga
  |     +-- mail
  |
  +-- Cloud Function procesarEmailQueue
          |
          +-- Gmail SMTP mediante Nodemailer
```

## Frontend

- Entry point: `src/main.jsx`.
- Rutas: `src/App.jsx`.
- Layout autenticado: `src/components/layout/MainLayout.jsx`.
- Navegación: `src/components/layout/Sidebar.jsx`.
- Campana/notificaciones: `src/components/layout/Header.jsx`.
- Estado global de sesión y perfil: `src/context/AuthContext.jsx`.

### Rutas públicas

| Ruta | Uso |
|---|---|
| `/solicitud` | Solicitud externa de laboratorio |
| `/login` | Inicio de sesión |
| `/registro` | Registro |
| `/cuenta-desactivada` | Cuenta bloqueada |

### Rutas autenticadas principales

| Ruta | Roles |
|---|---|
| `/` | Todos |
| `/matriz` | Encargado, jefa |
| `/admin/carga` | Encargado, jefa |
| `/admin/ciclos` | Encargado, jefa |
| `/admin/usuarios` | Jefa |
| `/admin/registro` | Jefa |
| `/reservar` | Todos |
| `/mis-reservas` | Autenticados; navegación orientada a docente |
| `/aprobaciones` | Jefa |

## Autenticación y autorización

Firebase Auth mantiene la identidad. Firestore `usuarios/{uid}` contiene el perfil de aplicación.

Campos importantes:

- `uid`
- `email`
- `nombre`
- `rol`
- `activo`
- `labsAsignados`
- `departamento`
- `ultimoAcceso`

Roles:

- `docente`: reservas propias.
- `encargado`: operación de laboratorios asignados.
- `jefa`: administración global.

La jefa inicial puede determinarse por `VITE_EMAIL_JEFA`.

Importante: la autorización visual no sustituye reglas Firestore. Los cambios de seguridad deben validarse tanto en frontend como en `firestore.rules`.

## Modelo de datos

### `laboratorios`

Contiene los 15 laboratorios (`lab_01`–`lab_15`; `lab_15` agregado en 2026-07). Lab 03 tiene módulos `m1` a `m4`.

### `ciclos`

IDs estables:

```text
ciclo_01_YYYY
ciclo_02_YYYY
ciclo_03_YYYY
```

Solo un ciclo debe tener `activo: true`.

### `clasesRegulares`

La colección también almacena eventos especiales.

Tipos:

- `regular`
- `puntual`
- `reunion`
- `defensa`

Campos comunes relevantes:

- `cicloId`
- `labId`
- `tipo`
- `diasSemana`
- `fechaInicio`
- `fechaFin`
- `horaInicio`
- `horaFin`
- `modulos`
- `activo`
- `color`
- `observaciones`

Campos académicos:

- `codigoAsignatura`
- `nombreAsignatura`
- `seccion`
- `docente`
- `inscritos`

Campos de eventos:

- `titulo`
- `docente` para defensa
- `inscritos` como participantes

### `reservas`

Estados:

- `pendiente`
- `aprobada`
- `rechazada`
- `cancelada`

Tipos:

- `unica`
- `rango`
- `recurrente`
- `multiples`
- `tour`

Las solicitudes públicas usan:

- `esExterno: true`
- `docenteId: "publico"`
- `docenteNombre`
- `docenteEmail`
- `facultad`

### `notificaciones`

Notificaciones personales, consultadas por `destinatarioId`.

### `adminAlerts`

Alertas broadcast para admins:

- nuevas reservas;
- nuevos usuarios.

Cada admin registra lectura en `leidaPor`.

### `actividadLog`

Auditoría funcional. Los registros no deben editarse ni eliminarse.

### `historialCarga`

Snapshots inmutables de carga académica para restauración.

### `mail`

Cola de correo. La Cloud Function escucha `mail/{mailId}`, envía el mensaje y escribe `delivery.state`.

## Carga académica

Archivos principales:

- `src/utils/excelTemplate.js`
- `src/utils/excelImporter.js`
- `src/components/admin/ImportarClasesModal.jsx`
- `src/services/clasesService.js`

Formatos:

1. Template estándar.
2. UTEC reporte básico.
3. UTEC reporte completo.

Reglas de importación:

- identidad: `labId|codigoAsignatura|seccion`;
- coincidencias actualizan;
- nuevas crean;
- ausentes se desactivan solo dentro de los labs presentes en el Excel;
- otros labs se preservan;
- colores y observaciones manuales se preservan;
- docente faltante se importa como `REVISAR`;
- las nuevas colisiones requieren decisión;
- se guarda snapshot antes de aplicar cambios.

Las reservas no se eliminan al importar.

## Validación de colisiones

La colisión requiere:

1. mismo laboratorio;
2. día o fecha común;
3. solapamiento de horario;
4. módulo común cuando corresponda.

La lógica está distribuida entre:

- `src/utils/matrizHelpers.js`
- `src/utils/validadorConflictos.js`
- `src/services/clasesService.js`
- formularios de clase/evento/reserva.

Al modificarla, probar clases, reservas, Lab 03, importaciones, movimiento y copia de eventos.

## Notificaciones y correo

### Tiempo real

Firestore `onSnapshot` alimenta:

- notificaciones personales;
- alertas admin;
- reservas pendientes en algunos paneles.

### Correo

`functions/index.js` procesa la colección `mail`.

Variables privadas esperadas en `functions/.env`:

```text
GMAIL_USER=
GMAIL_APP_PASSWORD=
```

No documentar valores reales ni commitear ese archivo.

## Despliegue

### Frontend

Flujo principal:

```text
commit -> push origin/main -> Vercel build -> producción
```

`vercel.json` garantiza el fallback SPA.

### Firebase

Cambios en reglas:

```bash
firebase deploy --only firestore:rules
```

Cambios en índices:

```bash
firebase deploy --only firestore:indexes
```

Cambios en email/backend:

```bash
firebase deploy --only functions
```

Firebase Hosting existe, pero no es el destino principal del frontend.

## Decisiones y deuda técnica

- Mantener `clasesRegulares` como colección común para clases y eventos evita una segunda matriz de consultas, pero exige tratar correctamente `tipo`.
- Las reglas actuales priorizan el formulario público y requieren endurecimiento futuro.
- Conviene mover la creación pública de reservas/correo a una función backend con validación y rate limiting.
- Conviene agregar pruebas unitarias para conflictos e importación antes de ampliar automatizaciones.
- El README necesita actualización y corrección de codificación en una tarea separada.

