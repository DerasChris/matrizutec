# Despliegue paralelo en IIS

Este despliegue no reemplaza Vercel. Ambos frontends usan el mismo proyecto Firebase.

```text
GitHub main -> Vercel -> Firebase
Rama codex/iis-onpremise -> IIS /laboratorios -> Firebase
```

## Generar el paquete

Desde la raíz del repositorio:

```bash
npm install
npm run build:onpremise
```

El resultado queda en:

```text
dist-onpremise/
```

Incluye:

- `index.html`
- `assets/`
- `web.config`
- `DEPLOY-INFO.txt`

## Configuración previa de Firebase

En Firebase Console:

1. Authentication.
2. Settings.
3. Authorized domains.
4. Agregar `tecnologica.utec.edu.sv`.

Si la API key tiene restricciones HTTP en Google Cloud, agregar:

```text
https://tecnologica.utec.edu.sv/*
```

## Copiar al servidor

Destino esperado:

```text
C:\inetpub\wwwroot\tecnologica\laboratorios\
```

Procedimiento:

1. Respaldar el `index.html` de prueba.
2. No tocar otras carpetas de `C:\inetpub\wwwroot`.
3. Copiar el contenido interno de `dist-onpremise/` dentro de `laboratorios/`.
4. Confirmar que `web.config` quede junto a `index.html`.

Resultado:

```text
laboratorios/
├── index.html
├── assets/
├── web.config
└── DEPLOY-INFO.txt
```

## Pruebas

Abrir:

```text
https://tecnologica.utec.edu.sv/laboratorios/
https://tecnologica.utec.edu.sv/laboratorios/login
https://tecnologica.utec.edu.sv/laboratorios/matriz
```

Probar:

- carga de assets;
- login email/contraseña;
- login Google;
- refresh directo en `/laboratorios/matriz`;
- lectura y escritura en Firebase;
- notificaciones en tiempo real;
- cierre de sesión.

## Error 500.19

Si IIS devuelve `500.19` al copiar `web.config`, probablemente falta el módulo **IIS URL Rewrite**. No eliminar reglas ni tocar el sitio principal: solicitar la instalación del módulo o configurar el rewrite a nivel del sitio con infraestructura.

## Una ruta funciona al navegar, pero da 404 al refrescar

React Router resuelve las rutas dentro del navegador. Un refresh en
`/laboratorios/matriz` hace que IIS busque una carpeta o archivo físico llamado
`matriz`. El `web.config` incluido en el build limpia las reglas heredadas de
WordPress y reescribe toda ruta no física a:

```text
/laboratorios/index.html
```

Para corregirlo, reemplazar el `web.config` del servidor por el generado más
recientemente y confirmar que **IIS URL Rewrite** esté instalado.

## Actualizaciones posteriores

Cada actualización IIS:

```bash
git switch codex/iis-onpremise
git pull
npm install
npm run build:onpremise
```

Luego reemplazar únicamente:

- `index.html`
- `assets/`
- `web.config`

La aplicación Vercel permanece intacta.
