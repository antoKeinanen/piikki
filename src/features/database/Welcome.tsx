export function Welcome({
  busy,
  error,
  onOpen,
  onCreate,
}: {
  busy: boolean;
  error: string;
  onOpen(): void;
  onCreate(): void;
}) {
  return (
    <main className="welcome">
      <div className="welcome-card">
        <h1 className="welcome-title">Piikki</h1>
        <button type="button" className="btn btn-primary btn-xl" disabled={busy} onClick={onOpen}>
          Avaa tietokanta
        </button>
        <p className="welcome-hint">Voit myös vetää tiedoston tähän.</p>
        <div className="welcome-divider" aria-hidden="true" />
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCreate}>
          Luo tietokanta
        </button>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
