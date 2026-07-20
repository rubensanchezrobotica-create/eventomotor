# Flujo de enriquecimiento de eventos

Este procedimiento permite investigar y mejorar eventos existentes de forma auditable, conservadora y reanudable. Cada lote requiere una autorización humana independiente antes de escribir en Supabase.

## Flujo aprobado

1. **Exportación SELECT-only**. Leer los eventos mediante consultas paginadas sin `INSERT`, `UPDATE`, `DELETE`, `UPSERT` ni RPC.
2. **Generación del backlog**. Calcular carencias, prioridad de investigación, normalizaciones orientativas y posibles duplicados sin modificar datos.
3. **Creación de un lote congelado**. Seleccionar 20 eventos y preservar IDs, orden y estado inicial. No regenerar el lote salvo instrucción expresa.
4. **Investigación en bloques**. Dividir el lote en bloques manejables y documentar fuentes, datos confirmados, dudas y cambios propuestos.
5. **Consolidación**. Unificar los bloques, validar el esquema y separar `proposed_updates`, campos sin cambios, campos no resueltos y borrados explícitos.
6. **Comparación con Supabase**. Consultar todos los IDs y comparar cada valor con `expected_current`, incluido `updated_at`.
7. **Dry-run**. Clasificar cada evento, calcular el impacto y bloquear el lote completo ante drift, conflictos, campos inválidos o estados parciales.
8. **Confirmación humana**. Presentar manifiesto, hash, HEAD, número de eventos y cambios previstos. No aplicar sin autorización inequívoca del lote concreto.
9. **Aplicación protegida**. Exigir simultáneamente `--apply`, ID del lote, recuento, SHA-256 del manifiesto y HEAD exacto.
10. **Backup y rollback**. Crear un backup completo antes de la primera escritura y un rollback limitado a los campos que se modificarán. Nunca sobrescribir backups.
11. **Verificación posterior**. Volver a consultar cada evento después del `UPDATE`, comprobar todos los campos y confirmar que `updated_at` cambió.
12. **Regeneración del backlog**. Solo tras una aplicación completa, regenerar la auditoría sin reemplazar automáticamente el lote congelado.
13. **Cierre del lote**. Emitir un informe canónico con resultados, métricas, hashes, correcciones críticas y estado final.

## Estados del preflight

- `pending_ready`: el evento conserva exactamente el estado anterior y puede aplicarse.
- `already_applied_verified`: el estado final coincide por completo; se omite sin ejecutar otro `UPDATE`.
- `partial_state_conflict`: existe una mezcla entre valores anteriores, propuestos o inesperados; bloquea todo el lote.
- `unrelated_drift`: los campos del parche coinciden, pero cambió un campo ajeno; bloquea todo el lote.

La reanudación idempotente siempre consulta el lote completo. Un evento ya aplicado permanece dentro del manifiesto y cuenta para la confirmación del lote, pero no vuelve a escribirse.

## Reglas editoriales y de datos

- No modificar slugs durante un enriquecimiento.
- Preferir fuentes oficiales, organizadores y federaciones; no presentar un agregador como fuente oficial cuando exista una fuente primaria.
- Municipio, provincia, país o nombre del recinto no constituyen por sí solos una dirección exacta.
- No añadir coordenadas sin verificarlas contra una fuente fiable.
- No seleccionar imágenes sin revisar derechos de uso, procedencia y URL de la fuente.
- `null` en un campo no resuelto significa que no hay propuesta; no significa borrar.
- Todo borrado debe aparecer en `explicit_clears` y tener una precondición exacta.
- Preservar siempre backups, rollback manifests e informes de aplicación.
- Detenerse ante drift, conflicto, fallo de concurrencia o aplicación parcial. No reintentar ni ejecutar rollback automáticamente.
- Comparar columnas `timestamptz` por instante, no por su representación textual. El filtro de concurrencia debe conservar literalmente el `updated_at` leído.
- No aplicar más de un lote con la misma autorización humana.

## Comandos de referencia

```powershell
npm run research:export-future-events
npm run research:consolidate-enrichment
npm run research:apply-enrichment -- --manifest <patch-manifest.json>
```

El comando de aplicación real debe incorporar todas las confirmaciones que muestre el dry-run. Nunca se debe construir a mano con hashes aproximados.

## Futuros lotes

- El siguiente identificador será `lote-investigacion-002`.
- Los lotes mantienen un tamaño objetivo de 20 eventos.
- La investigación puede realizarse de forma incremental y a ratos.
- Este trabajo no bloquea la preparación o publicación de la newsletter.
- Cada lote conserva por separado su lote congelado, bloques, consolidado, manifiesto, dry-run, autorización humana, backups e informe de cierre.
- La autorización de un lote nunca se reutiliza para otro.

