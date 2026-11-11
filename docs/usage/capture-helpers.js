// Import this module in a preview tab served by Vite, then call guide.stage(name).
// Capture at 1280×900. After 14, call cleanup(), then compatibility(), resize to
// 390×844, and capture stage 15. Screenshots retain numbered DOM overlays.
import { Ledger } from "/src/ledger/index.ts";
import { createExample } from "/src/test-support/example-ledger.ts";

const button = (text, root = document) => [...root.querySelectorAll("button")]
  .find((node) => node.textContent.trim() === text);
const dialog = () => document.querySelector('[role="dialog"][data-state="open"]');
const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
async function waitFor(check) {
  for (let i = 0; i < 100; i++) {
    if (check()) { await tick(); return; }
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw Error("Capture state did not settle");
}
async function click(text, root) {
  const target = button(text, root);
  if (!target || target.disabled) throw Error("Unavailable button: " + text);
  target.click();
  await tick();
}
async function fill(selector, value) {
  const input = document.querySelector(selector);
  if (!input) throw Error("Missing input: " + selector);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await tick();
}
let lastTargets;
function annotate(targets) {
  lastTargets = targets;
  document.querySelector("#guide-annotations")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "guide-annotations";
  overlay.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
  targets.forEach((target, index) => {
    const nodes = typeof target === "string" ? [...document.querySelectorAll(target)] : target;
    if (!nodes.length) throw Error("Missing annotation target: " + target);
    const rects = nodes.map((node) => node.getBoundingClientRect());
    const left = Math.max(14, Math.min(...rects.map((r) => r.left)) - 3);
    const top = Math.max(14, Math.min(...rects.map((r) => r.top)) - 3);
    const right = Math.max(...rects.map((r) => r.right)) + 3;
    const bottom = Math.max(...rects.map((r) => r.bottom)) + 3;
    const box = document.createElement("div");
    box.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${right-left}px;height:${bottom-top}px;border:2px solid #c53e20;border-radius:4px`;
    const badge = document.createElement("span");
    badge.textContent = String(index + 1);
    badge.style.cssText = "position:absolute;left:-13px;top:-13px;display:grid;place-items:center;width:26px;height:26px;border:2px solid white;border-radius:50%;background:#c53e20;color:white;font:700 15px system-ui;box-shadow:0 1px 4px #0004";
    box.append(badge);
    overlay.append(box);
  });
  document.body.append(overlay);
}
let directory;
let file;
async function seed() {
  directory = await navigator.storage.getDirectory();
  file = await directory.getFileHandle("piikki-guide-sample.sqlite", { create: true });
  const ledger = await createExample();
  await ledger.saveBranding({ organization: "Esimerkkiosakunta", primary: "#246c61", secondary: "#f7f4ec" });
  const stream = await file.createWritable();
  await stream.write(new Uint8Array(ledger.export()));
  await stream.close();
  file.requestPermission = async () => "granted";
  window.showOpenFilePicker = async () => [file];
  window.showSaveFilePicker = async () => file;
}
async function balance(value) {
  await waitFor(() => document.querySelector(".balance")?.textContent === value);
  await waitFor(() => !document.querySelector(".search-row button:disabled"));
}
const stages = {
  async "01"() {
    annotate([[button("Avaa tietokanta")], [button("Luo tietokanta")]]);
  },
  async "01b"() {
    await click("Luo tietokanta");
    await waitFor(dialog);
    await guide.onboarding();
  },
  async "02"() {
    await click("Peruuta", dialog());
    await waitFor(() => !dialog());
    await seed();
    await click("Avaa tietokanta");
    await balance("42,50");
    annotate([".search-row", '.customer-row[data-selected="true"]', ".account-summary", ".quick-charges", ".amount-form", ".history"]);
  },
  async "03"() {
    await fill('[aria-label="Hae henkilöä"]', "Elias");
    await click("Elias Nieminen");
    await balance("18,00");
    annotate(['[aria-label="Hae henkilöä"]', '.customer-row[data-selected="true"]', ".account-summary"]);
  },
  async "04"() {
    await fill('[aria-label="Hae henkilöä"]', "");
    await click("Aino Korhonen");
    await balance("42,50");
    await click("Lisää henkilö");
    await waitFor(dialog);
    await fill('[role="dialog"] input', "Mila Example");
    annotate(['[role="dialog"] input', [button("Lisää henkilö", dialog())]]);
  },
  async "05"() {
    await click("Lisää henkilö", dialog());
    await waitFor(() => !dialog());
    await click("8,50");
    await balance("34,00");
    annotate([[button("8,50")], ".account-summary", ".entry:first-child"]);
  },
  async "06"() {
    await fill('[aria-label="Summa"]', "2.25");
    annotate(['[aria-label="Summa"]', [button("Veloita 2,25")]]);
  },
  async "07"() {
    await click("Veloita 2,25");
    await balance("31,75");
    await click("Lisää saldoa");
    await fill('[aria-label="Summa"]', "10.00");
    annotate([[button("Lisää saldoa")], '[aria-label="Summa"]', [button("Lisää saldoa 10,00")]]);
  },
  async "08"() {
    await click("Lisää saldoa 10,00");
    await balance("41,75");
    const charge = [...document.querySelectorAll(".entry")].find((node) => node.querySelector(".entry-amount")?.textContent === "−2,25");
    await click("Peru", charge);
    await waitFor(dialog);
    annotate([[...dialog().querySelectorAll(".reversal-name, .reversal-name + p")], [button("Peru tapahtuma", dialog())]]);
  },
  async "09"() {
    await click("Peru tapahtuma", dialog());
    await balance("44,00");
    await waitFor(() => !dialog());
    annotate([".account-summary", ".entry:first-child", ".entry.reversed"]);
  },
  async "10"() {
    await click("Asetukset");
    await waitFor(dialog);
    await fill('[aria-label="Pääväri"]', "#185c53");
    annotate(['[aria-label="Pääväri"]', '[aria-label="Taustaväri"]', [button("Tallenna", dialog())]]);
  },
  async "11"() {
    await click("Tallenna", dialog());
    await waitFor(() => button("Tallenna", dialog())?.disabled);
    await click("Pikaveloitukset", dialog());
    await fill('[aria-label="Pikaveloituksen summa"]', "4.25");
    annotate([".preset-list", '[aria-label="Pikaveloituksen summa"]', [button("Lisää summa", dialog())]]);
  },
  async "12"() {
    await click("Lisää summa", dialog());
    await waitFor(() => [...document.querySelectorAll(".preset-row")].some((node) => node.textContent.includes("4,25")));
    const row = [...document.querySelectorAll(".preset-row")].find((node) => node.textContent.includes("4,25"));
    await click("Poista", row);
    await waitFor(() => button("Palauta 4,25", dialog()));
    const first = document.querySelector(".preset-row");
    annotate([[button("Muokkaa", first)], [button("Poista", first)], [button("Palauta 4,25", dialog())]]);
  },
  async "13"() {
    await click("Palauta 4,25", dialog());
    await waitFor(() => !button("Palauta 4,25", dialog()));
    await click("Tietokanta", dialog());
    annotate([".file-saving-help", [button("Avaa tietokanta", dialog())], [button("Lataa varmuuskopio", dialog())]]);
    await click("Lataa varmuuskopio", dialog());
  },
  async "14"() {
    await click("Valmis", dialog());
    await waitFor(() => !dialog());
    await click("Veloita");
    await fill('[aria-label="Summa"]', "999.00");
    await click("Veloita 999,00");
    await waitFor(() => document.querySelector(".account .error"));
    annotate([".account-summary", ".amount-form", ".account .error"]);
    const saved = await Ledger.open(new Uint8Array(await (await file.getFile()).arrayBuffer()));
    const snapshot = saved.snapshot();
    if (snapshot.customers.find((c) => c.name === "Aino Korhonen")?.balance !== 4400 ||
        snapshot.customers.find((c) => c.name === "Mila Example")?.balance !== 0 ||
        !snapshot.presets.some((p) => p.cents === 425) ||
        snapshot.branding.primary !== "#185c53") throw Error("Saved guide data did not match");
  },
  async "15"() {
    annotate([".compatibility-title", ".compatibility-explanation", ".compatibility-actions", ".compatibility-details"]);
  },
};
export const guide = {
  async stage(name) {
    document.querySelector("#guide-annotations")?.remove();
    await stages[name]();
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => {})));
    document.activeElement?.blur();
    annotate(lastTargets);
    await tick();
    return { stage: name, viewport: [innerWidth, innerHeight], annotations: document.querySelectorAll("#guide-annotations > div").length };
  },
  async onboarding() {
    await fill('[role="dialog"] input:not([type="file"]):not([type="color"])', "Esimerkkiosakunta");
    await fill('[aria-label="Pääväri"]', "#246c61");
    await fill('[aria-label="Taustaväri"]', "#f7f4ec");
    annotate(['[role="dialog"] input:not([type="file"]):not([type="color"])', '[type="file"]:not([hidden])', '[aria-label="Pääväri"]', '[aria-label="Taustaväri"]', [button("Luo tietokanta", dialog())]]);
  },
  async compatibility() {
    // Reuse Vite's existing module URLs so React and Chakra share one instance.
    const urls = performance.getEntriesByType("resource").map((entry) => entry.name);
    const loaded = (part) => {
      const url = urls.find((value) => value.split("?")[0].endsWith(part.replace(/\?$/, "")));
      if (!url) throw Error("Module not loaded: " + part);
      return url;
    };
    const React = (await import(loaded("/react.js?"))).default;
    const dom = (await import(loaded("/react-dom_client.js?"))).default;
    const { ChakraProvider, defaultSystem } = await import(loaded("/@chakra-ui_react.js?"));
    const { CompatibilityBlock } = await import(loaded("/src/features/database/CompatibilityBlock.tsx?"));
    document.querySelector("#root")?.remove();
    const root = document.createElement("div");
    document.body.append(root);
    dom.createRoot(root).render(React.createElement(
      ChakraProvider, { value: defaultSystem },
      React.createElement(CompatibilityBlock, { problem: "This browser cannot open and save local files." }),
    ));
    await waitFor(() => document.querySelector(".compatibility-title"));
  },
  async cleanup() {
    if (directory) await directory.removeEntry("piikki-guide-sample.sqlite");
  },
};
