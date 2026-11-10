import { brandingStyle } from "./branding";
import { defaultBranding } from "./model";
import { useState } from "react";
import { Button, Input, Text } from "@chakra-ui/react";

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
      <header className="masthead" aria-label="Piikki">
        <span className="wordmark">Piikki</span>
      </header>
      <section
        className="compatibility-content"
        aria-label="Selaimen yhteensopivuus"
      >
        <div className="compatibility-rule" aria-hidden="true" />
        <Text className="compatibility-title">
          {secure
            ? "Tarvitset toisen selaimen."
            : "Tarvitset suojatun yhteyden."}
        </Text>
        <Text className="compatibility-explanation">
          {secure
            ? "Muutokset tallentuvat suoraan SQLite-tiedostoosi. Tämä selain ei tue tarvittavaa tiedostojen käsittelyä."
            : "SQLite-tiedoston avaaminen ja tallentaminen vaatii HTTPS-yhteyden."}
        </Text>
        <Text className="compatibility-next">
          {secure
            ? "Kopioi linkki ja avaa se toisessa selaimessa tai kassalaitteella."
            : "Avaa sivu HTTPS-yhteydellä tai käytä omalla laitteellasi localhost-osoitetta."}
        </Text>
        <div className="compatibility-actions">
          {secure ? (
            <Button className="primary" onClick={() => void copyLink()}>
              {copied ? "Linkki kopioitu" : "Kopioi linkki"}
            </Button>
          ) : (
            <Button className="primary" asChild>
              <a href={window.location.href.replace(/^http:/, "https:")}>
                Avaa suojattu sivu
              </a>
            </Button>
          )}
          <Button variant="ghost" onClick={() => window.location.reload()}>
            Tarkista uudelleen
          </Button>
        </div>
        {showLink && (
          <Input
            aria-label="Sovelluksen linkki"
            className="compatibility-link"
            readOnly
            value={window.location.href}
            onFocus={(e) => e.target.select()}
          />
        )}
        <details className="compatibility-details">
          <summary>Miksi käyttö on estetty?</summary>
          <Text>
            {problem} Sovellus pysyy suljettuna, jotta muutokset eivät jää tallentamatta.
          </Text>
        </details>
      </section>
    </main>
  );
}
