import { useState, type ReactNode } from "react";
import { Tabs } from "@chakra-ui/react";
import type { Branding, Product, Snapshot } from "../ledger";
import { BrandingForm } from "../features/branding/BrandingForm";
import { ProductEditor } from "../features/products/ProductEditor";
import { RemovedCustomers } from "../features/cashier/RemovedCustomers";

export function Settings({
  snapshot,
  busy,
  files,
  saveBranding,
  saveProduct,
  removeProduct,
  restoreCustomer,
}: {
  snapshot: Snapshot;
  busy: boolean;
  files: ReactNode;
  saveBranding(branding: Branding): Promise<void>;
  saveProduct(product: Product): Promise<void>;
  removeProduct(id: string): Promise<void>;
  restoreCustomer(id: string): Promise<void>;
}) {
  const [error, setError] = useState("");
  return (
    <Tabs.Root defaultValue="branding" variant="line" className="settings-tabs">
      <Tabs.List>
        <Tabs.Trigger value="branding">Ulkoasu</Tabs.Trigger>
        <Tabs.Trigger value="charges">Nimikkeet</Tabs.Trigger>
        <Tabs.Trigger value="removed">Poistetut</Tabs.Trigger>
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
        <ProductEditor
          products={snapshot.products}
          busy={busy}
          save={saveProduct}
          remove={removeProduct}
          setError={setError}
        />
      </Tabs.Content>
      <Tabs.Content value="removed">
        <RemovedCustomers
          customers={snapshot.removedCustomers}
          busy={busy}
          restore={restoreCustomer}
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
