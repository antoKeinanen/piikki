import { expect, it } from "vitest";
import { brandingStyle } from "./theme";
import { contrastRatio, readableText } from "./colors";
import { defaultBranding } from "../../ledger";

it("computes accessible text for every sampled RGB background", () => {
  for (let r = 0; r <= 255; r += 17) {
    for (let g = 0; g <= 255; g += 17) {
      for (let b = 0; b <= 255; b += 17) {
        const background = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
        expect(contrastRatio(readableText(background), background)).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});

it("preserves chosen colors and keeps text and controls accessible for light, dark, and identical palettes", () => {
  for (const primary of ["#ffffff", "#000000", "#777777", "#ffdd00", "#b00040", "#182640"]) {
    for (const secondary of ["#ffffff", "#000000", "#777777", "#ffdd00", "#b00040", "#182640"]) {
      const style = brandingStyle({ ...defaultBranding, primary, secondary });
      expect(style["--brand"]).toBe(primary);
      expect(style["--accent"]).toBe(secondary);
      for (const foreground of [style["--ink"], style["--muted"], style["--error"]]) {
        expect(contrastRatio(foreground, secondary)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrastRatio(style["--on-brand"], primary)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(style["--on-hover"], style["--hover"])).toBeGreaterThanOrEqual(4.5);
      for (const indicator of [style["--line"], style["--focus"], style["--indicator"]]) {
        expect(contrastRatio(indicator, secondary)).toBeGreaterThanOrEqual(3);
      }
    }
  }
});
