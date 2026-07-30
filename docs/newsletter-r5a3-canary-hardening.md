# Newsletter R5A.3 — Canary hardening

## Incidente y causa

Durante una apertura temporal y limitada del canario, una solicitud de
resuscripción devolvió la respuesta pública genérica y creó un token
`resubscribe`, pero no produjo una entrega en Resend. La fila había sido dada de
baja antes de R5A.2 y conservaba `status = unsubscribed` sin una supresión activa
`voluntary`.

R5A.2 añadió correctamente un guard previo al transporte: una confirmación de
resuscripción sólo es elegible si existe esa supresión voluntaria. El estado
heredado incumplía el nuevo invariante. El token raw nunca llegó al usuario, el
hash persistido quedó activo y el cooldown impedía solicitar inmediatamente un
reemplazo.

El canario permanece cerrado con `NEWSLETTER_MODE=off` y
`NEWSLETTER_MAIL_TRANSPORT=disabled`. Esta fase no cambia configuración remota.

## Backfill forward-only

La migración `20260730100000_newsletter_canary_hardening.sql` identifica
exclusivamente filas `unsubscribed`, con `unsubscribed_at`, sin supresión activa
y sin estado, timestamp ni motivo canónico de supresión dura. Cada candidato
se bloquea y vuelve a validar dentro de
`repair_legacy_newsletter_unsubscribe(uuid, timestamptz)`.

La reparación:

- calcula el hash normalizado mediante `newsletter_email_hash`;
- crea una única supresión activa `voluntary` con `ON CONFLICT DO NOTHING`;
- no sustituye, levanta ni degrada supresiones existentes;
- conserva `confirmed_at`, `unsubscribed_at` y los eventos de consentimiento;
- elimina preferencias de entrega y minimiza la dirección y datos operativos;
- no activa al suscriptor, no crea consentimientos `confirmed` y no genera
  tokens;
- es idempotente y compatible con cero candidatos.

El helper es `SECURITY DEFINER`, fija un `search_path` vacío y queda sin
`EXECUTE` para `public`, `anon`, `authenticated` y `service_role`. Sólo lo
invocan funciones propietarias y la propia migración.

## Tokens huérfanos y ventana operativa

En una fila reparable, cualquier token `resubscribe` todavía activo se creó
mientras faltaba la supresión obligatoria y no podía superar el guard de
entrega. La reparación conserva la fila y sus timestamps, pero fija
`invalidated_at`. No toca tokens usados, ya invalidados ni tokens `subscribe`.

Se reinician únicamente los campos que implementan la ventana operativa:

- `last_confirmation_requested_at`;
- `confirmation_request_window_started_at`;
- `confirmation_request_count`.

Estos campos no constituyen el historial de consentimiento; éste permanece en
`newsletter_consent_events`. El reinicio permite una solicitud normal de
reemplazo. Tras ella vuelven a aplicarse el cooldown de quince minutos y el
límite diario.

## Autorreparación

La firma pública `request_newsletter_subscription` valida primero todos sus
argumentos, localiza por email normalizado o hash de supresión y bloquea el
suscriptor. Antes de reparar, cooldown, límite diario o creación de tokens,
evalúa el estado, los timestamps canónicos y el motivo de la supresión. Si
detecta el estado heredado voluntario exacto, ejecuta la misma reparación
transaccional antes de delegar en la implementación revisada de R5A.2.

La RPC de R5A.2 se conserva como función propietaria sin permisos Data API. El
flujo resultante crea un nuevo token `resubscribe`, devuelve
`confirmation_required` y mantiene el estado `unsubscribed`. Sólo la
confirmación del token levanta la supresión voluntaria y restaura la preferencia
semanal.

Los estados `bounced`, `complained` y `suppressed`, así como cualquier
supresión activa `permanent_bounce`, `complaint` o `provider_suppression`,
permanecen bloqueados. No se amplían grants directos sobre tablas.

La RPC pública conserva exactamente el contrato histórico de tres columnas:
`outcome text`, `subscriber_id uuid` y `token_purpose text`. La implementación
interna no tiene permisos para `public`, `anon`, `authenticated` ni
`service_role`, y su nombre no crea una sobrecarga resoluble por PostgREST.

## Interfaz y contrato público

La respuesta HTTP continúa siendo anti-enumeración. Un `202 accepted` sustituye
el formulario por el estado accesible **Solicitud recibida** y explica de forma
condicional que podría llegar un correo. No afirma que la dirección exista ni
que el proveedor haya aceptado un envío. El estado recibe foco, usa
`aria-live`, oculta los datos introducidos y recuerda la caducidad de 24 horas.

Durante el envío se conserva el bloqueo contra dobles peticiones, el botón
deshabilitado y el texto de carga. Los fallos reales mantienen mensajes
genéricos.

La primera capa legal se reduce a responsable, finalidad, legitimación,
ejercicio de derechos y enlaces a Política de privacidad y Aviso legal. Los
proveedores, conservación, transferencias y detalles técnicos permanecen en la
segunda capa enlazada. Esta organización no constituye asesoramiento jurídico
definitivo.

## Validación y rollback

La migración es forward-only: no se revierte editando migraciones aplicadas ni
restaurando masivamente datos minimizados. Ante un defecto antes de aplicarla se
corrige con una migración posterior. Tras aplicarla, el rollback operativo es
cerrar el canario y desplegar una corrección forward-only que preserve
supresiones y evidencia.

Los tests locales validan estructura, aplicación y UI. pgTAP, concurrencia real,
DB lint y Data API sólo se considerarán validados cuando GitHub Actions ejecute
la pila PostgreSQL efímera.

## Plan de despliegue futuro — no ejecutado

1. Obtener CI verde.
2. Hacer merge mediante el proceso de revisión.
3. Ejecutar un dry-run aislado.
4. Aplicar únicamente la migración R5A.3.
5. Verificar el historial remoto de migraciones.
6. Mantener cerrado el canario.
7. Abrirlo con una sola dirección autorizada.
8. Solicitar un nuevo correo.
9. Verificar la aceptación en Resend.
10. Confirmar el token.
11. Verificar la bienvenida.
12. Verificar el webhook.
13. Probar la baja.
14. Cerrar de nuevo el canario hasta el lanzamiento público.
