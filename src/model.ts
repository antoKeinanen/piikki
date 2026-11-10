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
export const LogoSchema = z.string().max(1_400_000).regex(
  /^data:image\/(?:png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/,
);
export const BrandingSchema = z.object({
  logo: LogoSchema.optional(),
  organization: z.string().trim().min(1).max(60).default("KyO"),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type Branding = z.infer<typeof BrandingSchema>;
export const defaultBranding: Branding = {
  organization: "KyO",
  primary: "#111111",
  secondary: "#FFFFFF",
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
  new Intl.NumberFormat("fi-FI", {
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
