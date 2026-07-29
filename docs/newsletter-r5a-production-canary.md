# Newsletter R5A: canario transaccional de producción

## Objetivo y alcance limitado

R5A prepara un carril canario, cerrado por allowlist, para validar en Vercel
Production el flujo real de La Agenda Motor:

1. solicitud de alta;
2. entrega de confirmación;
3. confirmación explícita mediante POST;
4. una única bienvenida;
5. baja explícita mediante POST;
6. repetición idempotente de la baja.

R5A no abre la captación general. La agenda semanal, las campañas y cualquier
mensaje arbitrario permanecen bloqueados. Este cambio sólo prepara código y
documentación: no modifica variables remotas, no despliega y no realiza envíos.

## Rutas públicas

- `/newsletter`
- `/newsletter/confirm`
- `/newsletter/unsubscribe`

Las tres rutas reutilizan la experiencia R4C, son dinámicas y `no-store`,
permanecen `noindex`, y responden 404 salvo que toda la configuración canaria
sea válida. Las rutas `/preview/newsletter...` continúan reservadas al ensayo
local R4B.

Abrir un enlace de confirmación o baja mediante GET sólo presenta la acción y
retira el token de la URL visible. La mutación se ejecuta mediante POST
same-origin después de una decisión explícita del usuario.

## Matriz exacta de guards

El transporte canario sólo queda preparado cuando se cumplen simultáneamente:

- `NEWSLETTER_MODE=live`.
- `NEWSLETTER_MAIL_TRANSPORT=resend`.
- `NEWSLETTER_PRODUCTION_CANARY_ARMED=production-double-opt-in-canary`.
- `VERCEL=1`.
- `VERCEL_ENV=production`.
- `NODE_ENV=production`.
- `NEWSLETTER_PRODUCTION_CANARY_ORIGIN` coincide exactamente con
  `https://www.eventomotor.com`.
- El origen usa HTTPS y no contiene credenciales, path adicional, query,
  fragmento ni slash final.
- El `Host`, el origen de la petición y la URL de la mutación coinciden
  exactamente con `www.eventomotor.com`.
- `NEWSLETTER_PRODUCTION_CANARY_ALLOWLIST` contiene entre 1 y 10 emails
  válidos, únicos tras normalización y sin wildcards.
- `NEWSLETTER_RESEND_API_KEY`, `NEWSLETTER_RESEND_FROM` y
  `NEWSLETTER_RESEND_REPLY_TO` son válidos.
- La dirección efectiva de `NEWSLETTER_RESEND_FROM` pertenece exactamente a
  `news.eventomotor.com`.
- Cada entrega tiene un único destinatario incluido exactamente en la
  allowlist y no contiene CC ni BCC.
- El comando es exclusivamente `confirmation` o `welcome`.

Un fallo en cualquiera de estas condiciones cierra el carril antes de invocar
el cliente HTTP. Preview y Development de Vercel no pueden habilitarlo. R4B
mantiene una evaluación separada: modo `test`, armado
`local-one-recipient`, `NODE_ENV=development`, sin Vercel y origen HTTP
loopback.

## Variables necesarias

Variables exclusivas de R5A:

```dotenv
NEWSLETTER_PRODUCTION_CANARY_ARMED=
NEWSLETTER_PRODUCTION_CANARY_ORIGIN=
NEWSLETTER_PRODUCTION_CANARY_ALLOWLIST=
```

Además utiliza las variables server-only ya existentes para modo, transporte,
API key, remitente y Reply-To. La allowlist R5A no reutiliza
`NEWSLETTER_TEST_RECIPIENT_ALLOWLIST`.

Los valores reales sólo deben introducirse manualmente en Vercel Production
durante una activación autorizada. Nunca deben copiarse a Git, documentación,
capturas, logs o chats.

## Plantillas permitidas y bloqueadas

Permitidas en el canario:

- confirmación de doble opt-in;
- bienvenida transaccional.

Bloqueadas:

- agenda semanal;
- campañas;
- emails arbitrarios;
- cualquier tipo futuro no añadido explícitamente al conjunto transaccional.

El renderer de preview puede seguir mostrando la edición semanal. El tipo de
comando del servicio y la comprobación en runtime impiden entregarla mediante
R5A. El cliente conserva el endpoint fijo de Resend, timeout de 10 segundos,
`redirect: "error"`, cero retries y ningún ajuste de tracking.

## Repeticiones y antiabuso

El cliente bloquea una segunda pulsación mientras la primera mutación está en
curso. La defensa duradera reside en PostgreSQL:

- la RPC bloquea el suscriptor con `FOR UPDATE`;
- aplica un cooldown de 15 minutos usando
  `last_confirmation_requested_at`;
- limita a tres solicitudes dentro de 24 horas;
- invalida el token anterior antes de emitir uno nuevo cuando corresponde.

Una dirección ya activa no recibe otra confirmación. Una segunda confirmación
devuelve `used_token` y no prepara otra bienvenida. La baja por token devuelve
`unsubscribed` la primera vez y `already_unsubscribed` en repeticiones.

Una solicitud con un email válido fuera de la allowlist recibe la misma
respuesta pública neutral y no llega al servicio, a persistencia ni a Resend.
La respuesta de alta nunca revela pertenencia a la allowlist ni estado de
suscripción.

## Preparación manual futura

Esta sección es un runbook para una operación posterior y expresamente
autorizada. No debe ejecutarse durante el desarrollo de R5A.

1. Confirmar que main contiene el commit aprobado y todos los checks están
   correctos.
2. Revisar que el dominio y remitente de Resend siguen verificados.
3. Crear una allowlist de 2 a 5 personas que hayan aceptado participar.
4. Revisar el texto de consentimiento y la información de privacidad con la
   persona responsable legal.
5. Cargar exclusivamente en Vercel Production los valores aprobados.
6. Mantener inicialmente `NEWSLETTER_MODE=off` y
   `NEWSLETTER_MAIL_TRANSPORT=disabled`.
7. Verificar que Preview y Development continúan apagados.
8. Realizar una ventana de cambio supervisada y activar al final, primero el
   transporte y después el modo live.

## Checklist legal

- [ ] Consentimiento y versión `2026-07` aprobados para uso en producción.
- [ ] Información de privacidad publicada y vigente.
- [ ] Finalidad, frecuencia y responsable revisados.
- [ ] Reply-To y canal de contacto supervisados.
- [ ] Participantes del canario informados y autorizados.
- [ ] Plazo de conservación y procedimiento de ejercicio de derechos revisados.

La aprobación legal definitiva es un bloqueo de activación, no del desarrollo
técnico.

## Checklist previa al canario

- [ ] Allowlist de 2 a 5 direcciones, sin duplicados ni listas de distribución.
- [ ] Remitente exacto del dominio verificado.
- [ ] Reply-To operativo.
- [ ] Origen exacto `https://www.eventomotor.com`.
- [ ] Preview y Development apagados.
- [ ] No existe otro cambio de newsletter en curso.
- [ ] Monitorización de Vercel, Resend y Supabase disponible.
- [ ] Responsable de rollback presente.
- [ ] Ventana y número máximo de pruebas acordados.

## Ejecución controlada con 2–5 personas

Para cada participante, una sola vez:

1. abrir `/newsletter`;
2. enviar email, provincia y consentimiento;
3. comprobar una confirmación en Resend;
4. abrir el enlace y verificar que GET no muta;
5. confirmar mediante el botón POST;
6. comprobar una única bienvenida;
7. abrir la baja y confirmar mediante POST;
8. repetir la baja y comprobar el estado idempotente;
9. no repetir el alta durante el cooldown.

No introducir direcciones ajenas a la allowlist ni probar la agenda semanal.

## Comprobaciones en Resend

- exactamente una confirmación por solicitud aceptada;
- exactamente una bienvenida por confirmación nueva;
- un único destinatario;
- ausencia de CC, BCC, campañas y agenda semanal;
- enlaces con origen público canónico;
- ausencia de reintentos de aplicación;
- no copiar IDs, cuerpos, direcciones o tokens al informe.

## Rollback inmediato

Ante cualquier respuesta inesperada, duplicado, error de permisos, fallo de
origen o entrega fuera de alcance:

1. establecer `NEWSLETTER_MODE=off`;
2. establecer `NEWSLETTER_MAIL_TRANSPORT=disabled`;
3. retirar el valor de armado;
4. comprobar que `/newsletter`, confirmación y baja responden 404;
5. conservar evidencias sin PII ni secretos;
6. no reintentar ni ampliar la allowlist hasta completar el diagnóstico.

Estado seguro final:

```dotenv
NEWSLETTER_MODE=off
NEWSLETTER_MAIL_TRANSPORT=disabled
NEWSLETTER_PRODUCTION_CANARY_ARMED=
NEWSLETTER_PRODUCTION_CANARY_ORIGIN=
NEWSLETTER_PRODUCTION_CANARY_ALLOWLIST=
```

R5A sigue siendo un canario explícito y reversible. No constituye autorización
para abrir la captación general ni para iniciar el envío semanal.
