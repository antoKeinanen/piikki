import { useState } from "react";
import { brandingStyle } from "../branding/theme";
import { defaultBranding } from "../../ledger";

export function CompatibilityBlock({ problem }: { problem: string }) {
  const [copied, setCopied] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const secure = window.isSecureContext;
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setShowLink(true);
    }
  }
  return (
    <main className="compatibility-page" style={brandingStyle(defaultBranding)}>
      <section className="compatibility-card" aria-label="Selaimen yhteensopivuus">
        <p className="welcome-title">Piikki</p>
        <h1 className="compatibility-title">
          {secure ? "Avaa Piikki toisessa selaimessa" : "Avaa Piikki suojatulla yhteydellä"}
        </h1>
        <p className="dialog-text">
          {secure
            ? "Piikki tallentaa muutokset suoraan tiedostoon. Tämä selain ei osaa sitä. Chrome ja Edge tietokoneella osaavat."
            : "Tiedostojen avaaminen ja tallentaminen vaatii HTTPS-yhteyden."}
        </p>
        <div className="button-row">
          {secure ? (
            <button type="button" className="btn btn-primary" onClick={() => void copyLink()}>
              {copied ? "Linkki kopioitu" : "Kopioi linkki"}
            </button>
          ) : (
            <a className="btn btn-primary" href={window.location.href.replace(/^http:/, "https:")}>
              Avaa suojattu sivu
            </a>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => window.location.reload()}>
            Tarkista uudelleen
          </button>
        </div>
        {showLink && (
          <input
            aria-label="Sovelluksen linkki"
            className="input"
            readOnly
            value={window.location.href}
            onFocus={(e) => e.target.select()}
          />
        )}
        <details className="details">
          <summary>Tekninen syy</summary>
          <p>{problem}</p>
        </details>
      </section>
    </main>
  );
}
