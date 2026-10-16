import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { invoiceSchema } from "@/lib/schemas/invoice";
import { sellerProfileSchema } from "@/lib/schemas/seller";
import { getPrisma } from "./db";
import { createCustomer, deleteCustomer, listCustomers } from "./customer-store";
import {
  createInvoice,
  deleteInvoice,
  duplicateInvoice,
  getInvoice,
  listInvoices,
  setInvoiceStatus,
  updateInvoice,
} from "./invoice-store";
import {
  createSeller,
  deleteSeller,
  getSeller,
  listSellers,
  setDefaultSeller,
  updateSeller,
} from "./seller-store";

const parse = (input: unknown) => invoiceSchema.parse(input);
const seller = (input: Record<string, unknown>) => sellerProfileSchema.parse(input);
const sample = () =>
  parse({
    number: "INV-1",
    issueDate: "2026-10-01",
    dueDate: "2026-10-20",
    seller: { name: "Acme Ltd", gstNumber: "123-456-789" },
    buyer: { name: "Jane Smith", nzbn: "9429000000001" },
    notes: "Thanks",
    lines: [
      { description: "Work", quantity: 2, unitPriceCents: 10000 },
      { description: "No price", quantity: 1 },
    ],
  });

beforeEach(async () => {
  const prisma = getPrisma();
  await prisma.invoice.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.seller.deleteMany();
});

afterAll(async () => {
  await getPrisma().$disconnect();
});

describe("invoice store", () => {
  it("saves a snapshot and reads it back unchanged", async () => {
    const saved = await createInvoice(sample());
    const loaded = await getInvoice(saved.id);
    expect(loaded?.invoice).toEqual(sample());
    expect(loaded?.status).toBe("draft");
    expect(loaded?.invoice.template).toBe("classic");
  });

  it("keeps list columns in sync with the snapshot", async () => {
    await createInvoice(sample());
    const [item] = await listInvoices();
    expect(item).toMatchObject({
      number: "INV-1",
      buyerName: "Jane Smith",
      issueDate: "2026-10-01",
      currency: "NZD",
      totalCents: 23000, // 2 x $100 + 15% GST; the line without a price is ignored
    });
  });

  it("stores no total when no line counts", async () => {
    await createInvoice(parse({ seller: { name: "A" }, buyer: { name: "B" } }));
    const [item] = await listInvoices();
    expect(item.totalCents).toBeNull();
    expect(item.number).toBeNull();
  });

  it("updates the snapshot and the list columns", async () => {
    const saved = await createInvoice(sample());
    const changed = parse({ ...sample(), number: "INV-2", buyer: { name: "Bob" } });
    const updated = await updateInvoice(saved.id, changed);
    expect(updated?.invoice.buyer.name).toBe("Bob");
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(saved.updatedAt.getTime());
    const [item] = await listInvoices();
    expect(item).toMatchObject({ number: "INV-2", buyerName: "Bob" });
    expect(await listInvoices()).toHaveLength(1);
  });

  it("does not require invoice numbers to be unique", async () => {
    await createInvoice(sample());
    await createInvoice(sample());
    expect(await listInvoices()).toHaveLength(2);
  });

  it("lists the most recently changed invoice first", async () => {
    const first = await createInvoice(parse({ ...sample(), number: "A" }));
    await createInvoice(parse({ ...sample(), number: "B" }));
    await updateInvoice(first.id, parse({ ...sample(), number: "A2" }));
    expect((await listInvoices()).map((i) => i.number)).toEqual(["A2", "B"]);
  });

  it("deletes an invoice", async () => {
    const saved = await createInvoice(sample());
    expect(await deleteInvoice(saved.id)).toBe(true);
    expect(await getInvoice(saved.id)).toBeNull();
    expect(await deleteInvoice(saved.id)).toBe(false);
  });

  it("treats unknown and malformed ids as not found", async () => {
    const unknown = "00000000-0000-4000-8000-000000000000";
    expect(await getInvoice(unknown)).toBeNull();
    expect(await getInvoice("not-a-uuid")).toBeNull();
    expect(await updateInvoice(unknown, sample())).toBeNull();
    expect(await updateInvoice("not-a-uuid", sample())).toBeNull();
    expect(await deleteInvoice("not-a-uuid")).toBe(false);
    expect(await duplicateInvoice(unknown)).toBeNull();
  });

  it("duplicates an invoice without its number and dates", async () => {
    const saved = await createInvoice(sample());
    const copy = await duplicateInvoice(saved.id);
    expect(copy!.id).not.toBe(saved.id);
    expect(copy!.invoice.number).toBeUndefined();
    expect(copy!.invoice.dueDate).toBeUndefined();
    expect(copy!.invoice.issueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(copy!.invoice.buyer).toEqual(saved.invoice.buyer);
    expect(copy!.invoice.lines).toEqual(saved.invoice.lines);
    expect(await listInvoices()).toHaveLength(2);
  });

  it("stores very large totals exactly", async () => {
    const big = parse({
      seller: { name: "A" },
      buyer: { name: "B" },
      lines: [{ quantity: 100000, unitPriceCents: 100000000 }],
    });
    await createInvoice(big);
    const [item] = await listInvoices();
    expect(item.totalCents).toBe(11_500_000_000_000); // 1e13 + 15% GST
  });
});

describe("invoice design", () => {
  it("stores the template, accent colour and font in the snapshot", async () => {
    const saved = await createInvoice(
      parse({ ...sample(), template: "minimal", accentColor: "#059669", font: "serif" }),
    );
    const loaded = await getInvoice(saved.id);
    expect(loaded?.invoice).toMatchObject({
      template: "minimal",
      accentColor: "#059669",
      font: "serif",
    });
  });

  it("applies the design defaults to a snapshot saved without one", async () => {
    // Invoices saved before the design fields existed have none of them in their content
    const saved = await createInvoice(sample());
    await getPrisma()
      .$executeRaw`UPDATE invoices SET content = content - 'template' - 'font' WHERE id = ${saved.id}::uuid`;
    const loaded = await getInvoice(saved.id);
    expect(loaded?.invoice.template).toBe("classic");
    expect(loaded?.invoice.font).toBeUndefined();
  });
});

describe("invoice status", () => {
  it("starts as a draft and can be changed", async () => {
    const saved = await createInvoice(sample());
    expect(saved.status).toBe("draft");
    expect(await setInvoiceStatus(saved.id, "sent")).toBe(true);
    expect((await getInvoice(saved.id))?.status).toBe("sent");
    expect((await listInvoices())[0].status).toBe("sent");
    expect(await setInvoiceStatus(saved.id, "paid")).toBe(true);
    expect((await getInvoice(saved.id))?.status).toBe("paid");
  });

  it("is not reset by editing the invoice", async () => {
    const saved = await createInvoice(sample());
    await setInvoiceStatus(saved.id, "sent");
    const updated = await updateInvoice(saved.id, parse({ ...sample(), notes: "Changed" }));
    expect(updated?.status).toBe("sent");
    expect(updated?.invoice.notes).toBe("Changed");
  });

  it("gives a duplicate the draft status", async () => {
    const saved = await createInvoice(sample());
    await setInvoiceStatus(saved.id, "paid");
    expect((await duplicateInvoice(saved.id))?.status).toBe("draft");
  });

  it("keeps the due date column in sync", async () => {
    await createInvoice(sample());
    expect((await listInvoices())[0].dueDate).toBe("2026-10-20");
    await createInvoice(parse({ seller: { name: "A" }, buyer: { name: "B" } }));
    expect((await listInvoices()).filter((i) => i.dueDate === null)).toHaveLength(1);
  });

  it("treats unknown and malformed ids as not found", async () => {
    expect(await setInvoiceStatus("00000000-0000-4000-8000-000000000000", "paid")).toBe(false);
    expect(await setInvoiceStatus("not-a-uuid", "paid")).toBe(false);
  });
});

describe("filtering the invoice list", () => {
  const TODAY = "2026-10-16";

  /** Creates an invoice and returns its number, so tests can compare lists of numbers. */
  async function add(
    number: string,
    buyer: string,
    status: "draft" | "sent" | "paid",
    dueDate?: string,
  ) {
    const saved = await createInvoice(
      parse({ number, dueDate, seller: { name: "Acme" }, buyer: { name: buyer } }),
    );
    if (status !== "draft") await setInvoiceStatus(saved.id, status);
  }

  const numbers = async (filter: Parameters<typeof listInvoices>[0]) =>
    (await listInvoices({ today: TODAY, ...filter })).map((i) => i.number).sort();

  beforeEach(async () => {
    await add("A", "Jane Smith", "draft", "2026-10-01"); // a draft is never overdue
    await add("B", "Bob Brown", "sent", "2026-10-01"); // overdue
    await add("C", "Cara Jones", "sent", "2026-10-20"); // sent, not yet due
    await add("D", "Dan Lee", "sent"); // sent, no due date
    await add("E", "Eve Moss", "paid", "2026-09-01"); // paid late is still paid
    await add("F", "Fay Wong", "sent", TODAY); // due today is not overdue yet
  });

  it("returns everything without a filter", async () => {
    expect(await numbers({})).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect(await numbers({ status: undefined, query: "" })).toEqual(["A", "B", "C", "D", "E", "F"]);
  });

  it("filters by status, and the tabs do not overlap", async () => {
    expect(await numbers({ status: "draft" })).toEqual(["A"]);
    expect(await numbers({ status: "paid" })).toEqual(["E"]);
    expect(await numbers({ status: "overdue" })).toEqual(["B"]);
    expect(await numbers({ status: "sent" })).toEqual(["C", "D", "F"]);
  });

  it("moves an invoice from sent to overdue when the date passes", async () => {
    expect(await numbers({ status: "overdue", today: "2026-10-17" })).toEqual(["B", "F"]);
    expect(await numbers({ status: "sent", today: "2026-10-17" })).toEqual(["C", "D"]);
    expect(await numbers({ status: "overdue", today: "2026-10-21" })).toEqual(["B", "C", "F"]);
  });

  it("searches the buyer name and the number, ignoring case", async () => {
    expect(await numbers({ query: "jane" })).toEqual(["A"]);
    expect(await numbers({ query: "BROWN" })).toEqual(["B"]);
    expect(await numbers({ query: "c" })).toEqual(["C"]); // Cara Jones, and number C
    expect(await numbers({ query: "e" })).toEqual(["A", "C", "D", "E"]);
    expect(await numbers({ query: "  dan  " })).toEqual(["D"]);
    expect(await numbers({ query: "nobody" })).toEqual([]);
  });

  it("combines status and search", async () => {
    expect(await numbers({ status: "sent", query: "o" })).toEqual(["C", "F"]); // Jones, Wong
    expect(await numbers({ status: "paid", query: "jane" })).toEqual([]);
  });

  it("treats % and _ in the search as plain characters", async () => {
    await add("G", "100% Organic", "draft");
    await add("H", "abc", "draft");
    expect(await numbers({ query: "100%" })).toEqual(["G"]);
    expect(await numbers({ query: "a_c" })).toEqual([]);
    expect(await numbers({ query: "%" })).toEqual(["G"]);
  });
});

describe("snapshots are independent of sellers and customers", () => {
  it("does not change a saved invoice when its seller or customer changes or is deleted", async () => {
    const acme = await createSeller(seller({ name: "Acme Ltd", gstNumber: "123-456-789" }));
    const customer = await createCustomer({ name: "Jane Smith" });
    const saved = await createInvoice(sample());

    await updateSeller(acme.id, seller({ name: "Renamed Ltd" }));
    await deleteSeller(acme.id);
    await deleteCustomer(customer.id);

    const loaded = await getInvoice(saved.id);
    expect(loaded?.invoice.seller.name).toBe("Acme Ltd");
    expect(loaded?.invoice.seller.gstNumber).toBe("123-456-789");
    expect(loaded?.invoice.buyer.name).toBe("Jane Smith");
  });
});

describe("customer store", () => {
  it("creates, lists in name order, and deletes customers", async () => {
    await createCustomer({ name: "Zed", email: "z@example.com" });
    const bob = await createCustomer({ name: "Bob", address: "1 Road", nzbn: "9429000000001" });
    const customers = await listCustomers();
    expect(customers.map((c) => c.name)).toEqual(["Bob", "Zed"]);
    expect(customers[0]).toMatchObject({ address: "1 Road", nzbn: "9429000000001" });
    expect(customers[0].email).toBeUndefined();

    expect(await deleteCustomer(bob.id)).toBe(true);
    expect(await deleteCustomer(bob.id)).toBe(false);
    expect(await deleteCustomer("not-a-uuid")).toBe(false);
    expect(await listCustomers()).toHaveLength(1);
  });
});

describe("seller store", () => {
  it("starts empty", async () => {
    expect(await listSellers()).toEqual([]);
  });

  it("makes the first seller the default and later ones not", async () => {
    const first = await createSeller(seller({ name: "First Ltd" }));
    const second = await createSeller(seller({ name: "Second Ltd" }));
    expect(first.isDefault).toBe(true);
    expect(second.isDefault).toBe(false);
  });

  it("falls back to the name when there is no label", async () => {
    const created = await createSeller(seller({ name: "Acme Ltd" }));
    expect(created.label).toBe("Acme Ltd");
    const labelled = await createSeller(seller({ name: "Acme Ltd", label: "Acme - Consulting" }));
    expect(labelled.label).toBe("Acme - Consulting");
    expect(labelled.name).toBe("Acme Ltd");
  });

  it("lists the default first, then by label", async () => {
    await createSeller(seller({ name: "Zed Ltd" })); // default
    await createSeller(seller({ name: "Bravo Ltd" }));
    await createSeller(seller({ name: "Alpha Ltd" }));
    expect((await listSellers()).map((s) => s.label)).toEqual([
      "Zed Ltd",
      "Alpha Ltd",
      "Bravo Ltd",
    ]);
  });

  it("keeps all fields, including payment details, and leaves unset ones undefined", async () => {
    const created = await createSeller(
      seller({
        name: "Acme Ltd",
        address: "1 Queen St",
        email: "a@acme.co",
        phone: "09 123",
        nzbn: "9429000000000",
        gstNumber: "123-456-789",
        paymentDetails: "Bank 12-3456",
      }),
    );
    expect(await getSeller(created.id)).toEqual({
      id: created.id,
      isDefault: true,
      label: "Acme Ltd",
      name: "Acme Ltd",
      address: "1 Queen St",
      email: "a@acme.co",
      phone: "09 123",
      nzbn: "9429000000000",
      gstNumber: "123-456-789",
      paymentDetails: "Bank 12-3456",
    });
    const bare = await createSeller(seller({ name: "Bare Ltd" }));
    expect((await getSeller(bare.id))?.address).toBeUndefined();
  });

  it("updates a seller without changing which one is the default", async () => {
    const first = await createSeller(seller({ name: "First Ltd" }));
    const updated = await updateSeller(first.id, seller({ name: "First 2 Ltd", nzbn: "1" }));
    expect(updated).toMatchObject({
      name: "First 2 Ltd",
      label: "First 2 Ltd",
      nzbn: "1",
      isDefault: true,
    });
    expect(await listSellers()).toHaveLength(1);
  });

  it("keeps exactly one default when it is changed", async () => {
    const first = await createSeller(seller({ name: "First Ltd" }));
    const second = await createSeller(seller({ name: "Second Ltd" }));
    expect(await setDefaultSeller(second.id)).toBe(true);
    const sellers = await listSellers();
    expect(sellers.filter((s) => s.isDefault).map((s) => s.id)).toEqual([second.id]);
    expect(sellers[0].id).toBe(second.id);
    expect((await getSeller(first.id))?.isDefault).toBe(false);
    // Choosing the current default again changes nothing
    expect(await setDefaultSeller(second.id)).toBe(true);
    expect((await listSellers()).filter((s) => s.isDefault)).toHaveLength(1);
  });

  it("leaves no default when the default seller is deleted", async () => {
    const first = await createSeller(seller({ name: "First Ltd" }));
    await createSeller(seller({ name: "Second Ltd" }));
    expect(await deleteSeller(first.id)).toBe(true);
    expect((await listSellers()).some((s) => s.isDefault)).toBe(false);
    // A new seller does not become the default while others exist
    expect((await createSeller(seller({ name: "Third Ltd" }))).isDefault).toBe(false);
  });

  it("makes a new seller the default when none exist", async () => {
    const only = await createSeller(seller({ name: "Only Ltd" }));
    await deleteSeller(only.id);
    expect((await createSeller(seller({ name: "Next Ltd" }))).isDefault).toBe(true);
  });

  it("treats unknown and malformed ids as not found", async () => {
    const unknown = "00000000-0000-4000-8000-000000000000";
    expect(await getSeller(unknown)).toBeNull();
    expect(await getSeller("not-a-uuid")).toBeNull();
    expect(await updateSeller(unknown, seller({ name: "X" }))).toBeNull();
    expect(await updateSeller("not-a-uuid", seller({ name: "X" }))).toBeNull();
    expect(await setDefaultSeller(unknown)).toBe(false);
    expect(await setDefaultSeller("not-a-uuid")).toBe(false);
    expect(await deleteSeller(unknown)).toBe(false);
    expect(await deleteSeller("not-a-uuid")).toBe(false);
  });
});
