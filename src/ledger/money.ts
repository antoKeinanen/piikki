export const formatAmount = (cents: number) =>
  new Intl.NumberFormat("fi-FI", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
export function parseAmount(value: string): number {
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(value.trim()))
    throw new Error("Anna summa numeroina, esim. 2,50.");
  const cents = Math.round(Number(value.replace(",", ".")) * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0)
    throw new Error("Summan pitää olla suurempi kuin nolla.");
  return cents;
}
/** Parses an amount that may be negative, such as a starting balance owed. */
export function parseSignedAmount(value: string): number {
  const trimmed = value.trim().replace(/^[−–]/, "-");
  return trimmed.startsWith("-") ? -parseAmount(trimmed.slice(1)) : parseAmount(trimmed);
}
