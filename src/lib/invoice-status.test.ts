import { describe, expect, it } from "vitest";
import { effectiveStatus } from "./invoice-status";

describe("effectiveStatus", () => {
  it("is overdue only when sent and past the due date", () => {
    expect(effectiveStatus("sent", "2026-10-01", "2026-10-16")).toBe("overdue");
  });

  it("is not overdue on the due date itself", () => {
    expect(effectiveStatus("sent", "2026-10-16", "2026-10-16")).toBe("sent");
    expect(effectiveStatus("sent", "2026-10-17", "2026-10-16")).toBe("sent");
  });

  it("is overdue the day after the due date", () => {
    expect(effectiveStatus("sent", "2026-10-15", "2026-10-16")).toBe("overdue");
  });

  it("is never overdue without a due date", () => {
    expect(effectiveStatus("sent", undefined, "2026-10-16")).toBe("sent");
    expect(effectiveStatus("sent", null, "2026-10-16")).toBe("sent");
  });

  it("leaves paid and draft invoices alone, however late", () => {
    expect(effectiveStatus("paid", "2020-01-01", "2026-10-16")).toBe("paid");
    expect(effectiveStatus("draft", "2020-01-01", "2026-10-16")).toBe("draft");
  });

  it("compares across month and year boundaries", () => {
    expect(effectiveStatus("sent", "2026-12-31", "2027-01-01")).toBe("overdue");
    expect(effectiveStatus("sent", "2026-09-30", "2026-10-01")).toBe("overdue");
  });
});
