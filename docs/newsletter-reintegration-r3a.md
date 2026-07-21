# Newsletter reintegration R3A — Isolated persistence and server orchestration

## Objetivo

R3A añade la capa de aplicación `server-only` que valida entradas, invoca las cuatro RPC
transaccionales de R1 e interpreta sus resultados. Mantiene la persistencia aislada del navegador,
no crea superficies HTTP y conserva el envío de correo detrás de un contrato provider-neutral.

La migración de R1 sigue siendo un borrador no aplicado. Este checkpoint no activa captación,
formularios, confirmación, baja, webhooks ni campañas.

## Comprobación inicial

- Rama: `feature/newsletter-phase-1a-reintegration`.
- HEAD inicial: `1d84111452f7bdc7a3ba9464bbd47be7d7703eff`.
- R1 y R2 estaban intactos, sin cambios tracked ni staged.
- Los untracked protegidos de lotes, enrichment, backups, marca e imágenes permanecieron intactos.
- `.env.local` no se modificó ni se inspeccionaron valores secretos.

## Infraestructura SQL aislada

Comandos de detección ejecutados sin instalar ni modificar herramientas:

```powershell
supabase --version
docker version
psql --version
Test-Path supabase/config.toml
```

Resultado:

- Supabase CLI: no disponible.
- Docker CLI/runtime: no disponible.
- `psql`: no disponible.
- `supabase/config.toml`: no existe.
- No existe un harness SQL local ni una base de test previamente configurada en el repositorio.

Por tanto, no existe un entorno PostgreSQL/Supabase local y aislado compatible. Conforme al alcance
de R3A, no se instalaron Docker, Supabase CLI, PostgreSQL ni herramientas globales. Tampoco se usó
un project ref, una URL, una clave o una conexión remota.

## Resultado de la validación SQL real

La ejecución real de
`database/migrations/20260721133000_newsletter_core_foundation.sql` queda bloqueada por ausencia de
infraestructura local. No se aplicó la migración en ningún entorno y no se modificó basándose en
suposiciones.

En consecuencia, siguen pendientes en una base desechable:

- Aplicación sobre un esquema vacío y comprobación de la estrategia de reaplicación.
- Inspección real de tablas, índices, constraints, RLS, grants, funciones y tipos de retorno.
- Concurrencia de solicitudes y confirmaciones.
- Transiciones de solicitud, confirmación, baja y eventos de proveedor.
- Idempotencia, rollback transaccional y eventos fuera de orden.
- Permisos efectivos de `anon`, `authenticated` y `service_role`.
- Verificación de que los retornos no exponen datos personales.

Los tests estructurales R1 continúan siendo útiles, pero no se presentan como sustituto de esas
pruebas PostgreSQL.

## Correcciones de migración

No se realizó ninguna corrección SQL. Sin ejecución PostgreSQL real no hay evidencia suficiente
para alterar la migración R1, sus tests estructurales o su modelo funcional.

## Repositorio server-only

`lib/newsletter/repository.server.ts`:

- Importa `server-only`.
- Reutiliza `createSupabaseServerClient()` de `lib/supabase.ts`; no crea un cliente alternativo.
- Define una operación de repositorio por RPC.
- Cada operación ejecuta exactamente una RPC y no usa `.from()`, consultas directas o secuencias
  multi-paso.
- Convierte los parámetros TypeScript a los nombres escalares de PostgreSQL.
- Valida los outcomes y la forma mínima de cada retorno antes de entregarlos al servicio.
- Descarta el detalle de error de Supabase y emite errores internos sin SQL, email, tokens o IDs.

Las cuatro operaciones son:

- `requestSubscription()` → `request_newsletter_subscription`.
- `confirmSubscription()` → `confirm_newsletter_subscription`.
- `unsubscribeSubscriber()` → `unsubscribe_newsletter_subscriber`.
- `recordProviderEvent()` → `record_newsletter_provider_event`.

## Servicio server-only

`lib/newsletter/service.server.ts`:

- Valida y normaliza las entradas antes de persistir.
- Sólo permite mutaciones si el modo resuelto es `test` o `live` y existe persistencia configurada.
- En `off` y `preview` falla antes de generar tokens, invocar RPC o preparar correo.
- Interpreta outcomes sin exponerlos mediante la respuesta pública futura.
- No importa `Request`, `Response`, Route Handlers, Server Actions, analítica o SDK de proveedor.
- El factory configurado usa el modo fail-closed de R1, el repositorio central y transporte nulo.

La respuesta pública preparada para una futura capa HTTP es idéntica para solicitud nueva, activa,
limitada, bloqueada o con fallo del proveedor. No contiene un booleano de éxito operativo ni afirma
que el correo haya sido preparado o enviado. Las decisiones específicas permanecen exclusivamente
en el resultado interno.

## Transporte provider-neutral

`lib/newsletter/mail-transport.server.ts` define:

- `NewsletterMailTransport`.
- `ConfirmationMailCommand` y `WelcomeMailCommand` mediante los contratos estrictos compartidos.
- `NullNewsletterMailTransport`, marcado explícitamente como `unavailable`; no envía ni persiste
  nada.

La disponibilidad forma parte del contrato. En `off` y `preview`, el servicio se bloquea antes de
consultar o invocar cualquier transporte. En `test` y `live`, un transporte omitido se sustituye por
el Null transport y produce `configuration_error` antes de generar un token o invocar la RPC. Pasar
el Null transport explícitamente tiene el mismo comportamiento.

Un transporte marcado como `ready` sólo acredita envío cuando devuelve `accepted`. Si devuelve
`skipped`, el servicio produce `configuration_error`; `skipped` nunca se convierte en `accepted` ni
en un resultado equivalente a enviado. Esto evita que una futura API presente éxito operativo
cuando no existe un transporte preparado.

El transporte de captura existe sólo dentro de
`tests/newsletter/newsletter-r3a.test.ts`. Conserva comandos en memoria durante el test, no escribe a
disco, no usa `localStorage` y no imprime PII.

No se instaló ni importó Resend.

## Fallo al preparar o enviar la confirmación

El orden de la solicitud habilitada permanece deliberadamente cerrado:

1. Generar token raw.
2. Calcular SHA-256.
3. Ejecutar una única RPC con el hash.
4. Recibir `confirmation_required`.
5. Entregar el raw token una sola vez al transporte provider-neutral.

Si un transporte `ready` lanza una excepción al preparar o enviar la confirmación:

- El resultado interno conserva `provider_error` y `mailStatus: failed`.
- No se realiza un segundo intento ni una consulta compensatoria desde TypeScript.
- No se afirma que el correo haya sido enviado.
- La respuesta pública futura conserva únicamente el mensaje genérico.
- Email, token raw, subscriber ID y detalle del proveedor no aparecen en el resultado o error.
- El registro `pending` y el hash pueden permanecer creados porque la RPC ya terminó correctamente.

R3A no añade una RPC compensatoria ni una tabla outbox. R3B/R4 deberá definir una política segura de
reintento o reemisión tras fallo del proveedor, manteniendo cooldown, invalidación de tokens e
idempotencia. Un fallo del correo de bienvenida conserva igualmente la confirmación local válida y
no intenta revertirla.

## Tokens

Para una solicitud habilitada:

1. Se validan todos los datos de entrada.
2. Se genera un token opaco de 32 bytes.
3. Se calcula SHA-256 antes de invocar la RPC.
4. La RPC recibe únicamente el hash.
5. Si la RPC devuelve `confirmation_required`, el token raw se entrega exclusivamente al comando
   interno de confirmación.
6. Si la RPC ignora el hash por estado activo, bloqueo o limitación, no se prepara correo.

El token raw no forma parte del resultado del servicio, del repositorio, de errores o de logs.

## Errores

`lib/newsletter/service-types.ts` define categorías internas cerradas:

- `configuration_error`
- `validation_error`
- `persistence_error`
- `token_error`
- `blocked_state`
- `cooldown`
- `provider_error`
- `unexpected_error`

Los códigos se convierten a mensajes constantes y seguros. No interpolan email, token, subscriber
ID, SQL, payloads de proveedor o secretos. Un fallo del transporte se registra sólo como resultado
interno `provider_error`; no intenta revertir una confirmación ya completada por PostgreSQL.

## Tipos Supabase

Se mantienen los tipos manuales de R1 en `lib/supabase.ts`. No se generaron tipos porque no existe
un entorno local ni Supabase CLI, y no se usó un proyecto remoto.

Cuando exista un entorno aislado aprobado, el comando debe verificarse contra la versión instalada
de la CLI y apuntar exclusivamente a local, por ejemplo conceptualmente:

```powershell
supabase gen types typescript --local
```

El resultado deberá compararse antes de sustituir cualquier tipo existente.

## Tests R3A

Ejecutar:

```powershell
npm run test:newsletter-r3a
```

La suite cubre:

- Solicitud nueva, activa, limitada, bloqueada y resuscripción.
- Orden generación/hash/RPC y separación entre token raw y repositorio.
- Confirmación válida e inválida.
- Baja y evento provider-neutral.
- Bloqueo completo en `off` y `preview`.
- Null transport no invocado en `off` o `preview` y rechazado en `test` o `live`.
- Transporte omitido y resultado `skipped` tratados como `configuration_error`.
- Ausencia de persistencia configurada.
- Transporte capturado una sola vez y fallo sin rollback local.
- Fallo de confirmación con una única RPC, un único intento, respuesta genérica y sin PII.
- Respuesta pública no enumerable y errores sin PII.
- Una única RPC por operación y ausencia de consultas directas multi-paso.
- Ausencia de endpoints, Server Actions, Resend, `localStorage` y logs.

## Seguridad y privacidad

- La service role permanece exclusivamente en el cliente server-side central.
- Ningún módulo cliente importa la capa R3A.
- No se registran entradas ni errores originales del proveedor o de Supabase.
- No se persisten tokens raw.
- No se expone el estado del suscriptor en la respuesta pública preparada.
- R3A no autoriza por sí misma un subscriber ID recibido desde internet; la futura capa HTTP deberá
  verificar una acción firmada antes de invocar la baja.

## Sigue sin estar conectado

- No hay Route Handlers ni Server Actions.
- El formulario y la preview R2 siguen simulados.
- No hay páginas de confirmación, baja o preferencias.
- No hay transporte real ni emails enviados.
- No hay webhooks, cron, campañas o analítica.
- No hay Supabase local o remoto conectado.
- `NEWSLETTER_MODE` no se activa ni se modifica `.env.local`.
- La migración no se ha aplicado.

## Validación SQL futura en CI

Una opción recomendada es ejecutar PostgreSQL/Supabase efímero en CI para aplicar la migración sobre
una base vacía y lanzar las pruebas reales de transacciones, permisos y concurrencia. Esa
infraestructura debe diseñarse y aprobarse como un checkpoint separado: R3A no crea workflows de
GitHub Actions, contenedores ni configuración remota.

## Próximo checkpoint R3B

R3B queda bloqueado hasta validar la migración en PostgreSQL real y aislado. Después deberá resolver la
autorización de acciones públicas, los límites HTTP persistentes y el mecanismo de entrega/retintento
sin mezclarlo todavía con una activación pública. Cualquier adaptador de proveedor debe ser un
checkpoint independiente y revisable.

## Propuesta de commit

```text
feat(newsletter): add isolated persistence orchestration R3A
```
