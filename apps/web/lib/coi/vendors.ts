/**
 * COI vendors — server-side data access layer.
 * Raw SQL via pg Pool (drizzle-orm is banned per portfolio constraints).
 */

import { buildDb } from "@/lib/db";

export interface CoiVendor {
  id: string;
  org_id: string;
  name: string;
  trade_category: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateVendorInput {
  name: string;
  trade_category?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface UpdateVendorInput {
  name?: string;
  trade_category?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

/** List all active vendors for an org, optionally filtered by a search query. */
export async function listVendors(
  orgId: string,
  search?: string,
): Promise<CoiVendor[]> {
  const db = buildDb();
  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    return db.query<CoiVendor>(
      `SELECT id, org_id, name, trade_category, contact_name, contact_email,
              contact_phone, address, notes, is_active,
              created_at::text, updated_at::text
         FROM coi_vendors
        WHERE org_id = $1
          AND is_active = TRUE
          AND (name ILIKE $2 OR trade_category ILIKE $2 OR contact_name ILIKE $2 OR contact_email ILIKE $2)
        ORDER BY name ASC
        LIMIT 200`,
      orgId,
      term,
    );
  }
  return db.query<CoiVendor>(
    `SELECT id, org_id, name, trade_category, contact_name, contact_email,
            contact_phone, address, notes, is_active,
            created_at::text, updated_at::text
       FROM coi_vendors
      WHERE org_id = $1
        AND is_active = TRUE
      ORDER BY name ASC
      LIMIT 200`,
    orgId,
  );
}

/** Fetch a single vendor by id, scoped to the org. */
export async function getVendor(
  orgId: string,
  vendorId: string,
): Promise<CoiVendor | null> {
  const db = buildDb();
  const rows = await db.query<CoiVendor>(
    `SELECT id, org_id, name, trade_category, contact_name, contact_email,
            contact_phone, address, notes, is_active,
            created_at::text, updated_at::text
       FROM coi_vendors
      WHERE org_id = $1 AND id = $2
      LIMIT 1`,
    orgId,
    vendorId,
  );
  return rows[0] ?? null;
}

/** Create a new vendor. Returns the created row. */
export async function createVendor(
  orgId: string,
  input: CreateVendorInput,
): Promise<CoiVendor> {
  const db = buildDb();
  const rows = await db.query<CoiVendor>(
    `INSERT INTO coi_vendors
       (org_id, name, trade_category, contact_name, contact_email, contact_phone, address, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, org_id, name, trade_category, contact_name, contact_email,
               contact_phone, address, notes, is_active,
               created_at::text, updated_at::text`,
    orgId,
    input.name,
    input.trade_category ?? null,
    input.contact_name ?? null,
    input.contact_email ?? null,
    input.contact_phone ?? null,
    input.address ?? null,
    input.notes ?? null,
  );
  if (!rows[0]) throw new Error("Vendor insert returned no rows");
  return rows[0];
}

/** Update vendor fields. Returns the updated row, or null if not found. */
export async function updateVendor(
  orgId: string,
  vendorId: string,
  input: UpdateVendorInput,
): Promise<CoiVendor | null> {
  const db = buildDb();
  const setClauses: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [orgId, vendorId];

  const fields: (keyof UpdateVendorInput)[] = [
    "name",
    "trade_category",
    "contact_name",
    "contact_email",
    "contact_phone",
    "address",
    "notes",
    "is_active",
  ];

  for (const field of fields) {
    if (field in input) {
      params.push(input[field] ?? null);
      setClauses.push(`${field} = $${params.length}`);
    }
  }

  if (setClauses.length === 1) {
    return getVendor(orgId, vendorId);
  }

  const rows = await db.query<CoiVendor>(
    `UPDATE coi_vendors
        SET ${setClauses.join(", ")}
      WHERE org_id = $1 AND id = $2
      RETURNING id, org_id, name, trade_category, contact_name, contact_email,
                contact_phone, address, notes, is_active,
                created_at::text, updated_at::text`,
    ...params,
  );
  return rows[0] ?? null;
}

/** Soft-delete a vendor (set is_active = false). */
export async function deactivateVendor(
  orgId: string,
  vendorId: string,
): Promise<boolean> {
  const db = buildDb();
  const rows = await db.query<{ id: string }>(
    `UPDATE coi_vendors
        SET is_active = FALSE, updated_at = NOW()
      WHERE org_id = $1 AND id = $2
      RETURNING id`,
    orgId,
    vendorId,
  );
  return (rows[0]?.id ?? null) !== null;
}
