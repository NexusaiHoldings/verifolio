/**
 * COI properties — server-side data access layer.
 * Raw SQL via pg Pool (drizzle-orm is banned per portfolio constraints).
 */

import { buildDb } from "@/lib/db";

export interface CoiProperty {
  id: string;
  org_id: string;
  name: string;
  address: string | null;
  property_type: string | null;
  unit_count: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePropertyInput {
  name: string;
  address?: string | null;
  property_type?: string | null;
  unit_count?: number | null;
  notes?: string | null;
}

export interface UpdatePropertyInput {
  name?: string;
  address?: string | null;
  property_type?: string | null;
  unit_count?: number | null;
  notes?: string | null;
  is_active?: boolean;
}

/** List all active properties for an org, optionally filtered by a search query. */
export async function listProperties(
  orgId: string,
  search?: string,
): Promise<CoiProperty[]> {
  const db = buildDb();
  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    return db.query<CoiProperty>(
      `SELECT id, org_id, name, address, property_type, unit_count, notes,
              is_active, created_at::text, updated_at::text
         FROM coi_properties
        WHERE org_id = $1
          AND is_active = TRUE
          AND (name ILIKE $2 OR address ILIKE $2 OR property_type ILIKE $2)
        ORDER BY name ASC
        LIMIT 200`,
      orgId,
      term,
    );
  }
  return db.query<CoiProperty>(
    `SELECT id, org_id, name, address, property_type, unit_count, notes,
            is_active, created_at::text, updated_at::text
       FROM coi_properties
      WHERE org_id = $1
        AND is_active = TRUE
      ORDER BY name ASC
      LIMIT 200`,
    orgId,
  );
}

/** Fetch a single property by id, scoped to the org. */
export async function getProperty(
  orgId: string,
  propertyId: string,
): Promise<CoiProperty | null> {
  const db = buildDb();
  const rows = await db.query<CoiProperty>(
    `SELECT id, org_id, name, address, property_type, unit_count, notes,
            is_active, created_at::text, updated_at::text
       FROM coi_properties
      WHERE org_id = $1 AND id = $2
      LIMIT 1`,
    orgId,
    propertyId,
  );
  return rows[0] ?? null;
}

/** Create a new property. Returns the created row. */
export async function createProperty(
  orgId: string,
  input: CreatePropertyInput,
): Promise<CoiProperty> {
  const db = buildDb();
  const rows = await db.query<CoiProperty>(
    `INSERT INTO coi_properties
       (org_id, name, address, property_type, unit_count, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, org_id, name, address, property_type, unit_count, notes,
               is_active, created_at::text, updated_at::text`,
    orgId,
    input.name,
    input.address ?? null,
    input.property_type ?? null,
    input.unit_count ?? null,
    input.notes ?? null,
  );
  if (!rows[0]) throw new Error("Property insert returned no rows");
  return rows[0];
}

/** Update property fields. Returns the updated row, or null if not found. */
export async function updateProperty(
  orgId: string,
  propertyId: string,
  input: UpdatePropertyInput,
): Promise<CoiProperty | null> {
  const db = buildDb();
  const setClauses: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [orgId, propertyId];

  const fields: (keyof UpdatePropertyInput)[] = [
    "name",
    "address",
    "property_type",
    "unit_count",
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
    return getProperty(orgId, propertyId);
  }

  const rows = await db.query<CoiProperty>(
    `UPDATE coi_properties
        SET ${setClauses.join(", ")}
      WHERE org_id = $1 AND id = $2
      RETURNING id, org_id, name, address, property_type, unit_count, notes,
                is_active, created_at::text, updated_at::text`,
    ...params,
  );
  return rows[0] ?? null;
}

/** Soft-delete a property (set is_active = false). */
export async function deactivateProperty(
  orgId: string,
  propertyId: string,
): Promise<boolean> {
  const db = buildDb();
  const rows = await db.query<{ id: string }>(
    `UPDATE coi_properties
        SET is_active = FALSE, updated_at = NOW()
      WHERE org_id = $1 AND id = $2
      RETURNING id`,
    orgId,
    propertyId,
  );
  return (rows[0]?.id ?? null) !== null;
}
