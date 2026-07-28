# Newsletter reintegration R4A — Guarded Resend transport

## Objetivo y alcance

R4A incorpora un adaptador Resend aislado, server-only y deshabilitado por
defecto. La fase prepara la integración para pruebas controladas posteriores,
pero no configura credenciales, no verifica dominios y no realiza envíos
reales.

La arquitectura resultante es:

`NewsletterService → NewsletterMailTransport → ResendNewsletterMailTransport → NewsletterResendClient`

Null, Capture y Resend se seleccionan en
`createConfiguredNewsletterMailRuntime()`. Los endpoints no contienen
condiciones específicas del proveedor y no existe un segundo servicio.

## Cliente elegido

Se usa un cliente HTTP mínimo sobre el `fetch` nativo de Node y no el SDK
oficial. El SDK evaluado es compatible con Node, pero su operación de envío no
expone una señal cancelable y registra detalles del error del proveedor fuera
de producción. El cliente mínimo permite garantizar un timeout real mediante
`AbortController`, controlar la sanitización y limitar el alcance a
`POST https://api.resend.com/emails`.

El cliente es inyectable. Los tests usan fakes deterministas y una protección
que hace fallar cualquier `fetch` global. No se añadió ninguna dependencia.

## Configuración

Todas las variables son server-only y permanecen vacías en `.env.example`:

- `NEWSLETTER_MODE`
- `NEWSLETTER_MAIL_TRANSPORT`
- `NEWSLETTER_RESEND_API_KEY`
- `NEWSLETTER_RESEND_FROM`
- `NEWSLETTER_RESEND_REPLY_TO`
- `NEWSLETTER_TEST_RECIPIENT_ALLOWLIST`
- `NEWSLETTER_RESEND_ORIGIN`

Resend sólo queda disponible si `NEWSLETTER_MODE=test`,
`NEWSLETTER_MAIL_TRANSPORT=resend`, la configuración completa es válida,
`NODE_ENV` no es `production` y `VERCEL_ENV` no existe. `off`, `preview`,
`live`, producción y cualquier despliegue Vercel fallan cerrados. Vercel
Preview nunca lo activa automáticamente.

El origen debe ser HTTPS, sin credenciales, path, query ni fragmento. Se usa
exclusivamente para construir los enlaces ya definidos por los emails.

## Allowlist y destinatarios

La allowlist usa comas. Cada dirección se normaliza con `trim` y minúsculas y
se compara de forma exacta. Se rechazan entradas vacías, duplicados tras
normalización, formatos inválidos, comodines, dominios, coincidencias
parciales y más de 20 destinatarios configurados.

Cada comando admite exactamente un destinatario. No hay CC, BCC, sustitución
ni redirección silenciosa. Un destinatario no permitido detiene el flujo antes
de invocar el cliente y termina como `provider_error` interno; la respuesta
HTTP pública conserva la política anti-enumeración.

## Payload, respuestas y errores

El adaptador reutiliza el renderer React Email existente y entrega `from`,
un único `to`, `reply_to`, `subject`, `html` y `text`. No añade tracking,
píxeles, headers de marketing ni modifica enlaces o contenido.

Sólo una respuesta 2xx con un `id` no vacío se mapea a `accepted`. Los errores
HTTP, excepciones, timeout y respuestas inválidas nunca se consideran
aceptados. El contrato provider-neutral no se amplió: el identificador del
proveedor se valida en el borde y no se devuelve al servicio. Su persistencia
queda pendiente de la fase de webhooks.

Existe un único intento lógico y no hay retries automáticos. El timeout por
defecto es de 10 segundos y cancela el `fetch` mediante `AbortController`.

## Logs y privacidad

El cliente y el transporte no registran credenciales, destinatarios,
remitentes, Reply-To, asuntos, contenido, tokens, URLs, headers, bodies,
respuestas del proveedor ni stacks. Los fallos siguen llegando al logger HTTP
existente como la categoría provider-neutral `provider_error`, junto con los
campos seguros que ya admite: operación, request ID, modo y timestamp.

Las categorías internas del borde Resend son constantes sin PII:
`resend_configuration_invalid`, `resend_recipient_not_allowed`,
`resend_provider_error`, `resend_timeout` y `resend_response_invalid`.

## Idempotencia

La base de datos sigue siendo la fuente de idempotencia del flujo. El comando
actual no aporta un identificador estable y seguro para la idempotencia del
proveedor. R4A no inventa una clave a partir del email, token, asunto, HTML o
texto, y no amplía el modelo. La idempotencia durable del envío queda
pendiente de una operación persistida en una fase posterior.

## Estado operativo y requisitos para R4B

R4A no contiene claves, no consulta una cuenta Resend, no envía confirmation
o welcome, no usa SMTP y no toca DNS. Tampoco modifica SQL, migraciones,
Supabase remoto, rutas públicas, captación pública, webhooks, campañas o
despliegues.

Antes de R4B deberán existir una credencial de prueba gestionada fuera del
repositorio, un remitente verificado, una allowlist aprobada y una decisión
operativa sobre el origen de enlaces e idempotencia durable. R4B deberá
mantener los mismos guards y ejecutar cualquier prueba real sólo con
autorización expresa.
