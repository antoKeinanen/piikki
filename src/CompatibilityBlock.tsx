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
    <main className="compatibility-page">
      <section
        className="compatibility-content"
        aria-label="Browser compatibility"
      >
        <div className="compatibility-rule" aria-hidden="true" />
        <Text className="compatibility-title">
          {secure
            ? "A different browser is needed."
            : "A secure connection is needed."}
        </Text>
        <Text className="compatibility-explanation">
          {secure
            ? "Each change saves directly to your SQLite file. This browser does not support the file access it needs."
            : "HTTPS is needed to open and save your SQLite file."}
        </Text>
        <Text className="compatibility-next">
          {secure
            ? "Copy the link and open it in another browser, or on your cashier device."
            : "Open this page over HTTPS, or use localhost when running it on your device."}
        </Text>
        <div className="compatibility-actions">
          {secure ? (
            <Button className="primary" onClick={() => void copyLink()}>
              {copied ? "Link copied" : "Copy link"}
            </Button>
          ) : (
            <Button className="primary" asChild>
              <a href={window.location.href.replace(/^http:/, "https:")}>
                Open secure page
              </a>
            </Button>
          )}
          <Button variant="ghost" onClick={() => window.location.reload()}>
            Check again
          </Button>
        </div>
        {showLink && (
          <Input
            aria-label="App link"
            className="compatibility-link"
            readOnly
            value={window.location.href}
            onFocus={(e) => e.target.select()}
          />
        )}
        <details className="compatibility-details">
          <summary>Why is access blocked?</summary>
          <Text>
            {problem} The app stays closed so changes cannot be left unsaved.
          </Text>
        </details>
      </section>
    </main>
  );
}
