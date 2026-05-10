# LabTrack Horarios — UTEC FICA

Sistema de gestión de horarios y reservas de laboratorios para la Facultad de Informática y Ciencias Aplicadas de la Universidad Tecnológica de El Salvador.

## Estado del proyecto

**Fase 1 completada** — Fundamentos del sistema:
- Autenticación con Google institucional (@utec.edu.sv)
- Tres roles: Encargado, Jefa, Docente
- Modelo de datos en Firestore con 7 colecciones
- Reglas de seguridad por rol
- Layout, navegación y rutas protegidas

## Stack

- React 18 + Vite
- Firebase (Auth, Firestore, Hosting)
- TailwindCSS
- React Router v6
- Lucide icons + react-hot-toast

## Instalación

### 1. Instalar dependencias

```bash
npm install
```

### 2. Crear proyecto en Firebase

1. Ve a https://console.firebase.google.com
2. Crea un proyecto nuevo (sugerido: `labtrack-horarios-utec`)
3. Activa **Authentication** → habilita el proveedor **Google**
4. En Authentication → Settings → Authorized domains, agrega tu dominio de Hosting
5. Activa **Firestore Database** en modo producción
6. En Project Settings → General → Your apps, registra una app web y copia las credenciales

### 3. Configurar variables de entorno

Copia `.env.example` a `.env`:

```bash
cp .env.example .env
```

Edita `.env` con las credenciales de tu proyecto Firebase y configura:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_DOMINIO_INSTITUCIONAL=utec.edu.sv
VITE_EMAIL_JEFA=correo.de.tu.jefa@utec.edu.sv
```

> **Importante:** El `VITE_EMAIL_JEFA` es el correo que será asignado automáticamente con rol "jefa" al primer ingreso. El resto de usuarios entran como "docente" y la jefa los reasigna manualmente desde Admin → Usuarios.

### 4. Desplegar reglas e índices Firestore

```bash
npm install -g firebase-tools
firebase login
firebase use --add  # selecciona tu proyecto
firebase deploy --only firestore:rules,firestore:indexes
```

### 5. Sembrar datos iniciales (laboratorios y ciclo)

Después de hacer login por primera vez como **jefa**, abre la consola del navegador y ejecuta:

```javascript
import('./src/utils/seedData.js').then(m => {
  m.sembrarLaboratorios().then(console.log);
  m.sembrarCicloActual().then(console.log);
});
```

O agrega temporalmente un botón "Sembrar datos" en el Dashboard durante el setup inicial.

### 6. Ejecutar en desarrollo

```bash
npm run dev
```

Abre http://localhost:5173

### 7. Build y despliegue

```bash
npm run build
firebase deploy --only hosting
```

## Modelo de datos Firestore

```
usuarios/
  {uid}: { email, nombre, foto, rol, departamento, activo, creadoEn }

laboratorios/
  lab_01..lab_14: { numero, nombre, ubicacion, capacidad, equipos, activo }

ciclos/
  ciclo_01_2026: { anio, numero, nombre, fechaInicio, fechaFin, activo }

clasesRegulares/
  {id}: { cicloId, labId, codigoAsignatura, nombreAsignatura, seccion,
          inscritos, docente, diasSemana[], horaInicio, horaFin, aula, activo }

reservas/
  {id}: { docenteId, docenteNombre, asignatura, motivo,
          tipo, labId, horaInicio, horaFin,
          fechaInicio, fechaFin, diasSemana[], fechasEspecificas[],
          ocurrencias[], estado, solicitadaEn, revisadaPor, revisadaEn,
          comentarioJefa, cicloId }

notificaciones/
  {id}: { destinatarioId, tipo, mensaje, leida, creadaEn, refId }

configuracion/
  general: { nombreFacultad, direccion, ... }
```

## Roles y permisos

| Acción | Encargado | Jefa | Docente |
|---|---|---|---|
| Ver dashboard / matriz | ✅ | ✅ | ✅ |
| Crear/editar clases regulares | ✅ | ✅ | ❌ |
| Importar Excel | ✅ | ✅ | ❌ |
| Crear reserva | ✅ | ✅ | ✅ |
| Aprobar/rechazar reserva | ❌ | ✅ | ❌ |
| Gestionar usuarios | ❌ | ✅ | ❌ |

## Roadmap

- [x] **Fase 1** — Fundamentos: auth, roles, modelo, reglas
- [ ] **Fase 2** — Vista por laboratorio (estado actual + agenda del día)
- [ ] **Fase 3** — Importador Excel + alta manual de clases regulares
- [ ] **Fase 4** — Matriz mensual completa estilo Excel
- [ ] **Fase 5** — Sistema de reservas con validación de conflictos
- [ ] **Fase 6** — Bandeja de aprobación para jefatura
- [ ] **Fase 7** — Reportes de ocupación y administración de usuarios

## Estructura del proyecto

```
src/
├── components/
│   ├── auth/ProtectedRoute.jsx
│   ├── common/LoadingScreen.jsx
│   └── layout/Header.jsx, MainLayout.jsx
├── context/AuthContext.jsx
├── lib/firebase.js, constants.js
├── pages/Login.jsx, Dashboard.jsx, SinPermiso.jsx, CuentaDesactivada.jsx
├── utils/seedData.js
├── App.jsx
├── main.jsx
└── index.css
```
