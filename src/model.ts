import { z } from "zod";
export const CustomerSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  reference: z.string(),
  balance: z.number().int().nonnegative(),
});
export type Customer = z.infer<typeof CustomerSchema>;
export const PresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  cents: z.number().int().positive(),
});
export type Preset = z.infer<typeof PresetSchema>;
export const EntrySchema = z.object({
  id: z.string(),
  customer_id: z.string(),
  cents: z.number().int(),
  label: z.string(),
  created_at: z.string(),
  reversal_of: z.string().nullable(),
  reversed: z.number().int(),
});
export type Entry = z.infer<typeof EntrySchema>;
export const BrandingSchema = z.object({
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type Branding = z.infer<typeof BrandingSchema>;
export const defaultBranding: Branding = {
  primary: "#3549D8",
  secondary: "#F0E4A3",
};
export function readableText(hex: string) {
  const channels = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? "#111111" : "#ffffff";
}
export type Snapshot = {
  branding: Branding;
  customers: Customer[];
  presets: Preset[];
  entries: Entry[];
};
export const formatAmount = (cents: number) =>
  new Intl.NumberFormat("en-IE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
export function parseAmount(value: string): number {
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(value.trim()))
    throw new Error("Enter an amount with up to two decimal places.");
  const cents = Math.round(Number(value.replace(",", ".")) * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0)
    throw new Error("Enter an amount greater than zero.");
  return cents;
}
