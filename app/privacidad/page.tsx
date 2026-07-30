import type { Metadata } from "next";
import Link from "next/link";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { SITE_URL } from "@/lib/seo";
import legalStyles from "../legal-document.module.css";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Información sobre el tratamiento de datos personales en EventoMotor y La Agenda Motor.",
  alternates: {
    canonical: `${SITE_URL}/privacidad`,
  },
};

export default function PrivacidadPage() {
  return (
    <div className={`emc-page ${legalStyles.legalPage}`}>
      <ConceptStyles />
      <ConceptStaticHeader compactActions />
      <main className="emc-contact-page emc-publish-page">
        <section className={`emc-contact-hero ${legalStyles.hero}`}>
          <div className={`emc-container ${legalStyles.heroInner}`}>
            <div className="emc-kicker">Legal</div>
            <h1>Política de privacidad de EventoMotor</h1>
            <p className={`emc-contact-lead ${legalStyles.lead}`}>
              Última actualización: 29 de julio de 2026.
            </p>
          </div>
        </section>

        <section className={`emc-section emc-contact-section ${legalStyles.content}`}>
          <div className={`emc-container ${legalStyles.contentInner}`}>
            <article className={`emc-panel emc-contact-list-panel emc-legal-document ${legalStyles.document}`}>
              <section>
                <h2>1. Responsable del tratamiento</h2>
                <p><strong>Responsable:</strong> Rubén Ginés Sánchez García</p>
                <p><strong>Proyecto:</strong> EventoMotor</p>
                <p><strong>Sitio web:</strong> eventomotor.com</p>
                <p>
                  <strong>Correo de contacto y protección de datos:</strong>{" "}
                  <a href="mailto:info@eventomotor.com">info@eventomotor.com</a>
                </p>
                <p><strong>País de establecimiento:</strong> España</p>
                <p>
                  EventoMotor es actualmente un proyecto gestionado por una persona
                  física. No existe una sociedad mercantil denominada EventoMotor.
                </p>
              </section>

              <section>
                <h2>2. Qué datos tratamos</h2>
                <h3>2.1. Suscripción a “La Agenda Motor”</h3>
                <p>Podemos tratar:</p>
                <ul>
                  <li>Dirección de correo electrónico.</li>
                  <li>Provincia, únicamente cuando se facilite de forma voluntaria.</li>
                  <li>Comunidad autónoma derivada de la provincia elegida.</li>
                  <li>Identificador controlado de la página o punto de captación.</li>
                  <li>Fecha y hora de la solicitud y de la confirmación.</li>
                  <li>Versión de la información y del texto de consentimiento mostrado.</li>
                  <li>
                    Estado de la suscripción: pendiente, activa, baja, rebote, queja
                    o supresión.
                  </li>
                  <li>
                    Datos técnicos necesarios para la entrega del correo, como el
                    identificador del mensaje y los estados de entrega, rebote o
                    queja.
                  </li>
                </ul>
                <p>
                  En el lanzamiento inicial no utilizaremos la dirección IP para
                  determinar la ubicación del suscriptor ni conservaremos una IP
                  hasheada en la base de datos de la newsletter.
                </p>
                <p>
                  No realizaremos seguimiento individual de aperturas ni de clics de
                  la newsletter.
                </p>

                <h3>2.2. Solicitudes de publicación de eventos</h3>
                <p>Podemos tratar:</p>
                <ul>
                  <li>Nombre público del organizador o entidad.</li>
                  <li>Dirección de correo electrónico.</li>
                  <li>Teléfono, cuando se facilite voluntariamente.</li>
                  <li>Información del evento.</li>
                  <li>
                    URL del cartel y enlaces a la web oficial, inscripción, venta de
                    entradas o redes sociales.
                  </li>
                </ul>
                <p>
                  En el flujo actual, el correo y el teléfono se utilizan como datos
                  internos de contacto y no se incorporan automáticamente a la ficha
                  pública. Cualquier futura publicación de esos datos requerirá
                  controles expresos e independientes que todavía no están
                  disponibles.
                </p>

                <h3>2.3. Consultas, rectificaciones y derechos</h3>
                <p>
                  Podemos tratar los datos identificativos, de contacto y el
                  contenido necesario para responder una consulta, corregir o
                  retirar un evento, gestionar una incidencia o atender una
                  solicitud de derechos.
                </p>
                <p>
                  No solicitaremos una copia del DNI de forma sistemática. Solo
                  pediremos información adicional cuando existan dudas razonables
                  sobre la identidad de la persona solicitante.
                </p>

                <h3>2.4. Navegación y cookies</h3>
                <p>
                  Las cookies técnicas necesarias podrán utilizarse para que la web
                  funcione y para recordar la elección de privacidad.
                </p>
                <p>
                  Google Analytics solo se activará después de que el usuario acepte
                  expresamente las cookies analíticas. Rechazarlas no impedirá
                  utilizar las funciones esenciales de EventoMotor.
                </p>
              </section>

              <section>
                <h2>3. Para qué utilizamos los datos y cuál es la base jurídica</h2>
                <h3>3.1. “La Agenda Motor”</h3>
                <p>Utilizamos los datos para:</p>
                <ul>
                  <li>Gestionar la solicitud de alta.</li>
                  <li>Enviar el correo de doble confirmación.</li>
                  <li>Enviar el correo de bienvenida.</li>
                  <li>Enviar semanalmente “La Agenda Motor”.</li>
                  <li>
                    Personalizar territorialmente la selección cuando se haya
                    indicado una provincia.
                  </li>
                  <li>Gestionar la baja.</li>
                  <li>
                    Cuando se active la integración autenticada con el proveedor,
                    gestionar entregas, rebotes permanentes y quejas.
                  </li>
                  <li>
                    Acreditar cuándo y cómo se prestó o retiró el consentimiento.
                  </li>
                </ul>
                <p>
                  La base jurídica principal es el <strong>consentimiento</strong>,
                  que puede retirarse en cualquier momento.
                </p>
                <p>
                  La suscripción no se activa al enviar el formulario. Solo se activa
                  cuando el usuario pulsa el enlace de confirmación recibido por
                  correo.
                </p>

                <h3>3.2. Entregabilidad, bajas y supresión</h3>
                <p>
                  Los datos relativos a entregas, rebotes y quejas sólo se tratarán
                  cuando hayan sido recibidos y registrados mediante una integración
                  autenticada con el proveedor. Esta integración debe completarse
                  antes de activar públicamente el servicio.
                </p>
                <p>
                  La baja actual impide nuevos envíos y conserva el registro
                  necesario para respetarla. La política técnica de minimización
                  posterior debe completarse antes de la activación pública.
                </p>

                <h3>3.3. Solicitudes de publicación de eventos</h3>
                <p>
                  Los datos se utilizan para revisar la solicitud, pedir
                  aclaraciones, verificar la información, publicar el evento cuando
                  proceda y gestionar posteriores rectificaciones o retiradas.
                </p>
                <p>
                  La base jurídica es la aplicación de medidas solicitadas por el
                  propio organizador y el interés legítimo en gestionar y revisar el
                  contenido remitido.
                </p>
                <p>
                  El flujo actual no publica el correo ni el teléfono de contacto.
                  Cualquier futura publicación requerirá una autorización expresa,
                  independiente y persistida.
                </p>
                <p>
                  Enviar una solicitud de publicación no implica suscribirse a “La
                  Agenda Motor”.
                </p>

                <h3>3.4. Consultas y ejercicio de derechos</h3>
                <p>
                  Los datos se utilizan para responder y dejar constancia de la
                  gestión realizada. La base jurídica es la atención de la solicitud
                  y, cuando corresponda, el cumplimiento de una obligación legal.
                </p>

                <h3>3.5. Analítica web</h3>
                <p>
                  La base jurídica para Google Analytics es el consentimiento para
                  cookies analíticas.
                </p>
              </section>

              <section>
                <h2>4. Personalización territorial</h2>
                <p>
                  Si el usuario facilita una provincia, EventoMotor derivará
                  internamente la comunidad autónoma correspondiente para recomendar
                  eventos cercanos o territorialmente relevantes.
                </p>
                <p>No utilizamos para esta finalidad:</p>
                <ul>
                  <li>Geolocalización precisa.</li>
                  <li>Ubicación obtenida mediante la dirección IP.</li>
                  <li>Historial de navegación.</li>
                  <li>Seguimiento individual de aperturas o clics del correo.</li>
                </ul>
                <p>
                  Si no se indica ninguna provincia, se recibirá una selección
                  general de España.
                </p>
                <p>
                  Esta personalización no produce efectos jurídicos ni consecuencias
                  significativas para el suscriptor.
                </p>
              </section>

              <section>
                <h2>5. Proveedores y destinatarios</h2>
                <p>
                  EventoMotor no vende ni facilita los datos de los suscriptores a
                  organizadores, patrocinadores o terceros para sus propios fines
                  comerciales.
                </p>
                <p>Para prestar el servicio utilizamos proveedores tecnológicos:</p>
                <ul>
                  <li><strong>Vercel:</strong> alojamiento y ejecución de la aplicación.</li>
                  <li>
                    <strong>Supabase:</strong> base de datos e infraestructura. El
                    proyecto principal está alojado en <code>eu-west-1</code>,
                    Irlanda.
                  </li>
                  <li>
                    <strong>Resend:</strong> envío y gestión técnica del correo desde
                    el subdominio <code>news.eventomotor.com</code>.
                  </li>
                  <li>
                    <strong>Zoho:</strong> gestión del buzón{" "}
                    <code>info@eventomotor.com</code>.
                  </li>
                  <li>
                    <strong>Google Analytics:</strong> analítica web, únicamente
                    después del consentimiento.
                  </li>
                  <li><strong>DonDominio:</strong> registro del dominio y gestión DNS.</li>
                </ul>
                <p>
                  Estos proveedores pueden tratar datos únicamente dentro de las
                  funciones necesarias para prestar sus servicios y conforme a sus
                  contratos y condiciones aplicables.
                </p>
              </section>

              <section>
                <h2>6. Transferencias internacionales</h2>
                <p>
                  Algunos proveedores o subencargados pueden tratar datos fuera del
                  Espacio Económico Europeo.
                </p>
                <p>
                  Cuando exista una transferencia internacional, se utilizarán las
                  garantías reconocidas por el RGPD que correspondan, como una
                  decisión de adecuación, las cláusulas contractuales tipo aprobadas
                  por la Comisión Europea u otro mecanismo válido.
                </p>
                <p>
                  EventoMotor mantendrá un inventario interno de proveedores,
                  subencargados y mecanismos de transferencia.
                </p>
              </section>

              <section>
                <h2>7. Conservación</h2>
                <ul>
                  <li><strong>Suscriptores activos:</strong> mientras permanezcan suscritos.</li>
                  <li>
                    <strong>Después de la baja:</strong> se conservará el registro
                    necesario para respetar la supresión, evitar envíos indebidos y
                    acreditar la operación mientras se completa la política técnica
                    de minimización.
                  </li>
                  <li>
                    <strong>Prueba de consentimiento y de baja:</strong> hasta 5
                    años, con acceso restringido, para acreditar el cumplimiento o
                    atender posibles reclamaciones. La minimización técnica adicional
                    debe completarse antes de activar públicamente el servicio.
                  </li>
                  <li>
                    <strong>Rebotes permanentes y quejas:</strong> cuando la
                    integración autenticada esté activa, mientras sea necesario para
                    evitar nuevos envíos indebidos.
                  </li>
                  <li>
                    <strong>Datos de contacto de organizadores:</strong> hasta 2 años
                    después de la celebración del evento; posteriormente se revisarán
                    y eliminarán cuando ya no sean necesarios.
                  </li>
                  <li>
                    <strong>Consultas y derechos:</strong> durante el tiempo necesario
                    para gestionarlos y acreditar la respuesta, aplicando después los
                    plazos legales correspondientes.
                  </li>
                  <li>
                    <strong>Copias de seguridad:</strong> los datos borrados podrán
                    permanecer temporalmente hasta la rotación automática de las
                    copias. No se restaurarán salvo que sea necesario para resolver
                    una incidencia real y justificada.
                  </li>
                </ul>
              </section>

              <section>
                <h2>8. Derechos</h2>
                <p>Puedes solicitar:</p>
                <ul>
                  <li>Acceso a tus datos.</li>
                  <li>Rectificación.</li>
                  <li>Supresión.</li>
                  <li>Limitación del tratamiento.</li>
                  <li>Oposición.</li>
                  <li>Portabilidad, cuando corresponda.</li>
                  <li>Retirada del consentimiento en cualquier momento.</li>
                </ul>
                <p>
                  Para ejercerlos, escribe a{" "}
                  <a href="mailto:info@eventomotor.com">
                    <strong>info@eventomotor.com</strong>
                  </a>{" "}
                  indicando qué derecho deseas ejercer.
                </p>
                <p>
                  La solicitud se responderá, con carácter general, en el plazo de un
                  mes. Solo se solicitará documentación adicional si existen dudas
                  razonables sobre la identidad.
                </p>
                <p>
                  También puedes presentar una reclamación ante la Agencia Española
                  de Protección de Datos.
                </p>
              </section>

              <section>
                <h2>9. Baja de “La Agenda Motor”</h2>
                <p>Todos los envíos periódicos incluirán un enlace de baja.</p>
                <p>
                  La baja será inmediata, gratuita y no requerirá iniciar sesión. El
                  motivo de baja, cuando se solicite, será siempre opcional y
                  aparecerá después de completar la operación.
                </p>
                <p>
                  Si una persona desea volver a suscribirse, deberá realizar una
                  nueva solicitud y completar de nuevo el doble opt-in.
                </p>
              </section>

              <section>
                <h2>10. Menores</h2>
                <p>“La Agenda Motor” no está dirigida a menores de 14 años.</p>
                <p>
                  No solicitamos la fecha de nacimiento, pero al suscribirse el
                  usuario declara tener al menos 14 años. Las personas menores de esa
                  edad no deben completar el formulario sin la autorización
                  correspondiente.
                </p>
              </section>

              <section>
                <h2>11. Seguridad</h2>
                <p>EventoMotor aplica medidas proporcionadas al riesgo, entre ellas:</p>
                <ul>
                  <li>Autenticación en dos pasos en los proveedores principales.</li>
                  <li>Acceso administrativo restringido.</li>
                  <li>Secretos y claves de servicio únicamente en servidor.</li>
                  <li>Tokens de confirmación de un solo uso y con caducidad.</li>
                  <li>
                    Bloqueo de nuevas entregas cuando un rebote permanente o una
                    queja hayan sido registrados de forma válida.
                  </li>
                  <li>Revisión manual de las solicitudes de eventos.</li>
                  <li>Registro interno de incidentes.</li>
                  <li>
                    Procedimiento para valorar la notificación de brechas a la AEPD.
                  </li>
                </ul>
              </section>

              <section>
                <h2>12. Procedencia</h2>
                <p>
                  Los datos de suscriptores y organizadores se obtienen directamente
                  de las personas que completan los formularios o contactan con
                  EventoMotor.
                </p>
                <p>
                  Cuando EventoMotor elabora una ficha desde información pública,
                  utiliza información del evento y evita incorporar datos personales
                  innecesarios de los organizadores.
                </p>
              </section>

              <section>
                <h2>13. Cambios en la política</h2>
                <p>
                  Esta política podrá actualizarse cuando cambien las funcionalidades,
                  proveedores, finalidades o requisitos aplicables.
                </p>
                <p>
                  Cuando un cambio afecte sustancialmente al consentimiento prestado,
                  se informará al usuario y se solicitará un nuevo consentimiento
                  cuando resulte necesario.
                </p>
                <p>
                  Consulta también la <Link href="/cookies">Política de cookies</Link>{" "}
                  y el <Link href="/aviso-legal">Aviso legal</Link>.
                </p>
              </section>
            </article>
          </div>
        </section>
      </main>
      <ConceptFooter />
    </div>
  );
}
