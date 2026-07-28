# Newsletter reintegration R3B.3 — Captura local de correo

## Objetivo

R3B.3 añade un transporte provider-neutral que captura localmente el correo que
el servicio de newsletter habría entregado a un proveedor. Permite comprobar
destinatario, tipo, asunto, HTML, texto plano, enlaces, orden y duplicados sin
usar red, SMTP, Resend ni una entrega real.

El alcance permanece interno. No se crean rutas públicas, endpoints de envío,
webhooks, exportaciones de suscriptores ni cambios legales.

## Auditoría del flujo existente

El servicio R3A genera actualmente dos comandos:

- `confirmation`: después de que la RPC de solicitud devuelva
  `confirmation_required`. Contiene destinatario normalizado, token raw,
  propósito y caducidad.
- `welcome`: después de que la RPC de confirmación devuelva `confirmed`.
  Contiene únicamente `subscriberId`.

La plantilla semanal está implementada y se usa en la preview R2, pero ningún
flujo de servicio la envía todavía.

La persistencia precede siempre al transporte:

1. La solicitud genera el token raw y su hash.
2. La RPC persiste el suscriptor pendiente, consentimiento y hash.
3. Sólo después se entrega el token raw al transporte de confirmación.

En confirmación, la RPC activa primero el suscriptor y consume el token; la
bienvenida se intenta después. Un fallo del transporte no ejecuta rollback ni
una segunda RPC.

`accepted` significa que el transporte provider-neutral aceptó y, en R3B.3,
persistió atómicamente la captura. No significa entrega real. `skipped` sigue
siendo un error de configuración. Una excepción del transporte se convierte en
`provider_error` y `mailStatus: failed` por la política R3A.

## Arquitectura

```text
NewsletterService
  -> NewsletterMailTransport
  -> CaptureNewsletterMailTransport
  -> NewsletterMailCaptureStore
  -> FileNewsletterMailCaptureStore
  -> .tmp/newsletter-mail-capture/<captureId>.json
```

Las responsabilidades están separadas:

- el servicio conserva reglas, tokens y persistencia;
- el transporte valida el comando, construye URLs y renderiza la plantilla;
- el store valida límites y realiza la escritura atómica;
- el buzón sólo lee resúmenes o detalles;
- el renderer React Email continúa siendo la fuente única de HTML y texto.

No existe una segunda lógica de envío ni una copia de las plantillas.

## Transporte de captura

`lib/newsletter/mail-capture-transport.server.tsx` implementa exactamente
`NewsletterMailTransport` y está marcado `server-only`.

Para una confirmación:

- exige email válido, token opaco válido, propósito permitido y fecha válida;
- construye `/preview/newsletter/confirm?token=...` sobre un origen HTTP local;
- renderiza `ConfirmSubscriptionEmail` mediante el renderer único;
- usa el asunto contractual de `NEWSLETTER_EMAIL_METADATA`;
- genera un UUID v4 aleatorio independiente de email y token;
- guarda una captura;
- devuelve `{ status: "accepted" }` únicamente después de guardar.

No usa `fetch`, SMTP, SDK de proveedor, consola ni reintentos.

El token raw sólo aparece dentro del HTML y texto del mensaje, como parte del
enlace que se está validando. No forma parte del ID, nombre de archivo,
metadata, resumen, logs o analítica.

## Estado de bienvenida

El servicio ya intenta enviar bienvenida tras una confirmación válida, pero el
contrato existente sólo proporciona `subscriberId`. No proporciona:

- destinatario;
- provincia;
- URL de eventos;
- token o URL de baja.

La RPC de confirmación tampoco devuelve esos datos. Fabricarlos, consultar
tablas directamente o ampliar silenciosamente la RPC violaría el aislamiento de
R3A y el alcance de R3B.3.

Por ello el transporte de captura rechaza el comando `welcome`. El servicio
conserva la confirmación persistida y devuelve internamente
`provider_error`/`mailStatus: failed`, sin crear una falsa captura ni duplicar el
intento. R3B.4 deberá definir el contrato mínimo de preparación de bienvenida y
la acción de baja antes de conectarla.

## Store y persistencia local

`NewsletterMailCaptureStore` expone:

- `save`;
- `list`, que devuelve únicamente resúmenes enmascarados;
- `get`, por UUID aleatorio.

La implementación de archivos:

- sólo acepta exactamente `.tmp/newsletter-mail-capture/` bajo el workspace;
- usa un JSON por captura;
- escribe primero un temporal con `wx`;
- publica el JSON mediante hard link atómico y elimina el temporal;
- nunca deriva nombres de email o token;
- ignora entradas que no tengan nombre UUID `.json`;
- rechaza roots alternativos y IDs inválidos;
- limita el tamaño antes de escribir y antes de leer;
- falla cerrada ante JSON corrupto o error de filesystem.

El directorio está ignorado explícitamente por Git. No se escribe en `public`,
`.next`, `data`, imports, marca o directorios versionados.

El store en memoria existe exclusivamente dentro de
`tests/newsletter/newsletter-r3b3.test.ts`; nunca es un fallback runtime.

## Límites y retención

Valores runtime:

| Límite | Valor |
| --- | ---: |
| Capturas | 100 |
| Destinatario | 320 caracteres |
| Asunto | 200 caracteres |
| HTML | 512 KiB |
| Texto | 128 KiB |
| Metadata | 8 valores de hasta 200 caracteres |
| Retención | 7 días |

Un exceso falla sin truncar contenido ni enlaces. Las capturas caducadas se
eliminan durante `save` o `list`; no existe cron de limpieza.

## Activación fail-closed

La captura está deshabilitada por defecto. `.env.example` conserva:

```text
NEWSLETTER_MODE=off
NEWSLETTER_MAIL_TRANSPORT=disabled
NEWSLETTER_MAIL_CAPTURE_ORIGIN=
```

Para que el runtime de captura exista deben cumplirse simultáneamente:

- `NEWSLETTER_MODE=preview`;
- `NEWSLETTER_MAIL_TRANSPORT=capture`;
- `NEWSLETTER_MAIL_CAPTURE_ORIGIN` con origen HTTP `localhost`, `127.0.0.1` o
  `::1`, sin credenciales, path, query o fragmento;
- `NODE_ENV=development`;
- `VERCEL_ENV` ausente;
- `NEXT_PUBLIC_SUPABASE_URL` HTTP y estrictamente local;
- la service role local ya existente configurada.

No se añade ningún secreto. Una URL de Supabase remota desactiva el perfil.

El guard HTTP continúa resolviendo `preview`. Sólo después de superar todas las
condiciones anteriores, la composición server-only reutiliza internamente el
modo de servicio `test` para permitir persistencia exclusivamente local. Esto
es un perfil explícito separado: `preview` normal continúa sin efectos
secundarios y el significado de `off`, `preview`, `test` y `live` no cambia.

R3B.3 no inició Supabase local, no modificó `.env.local` y no ejecutó ninguna
petición de formulario. La composición de captura sólo consulta variables de
proceso; no abre ese archivo directamente.

## Composición

`createConfiguredNewsletterService()` es el único punto que selecciona el
transporte:

- perfil incompleto o bloqueado: `NullNewsletterMailTransport`;
- perfil local completo: `CaptureNewsletterMailTransport`;
- proveedor futuro: no implementado.

No hay condiciones de captura en componentes, Route Handlers, plantillas o
repositorio. Ningún Client Component importa módulos de captura.

## Privacidad

El registro completo contiene el destinatario porque es necesario para revisar
la preparación del mensaje. El listado lo transforma a una máscara, por
ejemplo `dr***@example.invalid`.

El destinatario:

- no se usa como ID o ruta;
- no aparece en nombres de archivo;
- no se registra;
- no se devuelve desde ninguna API;
- sólo se muestra completo dentro del detalle local protegido.

Los fixtures y tests usan exclusivamente dominios `.invalid`.

## Buzón interno

Se crea:

- `/preview/newsletter/mailbox`;
- `/preview/newsletter/mailbox/[id]`.

No existe API de buzón. Las páginas son Server Components y leen directamente
el store. El acceso requiere:

- el guard R3B.2;
- el perfil capture completo;
- host HTTP local idéntico al origen configurado;
- ausencia de Vercel y producción.

El buzón hereda `noindex`, `nofollow`, `noarchive` y `no-referrer`. Google
Analytics excluye el prefijo completo del buzón.

El listado muestra fecha, tipo, email enmascarado, asunto, estado y enlace por
UUID. Un ID inválido o ausente responde `404` sin revelar datos.

El detalle muestra:

- destinatario completo;
- tipo, estado, fecha e ID;
- HTML en `iframe` con `sandbox=""` y `referrerPolicy="no-referrer"`;
- CSP `default-src 'none'`, imágenes sólo `data:` y formularios bloqueados;
- scripts retirados antes de construir `srcDoc`;
- iframe sin interacción, navegación superior ni recursos remotos;
- texto plano accesible;
- enlaces resumidos con valores de query ocultos.

Los tokens sólo permanecen visibles dentro del HTML/texto originales del
mensaje capturado.

## Fallos y ausencia de duplicados

- Cooldown, límite diario, suscriptor activo y estados bloqueados no invocan el
  transporte.
- Un store fallido provoca un único `provider_error`; no existe retry.
- La respuesta HTTP pública conserva la forma genérica anti-enumeración, pero
  el estado interno nunca afirma correo capturado.
- Una confirmación usada no vuelve a intentar bienvenida.
- No hay compensación TypeScript, outbox o cambio de RPC.

## Tests

Ejecutar:

```powershell
npm run test:newsletter-r3b3
```

El comando contiene dos particiones:

1. `react-server` para transporte, store, servicio, guards, privacidad y buzón;
2. runtime React normal para validar el renderizado React Email real, porque
   React 19 no permite `react-dom/server` bajo la condición `react-server`.

La suite cubre captura, payload, red, logs, URLs, almacenamiento, orden,
enmascarado, límites, atomicidad, path traversal, retención, activación,
solicitud, cooldown, activo, bloqueados, fallo de store, bienvenida, HTML
aislado, analítica y arquitectura cliente/server.

## Limitaciones y criterios para R3B.4

R3B.4 no debe comenzar hasta:

1. ampliar de forma aprobada el contrato de bienvenida sin consultas
   TypeScript multipaso;
2. definir y firmar el token de baja que usará la plantilla;
3. definir reemisión segura tras fallo de proveedor;
4. revisar logs de proxy para URLs con token;
5. aprobar límites y retención operativos;
6. decidir proveedor real como checkpoint separado;
7. conservar guards locales, anti-enumeración y tests R1–R3B.3.

R3B.3 no conecta Resend, SMTP, Supabase remoto, webhooks o correo real; tampoco
aplica migraciones ni despliega.
