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
    expect(loaded?.templateId).toBe("classic");
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
