# Newsletter public visual polish

## Problemas detectados

La captación pública compartía escala con una segunda hero: reservaba una
columna para un isotipo pequeño, alcanzaba 46 px de padding interior, 64 px de
separación exterior y un titular de hasta 43 px. La combinación añadía altura,
vacío y competencia visual frente al calendario o la ficha de evento.

Privacidad y Aviso legal heredaban la presentación general de las páginas de
publicación: hero de hasta el 66 % del viewport, panel ancho y títulos propios
de una landing comercial. El contenido era correcto, pero su presentación no
tenía el ritmo de un documento de consulta.

## Decisiones visuales

- La tarjeta conserva fondo oscuro y acento naranja, pero reduce padding,
  separación, radio, sombra y escala tipográfica.
- Se elimina por completo el logo interno. No se sustituye por otro símbolo,
  imagen o marca de agua; permanece únicamente `LA AGENDA MOTOR`.
- El nuevo título es `Recibe La Agenda Motor cada semana`.
- La descripción es `Una selección de eventos y planes de motor para que no se
  te escape el próximo fin de semana.`
- El CTA sigue siendo `Quiero recibirla`.
- El texto secundario queda como
  `Gratis · Sin ruido · Baja en cualquier momento`.
- Inicio y ficha reutilizan exactamente el mismo componente, sin formulario ni
  JavaScript adicional.

## Primera capa legal

La información permanece visible junto al consentimiento, sin panel, fondo,
borde, título independiente ni identificación personal. La identidad legal
completa `Rubén Ginés Sánchez García` se conserva sin cambios exclusivamente en
Política de privacidad y Aviso legal.

Se mantienen la finalidad, la legitimación, el contacto para ejercer derechos,
los enlaces legales, la provincia opcional, el consentimiento desmarcado y la
declaración de edad.

## Documentos legales

Ambas páginas comparten un módulo de estilos scoped:

- hero sin altura artificial;
- H1, H2 y H3 más contenidos;
- columna de lectura limitada;
- panel, separadores y listas más compactos;
- gradiente de fondo más tenue;
- enlaces distinguibles y foco visible.

No se ha resumido, eliminado ni reinterpretado contenido legal.

## Responsive y alcance funcional

La tarjeta pasa a una columna por debajo de 640 px, conserva un CTA de ancho
completo y evita overflow horizontal. Los documentos reducen padding y escala
en 768 y 400 px sin convertir el texto en contenido diminuto.

La revisión visual cubre 320, 375, 768, 1280 y 1440 px. No cambia el gate
off/canary/public, la API, el transporte, el webhook, las plantillas, el
consentimiento, SEO, cookies, Analytics ni el bloqueo de la edición semanal.
