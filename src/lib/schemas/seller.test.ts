import { describe, expect, it } from "vitest";
import { sellerProfileSchema } from "./seller";

describe("sellerProfileSchema", () => {
  it("needs only a name", () => {
    expect(sellerProfileSchema.safeParse({ name: "Acme Ltd" }).success).toBe(true);
    expect(sellerProfileSchema.safeParse({}).success).toBe(false);
    expect(sellerProfileSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("uses the name as the label when the label is empty", () => {
    expect(sellerProfileSchema.parse({ name: "Acme Ltd" }).label).toBe("Acme Ltd");
    expect(sellerProfileSchema.parse({ name: "Acme Ltd", label: "" }).label).toBe("Acme Ltd");
    expect(sellerProfileSchema.parse({ name: "Acme Ltd", label: "  " }).label).toBe("Acme Ltd");
    expect(sellerProfileSchema.parse({ name: "Acme Ltd", label: "Consulting" }).label).toBe(
      "Consulting",
    );
  });

  it("treats empty optional fields as not provided", () => {
    const parsed = sellerProfileSchema.parse({ name: "Acme", address: "", paymentDetails: " " });
    expect(parsed.address).toBeUndefined();
    expect(parsed.paymentDetails).toBeUndefined();
  });
});
