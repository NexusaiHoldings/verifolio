/**
 * COI Compliance Dashboard Aggregator
 *
 * Queries vendor certificates and compliance requirements to produce
 * traffic-light status indicators (compliant / expiring_soon / non_compliant / missing)
 * per vendor/property combination, sortable by expiration date and gap severity.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pool: any = null;

interface DbPool {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

function getPool(): DbPool {
  if (_pool) return _pool as DbPool;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool } = require("pg") as {
    Pool: new (cfg: {
      connectionString: string | undefined;
      max: number;
      idleTimeoutMillis: number;
    }) => DbPool;
  };
  _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  return _pool as DbPool;
}

export type ComplianceStatus = "compliant" | "expiring_soon" | "non_compliant" | "missing";
export type SortField = "expiration_date" | "gap_severity" | "vendor_name" | "property_name";
export type SortOrder = "asc" | "desc";

export interface VendorComplianceRecord {
  vendorId: string;
  vendorName: string;
  propertyId: string;
  propertyName: string;
  certificateId: string | null;
  coverageType: string | null;
  expirationDate: string | null;
  coverageLimit: number | null;
  requiredLimit: number | null;
  status: ComplianceStatus;
  gapSeverity: number;
  daysUntilExpiration: number | null;
}

export interface PropertyComplianceSummary {
  propertyId: string;
  propertyName: string;
  totalVendors: number;
  compliantCount: number;
  expiringSoonCount: number;
  nonCompliantCount: number;
  missingCount: number;
  overallStatus: ComplianceStatus;
  nextExpirationDate: string | null;
}

export interface DashboardData {
  properties: PropertyComplianceSummary[];
  vendors: VendorComplianceRecord[];
  totalCompliant: number;
  totalExpiringSoon: number;
  totalNonCompliant: number;
  totalMissing: number;
  generatedAt: string;
}

function severityForStatus(status: ComplianceStatus): number {
  const map: Record<ComplianceStatus, number> = {
    non_compliant: 3,
    missing: 2,
    expiring_soon: 1,
    compliant: 0,
  };
  return map[status];
}

function computeStatus(
  expirationDate: string | null,
  coverageLimit: number | null,
  requiredLimit: number | null,
): ComplianceStatus {
  if (!expirationDate) return "missing";
  const daysLeft = Math.floor(
    (new Date(expirationDate).getTime() - Date.now()) / 86_400_000,
  );
  if (daysLeft < 0) return "non_compliant";
  if (requiredLimit !== null && coverageLimit !== null && coverageLimit < requiredLimit) {
    return "non_compliant";
  }
  if (daysLeft <= 30) return "expiring_soon";
  return "compliant";
}

function daysUntil(expirationDate: string | null): number | null {
  if (!expirationDate) return null;
  return Math.floor(
    (new Date(expirationDate).getTime() - Date.now()) / 86_400_000,
  );
}

function sortVendorRecords(
  records: VendorComplianceRecord[],
  field: SortField,
  order: SortOrder,
): VendorComplianceRecord[] {
  return [...records].sort((a, b) => {
    let cmp = 0;
    if (field === "expiration_date") {
      const aMs = a.expirationDate
        ? new Date(a.expirationDate).getTime()
        : order === "asc"
          ? Infinity
          : -Infinity;
      const bMs = b.expirationDate
        ? new Date(b.expirationDate).getTime()
        : order === "asc"
          ? Infinity
          : -Infinity;
      cmp = aMs - bMs;
    } else if (field === "gap_severity") {
      cmp = a.gapSeverity - b.gapSeverity;
    } else if (field === "vendor_name") {
      cmp = a.vendorName.localeCompare(b.vendorName);
    } else {
      cmp = a.propertyName.localeCompare(b.propertyName);
    }
    return order === "asc" ? cmp : -cmp;
  });
}

export async function getVendorComplianceRecords(params: {
  propertyId?: string;
  sortField?: SortField;
  sortOrder?: SortOrder;
}): Promise<VendorComplianceRecord[]> {
  const { propertyId, sortField = "gap_severity", sortOrder = "desc" } = params;
  const pool = getPool();
  const qParams: unknown[] = [];
  let whereSql = "";
  if (propertyId) {
    qParams.push(propertyId);
    whereSql = `WHERE p.id = $${qParams.length}`;
  }
  const sql = `
    SELECT
      v.id            AS vendor_id,
      v.name          AS vendor_name,
      p.id            AS property_id,
      p.name          AS property_name,
      c.id            AS certificate_id,
      c.coverage_type AS coverage_type,
      c.expiration_date::text AS expiration_date,
      c.coverage_limit,
      cr.required_limit
    FROM coi_vendors v
    JOIN coi_properties p ON p.id = v.property_id
    LEFT JOIN coi_certificates c
      ON c.vendor_id = v.id AND c.is_active = true
    LEFT JOIN coi_compliance_requirements cr
      ON cr.property_id = p.id
      AND (cr.coverage_type = c.coverage_type OR c.coverage_type IS NULL)
    ${whereSql}
    ORDER BY v.name ASC
  `;
  try {
    const result = await pool.query(sql, qParams.length > 0 ? qParams : undefined);
    const records: VendorComplianceRecord[] = result.rows.map((row) => {
      const expDate = row.expiration_date ? String(row.expiration_date) : null;
      const covLimit = row.coverage_limit != null ? Number(row.coverage_limit) : null;
      const reqLimit = row.required_limit != null ? Number(row.required_limit) : null;
      const status = computeStatus(expDate, covLimit, reqLimit);
      return {
        vendorId: String(row.vendor_id),
        vendorName: String(row.vendor_name),
        propertyId: String(row.property_id),
        propertyName: String(row.property_name),
        certificateId: row.certificate_id ? String(row.certificate_id) : null,
        coverageType: row.coverage_type ? String(row.coverage_type) : null,
        expirationDate: expDate,
        coverageLimit: covLimit,
        requiredLimit: reqLimit,
        status,
        gapSeverity: severityForStatus(status),
        daysUntilExpiration: daysUntil(expDate),
      };
    });
    return sortVendorRecords(records, sortField, sortOrder);
  } catch {
    return [];
  }
}

export async function getPropertyComplianceSummaries(): Promise<PropertyComplianceSummary[]> {
  const records = await getVendorComplianceRecords({});
  const byProperty = new Map<string, { name: string; records: VendorComplianceRecord[] }>();
  for (const rec of records) {
    const entry = byProperty.get(rec.propertyId) ?? { name: rec.propertyName, records: [] };
    entry.records.push(rec);
    byProperty.set(rec.propertyId, entry);
  }
  const summaries: PropertyComplianceSummary[] = [];
  for (const [pid, { name, records: recs }] of byProperty) {
    const counts = { compliant: 0, expiring_soon: 0, non_compliant: 0, missing: 0 };
    let nextExpiry: string | null = null;
    for (const rec of recs) {
      counts[rec.status]++;
      if (rec.expirationDate) {
        if (!nextExpiry || new Date(rec.expirationDate) < new Date(nextExpiry)) {
          nextExpiry = rec.expirationDate;
        }
      }
    }
    const overallStatus: ComplianceStatus =
      counts.non_compliant > 0
        ? "non_compliant"
        : counts.missing > 0
          ? "missing"
          : counts.expiring_soon > 0
            ? "expiring_soon"
            : "compliant";
    summaries.push({
      propertyId: pid,
      propertyName: name,
      totalVendors: recs.length,
      compliantCount: counts.compliant,
      expiringSoonCount: counts.expiring_soon,
      nonCompliantCount: counts.non_compliant,
      missingCount: counts.missing,
      overallStatus,
      nextExpirationDate: nextExpiry,
    });
  }
  return summaries;
}

export async function getDashboardData(
  params: { sortField?: SortField; sortOrder?: SortOrder } = {},
): Promise<DashboardData> {
  const [vendors, properties] = await Promise.all([
    getVendorComplianceRecords(params),
    getPropertyComplianceSummaries(),
  ]);
  let totalCompliant = 0;
  let totalExpiringSoon = 0;
  let totalNonCompliant = 0;
  let totalMissing = 0;
  for (const v of vendors) {
    if (v.status === "compliant") totalCompliant++;
    else if (v.status === "expiring_soon") totalExpiringSoon++;
    else if (v.status === "non_compliant") totalNonCompliant++;
    else totalMissing++;
  }
  return {
    properties,
    vendors,
    totalCompliant,
    totalExpiringSoon,
    totalNonCompliant,
    totalMissing,
    generatedAt: new Date().toISOString(),
  };
}
