import { expect, it } from "vitest";
import { parseAmount, formatAmount } from "./money";

it("parses and formats decimal credits", () => {
    expect(parseAmount("8.50")).toBe(850);
    expect(formatAmount(850)).toBe("8,50");
    expect(formatAmount(0)).toBe("0,00");
    expect(parseAmount("0,29")).toBe(29);
    for (const input of ["0", "-1", "1.005", "1e3", ""])
      expect(() => parseAmount(input)).toThrow();
});
