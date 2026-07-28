# Newsletter reintegration R3B.4 — Internal E2E welcome flow

## Alcance

R3B.4 completa el flujo interno solicitud → confirmación → bienvenida capturada → baja por token,
sin habilitar producción ni añadir proveedores de correo. La migración newsletter aún no se ha
aplicado en un entorno persistente, por lo que el cambio SQL mínimo se incorpora a la migración
fundacional existente. No se crea una migración incremental, outbox, cola, cron ni retry durable.

## Token de baja

`newsletter_unsubscribe_tokens` conserva exclusivamente SHA-256 del token aleatorio generado en el
servidor. No guarda token raw, email, provincia, IP sin hash ni contenido del mensaje. Sus reglas
son:

- `expires_at` es nullable y, por defecto, el enlace no caduca por el paso del tiempo.
- Sólo puede existir un token no invalidado por suscriptor.
- Preparar una nueva bienvenida invalida el token anterior e inserta el nuevo en la misma
  transacción.
- La primera baja fija `first_used_at`, pero no invalida el token.
- Reutilizar el mismo token devuelve `already_unsubscribed`.
- Tras resuscripción y rotación, el token anterior devuelve `invalid_or_expired`.
- El token de confirmación nunca se reutiliza como token de baja.

La FK elimina los tokens cuando se elimina el suscriptor. RLS está habilitado y no hay policies
públicas ni acceso directo para `public`, `anon` o `authenticated`.

## RPC server-only

`prepare_newsletter_welcome_delivery(uuid, text, timestamptz)` bloquea primero el suscriptor, exige
estado `active`, invalida el token anterior, inserta el nuevo hash y devuelve sólo `subscriber_id`,
email destinatario, provincia, región e idioma. Si cualquier validación o inserción falla,
PostgreSQL revierte también la invalidación anterior.

`unsubscribe_newsletter_by_token(text, text, text, text, text)` valida y localiza el hash, bloquea
primero el suscriptor y después el token, y reutiliza la política transaccional de
`unsubscribe_newsletter_subscriber`. Sólo devuelve `unsubscribed`, `already_unsubscribed` o
`invalid_or_expired`.

Las seis RPC newsletter son `security definer`, usan `search_path = ''`, revocan `EXECUTE` a los
roles cliente y conceden ejecución exclusivamente a `service_role`. El orden común
suscriptor → token evita invertir locks entre rotación y baja.

## Orquestación y captura

Después de un outcome `confirmed`, el servicio genera un token raw nuevo, calcula SHA-256, prepara
el contexto mediante una única RPC y entrega al transporte sólo el contexto mínimo. El transporte
local renderiza la única fuente React Email de `WelcomeEmail` y construye:

- la ruta interna de eventos de la provincia;
- `/preview/newsletter/unsubscribe?token=<raw>`.

El raw token vive sólo en memoria y en el HTML/texto capturado, nunca en metadata, repositorio o
logs. El endpoint existente `POST /api/newsletter/unsubscribe` valida el token opaco, lo hashea y
ejecuta una única RPC. No acepta email ni UUID y mantiene same-origin, anti-enumeración, respuestas
sanitizadas y producción bloqueada.

`used_token`, cooldown, un suscriptor ya activo y estados bloqueados no generan capturas
duplicadas. Dos confirmaciones concurrentes producen una confirmación efectiva y una única
bienvenida.

## Fallos

Si falla la preparación, la confirmación ya persistida permanece activa, no se llama al transporte
y el error interno se clasifica como `persistence_error`. Si falla render o almacenamiento, la
confirmación y el token preparado permanecen, la captura no queda parcial y el resultado interno es
`provider_error`.

No hay retry automático, outbox ni compensación TypeScript. Antes de R4 habrá que decidir una
política durable de reemisión que rote de forma segura el token y no duplique mensajes.

## Validación

El E2E interno verifica dos capturas, en orden `confirmation` y `welcome`, para un único
destinatario; extrae ambos enlaces, confirma, ejecuta la primera baja y repite la baja de forma
idempotente. El estado final es `unsubscribed` y no se genera agenda semanal.

La validación PostgreSQL efímera queda preparada con ocho suites y **149 aserciones pgTAP**
esperadas. Concurrencia cubre dos preparaciones y dos bajas simultáneas. La Data API añade las dos
RPC nuevas para un total esperado de **12 denegaciones**: seis como `anon` y seis como
`authenticated`. Estos totales son expectativas versionadas pendientes de una ejecución posterior
autorizada en GitHub Actions; R3B.4 no aplica la migración local ni remotamente.

## Producción y paso a R4

R3B.4 no conecta Supabase remoto, Resend, SMTP, DNS ni Vercel; no envía emails reales y no crea
rutas públicas. `NEWSLETTER_MODE=live` continúa fuera de alcance.

R4 sólo podrá plantearse después de:

1. obtener migración, 149/149 pgTAP, concurrencia, DB lint y 12/12 permisos Data API en verde;
2. revisar seguridad y privacidad del flujo completo;
3. definir proveedor, retry durable y operación de producción en checkpoints separados.
