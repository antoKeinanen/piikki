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

export function brandingStyle(branding: Branding): CSSProperties & Record<`--${string}`, string> {
  const ink = readableText(branding.secondary);
  const hover = mix(branding.secondary, ink, 0.1);
  const light = ink !== "#ffffff";
  return {
    "--brand": branding.primary,
    "--accent": branding.secondary,
    "--on-brand": readableText(branding.primary),
    "--on-accent": ink,
    "--ink": ink,
    "--muted": contrastingTone(branding.secondary, ink, 4.5),
    "--line": contrastingTone(branding.secondary, ink, 3),
    "--focus": ink,
    "--indicator": contrastRatio(branding.primary, branding.secondary) >= 3
      ? branding.primary : ink,
    "--line-soft": mix(branding.secondary, ink, 0.1),
    "--surface": light ? mix(branding.secondary, "#ffffff", 0.7) : mix(branding.secondary, ink, 0.06),
    "--tint": mix(branding.secondary, branding.primary, light ? 0.1 : 0.25),
    "--hover": hover,
    "--on-hover": readableText(hover),
    "--error": contrastRatio("#a33328", branding.secondary) >= 4.5 ? "#a33328" : ink,
  };
}
