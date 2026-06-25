# Instrucciones para Claude

La guía canónica de este repositorio es `AGENTS.md`. Léela completa antes de modificar código.

## Inicio de cada sesión

1. Leer `AGENTS.md`.
2. Leer `docs/HANDOFF.md`.
3. Revisar:

```bash
git status --short
git log --oneline -5
```

4. Leer `docs/ARCHITECTURE.md` si la tarea afecta Firebase, roles, reservas, matriz, importaciones, notificaciones o despliegue.

## Reglas específicas

- No asumir que el README refleja el estado actual; el código y `docs/ARCHITECTURE.md` tienen prioridad.
- No hacer commit, push o deploy sin petición explícita del usuario.
- No sobrescribir trabajo de Codex ni cambios locales sin commit.
- No usar ni documentar secretos de `.env` o `functions/.env`.
- El frontend productivo está en Vercel y se actualiza mediante push a GitHub `main`.
- Firebase Hosting no reemplaza el despliegue de Vercel.
- Antes de entregar, ejecutar al menos `npm run build` cuando haya cambios de frontend.
- Actualizar `docs/HANDOFF.md` antes de ceder el trabajo a Codex.

## Formato de entrega

Al finalizar una tarea, indicar:

- resultado;
- archivos modificados;
- validaciones realizadas;
- cambios sin commit;
- despliegues efectuados, si fueron autorizados;
- siguiente paso seguro.

No dupliques aquí toda la arquitectura. Si hay discrepancias, prevalecen `AGENTS.md`, el código y `docs/ARCHITECTURE.md`, en ese orden.

