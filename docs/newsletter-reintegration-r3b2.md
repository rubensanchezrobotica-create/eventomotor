# Newsletter reintegration R3B.2 — Preview flow

## Objetivo

R3B.2 conecta la preview interna de **La Agenda Motor** con los contratos HTTP
server-only cerrados en R3B.1. Permite revisar interacción, estados y
accesibilidad sin habilitar captación pública, correo real o producción.

La fase mantiene bloqueados Resend, Supabase remoto, migraciones, rutas públicas
y cualquier campaña específica.

## Páginas conectadas

| Página interna | Acción explícita | Endpoint |
| --- | --- | --- |
| `/preview/newsletter` | Solicitar suscripción | `POST /api/newsletter/request` |
| `/preview/newsletter/confirm` | Confirmar suscripción | `POST /api/newsletter/confirm` |
| `/preview/newsletter/unsubscribe` | Confirmar baja | `POST /api/newsletter/unsubscribe` |

El layout compartido conserva el guard fail-closed de preview. Requiere
`NEWSLETTER_MODE=preview`, bloquea producción y devuelve `404` cuando el contexto
no es interno. No existen rutas públicas equivalentes.

## Arquitectura

```text
Client Component de preview
  -> lib/newsletter/http-client.ts
  -> fetch relativo, same-origin, POST JSON
  -> Route Handler R3B.1
  -> servicio server-only R3A
```

Los componentes cliente no importan repositorio, servicio server-only, crypto,
RPC, Supabase, service role ni variables privadas. El servidor conserva la
validación autoritativa, la normalización definitiva, las reglas de negocio y
la política anti-enumeración.

`http-client.ts`:

- usa únicamente rutas relativas;
- configura `credentials: "same-origin"` y `cache: "no-store"`;
- envía sólo `Content-Type: application/json`;
- aplica un timeout de 8 segundos con `AbortController`;
- acepta cancelación externa;
- no reintenta mutaciones;
- valida la forma pública mínima del JSON;
- trata body vacío, JSON inválido, red y respuestas desconocidas como fallo
  temporal;
- no registra payloads, email o tokens.

## Solicitud

El formulario envía exactamente:

```json
{
  "email": "valor introducido",
  "province": "slug seleccionado",
  "consentVersion": "2026-07"
}
```

`NEWSLETTER_CONSENT_VERSION` procede de `lib/newsletter/audience.ts`, la misma
fuente pública que usa R3B.1. La casilla está desmarcada por defecto, es
obligatoria y enlaza a la política de privacidad.

La validación cliente se limita a email no vacío con formato razonable,
provincia conocida y consentimiento explícito. No sustituye al servidor.

Estados visuales:

- `idle`;
- `validating`;
- `submitting`;
- `accepted`;
- `invalid`;
- `unavailable`;
- `rate_limited`;
- `temporarily_unavailable`.

Un bloqueo single-flight evita dos peticiones simultáneas. Durante el envío se
deshabilita el botón. Un `202` nunca afirma que el proveedor haya enviado un
correo: muestra la respuesta genérica «Si la dirección puede suscribirse,
recibirá un correo para confirmar la suscripción».

El aviso «Entorno interno: el envío real de correo todavía no está habilitado»
vive fuera del contrato de producto.

## Confirmación y baja

Abrir las páginas mediante GET no muta datos. Cada página muestra primero una
explicación y sólo invoca el endpoint al pulsar su botón.

Confirmación pública:

- `confirmed`;
- `already_confirmed`;
- `invalid_or_expired`;
- guard no disponible;
- error temporal.

Baja pública:

- `unsubscribed`;
- `already_unsubscribed`;
- `invalid_or_expired`;
- guard no disponible;
- error temporal.

La baja no acepta email y mantiene una representación idempotente. Un fallo
temporal permite un nuevo intento manual; nunca existe retry automático.

## Mapeo HTTP

Solicitud:

| HTTP | Estado visual |
| --- | --- |
| `202 accepted` | `accepted` |
| `400`, `413`, `415` | `invalid` |
| `404` | `unavailable` |
| `429` | `rate_limited` |
| `503` | `temporarily_unavailable` |

Confirmación y baja aceptan únicamente los outcomes públicos del body en `200`.
`404` se representa como servicio no disponible; `400`, `413` y `415` como
enlace inválido o caducado; el resto como error temporal. La interfaz no muestra
status bruto, body, request ID, SQLSTATE ni estado interno.

## Token y privacidad

El token:

1. se lee en el cliente desde la URL inicial;
2. se valida sólo por forma mediante la utilidad compartida;
3. se guarda en un `ref` en memoria;
4. se elimina inmediatamente de la URL visible con
   `history.replaceState`;
5. se envía una sola vez por POST tras la acción explícita;
6. se descarta después de un resultado terminal.

No se guarda en `localStorage`, `sessionStorage`, cookies o logs, ni se renderiza
como texto. Las páginas heredan:

- `noindex`;
- `nofollow`;
- `noarchive`;
- `referrer: no-referrer`.

La implementación global de Google Analytics excluye por completo
`/preview/newsletter/confirm` y `/preview/newsletter/unsubscribe`, incluso cuando
existe consentimiento analítico. Así no se carga el script ni se genera un
pageview con el query string del token.

Riesgo residual antes de producción: la URL inicial todavía puede formar parte
del request al servidor o de infraestructura situada antes de Next.js. Debe
revisarse la política de logs del proxy/plataforma antes de habilitar enlaces
reales.

## Accesibilidad

- labels enlazados mediante `htmlFor` e `id`;
- errores asociados con `aria-describedby`;
- `aria-invalid` por campo;
- regiones `aria-live`;
- carga anunciada y botones deshabilitados;
- foco dirigido al resultado al finalizar;
- foco visible para teclado;
- input de email con `type` e `inputMode` apropiados;
- copy de baja neutral y sin dark patterns;
- soporte para `prefers-reduced-motion`;
- zoom no bloqueado.

## Límites actuales

- No se envía correo real.
- El transporte nulo de R3A impide simular éxito operativo.
- La baja configurada permanece fail-closed hasta disponer de resolución segura
  del action token.
- No hay rate limiter productivo; sólo el punto de extensión R3B.1.
- No hay Supabase remoto, migraciones ni persistencia local alternativa.
- Las variantes del laboratorio R2 siguen siendo únicamente visuales.
- Producción permanece bloqueada.

## Criterios para R3B.3

R3B.3 no debe comenzar hasta:

1. aprobar copy y base legal definitivos;
2. definir rate limiting y observabilidad sin PII;
3. resolver de forma server-only los tokens de baja;
4. aprobar la política de reintento/reemisión tras fallos del proveedor;
5. validar logs de plataforma y tratamiento de URLs con token;
6. decidir y configurar el proveedor de correo sin debilitar los guards;
7. mantener tests de regresión R1–R3B.2 y validación SQL aislada.
