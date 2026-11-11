import { useState, type ReactNode } from "react";
import { Tabs } from "@chakra-ui/react";
import type { Branding, Preset, Snapshot } from "../ledger";
import { BrandingForm } from "../features/branding/BrandingForm";
import { PresetEditor } from "../features/presets/PresetEditor";

export function Settings({
  snapshot,
  busy,
  files,
  saveBranding,
  savePreset,
  removePreset,
}: {
  snapshot: Snapshot;
  busy: boolean;
  files: ReactNode;
  saveBranding(branding: Branding): Promise<void>;
  savePreset(preset: Preset): Promise<void>;
  removePreset(id: string): Promise<void>;
}) {
  const [error, setError] = useState("");
  return (
    <Tabs.Root defaultValue="branding" variant="line" className="settings-tabs">
      <Tabs.List>
        <Tabs.Trigger value="branding">Ulkoasu</Tabs.Trigger>
        <Tabs.Trigger value="charges">Pikaveloitukset</Tabs.Trigger>
        <Tabs.Trigger value="files">Tietokanta</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="branding">
        <BrandingForm
          initial={snapshot.branding}
          busy={busy}
          save={saveBranding}
        />
      </Tabs.Content>
      <Tabs.Content value="charges">
        <PresetEditor
          presets={snapshot.presets}
          busy={busy}
          save={savePreset}
          remove={removePreset}
          setError={setError}
        />
      </Tabs.Content>
      <Tabs.Content value="files">
        <div className="settings-files">{files}</div>
      </Tabs.Content>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </Tabs.Root>
  );
}
