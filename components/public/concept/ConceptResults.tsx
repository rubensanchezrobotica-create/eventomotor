import TrackLink from "@/components/analytics/TrackLink";

export default function ConceptResults() {
  return (
    <section className="emc-section emc-organizer-section" id="publicar">
      <div className="emc-container">
        <div className="emc-panel emc-pro-panel">
          <div>
            <div className="emc-kicker">Para organizadores</div>
            <h2>¿Organizas un evento de motor?</h2>
            <p className="emc-pro-copy">
              Publica tu evento y aparece en el calendario, el mapa, las búsquedas por zona y las fichas optimizadas de EventoMotor.
            </p>
            <div className="emc-pro-actions">
              <TrackLink
                className="emc-btn emc-btn-primary"
                eventName="click_publish_event"
                eventParams={{ source: "organizer_cta" }}
                href="/publicar-evento"
              >
                Publicar evento
              </TrackLink>
            </div>
          </div>
          <div className="emc-checks">
            <div className="emc-check"><strong>Calendario nacional</strong><span>presencia por fecha</span></div>
            <div className="emc-check"><strong>Mapa por zonas</strong><span>descubrimiento territorial</span></div>
            <div className="emc-check"><strong>Ficha SEO</strong><span>página propia del evento</span></div>
            <div className="emc-check"><strong>Clics medibles</strong><span>tráfico hacia fuente o entradas</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
