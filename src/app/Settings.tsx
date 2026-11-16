import type { ReactNode } from "react";
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
  return (
    <main className="page">
      <h1 className="page-title">Asetukset</h1>
      <Tabs.Root defaultValue="products" className="settings-tabs" lazyMount>
        <Tabs.List>
          <Tabs.Trigger value="products">Nimikkeet</Tabs.Trigger>
          <Tabs.Trigger value="branding">Ulkoasu</Tabs.Trigger>
          <Tabs.Trigger value="removed">Poistetut henkilöt</Tabs.Trigger>
          <Tabs.Trigger value="files">Tiedosto</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="products">
          <ProductEditor
            products={snapshot.products}
            busy={busy}
            save={saveProduct}
            remove={removeProduct}
          />
        </Tabs.Content>
        <Tabs.Content value="branding">
          <div className="narrow">
            <BrandingForm
              initial={snapshot.branding}
              busy={busy}
              save={saveBranding}
            />
          </div>
        </Tabs.Content>
        <Tabs.Content value="removed">
          <div className="narrow">
            <RemovedCustomers
              customers={snapshot.removedCustomers}
              busy={busy}
              restore={restoreCustomer}
            />
          </div>
        </Tabs.Content>
        <Tabs.Content value="files">
          <div className="narrow">{files}</div>
        </Tabs.Content>
      </Tabs.Root>
    </main>
  );
}
