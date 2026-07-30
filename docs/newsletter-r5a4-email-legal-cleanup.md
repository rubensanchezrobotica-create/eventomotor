# Newsletter R5A.4 — Limpieza legal de emails

## Alcance

R5A.4 elimina la identificación personal del responsable en los correos de La
Agenda Motor. No modifica la primera capa legal de la landing, el flujo de
suscripción, las RPC, las migraciones, el webhook ni la configuración remota.

Las tres plantillas se identifican visiblemente como **La Agenda Motor ·
EventoMotor**. Sus pies mantienen el contacto `info@eventomotor.com` y enlaces
a la Política de privacidad y al Aviso legal. La bienvenida y la edición
semanal conservan además su enlace de baja.

Los textos de contexto quedan diferenciados por finalidad:

- confirmación: «Recibes este correo porque solicitaste tu suscripción a La
  Agenda Motor de EventoMotor.»;
- bienvenida y edición semanal: «Recibes este correo porque confirmaste tu
  suscripción a La Agenda Motor de EventoMotor.».

El remitente contractual sigue siendo `La Agenda Motor · EventoMotor
<agenda@news.eventomotor.com>` y el Reply-To sigue siendo
`info@eventomotor.com`.

## Verificación

Los tests renderizan HTML y texto plano de confirmación, bienvenida y edición
semanal. Comprueban que el nombre personal no aparece en cuerpo, pie, asunto ni
preheader; que EventoMotor continúa visible; que se conservan los enlaces
legales y de baja aplicables; y que el contrato de remitente y Reply-To no
cambia.
