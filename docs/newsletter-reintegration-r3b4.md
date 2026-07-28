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

La rotación obtiene `clock_timestamp()` inmediatamente después del lock y valida entonces
`p_expires_at`. El mismo instante se usa como `created_at` y `updated_at` del token nuevo. El token
anterior se actualiza con `invalidated_at = greatest(v_now, created_at)` y
`updated_at = greatest(v_now, created_at)`; el trigger de esta tabla conserva además un
`updated_at` de reloj monotónico. Las constraints temporales permanecen intactas.

`unsubscribe_newsletter_by_token(text, text, text, text, text)` valida y localiza el hash, bloquea
primero el suscriptor y después el token, y reutiliza la política transaccional de
`unsubscribe_newsletter_subscriber`. Sólo devuelve `unsubscribed`, `already_unsubscribed` o
`invalid_or_expired`.

Tras adquirir ambos locks, obtiene `clock_timestamp()` y sólo entonces comprueba la expiración. El
primer uso se escribe como
`coalesce(first_used_at, greatest(v_now, created_at))` y `updated_at` como
`greatest(v_now, created_at)`. La RPC no depende exclusivamente del trigger para preservar las
constraints temporales y el segundo uso conserva el primer timestamp.

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

La validación PostgreSQL efímera queda preparada con ocho suites y **153 aserciones pgTAP**
esperadas. Concurrencia cubre dos preparaciones y dos bajas simultáneas. La Data API añade las dos
RPC nuevas para un total esperado de **12 denegaciones**: seis como `anon` y seis como
`authenticated`. Estos totales son expectativas versionadas pendientes de una ejecución posterior
autorizada en GitHub Actions; R3B.4 no aplica la migración local ni remotamente.

### Incidencia temporal del Run #10

El Run #10 (`30371942800`) aplicó la migración y completó **149/149** aserciones pgTAP. Solicitudes,
confirmaciones y eventos concurrentes pasaron, pero la segunda de dos preparaciones simultáneas
falló por `newsletter_unsubscribe_tokens_invalidation_check`. `now()` representa el inicio de la
transacción: la segunda sesión lo había calculado antes de esperar el lock y trató de invalidar el
token recién creado por la primera con un instante unos microsegundos anterior a su `created_at`.

La corrección toma tiempo de reloj después del lock, protege ambos timestamps mediante `greatest` y
refuerza pgTAP y el escenario concurrente. No se considera validada en PostgreSQL real hasta una
ejecución posterior autorizada completamente verde; R4 continúa bloqueado.

### Incidencia temporal del Run #11

El Run #11 (`30379515569`) aplicó la migración y ejecutó correctamente 140 aserciones antes de que
`newsletter_welcome_unsubscribe.test.sql` terminase con `Bad plan` (15 de 26 ejecutadas). La primera
baja violó `newsletter_unsubscribe_tokens_first_use_check`: el `now()` inicial de
`unsubscribe_newsletter_by_token` representaba el comienzo de la transacción pgTAP y quedó por
detrás del `created_at` generado después por la rotación.

La corrección conserva el orden suscriptor → token, obtiene tiempo de reloj después de ambos locks y
protege explícitamente `first_used_at` y `updated_at` con `greatest(v_now, created_at)`. Las
constraints siguen intactas. El total sube a 153 por dos aserciones específicas y R4 permanece
bloqueado hasta validar toda la cadena en CI.

## Producción y paso a R4

R3B.4 no conecta Supabase remoto, Resend, SMTP, DNS ni Vercel; no envía emails reales y no crea
rutas públicas. `NEWSLETTER_MODE=live` continúa fuera de alcance.

R4 sólo podrá plantearse después de:

1. obtener migración, 153/153 pgTAP, concurrencia, DB lint y 12/12 permisos Data API en verde;
2. revisar seguridad y privacidad del flujo completo;
3. definir proveedor, retry durable y operación de producción en checkpoints separados.
