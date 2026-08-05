# Emisor manual de la edición 01

Este checkpoint añade persistencia y orquestación manual para la primera edición de **La Agenda Motor**. No añade cron, scheduler, selección manual de destinatarios ni envíos en lote.

## Límites de seguridad

- El comando es `dry-run` por defecto y en ese modo sólo consulta un resumen agregado. No prepara entregas ni llama a Resend.
- El modo real está bloqueado en CI, Vercel y procesos con `NODE_ENV=production`.
- El proceso real requiere simultáneamente `NEWSLETTER_MODE=live`, `NEWSLETTER_MAIL_TRANSPORT=resend`, el guard de lanzamiento público, un armado específico de campaña y dos confirmaciones CLI exactas.
- El comando no carga `.env.local`; las credenciales deben inyectarse de forma efímera en el proceso autorizado.
- No se admiten direcciones por argumentos. La audiencia procede exclusivamente de la RPC service-role.
- La salida contiene únicamente identificador de edición, digest, asunto y recuentos. No imprime emails, tokens, claves, payloads ni errores del proveedor.

## Persistencia

`newsletter_campaigns` fija de forma inmutable la clave de edición, asunto y digests SHA-256 canónicos de HTML y texto. Reutilizar la clave con cualquier contenido distinto aborta.

`newsletter_campaign_deliveries` impone `unique (campaign_id, subscriber_id)` y conserva estado, intentos, claim, clave de idempotencia, ID del proveedor y errores sanitizados. Los estados son `prepared`, `sending`, `accepted`, `failed` y `unknown`.

`newsletter_campaign_unsubscribe_tokens` guarda únicamente SHA-256. Cada intento obtiene un token criptográfico distinto; el valor raw existe sólo en memoria mientras se prepara ese correo. Los tokens históricos de bienvenida y los tokens de campañas anteriores no se rotan al preparar otra campaña.

## Elegibilidad y claim

La preparación exige simultáneamente:

- suscriptor `active` con `confirmed_at`;
- evidencia de consentimiento `confirmed`;
- preferencia semanal activa;
- ausencia de baja, bounce, complaint o suppression en el agregado;
- ausencia de una supresión activa.

La misma regla se revalida bajo bloqueo de fila en el claim inmediatamente anterior al envío. Cada claim bloquea primero la fila de campaña: mientras exista una entrega `sending` no caducada, ninguna otra entrega de esa campaña puede reclamarse. Las campañas distintas mantienen bloqueos independientes. Dos claims concurrentes no pueden obtener la misma entrega ni entregas diferentes de una misma campaña. `accepted` y `unknown` nunca son reclamables; un `failed` sólo lo es con `--resume` y cuando el rechazo del proveedor fue inequívoco y se marcó como reintentable.

## Idempotencia y resultados ambiguos

Resend documenta `Idempotency-Key` para `POST /emails` y conserva las claves durante 24 horas. El cliente envía una clave determinista sin PII con campaña, entrega e intento. Un reintento tras un rechazo HTTP inequívoco usa un intento y token nuevos; los resultados ambiguos no se reintentan.

Un timeout, una pérdida de conexión sin respuesta, una respuesta 5xx/408 o una respuesta 2xx no interpretable se registra como `unknown`. Si Resend acepta y falla la persistencia del `providerMessageId`, el runner intenta cerrar el claim como `unknown` y detiene la ejecución. Si tampoco puede persistirlo, la entrega queda `sending`; después de 15 minutos el siguiente claim la convierte conservadoramente a `unknown`. Nunca se reenvía automáticamente.

Referencia: <https://resend.com/docs/dashboard/emails/idempotency-keys>.

## Operación propuesta

Vista previa agregada, sin envío:

```powershell
npm run newsletter:edition01:campaign -- --limit 25
```

El modo real requiere autorización separada. Su forma prevista es:

```powershell
npm run newsletter:edition01:campaign -- --send --confirm-edition agenda_motor_2026_08_06 --confirm-phrase SEND-AGENDA-MOTOR-2026-08-06 --limit 25
```

Para continuar únicamente fallos inequívocamente reintentables se añade `--resume`. Un `unknown` requiere revisión manual fuera del runner; no existe flag para forzar su reenvío.
