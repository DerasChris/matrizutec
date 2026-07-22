import { copyFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'dist-onpremise');

await copyFile(
  resolve(root, 'deploy', 'iis', 'web.config'),
  resolve(output, 'web.config'),
);

await writeFile(
  resolve(output, 'DEPLOY-INFO.txt'),
  [
    'LabTrack Horarios - build IIS',
    '',
    'Destino:',
    'C:\\inetpub\\wwwroot\\tecnologica\\laboratorios\\',
    '',
    'Copiar el CONTENIDO de dist-onpremise, no la carpeta contenedora.',
    'La URL esperada es:',
    'https://tecnologica.utec.edu.sv/laboratorios/',
    '',
    'Este build continúa conectado al mismo Firebase que la versión Vercel.',
    '',
  ].join('\r\n'),
  'utf8',
);

console.log('Paquete IIS preparado en dist-onpremise/');
