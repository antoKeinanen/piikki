// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { Ledger, createExample } from "./ledger";
import * as fileAccess from "./database-file";

vi.mock("sql.js/dist/sql-wasm.wasm?url", () => ({
  default: `${process.cwd()}/node_modules/sql.js/dist/sql-wasm.wasm`,
}));
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
function mount() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <App />
      </QueryClientProvider>
    </ChakraProvider>,
  );
}
it("charges immediately, hides IDs and filenames, and opens branding settings", async () => {
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  vi.spyOn(fileAccess, "supportsDirectFiles").mockReturnValue(true);
  vi.spyOn(fileAccess, "pickDatabase").mockResolvedValue({
    ledger: await createExample(),
    name: "example.sqlite",
  });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Avaa tietokanta" }));
  const balance = await screen.findByLabelText("Saldo");
  expect(balance.textContent).toBe("42,50");
  expect(screen.queryByText("1001")).toBeNull();
  expect(screen.queryByText("example.sqlite")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Veloita 8,50" }));
  await waitFor(() => expect(balance.textContent).toBe("34,00"));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Lisää saldoa" }));
  fireEvent.change(screen.getByLabelText("Summa"), {
    target: { value: "10.00" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lisää saldoa 10,00" }));
  await waitFor(() => expect(balance.textContent).toBe("44,00"));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Asetukset" }));
  expect(await screen.findByRole("dialog", { name: "Asetukset" })).toBeTruthy();
  expect(screen.getByLabelText("Pääväri")).toBeTruthy();
  expect(screen.getByLabelText("Taustaväri")).toBeTruthy();
  const logo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
  fireEvent.change(screen.getByLabelText("Logo"), {
    target: { files: [new File([Uint8Array.from(atob(logo.split(",")[1]), (c) => c.charCodeAt(0))], "logo.png", { type: "image/png" })] },
  });
  await screen.findByAltText("Logon esikatselu");
  fireEvent.change(screen.getByLabelText("Osakunta"), { target: { value: "Testiosakunta" } });
  fireEvent.change(screen.getByLabelText("Pääväri"), {
    target: { value: "#102030" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tallenna" }));
  await waitFor(() =>
    expect(document.querySelector(".app")?.getAttribute("style")).toContain(
      "#102030",
    ),
  );
  fireEvent.click(screen.getByRole("tab", { name: "Pikaveloitukset" }));
  expect(await screen.findByLabelText("Pikaveloituksen summa")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Pikaveloituksen summa"), {
    target: { value: "4.25" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lisää summa" }));
  await screen.findByText("4,25");
  fireEvent.click(screen.getByRole("button", { name: "Valmis" }));
  await waitFor(() =>
    expect(
      document.querySelector('[role="dialog"][data-state="open"]'),
    ).toBeNull(),
  );
  expect(screen.getByRole("banner", { name: "Testiosakunta" })).toBeTruthy();
  expect(screen.getByAltText("Testiosakunta logo").getAttribute("src")).toBe(logo);
  fireEvent.click(screen.getByRole("button", { name: "Veloita" }));
  expect(
    await screen.findByRole("button", { name: "Veloita 4,25" }),
  ).toBeTruthy();
});

it("blocks the app when required file access is missing, regardless of browser name", () => {
  mount();
  expect(
    screen.getByRole("region", { name: "Selaimen yhteensopivuus" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Avaa tietokanta" })).toBeNull();
  expect(screen.queryByLabelText("Hae henkilöä")).toBeNull();
  expect(localStorage.length).toBe(0);
});

it('offers a copyable link when the browser cannot open files', async () => {
  vi.stubGlobal('isSecureContext', true);
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText}});
  try {
    mount();
    fireEvent.click(screen.getByRole('button', {name:'Kopioi linkki'}));
    await screen.findByRole('button', {name:'Linkki kopioitu'});
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(screen.queryByRole('button', {name:'Avaa tietokanta'})).toBeNull();
  } finally { vi.unstubAllGlobals(); }
});


it("collects organization branding before creating and saving the database", async () => {
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  const save = vi.spyOn(fileAccess, "saveDatabase").mockImplementation(async (ledger, name) => ({
    ledger: await Ledger.open(ledger.export()),
    name,
  }));
  mount();
  expect(screen.queryByText("KyO")).toBeNull();
  expect(screen.getByRole("banner", { name: "Piikki" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Luo tietokanta" }));
  const dialog = await screen.findByRole("dialog", { name: "Organisaation tiedot" });
  expect(save).not.toHaveBeenCalled();
  const create = within(dialog).getByRole("button", { name: "Luo tietokanta" });
  expect(create.hasAttribute("disabled")).toBe(true);
  fireEvent.change(within(dialog).getByLabelText("Osakunta"), {
    target: { value: "Uusi organisaatio" },
  });
  fireEvent.change(within(dialog).getByLabelText("Pääväri"), {
    target: { value: "#123456" },
  });
  fireEvent.change(within(dialog).getByLabelText("Taustaväri"), {
    target: { value: "#abcdef" },
  });
  fireEvent.change(within(dialog).getByLabelText("Logo"), {
    target: { files: [new File(["logo"], "logo.svg", { type: "image/svg+xml" })] },
  });
  await screen.findByAltText("Logon esikatselu");
  fireEvent.click(create);
  await screen.findByRole("banner", { name: "Uusi organisaatio" });
  expect(save).toHaveBeenCalledTimes(1);
  const saved = await Ledger.open(save.mock.calls[0][0].export());
  expect(saved.snapshot().branding).toEqual({
    organization: "Uusi organisaatio",
    primary: "#123456",
    secondary: "#abcdef",
    logo: "data:image/svg+xml;base64,bG9nbw==",
  });
});

it("cancels onboarding without creating a database", async () => {
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  const save = vi.spyOn(fileAccess, "saveDatabase");
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Luo tietokanta" }));
  await screen.findByRole("dialog", { name: "Organisaation tiedot" });
  fireEvent.click(screen.getByRole("button", { name: "Peruuta" }));
  await waitFor(() => expect(document.querySelector('[role="dialog"][data-state="open"]')).toBeNull());
  expect(save).not.toHaveBeenCalled();
});
