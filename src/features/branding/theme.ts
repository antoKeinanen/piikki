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

/** The lightest mix of background toward foreground that reaches `minimum` on every given surface. */
function contrastingTone(background: string, foreground: string, minimum: number, surfaces = [background]) {
  for (let percent = 0; percent <= 100; percent++) {
    const candidate = mix(background, foreground, percent / 100);
    if (surfaces.every((surface) => contrastRatio(candidate, surface) >= minimum)) return candidate;
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
  // A soft fill: a hint of the text colour, or for mid-tone backgrounds where
  // that would cost text contrast, a hint of the opposite end instead.
  const toward = mix(branding.secondary, ink, 0.035);
  const surface =
    contrastRatio(ink, toward) >= 5
      ? toward
      : mix(branding.secondary, ink === "#ffffff" ? "#000000" : "#ffffff", 0.06);
  return {
    "--brand": branding.primary,
    "--accent": branding.secondary,
    "--on-brand": readableText(branding.primary),
    "--on-accent": ink,
    "--ink": ink,
    // Muted text also sits on the soft --surface fills, so it is measured there.
    "--muted": contrastingTone(branding.secondary, ink, 4.5, [branding.secondary, surface]),
    "--line": contrastingTone(branding.secondary, ink, 3),
    "--hairline": mix(branding.secondary, ink, 0.14),
    "--surface": surface,
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
