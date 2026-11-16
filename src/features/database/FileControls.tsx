export function FileControls({
  busy,
  encrypted,
  onOpen,
  onBackup,
}: {
  busy: boolean;
  encrypted: boolean;
  onOpen(): void;
  onBackup(): void;
}) {
  return (
    <div className="settings-section">
      <p className="dialog-text">Muutokset tallentuvat tiedostoon heti.</p>
      <p className="field-hint">
        {encrypted
          ? "Tiedosto on salattu. Sen voi avata vain sovelluksella, jolla on sama salasana."
          : "Tiedostoa ei ole salattu, koska sovellukselle ei ole asetettu salasanaa."}
      </p>
      <div className="button-row">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onBackup}>
          Lataa varmuuskopio
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onOpen}>
          Avaa toinen tietokanta
        </button>
      </div>
    </div>
  );
}
