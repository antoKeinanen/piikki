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
