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
export type Snapshot = {
  branding: Branding;
  customers: Customer[];
  presets: Preset[];
  entries: Entry[];
};
