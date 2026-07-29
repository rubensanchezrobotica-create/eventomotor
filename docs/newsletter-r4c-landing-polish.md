# Newsletter R4C — Landing polish

## Objetivo

R4C pule la composición, el copy por estado y el comportamiento responsive de
las tres rutas internas de La Agenda Motor:

- `/preview/newsletter`
- `/preview/newsletter/confirm`
- `/preview/newsletter/unsubscribe`

El trabajo es exclusivamente visual y de presentación. No cambia el contrato
HTTP, el procesamiento de tokens, la persistencia ni la entrega de correo.

## Problemas detectados

- Confirmación y baja heredaban la navegación pública completa y el CTA
  `Publicar`, pese a ser flujos de una sola tarea.
- El titular de las acciones ocupaba demasiado espacio y alejaba el CTA.
- El encabezado conservaba copy pendiente después de una acción completada.
- El mensaje técnico sobre la gestión del token se mostraba al usuario.
- En móvil, métricas y beneficios mantenían demasiadas columnas.
- El laboratorio R2 competía visualmente con la experiencia de producto.

## Decisiones visuales

- Cabecera mínima en confirmación y baja: logo de EventoMotor y contexto de
  La Agenda Motor, sin navegación completa.
- Contenedor de acción centrado y reducido a `780px`, con titulares de
  `clamp(32px, 4.2vw, 48px)`.
- Acento naranja breve, bordes finos y superficies oscuras coherentes con la
  identidad existente.
- Estado completado diferenciado mediante un panel de confirmación compacto,
  no mediante una segunda página o una variante técnica.
- CTA de baja explícito, con la salida segura `Mantener mi suscripción` como
  enlace secundario de menor peso visual.
- Laboratorio R2 recogido en un `details` semántico, separado del recorrido de
  producto.
- Aviso R4B conservado únicamente dentro de la preview protegida por el guard
  local ya existente.

## Copy final por estado

### Confirmación pendiente

- Etiqueta: `Confirmación de suscripción`
- Título: `Confirma tu suscripción a La Agenda Motor`
- Descripción: `Sólo falta este paso para empezar a recibir nuestra selección semanal de eventos del motor.`
- Apoyo: `Confirma tu dirección para activar tu suscripción.`
- CTA: `Confirmar suscripción`

### Confirmación completada

- Etiqueta: `Suscripción confirmada`
- Título: `Ya formas parte de La Agenda Motor`
- Descripción: `Tu suscripción está activa. Recibirás nuestra selección semanal de planes y eventos del motor.`
- Estado: `Todo listo`
- Apoyo: `Te avisaremos cuando tengamos preparada tu próxima selección.`
- CTA secundario: `Ver próximos eventos`

### Confirmación ya completada

- Título: `Tu suscripción ya estaba confirmada`
- Texto: `No necesitas realizar ninguna otra acción.`

### Baja pendiente

- Etiqueta: `Baja de la newsletter`
- Título: `¿Quieres dejar de recibir La Agenda Motor?`
- Descripción: `Confirma la baja para dejar de recibir nuestras próximas ediciones.`
- Apoyo: `Puedes cerrar esta página si prefieres mantener tu suscripción.`
- CTA principal: `Sí, darme de baja`
- CTA secundario: `Mantener mi suscripción`

### Baja completada

- Etiqueta: `Baja completada`
- Título: `Tu baja se ha procesado correctamente`
- Descripción: `No recibirás nuevas ediciones de La Agenda Motor.`
- CTA: `Volver a EventoMotor`

### Baja ya completada

- Título: `La baja ya estaba completada`
- Texto: `No necesitas realizar ninguna otra acción.`

## Responsive y accesibilidad

- Cortes revisados para escritorio, tablet y `520px`, `430px` y `360px`.
- Beneficios en una columna en móvil estrecho y métricas en una columna a
  `360px`.
- Controles principales con texto de `16px`, ancho completo en móvil y
  objetivos táctiles de al menos `44px`.
- Estados `hover`, `focus-visible`, `disabled` y `loading` diferenciados.
- Orden semántico de encabezados, labels, `aria-live` y foco programático
  conservados.
- Sin copy técnico sobre tokens y sin scroll horizontal.

## Elementos no modificados

- Endpoints y método POST.
- Política same-origin y `no-store`.
- Tokens, RPC, Supabase y migraciones.
- Resend, transportes y variables de entorno.
- Guard R4B, 404 fail-closed, `noindex` y `no-referrer`.
- Idempotencia, bienvenida y lógica de baja.
- Emails React Email y logotipo de email.

## Checklist visual

- [x] Landing principal: 1440, 1024, 768, 390, 360 y 320 px.
- [x] Confirmación pendiente: escritorio, 390 y 320 px.
- [x] Confirmación completada: escritorio y móvil.
- [x] Baja pendiente: escritorio, 390 y 320 px.
- [x] Baja completada y ya completada: escritorio y móvil.
- [x] Sin overflow horizontal.
- [x] Recorrido completo por teclado.
- [x] Foco visible en enlaces, campos y botones.
- [x] Aviso R4B visible sólo en el carril local armado.
