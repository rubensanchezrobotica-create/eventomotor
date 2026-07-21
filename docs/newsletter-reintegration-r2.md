# Newsletter reintegration R2 — Product and visual preview

## Objetivo

R2 presenta y permite revisar `La Agenda Motor`, la newsletter semanal de EventoMotor, sin activar captación, persistencia ni envíos. La ruta interna reúne propuesta de valor, formulario simulado, variantes futuras y el HTML/texto plano real de los tres emails.

## Arquitectura visual

La preview reconstruye el producto sobre el sistema actual de EventoMotor. Reutiliza `ConceptStaticHeader`, `ConceptFooter`, `ConceptStyles`, el contenedor `emc-container`, el fondo oscuro, el naranja de marca, tipografía sans-serif, radios, bordes y sombras de las previews recientes. Sus estilos están encapsulados en `NewsletterPreview.module.css`; no modifica CSS global, header ni footer públicos.

La iteración visual final separa dos capas. La primera funciona como una landing terminada; la segunda se identifica expresamente como `Laboratorio interno R2`. La página se divide en:

1. Hero con propuesta y captación principal.
2. Beneficios editoriales.
3. Muestra recortada del HTML semanal real.
4. Flujo registro → confirmación → bienvenida → agenda.
5. Laboratorio con estados, variantes, visor técnico y notas del MVP.

## Componentes y estructura

- `app/preview/newsletter/page.tsx`: entrada server de la preview, guardia y render inicial.
- `components/newsletter/NewsletterPreviewPage.tsx`: composición del producto.
- `NewsletterSignupForm.tsx`: interacción simulada y laboratorio de estados.
- `NewsletterCaptureVariants.tsx`: variantes futuras no conectadas. La territorial acepta `provinceSlug`, `provinceName` y texto contextual.
- `NewsletterEmailShowcase.tsx`: selector y visor seguro del resultado renderizado.
- `newsletter-preview-model.ts`: tipos, opciones, validación y guardia puras.
- `emails/newsletter/*`: plantillas, metadata, tipos, fixtures y renderer.
- `lib/newsletter/render-email.server.tsx`: fachada `server-only` consumida por Next.js.

## Plantillas y fuente única

Existen tres implementaciones React Email: confirmación, bienvenida y agenda semanal. `email-renderer.tsx` selecciona una plantilla, inyecta su fixture tipado y genera HTML con `render`; el texto plano deriva de ese mismo HTML con `toPlainText`. La preview web consume el mismo resultado en un `iframe`, por lo que no hay una segunda maqueta HTML ni una copia visual divergente.

La fachada bajo `lib/newsletter` marca el consumo desde servidor. El renderer puro permanece separado para poder probar React Email bajo las condiciones normales de React; el modo global `react-server` del test R1 no admite `react-dom/server`.

## Fixtures

Todos los datos del email son internos y ficticios. La marca técnica se conserva en el fixture y en una nota no visible, mientras el contenido renderizado utiliza copy editorial terminado. No contienen UUID, tokens, suscriptores reales, precios ni disponibilidad. No se consulta Supabase.

## Cómo abrir la preview

No se modifica `.env.local`. En PowerShell, establecer el modo sólo para la sesión y arrancar Next:

```powershell
$env:NEWSLETTER_MODE='preview'
npm run dev
```

Abrir `http://localhost:3000/preview/newsletter`. La ruta exige exactamente `NEWSLETTER_MODE=preview`, comprueba `VERCEL_ENV`, bloquea producción con 404 y declara `noindex, nofollow`. El valor seguro permanente de `.env.example` continúa siendo `NEWSLETTER_MODE=off`.

Los parámetros `email`, `emailViewport` y `formState` permiten reproducir estados para revisión local; sólo aceptan valores predefinidos.

## Simulado y no conectado

Se simulan los estados `idle`, `focused`, `invalid_email`, `missing_province`, `submitting`, `pending_confirmation` y `generic_error`, incluyendo una latencia local corta. El email se limpia al completar la simulación. No hay `fetch`, almacenamiento web, consola, analítica, Server Action ni Route Handler.

Tampoco hay SDK de Resend, llamadas de envío, conexión a Supabase, aplicación de migraciones, rate limiting, webhooks, preferencia pública o baja funcional. Los enlaces de email apuntan exclusivamente a anclas de la preview local y el iframe está aislado con `sandbox` vacío, sin scripts ni interacción.

## Responsive y accesibilidad

Los estilos incluyen cortes para tablet y móvil, grids sin anchuras mínimas rígidas, campos a ancho completo, controles que envuelven, email móvil limitado a 390 px, foco visible y reducción de movimiento. La revisión R2 se realiza a 390, 430, 768, 1024 y 1440 px, además de un equivalente de zoom/reflow al 200 %, textos largos y errores.

El formulario usa labels reales, ayudas asociadas, `aria-invalid`, errores con `role=alert`/`aria-live`, mensaje de éxito anunciado y foco programático tras validación. Los selectores usan botones con `aria-pressed`; el iframe tiene título; el logo de email tiene alt text; los controles táctiles mantienen una altura cómoda y el orden DOM coincide con el orden visual.

Playwright no forma parte del proyecto y no se añade exclusivamente para R2. Las capturas y comprobaciones de overflow se hicieron con Edge headless y Chrome DevTools Protocol. Se verificaron anchos reales de 390, 430, 768, 1024 y 1440 px: en los cinco casos `scrollWidth <= clientWidth`. También se comprobó reflow equivalente a zoom del 200 % (viewport CSS de 720 px con escala 2), navegación por teclado con outline visible de 3 px, media query de reducción de movimiento, la provincia larga `Santa Cruz de Tenerife` y el error genérico multilínea.

La última iteración redujo la altura completa en todos los anchos medidos: 9098→7278 px en 390 (20,0 %), 8910→6993 px en 430 (21,5 %), 7099→5672 px en 768 (20,1 %), 6484→5183 px en 1024 (20,1 %) y 6552→5239 px en 1440 (20,0 %). El flujo pasó de una superficie naranja completa a una sección oscura con progresión naranja; las cuatro variantes se compactaron y todos los controles técnicos quedaron dentro del laboratorio.

La inspección del HTML directo detectó durante R2 que el padding lateral del `Body` de email podía forzar el ancho de la tabla en móvil. El shell se corrigió con margen porcentual propio y sin sumar padding exterior; los tres HTML se volvieron a auditar a 390 px sin overflow interno. Playwright sigue sin formar parte del proyecto y no se añadió exclusivamente para esta fase.

## Tests

```powershell
npm run test:newsletter-core
npm run test:newsletter-r2
npm run typecheck
```

R2 prueba guardia y producción, metadata, sitemap/navegación, validación y estados, no persistencia, ausencia de integraciones/endpoints, estructura responsive, sandbox, los tres renders HTML/texto, metadata, CTA, alt, baja, ausencia de scripts/formularios/tokens/PII y la fuente única.

## Riesgos y textos pendientes

- Consentimiento, preferencias, baja y textos legales definitivos requieren revisión jurídica antes de exposición pública. Los avisos internos se muestran fuera del HTML visible del email.
- Preferencias y baja sólo representan destinos futuros.
- El contenido editorial necesita proceso, responsables y criterios antes de automatizar campañas.
- La compatibilidad final debe probarse en clientes de correo reales cuando exista infraestructura de envío aislada.
- La observabilidad, antiabuso, rate limiting y estrategia de reintentos quedan fuera de R2.

## Siguiente checkpoint: R3

R3 puede incorporar orquestación exclusivamente server-side, Route Handlers internos, doble opt-in contra una base aislada, rate limiting y pruebas integradas. Supabase y cualquier proveedor de email deben permanecer desconectados hasta que ese alcance se autorice explícitamente y los textos legales estén aprobados.
