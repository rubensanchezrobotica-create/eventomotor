# Newsletter R5A.1: integración legal de lanzamiento

## Fuente y alcance

Documento utilizado: `EventoMotor_bloque_legal_lanzamiento_v0.9.md`, versión
0.9, fechado el 29 de julio de 2026. El archivo entregado no incluía el sufijo
`(1)` citado en la solicitud, pero el título, versión y contenido coinciden con
el documento obligatorio.

R5A.1 contrasta el texto legal con el comportamiento real, integra únicamente
afirmaciones sostenibles y mantiene el canario apagado. No activa newsletter,
Resend, Supabase remoto, Vercel, cron, webhook ni envío semanal.

## Matriz de los 15 requisitos

| # | Requisito | Estado después de R5A.1 | Evidencia | Diferencia y acción pendiente | Bloquea canario | Bloquea apertura |
|---|---|---|---|---|---|---|
| 1 | Provincia opcional y región derivada en servidor | CUMPLIDO Y PROBADO | `NewsletterSignupForm`, `parseRequestNewsletterInput`, `newsletterRegionForProvince`, servicio y test R5A.1 | El formulario ya puede omitir la provincia; el servidor deriva una región controlada o `null`; bienvenida general sin provincia | No | No |
| 2 | Casilla desmarcada y doble opt-in real | CUMPLIDO Y PROBADO | `useState(false)`, bloqueo `!consent`, RPC de solicitud/confirmación, tests R3/R5 | Sin diferencia | No | No |
| 3 | Confirmación durante 24 horas | CUMPLIDO Y PROBADO | `TOKEN_LIFETIME_MS`, token de un uso, pgTAP y tests de servicio | Sin diferencia | No | No |
| 4 | Borrado automático de pendientes a 7 días | REQUIERE MIGRACIÓN | No existe función de purga, cron ni job en la migración newsletter | Añadir operación SQL idempotente, política de borrado y ejecución programada autenticada; validar en PostgreSQL real | Sí | Sí |
| 5 | Baja inmediata e idempotente | CUMPLIDO Y PROBADO | `unsubscribe_newsletter_by_token`, `first_used_at`, concurrencia y pgTAP | Sin diferencia | No | No |
| 6 | Supresión mínima y nueva confirmación al resuscribirse | PARCIALMENTE CUMPLIDO / REQUIERE MIGRACIÓN | `resubscribe` exige nuevo token; la baja desactiva preferencias pero conserva el registro completo | Definir qué campos se anonimizan o eliminan, qué evidencia se conserva y aplicar una RPC transaccional de minimización | Sí | Sí |
| 7 | Rebotes permanentes y quejas mediante webhook autenticado | PENDIENTE DE CÓDIGO Y CONFIGURACIÓN EXTERNA | RPC `record_newsletter_provider_event` bloquea estados, pero no existe endpoint webhook ni autenticación Resend | Diseñar verificación de firma, replay protection, mapeo de eventos y configuración externa; probar extremo a extremo | Sí | Sí |
| 8 | Sin tracking individual de aperturas/clics | PARCIALMENTE CUMPLIDO / PENDIENTE EXTERNO | Payload Resend sin tracking y sin endpoint de ingestión; la base histórica aún admite `opened` y `clicked` | Verificar y documentar tracking desactivado en Resend; una futura migración debería retirar campos/eventos no usados | Sí, hasta verificar | Sí |
| 9 | Rutas públicas fuera de `/preview` | CUMPLIDO Y PROBADO | `/newsletter/confirm`, `/newsletter/unsubscribe`, GET no mutante y POST explícito | Sin diferencia | No | No |
| 10 | GA posterior al consentimiento y fuera de rutas sensibles | CUMPLIDO Y PROBADO EN CÓDIGO | `GoogleAnalytics`, `applyAnalyticsConsent`, exclusión de rutas públicas/preview, test R5A.1 | Al retirar permiso se activa `ga-disable-*` y se intenta borrar las cookies `_ga*` visibles para el documento en el host actual; no se garantiza borrar cookies inaccesibles, de otros dominios o rutas. Verificar manualmente antes del canario | No tras verificación manual | No tras verificación manual |
| 11 | `no-store`, `no-referrer` y logs redactados | CUMPLIDO Y PROBADO | layout newsletter, `connection()`, headers HTTP, limpieza de URL y logger estructurado sin PII | Sin diferencia | No | No |
| 12 | Primera capa en ambos formularios | CUMPLIDO Y PROBADO | Primera capa visible en newsletter y publicación de eventos, enlaces a `/privacidad` | La capa de eventos se integra sin simular las autorizaciones que aún no pueden persistirse | No | No |
| 13 | Contacto interno separado de datos publicables | REQUIERE MIGRACIÓN | `event_submissions` sólo tiene `organizer_name`, `contact_email` y `contact_phone`; no guarda persona interna ni flags de publicación | Añadir columnas y contratos, migrar tipos/API/admin, consentimiento independiente y pruebas de no publicación por defecto | No | Sí, para el flujo de eventos |
| 14 | Remitente exacto | CUMPLIDO Y PROBADO | `NEWSLETTER_PRODUCTION_SENDER` y guard R5A | Exige `La Agenda Motor · EventoMotor <agenda@news.eventomotor.com>`; no cambia variables reales | No | No |
| 15 | Reply-To exacto | CUMPLIDO Y PROBADO | `NEWSLETTER_PRODUCTION_REPLY_TO` y guard R5A | Exige `info@eventomotor.com`; no cambia variables reales | No | No |

## Textos integrados

- Política de privacidad completa y semántica en `/privacidad`.
- Aviso legal provisional completo en `/aviso-legal`.
- Primera capa, campos, consentimiento, edad, CTA y respuesta neutral de la
  newsletter.
- Asunto, preheader y bloque legal del correo de confirmación.
- Pie legal del correo de bienvenida, con privacidad, contacto y baja.
- Pie legal de la plantilla semanal, manteniendo bloqueado su transporte.
- Estados legales de baja satisfactoria, repetida y enlace no disponible.
- Primera capa del formulario de publicación de eventos.
- Primera capa del banner de cookies y tres decisiones equivalentes.
- Remitente y Reply-To esperados en constantes, validadores, ejemplo y tests.

## Diferencias justificadas respecto a v0.9

### Purga de pendientes

Se omite en el formulario, la confirmación y la política la afirmación de que
las solicitudes no confirmadas se eliminan automáticamente a los siete días.
No existe todavía una operación SQL ni un programador que la garantice.

### Minimización después de la baja

La página de baja no afirma que se conserva *únicamente* un registro mínimo.
La baja es inmediata y evita envíos, pero el modelo actual conserva el registro
del suscriptor y necesita una migración para aplicar minimización verificable.

### Formulario de publicación

Se integra la primera capa, pero no se muestran checkboxes de publicación ni
una declaración persistida de autorización. Añadir controles sin columnas,
contrato de API y revisión administrativa supondría simular una preferencia que
el sistema no podría conservar ni aplicar. La migración mínima debe incluir:

- `contact_person_name`;
- `publish_contact_email` con `false` por defecto;
- `publish_contact_phone` con `false` por defecto;
- evidencia/versión de la declaración obligatoria;
- separación inequívoca de `organizer_name` público y contacto interno;
- adaptación de API, tipos, panel de revisión y publicación.

### Motivo de baja

El motivo voluntario queda pospuesto. No condiciona, retrasa ni revierte la
baja y sólo podrá añadirse después de completar la operación.

### Gestionar preferencias

La plantilla semanal no muestra un enlace de gestión de preferencias porque no
existe todavía una ruta autenticada por token que pueda sostenerlo. El envío
semanal sigue bloqueado y esa ruta es un requisito previo a su activación.

## Cambios que requieren migración o infraestructura

1. Purga transaccional de solicitudes `pending` con antigüedad superior a siete
   días, invalidación de tokens relacionados y job programado observable.
2. Política transaccional de minimización después de la baja, preservando sólo
   evidencia y supresión justificadas.
3. Separación persistente del contacto interno y datos publicables de
   organizadores.
4. Revisión futura del esquema que todavía admite aperturas y clics aunque la
   aplicación no los ingiere ni los usa.

Ninguna de estas migraciones se crea o ejecuta en R5A.1.

## Configuración externa pendiente

- Webhook Resend autenticado para rebote permanente y queja.
- Verificación de firma, tolerancia temporal, replay protection e
  idempotencia por provider event ID.
- Confirmación en Resend de que el tracking de aperturas y clics está
  desactivado.
- Verificación manual en navegador del consentimiento y retirada de GA.
- Revisión legal/operativa definitiva del responsable antes de activar.

## Checklist antes del canario

- [ ] Mantener `NEWSLETTER_MODE=off` y
  `NEWSLETTER_MAIL_TRANSPORT=disabled` hasta una ventana autorizada.
- [ ] Implementar y probar purga de pendientes a siete días.
- [ ] Implementar y probar minimización posterior a baja.
- [ ] Implementar webhook autenticado de rebotes y quejas.
- [ ] Verificar tracking individual desactivado en Resend.
- [ ] Verificar banner, rechazo, retirada y limpieza de cookies en navegador.
- [ ] Confirmar remitente y Reply-To exactos.
- [ ] Revisar textos y diferencias con responsable legal.
- [ ] Mantener allowlist de 2–5 participantes informados y rollback disponible.

## Checklist antes de la apertura pública

- [ ] Completar todos los puntos del canario y cerrar sus evidencias.
- [ ] Separar y persistir contacto interno/publicable de organizadores.
- [ ] Crear una gestión de preferencias segura antes del envío semanal.
- [ ] Definir retención y eliminación operativa para solicitudes de eventos.
- [ ] Ejecutar un canario satisfactorio sin PII en logs ni tracking individual.
- [ ] Aprobar legal y operativamente privacidad, cookies, derechos y
  transferencias.
- [ ] Autorizar explícitamente la apertura; R5A.1 no la autoriza.

## Rollback seguro

```dotenv
NEWSLETTER_MODE=off
NEWSLETTER_MAIL_TRANSPORT=disabled
NEWSLETTER_R4B_ARMED=
NEWSLETTER_R4B_LOCAL_ORIGIN=
NEWSLETTER_PRODUCTION_CANARY_ARMED=
NEWSLETTER_PRODUCTION_CANARY_ORIGIN=
NEWSLETTER_PRODUCTION_CANARY_ALLOWLIST=
NEWSLETTER_RESEND_API_KEY=
NEWSLETTER_RESEND_FROM=
NEWSLETTER_RESEND_REPLY_TO=
```

R5A.1 no modifica estos valores reales. El estado seguro sigue siendo
`off/disabled`.
