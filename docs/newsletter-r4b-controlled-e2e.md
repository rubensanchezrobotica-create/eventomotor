# Newsletter R4B: ensayo E2E local controlado

## Objetivo

R4B prepara un único carril manual para comprobar en local el flujo completo de
La Agenda Motor con dos entregas reales mediante Resend: solicitud, confirmación,
bienvenida, baja y repetición idempotente de la baja.

Este carril no es un modo público, no se configura en Vercel y no modifica la
arquitectura de persistencia, las RPC, las plantillas ni los endpoints existentes.

## Garantías de seguridad

El transporte real falla cerrado salvo que todas las condiciones siguientes se
cumplan al mismo tiempo:

- `NEWSLETTER_MODE=test`.
- `NEWSLETTER_MAIL_TRANSPORT=resend`.
- `NEWSLETTER_R4B_ARMED=local-one-recipient`.
- `NODE_ENV=development`.
- No existen `VERCEL` ni `VERCEL_ENV`.
- `NEWSLETTER_R4B_LOCAL_ORIGIN` es un origen HTTP loopback canónico, sin ruta,
  credenciales, query ni fragment.
- La allowlist contiene exactamente un email válido.
- Cada entrega contiene exactamente ese destinatario normalizado y no contiene
  CC ni BCC.
- La API key, el remitente y Reply-To están presentes.
- La dirección del remitente pertenece exactamente a `news.eventomotor.com`.

El cliente conserva el endpoint fijo de Resend, `redirect: "error"`, un timeout
de 10 segundos y cero reintentos. Los enlaces de confirmación y baja se generan
exclusivamente con el origen loopback configurado. Las mutaciones siguen siendo
POST, las respuestas son `no-store`, el token se retira de la URL visible y la
preview mantiene `noindex`.

## Preparación manual posterior

La prueba sólo debe prepararse en un archivo local no versionado. No copies la
clave real a documentación, logs, terminales compartidos, capturas ni chats.
Configura manualmente:

```dotenv
NEWSLETTER_MODE=test
NEWSLETTER_MAIL_TRANSPORT=resend
NEWSLETTER_R4B_ARMED=local-one-recipient
NEWSLETTER_R4B_LOCAL_ORIGIN=http://localhost:3000
NEWSLETTER_RESEND_API_KEY=<clave-local-no-versionada>
NEWSLETTER_RESEND_FROM=<remitente-verificado-en-news.eventomotor.com>
NEWSLETTER_RESEND_REPLY_TO=<reply-to-controlado>
NEWSLETTER_TEST_RECIPIENT_ALLOWLIST=<un-unico-destinatario-autorizado>
```

No uses un dominio público, HTTPS, una IP de la red local ni más de una dirección
en la allowlist. No descargues variables desde Vercel.

## Lista de verificación antes de un envío real

- [ ] El proceso se ejecuta en una máquina local y no dentro de Vercel.
- [ ] El origen abre exactamente el mismo host y puerto usados en la variable.
- [ ] La allowlist contiene una sola dirección, revisada por la persona receptora.
- [ ] El formulario contiene exactamente esa misma dirección.
- [ ] El remitente usa el subdominio verificado `news.eventomotor.com`.
- [ ] No hay otra instancia del servidor usando esta configuración.
- [ ] La rama y el árbol de trabajo son los esperados.
- [ ] No se está grabando ni compartiendo la terminal.
- [ ] Se ha acordado realizar una única ejecución manual.

## Ejecución local que se validará

1. Arrancar Next.js localmente con la configuración anterior.
2. Abrir `/preview/newsletter` en el origen exacto configurado.
3. Solicitar la suscripción con el único email permitido y una provincia.
4. Abrir el correo de confirmación y comprobar que el enlace apunta al loopback.
5. Pulsar el botón de confirmación; abrir el enlace no muta por GET.
6. Comprobar que se recibe una única bienvenida.
7. Abrir el enlace local de baja y confirmar mediante POST.
8. Repetir la baja y comprobar `already_unsubscribed`.

No se debe probar con formularios públicos ni efectuar envíos adicionales.

## Vuelta al estado seguro

Detén el servidor y elimina de la configuración local los valores de R4B y las
credenciales. Como mínimo, deja:

```dotenv
NEWSLETTER_MODE=off
NEWSLETTER_MAIL_TRANSPORT=disabled
NEWSLETTER_R4B_ARMED=
NEWSLETTER_R4B_LOCAL_ORIGIN=
```

Confirma que no queda ningún proceso local activo. En Vercel, Production,
Preview y Development deben conservar `NEWSLETTER_MODE=off` y
`NEWSLETTER_MAIL_TRANSPORT=disabled`; no añadas las variables R4B.

## Confirmación de ausencia de despliegue

Esta preparación no requiere `vercel deploy`, `vercel env pull`, GitHub Actions,
`supabase link`, `supabase db push` ni migraciones. Para confirmar que no se
desplegó nada, revisa sólo el historial local de comandos y el estado de Git; no
introduzcas credenciales ni conectes servicios remotos durante esa comprobación.
