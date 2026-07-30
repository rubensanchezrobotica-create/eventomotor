# Newsletter R5B — Captación pública preparada

## Estados operativos

La activación pública queda separada del canario y falla cerrada:

| Estado | Landing y CTA globales | Destinatarios | Entregas |
| --- | --- | --- | --- |
| `off` | `/newsletter` responde 404 y no se renderizan CTA | Ninguno | Ninguna |
| `canary` | Landing canaria noindex; CTA globales ocultos | Allowlist exacta | Confirmación y bienvenida |
| `public launch` | Landing pública indexable y CTA visibles | Cualquier email válido | Confirmación y bienvenida |

Si los gates canario y público quedan armados simultáneamente, la
configuración se considera ambigua y no habilita el runtime.

La edición semanal no forma parte de los comandos transaccionales permitidos y
continúa deshabilitada.

## Variables nuevas

Las variables son server-only y no contienen valores en `.env.example`:

- `NEWSLETTER_PUBLIC_LAUNCH_ENABLED`, cuyo valor operativo exacto debe ser
  `confirmed-public-launch`;
- `NEWSLETTER_PUBLIC_LAUNCH_ORIGIN`, que debe ser exactamente
  `https://www.eventomotor.com`.

El gate exige además `NODE_ENV=production`, Vercel Production real,
`NEWSLETTER_MODE=live`, `NEWSLETTER_MAIL_TRANSPORT=resend`, API key y secreto
de webhook válidos, el remitente contractual y el Reply-To contractual.
Preview, Development, hosts alternativos y orígenes distintos quedan
bloqueados.

## Superficies integradas

Cuando el gate público completo está abierto se muestra una tarjeta reutilizable:

- en Inicio, después del bloque principal de descubrimiento;
- en la ficha pública, después de la información del evento y antes de eventos
  relacionados;
- como enlace `La Agenda Motor` en el footer de esas superficies.

La tarjeta enlaza a `/newsletter`, no contiene formulario, checkbox ni lógica
cliente propia. Durante canario y `off` no se renderiza.

## Landing y primera capa legal

La landing pública usa el canonical
`https://www.eventomotor.com/newsletter`, título y descripción propios y robots
indexables únicamente bajo el gate público. En `off` conserva 404; durante
canario conserva noindex. Todas las variantes continúan siendo dinámicas y las
mutaciones responden con `Cache-Control: no-store`.

El formulario mantiene email, provincia opcional, consentimiento desmarcado,
declaración de edad y respuesta anti-enumeración. La primera capa legal aparece
junto al consentimiento, sin panel destacado, e identifica una sola vez al
responsable. Privacidad y Aviso legal siguen enlazados.

## Checklist previo al lanzamiento

1. CI completamente verde.
2. Confirmar que no existen migraciones pendientes.
3. Verificar remitente y Reply-To exactos.
4. Verificar el secreto del webhook y la API key sin imprimirlos.
5. Retirar el armamento canario antes de armar el lanzamiento público.
6. Configurar las dos variables R5B sólo en Vercel Production.
7. Mantener inicialmente `NEWSLETTER_MODE=off` y el transporte deshabilitado.
8. Confirmar `/newsletter` 404 y ausencia de CTA globales.
9. Cambiar de forma coordinada a `live/resend` y redesplegar.
10. Verificar landing, Inicio, ficha y footer en el host canónico.
11. Completar una suscripción controlada y validar confirmación, bienvenida,
    webhook y baja.
12. Confirmar que no existe ninguna vía de envío semanal.

## Rollback y validación posterior

El rollback no requiere SQL: restablecer `NEWSLETTER_MODE=off` y
`NEWSLETTER_MAIL_TRANSPORT=disabled`, redesplegar y verificar 404, CTA ocultos,
API y webhook fail-closed y ausencia de entregas.

Plan futuro documentado, no ejecutado:

1. CI verde.
2. Merge.
3. Sin migraciones.
4. Despliegue con `off/disabled`.
5. Verificar `/newsletter` 404.
6. Añadir variables públicas sólo en Production.
7. Mantener inicialmente `off/disabled`.
8. Cambiar a `live/resend`.
9. Redesplegar.
10. Verificar landing, Inicio, ficha y footer.
11. Realizar una última suscripción controlada.
12. Abrir públicamente.
13. Ejecutar rollback inmediato mediante `off/disabled` ante cualquier
    incidencia.
