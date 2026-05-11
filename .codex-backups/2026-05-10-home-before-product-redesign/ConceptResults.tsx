export default function ConceptResults() {
  return (
    <section className="emc-section emc-organizer-section" id="organizadores">
      <div className="emc-container">
        <div className="emc-panel emc-pro-panel">
          <div>
            <div className="emc-kicker">Para organizadores</div>
            <h2>Publica tu evento donde el usuario ya está buscando</h2>
            <p className="emc-pro-copy">
              EventoMotor ordena los planes por fecha, zona, tipo de vehículo y disciplina para que el evento sea fácil de encontrar.
            </p>
            <div className="emc-pro-actions">
              <a className="emc-btn emc-btn-primary" href="mailto:hola@eventomotor.com?subject=Publicar%20evento%20en%20EventoMotor">
                Publicar evento
              </a>
            </div>
          </div>
          <div className="emc-checks">
            <div className="emc-check"><strong>Fecha</strong><span>calendario claro</span></div>
            <div className="emc-check"><strong>Zona</strong><span>búsqueda territorial</span></div>
            <div className="emc-check"><strong>Tipo</strong><span>motos o coches</span></div>
            <div className="emc-check"><strong>Ficha</strong><span>detalle del evento</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
