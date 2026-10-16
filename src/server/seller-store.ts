import type { SellerProfile } from "@/lib/schemas/seller";
import { getPrisma } from "./db";
import { isUuid } from "./invoice-store";

export type Seller = SellerProfile & { id: string; isDefault: boolean };

function toSeller(row: {
  id: string;
  label: string;
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  nzbn: string | null;
  gstNumber: string | null;
  paymentDetails: string | null;
  isDefault: boolean;
}): Seller {
  return {
    id: row.id,
    isDefault: row.isDefault,
    label: row.label,
    name: row.name,
    address: row.address ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    nzbn: row.nzbn ?? undefined,
    gstNumber: row.gstNumber ?? undefined,
    paymentDetails: row.paymentDetails ?? undefined,
  };
}

function toData(profile: SellerProfile) {
  return {
    label: profile.label,
    name: profile.name,
    address: profile.address ?? null,
    email: profile.email ?? null,
    phone: profile.phone ?? null,
    nzbn: profile.nzbn ?? null,
    gstNumber: profile.gstNumber ?? null,
    paymentDetails: profile.paymentDetails ?? null,
  };
}

/** The default seller first, then by label. */
export async function listSellers(): Promise<Seller[]> {
  const rows = await getPrisma().seller.findMany({
    orderBy: [{ isDefault: "desc" }, { label: "asc" }, { id: "asc" }],
  });
  return rows.map(toSeller);
}

export async function getSeller(id: string): Promise<Seller | null> {
  if (!isUuid(id)) return null;
  const row = await getPrisma().seller.findUnique({ where: { id } });
  return row ? toSeller(row) : null;
}

/** The first seller you create becomes the default. */
export async function createSeller(profile: SellerProfile): Promise<Seller> {
  return getPrisma().$transaction(async (tx) => {
    const isDefault = (await tx.seller.count()) === 0;
    return toSeller(await tx.seller.create({ data: { ...toData(profile), isDefault } }));
  });
}

/** Returns null when the seller does not exist. */
export async function updateSeller(id: string, profile: SellerProfile): Promise<Seller | null> {
  if (!isUuid(id)) return null;
  try {
    return toSeller(await getPrisma().seller.update({ where: { id }, data: toData(profile) }));
  } catch (error) {
    if ((error as { code?: string }).code === "P2025") return null; // record not found
    throw error;
  }
}

/** Makes this seller the only default. Returns false when the seller does not exist. */
export async function setDefaultSeller(id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  return getPrisma().$transaction(async (tx) => {
    if (!(await tx.seller.findUnique({ where: { id }, select: { id: true } }))) return false;
    await tx.seller.updateMany({
      where: { isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
    await tx.seller.update({ where: { id }, data: { isDefault: true } });
    return true;
  });
}

/**
 * Returns false when the seller did not exist. Deleting the default leaves no default, so new
 * invoices start with an empty seller until another one is chosen.
 */
export async function deleteSeller(id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const { count } = await getPrisma().seller.deleteMany({ where: { id } });
  return count > 0;
}
