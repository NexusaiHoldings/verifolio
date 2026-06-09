/**
 * COI vendor data layer — raw SQL via pg pool (no ORM).
 *
 * All IDs are UUIDs. Parameterized queries only ($1, $2, …).
 */

// ── Row types ─────────────────────────────────────────────────────────────────

export interface VendorRow {
  id: string;
  org_id: string;
  name: string;
  trade: string | null;
  license_number: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface VendorFilters {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface VendorInput {
  name: string;
  trade?: string;
  license_number?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  notes?: string;
  status?: string;
}

// ── pg pool (same pattern as apps/web/lib/db.ts) ─────────────────────────────

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
 * List vendors for an org, with optional full-text search and status filter.
 */
export async function listVendors(
  orgId: string,
  filters: VendorFilters = {},
): Promise<VendorRow[]> {
  const { search, status, limit = 100, offset = 0 } = filters;
  const conditions: string[] = ["org_id = $1"];
  const params: unknown[] = [orgId];
  let idx = 2;

  if (search && search.trim().length > 0) {
    conditions.push(
      `(name ILIKE $${idx} OR trade ILIKE $${idx} OR contact_email ILIKE $${idx})`,
    );
    params.push(`%${search.trim()}%`);
    idx++;
  }

  if (status && status.trim().length > 0) {
    conditions.push(`status = $${idx}`);
    params.push(status.trim());
    idx++;
  }

  params.push(limit, offset);

  const sql = `
    SELECT id, org_id, name, trade, license_number, contact_email, contact_phone,
           address, notes, status, created_at, updated_at
    FROM coi_vendors
    WHERE ${conditions.join(" AND ")}
    ORDER BY name ASC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;

  return dbQuery<VendorRow>(sql, params);
}

/**
 * Fetch a single vendor by id, scoped to the org.
 */
export async function getVendor(
  orgId: string,
  vendorId: string,
): Promise<VendorRow | null> {
  const rows = await dbQuery<VendorRow>(
    `SELECT id, org_id, name, trade, license_number, contact_email, contact_phone,
            address, notes, status, created_at, updated_at
     FROM coi_vendors
     WHERE id = $1 AND org_id = $2`,
    [vendorId, orgId],
  );
  return rows[0] ?? null;
}

/**
 * Create a new vendor record.
 */
export async function createVendor(
  orgId: string,
  input: VendorInput,
): Promise<VendorRow> {
  const rows = await dbQuery<VendorRow>(
    `INSERT INTO coi_vendors
       (org_id, name, trade, license_number, contact_email, contact_phone, address, notes, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, org_id, name, trade, license_number, contact_email, contact_phone,
               address, notes, status, created_at, updated_at`,
    [
      orgId,
      input.name,
      input.trade ?? null,
      input.license_number ?? null,
      input.contact_email ?? null,
      input.contact_phone ?? null,
      input.address ?? null,
      input.notes ?? null,
      input.status ?? "active",
    ],
  );
  if (!rows[0]) throw new Error("Vendor insert returned no rows");
  return rows[0];
}

/**
 * Update an existing vendor. Only provided fields are changed.
 */
export async function updateVendor(
  orgId: string,
  vendorId: string,
  input: Partial<VendorInput>,
): Promise<VendorRow | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const fieldMap: Record<string, unknown> = {
    name: input.name,
    trade: input.trade,
    license_number: input.license_number,
    contact_email: input.contact_email,
    contact_phone: input.contact_phone,
    address: input.address,
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

  if (setClauses.length === 0) return getVendor(orgId, vendorId);

  setClauses.push(`updated_at = now()`);
  params.push(vendorId, orgId);

  const rows = await dbQuery<VendorRow>(
    `UPDATE coi_vendors
     SET ${setClauses.join(", ")}
     WHERE id = $${idx} AND org_id = $${idx + 1}
     RETURNING id, org_id, name, trade, license_number, contact_email, contact_phone,
               address, notes, status, created_at, updated_at`,
    params,
  );
  return rows[0] ?? null;
}

/**
 * Soft-delete a vendor by setting status = 'archived'.
 */
export async function archiveVendor(
  orgId: string,
  vendorId: string,
): Promise<boolean> {
  const rows = await dbQuery<{ id: string }>(
    `UPDATE coi_vendors
     SET status = 'archived', updated_at = now()
     WHERE id = $1 AND org_id = $2
     RETURNING id`,
    [vendorId, orgId],
  );
  return rows.length > 0;
}

export interface VendorPropertyAssignment {
  property_id: string;
  property_name: string;
  assigned_at: string;
}

/**
 * Fetch properties assigned to a vendor.
 */
export async function listVendorProperties(
  vendorId: string,
): Promise<VendorPropertyAssignment[]> {
  return dbQuery<VendorPropertyAssignment>(
    `SELECT vp.property_id, p.name AS property_name, vp.assigned_at
     FROM coi_vendor_properties vp
     JOIN coi_properties p ON p.id = vp.property_id
     WHERE vp.vendor_id = $1
     ORDER BY p.name ASC`,
    [vendorId],
  );
}
