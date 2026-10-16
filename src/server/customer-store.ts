import { z } from "zod";
import { partySchema } from "@/lib/schemas/invoice";
import { getPrisma } from "./db";
import { isUuid } from "./invoice-store";

export type Customer = z.output<typeof partySchema> & { id: string };

function toCustomer(row: {
  id: string;
  name: string;
  address: string | null;
  email: string | null;
  nzbn: string | null;
}): Customer {
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? undefined,
    email: row.email ?? undefined,
    nzbn: row.nzbn ?? undefined,
  };
}

export async function listCustomers(): Promise<Customer[]> {
  const rows = await getPrisma().customer.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }] });
  return rows.map(toCustomer);
}

export async function createCustomer(party: z.output<typeof partySchema>): Promise<Customer> {
  const row = await getPrisma().customer.create({
    data: {
      name: party.name,
      address: party.address ?? null,
      email: party.email ?? null,
      nzbn: party.nzbn ?? null,
    },
  });
  return toCustomer(row);
}

/** Returns false when the customer did not exist. */
export async function deleteCustomer(id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const { count } = await getPrisma().customer.deleteMany({ where: { id } });
  return count > 0;
}
