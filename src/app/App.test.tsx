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
import { Ledger } from "../ledger";
import { createExample } from "../test-support/example-ledger";
import * as fileAccess from "../persistence/database-file";

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
async function continueEvent() {
  fireEvent.click(await screen.findByRole("button", { name: /^Jatka tapahtumaa / }));
  await waitFor(() => expect(document.querySelector('[role="dialog"][data-state="open"]')).toBeNull());
}
it("charges immediately, hides IDs and filenames, and opens branding settings", async () => {
  const ledger = await createExample();
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  vi.spyOn(fileAccess, "supportsDirectFiles").mockReturnValue(true);
  vi.spyOn(fileAccess, "pickDatabase").mockResolvedValue({
    ledger,
    name: "example.sqlite",
  });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Avaa tietokanta" }));
  await continueEvent();
  const balance = await screen.findByLabelText("Saldo");
  expect(balance.textContent).toBe("42,50");
  expect(screen.queryByText("1001")).toBeNull();
  expect(screen.queryByText("example.sqlite")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Veloita 8,50" }));
  await waitFor(() => expect(balance.textContent).toBe("34,00"));
  expect(document.querySelector('[role="dialog"][data-state="open"]')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Lisää saldoa" }));
  fireEvent.change(screen.getByLabelText("Summa"), {
    target: { value: "10.00" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lisää saldoa 10,00" }));
  await waitFor(() => expect(balance.textContent).toBe("44,00"));
  expect(document.querySelector('[role="dialog"][data-state="open"]')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Asetukset" }));
  expect(await screen.findByRole("dialog", { name: "Asetukset" })).toBeTruthy();
  expect(screen.getByLabelText("Pääväri")).toBeTruthy();
  expect(screen.getByLabelText("Taustaväri")).toBeTruthy();
  const logo =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
  fireEvent.change(screen.getByLabelText("Logo"), {
    target: {
      files: [
        new File(
          [Uint8Array.from(atob(logo.split(",")[1]), (c) => c.charCodeAt(0))],
          "logo.png",
          { type: "image/png" },
        ),
      ],
    },
  });
  await screen.findByAltText("Logon esikatselu");
  fireEvent.change(screen.getByLabelText("Osakunta"), {
    target: { value: "Testiosakunta" },
  });
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
  const preset = ledger.snapshot().presets.find((value) => value.cents === 425);
  if (!preset) throw new Error("Preset was not saved");
  const row = screen.getByText("4,25").closest(".preset-row");
  if (!(row instanceof HTMLElement)) throw new Error("Preset row missing");
  fireEvent.click(within(row).getByRole("button", { name: "Poista" }));
  const restore = await screen.findByRole("button", { name: "Palauta 4,25" });
  expect(
    ledger.snapshot().presets.some((value) => value.id === preset.id),
  ).toBe(false);
  fireEvent.click(restore);
  await waitFor(() =>
    expect(
      ledger.snapshot().presets.find((value) => value.id === preset.id),
    ).toEqual(preset),
  );
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Palauta 4,25" })).toBeNull(),
  );

  fireEvent.click(screen.getByRole("button", { name: "Valmis" }));
  await waitFor(() =>
    expect(
      document.querySelector('[role="dialog"][data-state="open"]'),
    ).toBeNull(),
  );
  expect(screen.getByRole("banner", { name: "Testiosakunta" })).toBeTruthy();
  expect(screen.getByAltText("Testiosakunta logo").getAttribute("src")).toBe(
    logo,
  );
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

it("offers a copyable link when the browser cannot open files", async () => {
  vi.stubGlobal("isSecureContext", true);
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  try {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Kopioi linkki" }));
    await screen.findByRole("button", { name: "Linkki kopioitu" });
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(
      screen.queryByRole("button", { name: "Avaa tietokanta" }),
    ).toBeNull();
  } finally {
    vi.unstubAllGlobals();
  }
});

it("collects organization branding before creating and saving the database", async () => {
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  const save = vi
    .spyOn(fileAccess, "saveDatabase")
    .mockImplementation(async (ledger, name) => ({
      ledger: await Ledger.open(ledger.export()),
      name,
    }));
  mount();
  expect(screen.queryByText("KyO")).toBeNull();
  expect(screen.getByRole("banner", { name: "Piikki" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Luo tietokanta" }));
  const dialog = await screen.findByRole("dialog", {
    name: "Organisaation tiedot",
  });
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
    target: {
      files: [new File(["logo"], "logo.svg", { type: "image/svg+xml" })],
    },
  });
  await screen.findByAltText("Logon esikatselu");
  fireEvent.click(create);
  await screen.findByRole("dialog", { name: "Valitse tapahtuma" });
  expect(save).not.toHaveBeenCalled();
  const createEvent = screen.getByRole("button", { name: "Luo uusi tapahtuma" });
  expect(createEvent.hasAttribute("disabled")).toBe(true);
  fireEvent.change(screen.getByLabelText("Tapahtuman nimi"), { target: { value: "Avajaiset" } });
  fireEvent.click(createEvent);
  await screen.findByRole("banner", { name: "Uusi organisaatio" });
  expect(save).toHaveBeenCalledTimes(1);
  const saved = await Ledger.open(save.mock.calls[0][0].export());
  expect(saved.snapshot().event.name).toBe("Avajaiset");
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
  await waitFor(() =>
    expect(
      document.querySelector('[role="dialog"][data-state="open"]'),
    ).toBeNull(),
  );
  expect(save).not.toHaveBeenCalled();
});

it("replaces the session snapshot and clears the cashier draft when opening another database", async () => {
  const first = await createExample();
  const second = await Ledger.open();
  await second.addCustomer("Second customer", "");
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  vi.spyOn(fileAccess, "supportsDirectFiles").mockReturnValue(true);
  vi.spyOn(fileAccess, "pickDatabase")
    .mockResolvedValueOnce({ ledger: first, name: "first.sqlite" })
    .mockResolvedValueOnce({ ledger: second, name: "second.sqlite" });
  mount();
  fireEvent.click(
    await screen.findByRole("button", { name: "Avaa tietokanta" }),
  );
  await continueEvent();
  await screen.findByLabelText("Saldo");
  fireEvent.click(screen.getByRole("button", { name: "Lisää saldoa" }));
  fireEvent.change(screen.getByLabelText("Summa"), { target: { value: "12" } });
  fireEvent.click(screen.getByRole("button", { name: "Asetukset" }));
  fireEvent.click(await screen.findByRole("tab", { name: "Tietokanta" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Avaa tietokanta" }),
  );
  await continueEvent();
  await screen.findByRole("button", { name: "Second customer" });
  await waitFor(() =>
    expect(screen.getByLabelText("Saldo").textContent).toBe("0,00"),
  );
  expect(screen.queryByRole("button", { name: "Aino Korhonen" })).toBeNull();
  expect(screen.getByLabelText("Summa").getAttribute("value")).toBe("");
  expect(
    screen
      .getByRole("button", { name: "Veloita", pressed: true })
      .getAttribute("aria-pressed"),
  ).toBe("true");
});

it("keeps the amount and balance after a failed save, then allows retry", async () => {
  let fail = true;
  const example = await createExample();
  const ledger = await Ledger.open(example.export(), async () => {
    if (fail) throw new Error("Disk write failed");
  });
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  vi.spyOn(fileAccess, "supportsDirectFiles").mockReturnValue(true);
  vi.spyOn(fileAccess, "pickDatabase").mockResolvedValue({
    ledger,
    name: "test.sqlite",
  });
  mount();
  fireEvent.click(
    await screen.findByRole("button", { name: "Avaa tietokanta" }),
  );
  await continueEvent();
  await screen.findByLabelText("Saldo");
  fireEvent.change(screen.getByLabelText("Summa"), {
    target: { value: "1.23" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Veloita 1,23" }));
  await screen.findByText("Disk write failed");
  expect(screen.getByLabelText("Saldo").textContent).toBe("42,50");
  expect(screen.getByLabelText("Summa").getAttribute("value")).toBe("1.23");
  fail = false;
  fireEvent.click(screen.getByRole("button", { name: "Veloita 1,23" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Saldo").textContent).toBe("41,27"),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Summa").getAttribute("value")).toBe(""),
  );
});

it("preserves the active database when opening a replacement is cancelled", async () => {
  const ledger = await createExample();
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  vi.spyOn(fileAccess, "supportsDirectFiles").mockReturnValue(true);
  vi.spyOn(fileAccess, "pickDatabase")
    .mockResolvedValueOnce({ ledger, name: "test.sqlite" })
    .mockRejectedValueOnce(new DOMException("Cancelled", "AbortError"));
  mount();
  fireEvent.click(
    await screen.findByRole("button", { name: "Avaa tietokanta" }),
  );
  await continueEvent();
  await screen.findByLabelText("Saldo");
  fireEvent.click(screen.getByRole("button", { name: "Asetukset" }));
  fireEvent.click(await screen.findByRole("tab", { name: "Tietokanta" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Avaa tietokanta" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Valmis" }).hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Valmis" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Saldo").textContent).toBe("42,50"),
  );
  expect(ledger.snapshot().customers[0].balance).toBe(4250);
});

it("shows the previous event name and creates a named event with fresh balances", async () => {
  const ledger = await createExample();
  const previous = ledger.snapshot();
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  vi.spyOn(fileAccess, "supportsDirectFiles").mockReturnValue(true);
  vi.spyOn(fileAccess, "pickDatabase").mockResolvedValue({ ledger, name: "test.sqlite" });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Avaa tietokanta" }));
  const dialog = await screen.findByRole("dialog", { name: "Valitse tapahtuma" });
  expect(within(dialog).getByText(`Edellinen tapahtuma: ${previous.event.name}`)).toBeTruthy();
  expect(screen.queryByLabelText("Saldo")).toBeNull();
  const create = within(dialog).getByRole("button", { name: "Luo uusi tapahtuma" });
  fireEvent.change(screen.getByLabelText("Tapahtuman nimi"), { target: { value: "   " } });
  expect(create.hasAttribute("disabled")).toBe(true);
  fireEvent.change(screen.getByLabelText("Tapahtuman nimi"), { target: { value: "  Talvijuhla  " } });
  fireEvent.click(create);
  await waitFor(() => expect(screen.getByLabelText("Saldo").textContent).toBe("0,00"));
  expect(screen.getByText("Talvijuhla")).toBeTruthy();
  expect(ledger.snapshot(previous.event.id)).toEqual(previous);
  expect((await Ledger.open(ledger.export())).latestEvent().name).toBe("Talvijuhla");
});

it("keeps the choice and previous event after a failed event save and allows retry", async () => {
  const original = await createExample();
  let fail = true;
  const ledger = await Ledger.open(original.export(), async () => {
    if (fail) throw new Error("Event save failed");
  });
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  vi.spyOn(fileAccess, "supportsDirectFiles").mockReturnValue(true);
  vi.spyOn(fileAccess, "pickDatabase").mockResolvedValue({ ledger, name: "test.sqlite" });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Avaa tietokanta" }));
  await screen.findByRole("dialog", { name: "Valitse tapahtuma" });
  fireEvent.change(screen.getByLabelText("Tapahtuman nimi"), { target: { value: "Talvijuhla" } });
  fireEvent.click(screen.getByRole("button", { name: "Luo uusi tapahtuma" }));
  await screen.findByText("Event save failed");
  expect(ledger.snapshot()).toEqual(original.snapshot());
  expect(screen.getByLabelText("Tapahtuman nimi").getAttribute("value")).toBe("Talvijuhla");
  fail = false;
  fireEvent.click(screen.getByRole("button", { name: "Luo uusi tapahtuma" }));
  await waitFor(() => expect(screen.getByLabelText("Saldo").textContent).toBe("0,00"));
});

it("cancels the event choice without activating or changing the selected file", async () => {
  const ledger = await createExample();
  const before = ledger.export();
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  vi.spyOn(fileAccess, "supportsDirectFiles").mockReturnValue(true);
  vi.spyOn(fileAccess, "pickDatabase").mockResolvedValue({ ledger, name: "test.sqlite" });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Avaa tietokanta" }));
  await screen.findByRole("dialog", { name: "Valitse tapahtuma" });
  fireEvent.click(screen.getByRole("button", { name: "Peruuta" }));
  await waitFor(() => expect(document.querySelector('[role="dialog"][data-state="open"]')).toBeNull());
  expect(screen.queryByLabelText("Saldo")).toBeNull();
  expect(ledger.export()).toEqual(before);
});

it("keeps the current cashier session when the replacement event choice is cancelled", async () => {
  const first = await createExample();
  const second = await Ledger.create({ name: "Toinen juhla" });
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  vi.spyOn(fileAccess, "supportsDirectFiles").mockReturnValue(true);
  vi.spyOn(fileAccess, "pickDatabase")
    .mockResolvedValueOnce({ ledger: first, name: "first.sqlite" })
    .mockResolvedValueOnce({ ledger: second, name: "second.sqlite" });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Avaa tietokanta" }));
  await continueEvent();
  await screen.findByLabelText("Saldo");
  fireEvent.click(screen.getByRole("button", { name: "Asetukset" }));
  fireEvent.click(await screen.findByRole("tab", { name: "Tietokanta" }));
  fireEvent.click(await screen.findByRole("button", { name: "Avaa tietokanta" }));
  await screen.findByRole("button", { name: "Jatka tapahtumaa Toinen juhla" });
  fireEvent.click(screen.getByRole("button", { name: "Peruuta" }));
  await waitFor(() => expect(document.querySelector('[role="dialog"][data-state="open"]')).toBeNull());
  expect(screen.getByLabelText("Saldo").textContent).toBe("42,50");
  expect(screen.getByRole("button", { name: "Aino Korhonen" })).toBeTruthy();
  expect(first.snapshot().customers[0].balance).toBe(4250);
});

it("asks for the event after a dropped database has been connected to a saved copy", async () => {
  const ledger = await createExample();
  const bytes = ledger.export();
  const file = new File([new Uint8Array(bytes)], "dropped.sqlite");
  Object.defineProperty(file, "arrayBuffer", { value: async () => new Uint8Array(bytes).buffer });
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  const save = vi.spyOn(fileAccess, "saveDatabase").mockImplementation(async (imported, name) => ({ ledger: imported, name }));
  const mounted = mount();
  const app = mounted.container.querySelector(".app");
  if (!app) throw new Error("App missing");
  fireEvent.drop(app, { dataTransfer: { files: [file] } });
  await screen.findByRole("dialog", { name: "Valitse tapahtuma" });
  expect(save).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[0][1]).toBe("dropped.sqlite");
  expect(screen.queryByLabelText("Saldo")).toBeNull();
  await continueEvent();
  await waitFor(() => expect(screen.getByLabelText("Saldo").textContent).toBe("42,50"));
});
