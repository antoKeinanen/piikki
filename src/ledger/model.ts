import { z } from "zod";
/** Osakunta names are free text; the limit only guards against pasted junk. */
export const OSAKUNTA_MAX = 60;
export const OPERATOR_MAX = 60;
export const CustomerSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  reference: z.string(),
  osakunta: z.string().max(OSAKUNTA_MAX).default(""),
  note: z.string().default(""),
  balance: z.number().int(),
  /** Time of the person's latest entry in any event, or null without entries. */
  last_activity: z.string().nullable().default(null),
});
export type Customer = z.infer<typeof CustomerSchema>;
export const EntrySchema = z.object({
  id: z.string(),
  customer_id: z.string(),
  cents: z.number().int(),
  label: z.string(),
  created_at: z.string(),
  reversal_of: z.string().nullable(),
  reversed: z.number().int(),
  /** Who was at the till when the entry was made; empty for older entries. */
  operator: z.string().default(""),
  /** Optional free-text description written by the operator. */
  note: z.string().default(""),
  /** A starting balance entered when the person was added, not a sale or deposit. */
  opening: z.number().int().default(0),
});
export type Entry = z.infer<typeof EntrySchema>;
export const LogoSchema = z.string().max(1_400_000).regex(
  /^data:image\/(?:png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/,
);
export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  cents: z.number().int().positive(),
  description: z.string().max(2000),
  image: z.union([z.literal(""), LogoSchema]),
  /** Products with the same category are grouped behind one button. */
  category: z.string().trim().max(60).default(""),
});
export type Product = z.infer<typeof ProductSchema>;
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
export const EventNameSchema = z.string().trim().min(1, "Anna tapahtuman nimi.").max(100);
export const LedgerEventSchema = z.object({
  id: z.string(),
  name: EventNameSchema,
});
export type LedgerEvent = z.infer<typeof LedgerEventSchema>;
export type Snapshot = {
  event: LedgerEvent;
  branding: Branding;
  customers: Customer[];
  /** Deleted people keep their history and balance and can be restored. */
  removedCustomers: Customer[];
  products: Product[];
  entries: Entry[];
};
