/**
 * COI property data layer — raw SQL via pg pool (no ORM).
 *
 * All IDs are UUIDs. Parameterized queries only ($1, $2, …).
 */

// ── Row types ─────────────────────────────────────────────────────────────────

export interface PropertyRow {
  id: string;
  org_id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  property_type: string;
  unit_count: number | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PropertyFilters {
  search?: string;
  status?: string;
  property_type?: string;
  limit?: number;
  offset?: number;
}

export interface PropertyInput {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  property_type?: string;
  unit_count?: number;
  notes?: string;
  status?: string;
}

// ── pg pool ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pool: any = null;

function getPool(): {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
} {
  if (_pool) return _pool;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool: PgPool } = require("pg") as {
    Pool: new (config: Record<string, unknown>) => {
      query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
    };
  };
  _pool = new PgPool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  return _pool;
}

async function dbQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const pool = getPool();
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * List properties for an org with optional search, status, and type filters.
 */
export async function listProperties(
  orgId: string,
  filters: PropertyFilters = {},
): Promise<PropertyRow[]> {
  const { search, status, property_type, limit = 100, offset = 0 } = filters;
  const conditions: string[] = ["org_id = $1"];
  const params: unknown[] = [orgId];
  let idx = 2;

  if (search && search.trim().length > 0) {
    conditions.push(
      `(name ILIKE $${idx} OR address ILIKE $${idx} OR city ILIKE $${idx})`,
    );
    params.push(`%${search.trim()}%`);
    idx++;
  }

  if (status && status.trim().length > 0) {
    conditions.push(`status = $${idx}`);
    params.push(status.trim());
    idx++;
  }

  if (property_type && property_type.trim().length > 0) {
    conditions.push(`property_type = $${idx}`);
    params.push(property_type.trim());
    idx++;
  }

  params.push(limit, offset);

  const sql = `
    SELECT id, org_id, name, address, city, state, zip, property_type,
           unit_count, notes, status, created_at, updated_at
    FROM coi_properties
    WHERE ${conditions.join(" AND ")}
    ORDER BY name ASC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;

  return dbQuery<PropertyRow>(sql, params);
}

/**
 * Fetch a single property by id, scoped to the org.
 */
export async function getProperty(
  orgId: string,
  propertyId: string,
): Promise<PropertyRow | null> {
  const rows = await dbQuery<PropertyRow>(
    `SELECT id, org_id, name, address, city, state, zip, property_type,
            unit_count, notes, status, created_at, updated_at
     FROM coi_properties
     WHERE id = $1 AND org_id = $2`,
    [propertyId, orgId],
  );
  return rows[0] ?? null;
}

/**
 * Create a new property record.
 */
export async function createProperty(
  orgId: string,
  input: PropertyInput,
): Promise<PropertyRow> {
  const rows = await dbQuery<PropertyRow>(
    `INSERT INTO coi_properties
       (org_id, name, address, city, state, zip, property_type, unit_count, notes, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, org_id, name, address, city, state, zip, property_type,
               unit_count, notes, status, created_at, updated_at`,
    [
      orgId,
      input.name,
      input.address ?? null,
      input.city ?? null,
      input.state ?? null,
      input.zip ?? null,
      input.property_type ?? "managed",
      input.unit_count ?? null,
      input.notes ?? null,
      input.status ?? "active",
    ],
  );
  if (!rows[0]) throw new Error("Property insert returned no rows");
  return rows[0];
}

/**
 * Update an existing property. Only provided fields are changed.
 */
export async function updateProperty(
  orgId: string,
  propertyId: string,
  input: Partial<PropertyInput>,
): Promise<PropertyRow | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const fieldMap: Record<string, unknown> = {
    name: input.name,
    address: input.address,
    city: input.city,
    state: input.state,
    zip: input.zip,
    property_type: input.property_type,
    unit_count: input.unit_count,
    notes: input.notes,
    status: input.status,
  };

  for (const [col, val] of Object.entries(fieldMap)) {
    if (val !== undefined) {
      setClauses.push(`${col} = $${idx}`);
      params.push(val);
      idx++;
    }
  }

  if (setClauses.length === 0) return getProperty(orgId, propertyId);

  setClauses.push(`updated_at = now()`);
  params.push(propertyId, orgId);

  const rows = await dbQuery<PropertyRow>(
    `UPDATE coi_properties
     SET ${setClauses.join(", ")}
     WHERE id = $${idx} AND org_id = $${idx + 1}
     RETURNING id, org_id, name, address, city, state, zip, property_type,
               unit_count, notes, status, created_at, updated_at`,
    params,
  );
  return rows[0] ?? null;
}

/**
 * Soft-delete a property by setting status = 'archived'.
 */
export async function archiveProperty(
  orgId: string,
  propertyId: string,
): Promise<boolean> {
  const rows = await dbQuery<{ id: string }>(
    `UPDATE coi_properties
     SET status = 'archived', updated_at = now()
     WHERE id = $1 AND org_id = $2
     RETURNING id`,
    [propertyId, orgId],
  );
  return rows.length > 0;
}

export interface PropertyVendorAssignment {
  vendor_id: string;
  vendor_name: string;
  assigned_at: string;
}

/**
 * Fetch vendors assigned to a property.
 */
export async function listPropertyVendors(
  propertyId: string,
): Promise<PropertyVendorAssignment[]> {
  return dbQuery<PropertyVendorAssignment>(
    `SELECT vp.vendor_id, v.name AS vendor_name, vp.assigned_at
     FROM coi_vendor_properties vp
     JOIN coi_vendors v ON v.id = vp.vendor_id
     WHERE vp.property_id = $1
     ORDER BY v.name ASC`,
    [propertyId],
  );
}
