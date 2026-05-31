# LabTrack Horarios — UTEC FICA

Sistema de gestión de horarios y reservas de laboratorios de la **Facultad de Informática y Ciencias Aplicadas** de la Universidad Tecnológica de El Salvador.

---

## 📋 Tabla de contenidos

1. [Descripción general](#descripción-general)
2. [Stack tecnológico](#stack-tecnológico)
3. [Estructura del proyecto](#estructura-del-proyecto)
4. [Roles y permisos](#roles-y-permisos)
5. [Funcionalidades por módulo](#funcionalidades-por-módulo)
6. [Modelo de datos](#modelo-de-datos)
7. [Configuración local](#configuración-local)
8. [Despliegue](#despliegue)
9. [Constantes y convenciones](#constantes-y-convenciones)
10. [Pendientes y mejoras futuras](#pendientes-y-mejoras-futuras)

---

## 📖 Descripción general

LabTrack Horarios reemplaza la matriz mensual en Excel que se usaba para administrar los 14 laboratorios de la FICA. El sistema permite:

- Visualizar el estado actual de cualquier laboratorio (ocupado/libre)
- Administrar clases regulares del ciclo académico
- Reservar laboratorios para usos puntuales (asesorías, exámenes, capacitaciones)
- Aprobar/rechazar/modificar reservas desde un panel de jefatura
- Gestionar usuarios y roles del sistema

El sistema considera un caso especial: el **Lab 03 tiene 4 módulos** (M1-M4) con un total de 125 PCs distribuidos, que pueden reservarse independientemente.

---

## 🛠 Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | React | 18 |
| Build tool | Vite | 5 |
| Routing | React Router | 6 |
| Estilos | TailwindCSS | 3 |
| Iconos | Lucide React | - |
| Notificaciones toast | react-hot-toast | - |
| Manipulación fechas | date-fns | - |
| Excel (export) | xlsx | - |
| Backend | Firebase Firestore | v10 |
| Autenticación | Firebase Auth | v10 |
| Hosting | Vercel | - |
| Repositorio | Git/GitHub | - |

### Paleta de colores (UTEC)

```css
utec-primary: #003366  /* azul UTEC */
utec-accent:  #FFCC00  /* amarillo dorado */
utec-light:   #E6F0FA  /* azul muy claro */
utec-dark:    #001A33  /* azul oscuro */
```

---

## 📁 Estructura del proyecto

```
src/
├── components/
│   ├── auth/
│   │   └── ProtectedRoute.jsx        # Guard de rutas según rol
│   ├── layout/
│   │   ├── Header.jsx                # Navbar con notificaciones
│   │   └── MainLayout.jsx            # Layout principal
│   ├── common/
│   │   └── LoadingScreen.jsx
│   ├── dashboard/
│   │   ├── SelectorLab.jsx           # Dropdown de labs
│   │   ├── EstadoActual.jsx          # Tarjeta "ahora"
│   │   └── AgendaDelDia.jsx          # Lista con toggle día completo
│   ├── admin/
│   │   ├── MatrizGrid.jsx            # Calendario mensual del lab
│   │   ├── BloqueClase.jsx           # Bloque visual (clase/reserva)
│   │   ├── ClaseFormulario.jsx       # Modal crear/editar clase
│   │   └── DetalleReservaModal.jsx   # Modal lectura + editar
│   └── reservas/
│       ├── FormularioReserva.jsx     # Form crear reserva (4 tipos)
│       ├── EditarReservaModal.jsx    # Form edición admin
│       ├── PreviewOcurrencias.jsx    # Preview de fechas + conflictos
│       └── TarjetaReserva.jsx        # Card visual
├── context/
│   └── AuthContext.jsx               # Provider de auth + perfil
├── hooks/
│   └── useReloj.js                   # Hook que actualiza cada minuto
├── lib/
│   ├── firebase.js                   # Init Firebase + instancia secundaria
│   └── constants.js                  # Todas las constantes del sistema
├── pages/
│   ├── Login.jsx                     # Login email/password + Google
│   ├── Registro.jsx                  # Registro público
│   ├── Dashboard.jsx                 # Página principal
│   ├── Reservar.jsx                  # Crear reserva (docente)
│   ├── MisReservas.jsx               # Mis solicitudes
│   ├── Aprobaciones.jsx              # Bandeja jefa
│   ├── SinPermiso.jsx
│   ├── CuentaDesactivada.jsx
│   └── admin/
│       ├── MatrizLab.jsx             # Matriz mensual
│       └── GestionUsuarios.jsx       # Panel jefa
├── services/
│   ├── laboratoriosService.js
│   ├── clasesService.js
│   ├── reservasService.js
│   ├── usuariosService.js
│   └── notificacionesService.js
├── utils/
│   ├── dateHelpers.js
│   ├── matrizHelpers.js
│   ├── expansorOcurrencias.js
│   ├── validadorConflictos.js
│   ├── seedData.js                   # Sembrar labs + ciclo
│   └── seedDemoData.js               # Sembrar clases demo
├── App.jsx                           # Rutas
├── main.jsx                          # Entry point
└── index.css                         # Tailwind + estilos globales

# Archivos de configuración (raíz)
firebase.json
firestore.rules
firestore.indexes.json
vite.config.js
package.json
.env                                  # Variables (NO commitear)
.env.example                          # Template público
```

---

## 👥 Roles y permisos

El sistema tiene 3 roles, cada uno con accesos específicos:

### 🟦 Docente (rol por defecto)

- ✅ Ver el estado actual de los laboratorios
- ✅ Solicitar reservas (4 tipos: única, rango, recurrente, múltiples fechas)
- ✅ Ver "Mis reservas" con su historial
- ✅ Cancelar reservas propias **solo si están pendientes**
- ✅ Recibir notificaciones cuando se aprueba/rechaza/modifica su reserva
- ❌ No tiene acceso a la matriz mensual ni a aprobaciones

### 🟩 Encargado

- ✅ Todo lo que puede hacer un docente
- ✅ Acceso a la matriz mensual (crear/editar/eliminar clases regulares)
- ✅ Click en reserva aprobada en la matriz → ver detalle + editar
- ✅ Editar reservas aprobadas (con validación de conflictos)
- ❌ No puede aprobar/rechazar reservas nuevas
- ❌ No puede gestionar usuarios

### 🟥 Jefa

- ✅ Todos los privilegios anteriores
- ✅ Bandeja de aprobaciones (aprobar/rechazar/eliminar reservas pendientes)
- ✅ Modificar reservas aprobadas (mismo poder que encargado)
- ✅ Panel de gestión de usuarios:
  - Crear usuario con contraseña inicial
  - Cambiar rol de cualquier usuario
  - Activar/desactivar cuentas
  - Eliminar cuentas (solo documento Firestore, no auth)
- ⚠️ No puede cambiar su propio rol ni desactivarse a sí misma

> 💡 **Asignación inicial de rol jefa:** se hace mediante la variable `VITE_EMAIL_JEFA`. El primer usuario que se registre con ese email automáticamente recibe rol `jefa`.

---

## 🧩 Funcionalidades por módulo

### 1. Autenticación

- **Login email/password** (método primario)
- **Login con Google** (método secundario, sin restricción de dominio)
- **Registro público abierto** — cualquier email puede crear cuenta
- Asignación automática de rol según email (`docente` por defecto, `jefa` si coincide con `VITE_EMAIL_JEFA`)
- Sesión persistente
- Protección de rutas según rol
- ⏸️ Recuperar contraseña: pendiente

### 2. Dashboard / Estado actual

- Saludo personalizado con nombre del usuario
- Reloj sincronizado al minuto
- Selector de laboratorio (dropdown)
- Tarjeta "AHORA" con la clase o reserva activa en este momento
- Agenda del día con dos vistas (toggle):
  - **Estado actual**: solo activas y futuras
  - **Día completo**: incluye las pasadas con `opacity-60`
- Soporte para clases regulares + reservas aprobadas en la misma agenda
- Chips visuales de módulos para Lab 03
- Panel de "Setup" para admin (sembrar labs, sembrar demo, eliminar demo)

### 3. Matriz mensual de clases

- Vista calendario completa (1 fila por día del mes)
- 14 laboratorios seleccionables
- Lab 03 con 4 sub-filas (M1-M4)
- Header con franjas horarias de 06:30 a 20:00 (slots de 30 min)
- Marca visual de cierre `20:00` al final del header
- Click y arrastrar para crear nueva clase
- Click en bloque para editar
- Día actual destacado
- Fines de semana con fondo gris
- Reservas aprobadas se ven con **borde punteado dorado**
- Click en reserva → modal de detalle con opción de editar (solo admin)
- Detección automática de colisiones al crear clases

### 4. Reservas

#### Para docentes (`/reservar`):

- Formulario con 4 tipos:
  - **Única**: un solo día
  - **Rango**: días consecutivos entre dos fechas
  - **Recurrente**: días específicos de la semana en un rango
  - **Múltiples**: lista de fechas específicas seleccionadas
- Selector de módulos para Lab 03
- Validación en vivo de conflictos contra clases regulares y otras reservas aprobadas
- **Bloqueo de envío si hay cualquier conflicto** (no se puede forzar)
- Preview de todas las ocurrencias antes de enviar

#### Mis reservas (`/mis-reservas`):

- Lista de reservas propias agrupada por estado
- Secciones: Pendientes, Aprobadas, Otras
- Cancelación solo de pendientes
- Toggle "Ver histórico" para fechas pasadas
- Mensajes de aprobación/rechazo visibles

#### Para jefa (`/aprobaciones`):

- Bandeja con pendientes + procesadas recientes
- Detalle completo de cada reserva
- Aprobar con nota opcional
- Rechazar con motivo obligatorio
- Eliminar permanentemente
- **Editar reservas aprobadas** con validación de conflictos
- Notifica automáticamente al docente con diff detallado de cambios

### 5. Sistema de notificaciones

- Campanita en el header con badge de no leídas
- Dropdown con últimas 20 notificaciones
- Suscripción en tiempo real (Firestore onSnapshot)
- Click en notificación → navega al detalle relacionado
- "Marcar todas como leídas"
- Tipos:
  - `reserva_creada` (a jefa)
  - `reserva_aprobada` (a docente)
  - `reserva_rechazada` (a docente)
  - `reserva_modificada` (a docente, con diff)
  - `reserva_eliminada` (a docente)
- ⏸️ Envío por email: configurado pero deshabilitado por ahora

### 6. Gestión de usuarios (jefa)

- Tabla con todos los usuarios del sistema
- Búsqueda por nombre/email
- Filtros por rol y estado
- Cambio de rol con dropdown inline
- Activar/desactivar cuentas
- Eliminar (borra documento Firestore, la cuenta de Firebase Auth queda)
- Modal "Crear usuario" que usa instancia secundaria de Firebase Auth para no perder sesión
- Estadísticas resumen (total, por rol, inactivos)

---

## 🗂 Modelo de datos (Firestore)

### Colección `usuarios/{uid}`

```js
{
  uid: string,
  email: string,
  nombre: string,
  foto: string | null,
  rol: 'docente' | 'encargado' | 'jefa',
  departamento: string,
  activo: boolean,
  proveedor: 'password' | 'google.com',
  creadoEn: timestamp,
  actualizadoEn: timestamp,
  ultimoAcceso: timestamp,
  creadoPorAdmin?: boolean
}
```

### Colección `laboratorios/{labId}`

```js
{
  id: 'lab_01' | 'lab_02' | ... | 'lab_14',
  numero: number,
  nombre: string,
  ubicacion: string,
  capacidad: number,
  equipos: number,
  activo: boolean,
  tieneModulos: boolean,         // true solo para lab_03
  modulos: [                     // solo lab_03
    { id, nombre, corto, pcInicio, pcFin, equipos }
  ]
}
```

### Colección `ciclos/{cicloId}`

```js
{
  id: 'ciclo_01_2026',
  anio: number,
  numero: 1 | 2,
  nombre: string,
  fechaInicio: string (YYYY-MM-DD),
  fechaFin: string,
  activo: boolean
}
```

### Colección `clasesRegulares/{id}`

```js
{
  cicloId: string,
  labId: string,
  codigoAsignatura: string,
  nombreAsignatura: string,
  seccion: string,
  inscritos: number,
  docente: string,
  diasSemana: ['lunes', 'martes', ...],
  horaInicio: 'HH:MM',
  horaFin: 'HH:MM',
  aula: string,
  tipo: 'regular' | 'puntual',
  fechaInicio?: string,           // para puntual o restricción
  fechaFin?: string,
  modulos: string[],              // solo si lab tiene módulos
  activo: boolean,
  esDemo?: boolean
}
```

### Colección `reservas/{id}`

```js
{
  docenteId: string (uid),
  docenteNombre: string,
  docenteEmail: string,
  labId: string,
  labNombre: string,
  modulos: string[],
  tipo: 'unica' | 'rango' | 'recurrente' | 'multiples',
  asignatura: string,
  motivo: string,
  horaInicio: 'HH:MM',
  horaFin: 'HH:MM',
  fechaInicio: string,
  fechaFin: string,
  diasSemana: string[],           // para recurrente
  fechasEspecificas: string[],    // para múltiples
  ocurrencias: string[],          // todas las fechas calculadas
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada',
  aprobadaPor?: string,
  aprobadaPorNombre?: string,
  aprobadaEn?: timestamp,
  notaJefa?: string,
  rechazadaPor?: string,
  rechazadaPorNombre?: string,
  rechazadaEn?: timestamp,
  motivoRechazo?: string,
  canceladaEn?: timestamp,
  modificadaPor?: string,
  modificadaPorNombre?: string,
  modificadaEn?: timestamp,
  creadaEn: timestamp,
  actualizadaEn: timestamp
}
```

### Colección `notificaciones/{id}`

```js
{
  destinatarioId: string (uid) | 'jefa',
  destinatarioEmail: string,
  tipo: string,
  titulo: string,
  mensaje: string,
  refId: string,
  refTipo: 'reserva' | 'clase' | 'usuario',
  leida: boolean,
  creadaEn: timestamp,
  leidaEn?: timestamp
}
```

### Colección `mail/{id}` (cola de emails)

```js
{
  to: string,
  message: {
    subject: string,
    html: string,
    text: string
  },
  // Estos campos los agrega la extensión Trigger Email:
  delivery?: {
    state: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'ERROR',
    attempts: number,
    error?: string
  }
}
```

### Colección `configuracion/{docId}`

Documentos de configuración global (solo jefa).

---

## ⚙️ Configuración local

### Requisitos

- Node.js 18+
- npm o pnpm
- Cuenta de Firebase con proyecto creado
- Cuenta de Vercel para deploy (opcional)

### Pasos

1. Clonar el repo
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Crear archivo `.env` en la raíz copiando `.env.example`:
   ```env
   VITE_FIREBASE_API_KEY=tu_api_key
   VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=tu-proyecto-id
   VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456:web:abc123
   VITE_EMAIL_JEFA=jefatura@utec.edu.sv
   VITE_DOMINIO_INSTITUCIONAL=utec.edu.sv
   ```
4. En Firebase Console:
   - Habilitar Authentication → Email/Password y Google
   - Habilitar Firestore Database
   - Agregar `localhost` a "Authorized domains"
5. Desplegar las reglas e índices de Firestore:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```
6. Arrancar el dev server:
   ```bash
   npm run dev
   ```
7. En el primer acceso, login con la cuenta `VITE_EMAIL_JEFA` para obtener rol de jefa
8. Desde el Dashboard, abrir el panel **Setup** y hacer click en "Sembrar/actualizar labs + ciclo"

---

## 🚀 Despliegue

### Vercel

1. Conectar el repositorio de GitHub en Vercel
2. Configurar todas las variables `VITE_*` en Vercel → Settings → Environment Variables
3. Cada push a `main` despliega automáticamente
4. Agregar el dominio Vercel (`tu-app.vercel.app`) a Firebase → Authentication → Authorized domains

### Firestore

```bash
# Desplegar solo reglas
firebase deploy --only firestore:rules

# Desplegar solo índices
firebase deploy --only firestore:indexes

# Desplegar ambos
firebase deploy --only firestore:rules,firestore:indexes
```

### Si se requiere build manual

```bash
npm run build
# Sube la carpeta dist/ al hosting que prefieras
```

---

## 📐 Constantes y convenciones

### Horarios

- `HORA_INICIO_DIA = '06:30'`
- `HORA_FIN_DIA = '20:00'`
- `SLOT_MINUTOS = 30`
- Total de slots por día: **28**

### Días de la semana

IDs: `lunes`, `martes`, `miercoles`, `jueves`, `viernes`, `sabado`, `domingo`

### Módulos del Lab 03

| ID | Nombre | PCs | Equipos |
|---|---|---|---|
| `m1` | Módulo 1 | 1-27 | 27 |
| `m2` | Módulo 2 | 28-63 | 36 |
| `m3` | Módulo 3 | 64-99 | 36 |
| `m4` | Módulo 4 | 100-125 | 26 |

### Colores de bloques

Los bloques de clases se colorean automáticamente según hash del `codigoAsignatura`. Hay 15 colores en la paleta (`PALETA_COLORES_CLASES`).

### Naming

- Archivos de componentes: **PascalCase** (`AgendaDelDia.jsx`)
- Archivos de servicios/utils: **camelCase** (`reservasService.js`)
- IDs de Firestore: **snake_case** (`lab_01`, `ciclo_01_2026`)
- Variables y funciones: **camelCase**

### Idioma

- Toda la UI, comentarios y mensajes: **Español (es-SV)**
- Código y nombres técnicos: **inglés/spanglish aceptable**

---

## 📌 Pendientes y mejoras futuras

### 🟡 Pulido y mejoras menores

- [ ] Recuperar contraseña olvidada (`sendPasswordResetEmail`)
- [ ] Mostrar módulos del Lab 03 desglosados en la vista "Estado actual"
- [ ] Activar envío real de emails con Trigger Email Extension
- [ ] Eliminar cuenta de Firebase Auth al borrar usuario (requiere Cloud Function)
- [ ] Permitir a encargados ver la bandeja de aprobaciones (solo lectura)

### 🟢 Nice-to-have

- [ ] Reportes y estadísticas (ocupación por lab, top docentes, horarios pico)
- [ ] Exportar a Excel desde la matriz
- [ ] Notificaciones programadas ("tu clase empieza en 15 min")
- [ ] Historial de auditoría completo (quién cambió qué y cuándo)
- [ ] Mejoras móviles (actualmente desktop-first)
- [ ] Importador de clases desde Excel
- [ ] Sistema de invitaciones por email cuando jefa crea usuario
- [ ] Integración con sistema de asistencia (LabTrack original)

---

## 📞 Soporte

**Desarrollador:** Christian Deras
**Email:** christian.deras@utec.edu.sv
**Repositorio:** [agregar URL de GitHub]
**Producción:** [agregar URL de Vercel]

---

## 📄 Licencia

Sistema interno de la Universidad Tecnológica de El Salvador. Uso restringido al personal autorizado de la FICA.
