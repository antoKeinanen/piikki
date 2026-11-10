// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
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
  vi.spyOn(fileAccess, "saveDatabase").mockImplementation(async (ledger) => ({
    ledger,
    name: "example.sqlite",
  }));
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Try example" }));
  const balance = await screen.findByLabelText("Available balance");
  expect(balance.textContent).toBe("42.50");
  expect(screen.queryByText("1001")).toBeNull();
  expect(screen.queryByText("example.sqlite")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Charge 8.50" }));
  await waitFor(() => expect(balance.textContent).toBe("34.00"));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Deposit" }));
  fireEvent.change(screen.getByLabelText("Amount"), {
    target: { value: "10.00" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Deposit 10.00" }));
  await waitFor(() => expect(balance.textContent).toBe("44.00"));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  expect(await screen.findByRole("dialog", { name: "Settings" })).toBeTruthy();
  expect(screen.getByLabelText("Primary color")).toBeTruthy();
  expect(screen.getByLabelText("Secondary color")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Primary color"), {
    target: { value: "#102030" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save colors" }));
  await waitFor(() =>
    expect(document.querySelector(".app")?.getAttribute("style")).toContain(
      "#102030",
    ),
  );
  fireEvent.click(screen.getByRole("tab", { name: "Quick charges" }));
  expect(await screen.findByLabelText("Quick charge amount")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Quick charge amount"), {
    target: { value: "4.25" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add amount" }));
  await screen.findByText("4.25");
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  await waitFor(() =>
    expect(
      document.querySelector('[role="dialog"][data-state="open"]'),
    ).toBeNull(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Charge" }));
  expect(
    await screen.findByRole("button", { name: "Charge 4.25" }),
  ).toBeTruthy();
});

it("blocks the app when required file access is missing, regardless of browser name", () => {
  mount();
  expect(
    screen.getByRole("region", { name: "Browser compatibility" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Open database" })).toBeNull();
  expect(screen.queryByLabelText("Find a customer")).toBeNull();
  expect(localStorage.length).toBe(0);
});

it('offers a copyable link when the browser cannot open files', async () => {
  vi.stubGlobal('isSecureContext', true);
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText}});
  try {
    mount();
    fireEvent.click(screen.getByRole('button', {name:'Copy link'}));
    await screen.findByRole('button', {name:'Link copied'});
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(screen.queryByRole('button', {name:'Open database'})).toBeNull();
  } finally { vi.unstubAllGlobals(); }
});
