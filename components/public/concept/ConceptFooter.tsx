export default function ConceptFooter() {
  return (
    <footer className="emc-footer">
      <div className="emc-container emc-footer-grid">
        <div>
          <div className="emc-footer-brand">
            <span className="emc-brand-mark" aria-hidden="true">EM</span>
            <span className="emc-brand-word">
              Evento<span>Motor</span>
            </span>
          </div>
          <p>Concepto visual portado a React con datos reales de EventoMotor.</p>
        </div>
        <div>© {new Date().getFullYear()} EventoMotor / La brújula del motor</div>
      </div>
    </footer>
  );
}
