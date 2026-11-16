import type { CSSProperties } from "react";
import { contrastRatio, readableText } from "./colors";
import type { Branding } from "../../ledger";

function mix(background: string, foreground: string, weight: number) {
  return "#" + [1, 3, 5].map((start) =>
    Math.round(
      parseInt(background.slice(start, start + 2), 16) * (1 - weight) +
      parseInt(foreground.slice(start, start + 2), 16) * weight,
    ).toString(16).padStart(2, "0"),
  ).join("");
}

function contrastingTone(background: string, foreground: string, minimum: number) {
  for (let percent = 0; percent <= 100; percent++) {
    const candidate = mix(background, foreground, percent / 100);
    if (contrastRatio(candidate, background) >= minimum) return candidate;
  }
  return foreground;
}

/** A fixed signal colour as text, or the ink colour when the background makes it unreadable. */
function signal(color: string, background: string, ink: string) {
  return contrastRatio(color, background) >= 4.5 ? color : ink;
}

/** Charges are red and deposits green everywhere, independent of branding. */
export const CHARGE = "#b3261e";
export const DEPOSIT = "#1b6e35";

export function brandingStyle(branding: Branding): CSSProperties & Record<`--${string}`, string> {
  const ink = readableText(branding.secondary);
  const hover = mix(branding.secondary, ink, 0.07);
  return {
    "--brand": branding.primary,
    "--accent": branding.secondary,
    "--on-brand": readableText(branding.primary),
    "--on-accent": ink,
    "--ink": ink,
    "--muted": contrastingTone(branding.secondary, ink, 4.5),
    "--line": contrastingTone(branding.secondary, ink, 3),
    "--hairline": mix(branding.secondary, ink, 0.14),
    "--surface": mix(branding.secondary, ink, 0.035),
    "--focus": ink,
    "--indicator": contrastRatio(branding.primary, branding.secondary) >= 3
      ? branding.primary : ink,
    "--hover": hover,
    "--on-hover": readableText(hover),
    "--error": signal("#a33328", branding.secondary, ink),
    "--charge": signal(CHARGE, branding.secondary, ink),
    "--deposit": signal(DEPOSIT, branding.secondary, ink),
  };
}
