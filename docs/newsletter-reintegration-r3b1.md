# Newsletter reintegration R3B.1 — Contratos HTTP y endpoints internos

## Objetivo

R3B.1 añade una frontera HTTP interna, pequeña y explícita sobre la orquestación server-only de
R3A. No conecta los formularios R2, no habilita producción y no añade persistencia, RPC, transporte
de email o reglas de negocio alternativas.

Los tres Route Handlers son:

```text
POST /api/newsletter/request
POST /api/newsletter/confirm
POST /api/newsletter/unsubscribe
```

No existe ninguna mutación mediante `GET`, `PUT`, `PATCH` o `DELETE`. Next.js responde `405` a los
métodos no exportados.

## Arquitectura

La frontera se divide en:

- `lib/newsletter/http-contracts.ts`: DTO públicos sin tipos internos.
- `lib/newsletter/http.server.ts`: guard, lectura acotada de JSON, validación, factories, mapeos,
  logging sanitizado y adaptadores inyectables.
- `app/api/newsletter/*/route.ts`: Route Handlers mínimos, `POST` y runtime Node.js.
- `lib/newsletter/audience.ts`: catálogo territorial y versión de consentimiento compartidos con
  R2, sin conectar el formulario.

Los handlers no normalizan emails, no generan ni hashean tokens y no acceden a RPC. Delegan esas
responsabilidades en `NewsletterService`. El pequeño refactor de `schemas.ts` expone la validación
de forma de token que el servicio ya utilizaba para evitar una segunda expresión incompatible.

La construcción del servicio configurado es perezosa y ocurre sólo después de superar guard,
protección de abuso opcional y validación de entrada. Un request bloqueado no crea un cliente
Supabase.

## Contratos públicos

### Solicitud

Entrada:

```json
{
  "email": "driver@example.invalid",
  "province": "madrid",
  "consentVersion": "2026-07"
}
```

Respuesta para cualquier outcome interno válido:

```json
{
  "ok": true,
  "status": "accepted"
}
```

Status HTTP: `202`.

`confirmation_required`, `already_active`, `cooldown`, `daily_limit` y `blocked` producen
exactamente el mismo DTO. Los estados `bounced`, `complained` y `suppressed` quedan detrás de
`blocked` y no son observables.

### Confirmación

Entrada:

```json
{
  "token": "<opaque-token>"
}
```

Resultados públicos:

- `confirmed`
- `already_confirmed`
- `invalid_or_expired`

Status HTTP para un token con forma válida: `200`. Un token usado se mapea a
`already_confirmed`; inválido, caducado o bloqueado se unifican como `invalid_or_expired`.

### Baja

Entrada:

```json
{
  "token": "<authenticated-action-token>"
}
```

No se acepta email ni `subscriberId`. Resultados públicos:

- `unsubscribed`
- `already_unsubscribed`
- `invalid_or_expired`

Status HTTP para un token con forma válida: `200`. `already_unsubscribed` y
`already_not_sendable` se unifican como `already_unsubscribed`; `not_found` se mapea a
`invalid_or_expired`.

R1 exige que el servidor autentique el target antes de llamar a
`unsubscribe_newsletter_subscriber`. El repositorio no tiene actualmente un issuer/verificador de
acciones de baja y R1 descartó el secreto propuesto. R3B.1 no inventa otro secreto ni trata un UUID
como autoridad. La factory acepta un `NewsletterUnsubscribeTokenResolver` inyectable y los tests
prueban el contrato completo; el handler configurado responde fail-closed con `503` hasta que una
fase autorizada aporte un resolver criptográfico real.

## Errores HTTP

El contrato `PublicNewsletterErrorResponse` sólo expone:

| Status | Error | Uso |
|---|---|---|
| `400` | `invalid_request` | JSON o campos inválidos |
| `404` | `not_found` | endpoint deshabilitado por guard |
| `413` | `payload_too_large` | más de 4096 bytes |
| `415` | `unsupported_media_type` | no es `application/json` |
| `429` | `rate_limited` | futura protección inyectada lo deniega |
| `503` | `temporarily_unavailable` | configuración o dependencia interna no disponible |

No se devuelven mensajes de SQL, RPC, tablas, modo, proveedor, configuración o stack.

## Validación de entrada

- Sólo `Content-Type: application/json`, con parámetros opcionales como `charset`.
- Límite de 4096 bytes comprobado mediante `Content-Length` y durante la lectura del stream.
- JSON válido y objeto plano.
- Rechazo de campos inesperados.
- Email validado con `isValidEmail`; la normalización continúa exclusivamente en R3A.
- Provincia perteneciente al catálogo newsletter compartido.
- Versión de consentimiento exacta y versionada.
- Confirmación limitada al token opaco aceptado por R3A.
- Baja limitada a una forma ASCII acotada; la autorización criptográfica pertenece al resolver.

## Guards y fail-closed

La protección principal está en servidor:

- `off`, configuración ausente o inválida: `404`.
- `live`: `404`; no activa captación en R3B.1.
- Vercel production: siempre `404`.
- producción sin `VERCEL_ENV`: siempre `404`.
- `preview`: sólo development local o Vercel preview, con `Origin` presente y same-origin.
- `test`: sólo `NODE_ENV=test`, sin contexto Vercel; permite ausencia de `Origin` para clientes de
  test no browser.

Si existe header `Host`, debe coincidir con el host de la URL del request. `Origin` no es la
autoridad primaria: se aplica después del modo y del bloqueo de entorno. Referer, User-Agent,
querystrings y campos del body no habilitan el endpoint.

## Same-origin y previews

Una petición browser en preview debe enviar un `Origin` cuya combinación esquema/host/puerto
coincida exactamente con la URL del handler. Esto admite `localhost` y dominios efímeros de Vercel
sin mantener allowlists de hosts. Los clientes no browser sin `Origin` quedan bloqueados en preview
y sólo se aceptan en el modo `test` controlado.

La comprobación reduce CSRF y uso accidental, pero no se presenta como autenticación. El endpoint
continúa dependiendo de los guards de modo y, para bajas, de posesión y verificación del token.

## Anti-enumeración

Solicitud devuelve siempre `202 accepted` para todos los outcomes de dominio válidos. Ningún DTO
contiene:

- email o email normalizado;
- `subscriber_id`;
- token o hash;
- status del suscriptor;
- cooldown o motivo de bloqueo;
- datos de proveedor;
- eventos de consentimiento.

Confirmación y baja sólo exponen el conjunto mínimo solicitado y agrupan estados internos que no
aportan una acción distinta al usuario.

## Logging

Los errores internos sólo permiten:

- `operation`;
- categoría sanitizada;
- request ID aleatorio local;
- modo resuelto;
- timestamp.

No se registra body, headers, email, token, hash, subscriber ID, JWT, password, URL Supabase,
credenciales, objeto RPC ni stack. El request ID no deriva de datos del usuario.

## Transporte de email

R3B.1 reutiliza `NewsletterService` y su transporte provider-neutral. No cambia estas garantías:

- `off` y `preview` no persisten mediante el servicio R3A.
- `test` y `live` exigen persistencia y transporte `ready`.
- `NullNewsletterMailTransport` nunca representa un envío correcto.
- Un transporte ausente no se convierte en aceptación persistida.

Los tests inyectan servicios controlados; no se añade un transporte en memoria al código
productivo. Resend y la captura local siguen ausentes. La captura local corresponde a R3B.3.

## Extensión de abuso y rate limiting

La factory acepta opcionalmente `NewsletterAbuseCheck`. Si no se proporciona, no se ejecuta ni se
afirma que exista rate limiting. Una implementación futura puede denegar antes de leer el body y
producir `429`, sin cambiar los contratos.

R3B.1 no añade Redis, Upstash, estado global en memoria ni una dependencia externa.

## Tests e inyección

Los tests sustituyen mediante factory:

- creación del `NewsletterService`;
- resolver de token de baja;
- entorno;
- protección de abuso;
- logger;
- reloj y generador de request IDs.

No acceden a Supabase, no ejecutan RPC y no envían emails. La implementación configurada conserva
`server-only`; ningún componente cliente importa repositorio, crypto, service role o handler HTTP.

## Fuera de alcance

- Formularios R2 conectados.
- Página visual de confirmación o baja.
- Envío/captura local de correo.
- Emisor/verificador productivo de tokens de baja.
- Rate limiting real.
- Webhooks, envío semanal, administración o preferencias avanzadas.
- Supabase remoto, migraciones, Resend y producción.

## Criterios para avanzar a R3B.2

1. Tests R1, R2, R3A, R3A.1 y R3B.1 en verde.
2. Typecheck, build y lint del alcance en verde.
3. Confirmar que producción y `live` continúan bloqueados.
4. Mantener los formularios desconectados hasta una decisión explícita de R3B.2.
5. Conectar sólo `request` y `confirm` a UI cuando sus dependencias internas controladas estén
   preparadas.
6. No conectar una UI de baja hasta disponer de un issuer/verificador de tokens de acción seguro,
   revisado y sin reutilizar credenciales de Supabase.
7. Mantener R3B.3 como fase separada para captura local de correo.
