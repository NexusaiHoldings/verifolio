import type { Pool } from 'pg';

export type ComplianceStatus = 'compliant' | 'expiring_soon' | 'non_compliant' | 'missing';
export type GapSeverity = 'critical' | 'high' | 'medium' | 'low' | 'none';
export type SortField = 'expiration_date' | 'gap_severity' | 'vendor_name' | 'property_name' | 'status';
export type SortOrder = 'asc' | 'desc';

export interface VendorComplianceRecord {
  vendorId: string;
  vendorName: string;
  propertyId: string;
  propertyName: string;
  certificateType: string;
  status: ComplianceStatus;
  expirationDate: Date | null;
  coverageAmount: number | null;
  requiredCoverageAmount: number | null;
  daysUntilExpiration: number | null;
  gapSeverity: GapSeverity;
  policyNumber: string | null;
  insurer: string | null;
}

export interface ComplianceSummary {
  compliant: number;
  expiringSoon: number;
  nonCompliant: number;
  missing: number;
  total: number;
}

export interface DashboardData {
  summary: ComplianceSummary;
  records: VendorComplianceRecord[];
}

// Global pool reused across requests to avoid connection churn in serverless warm instances.
declare global {
  // eslint-disable-next-line no-var
  var _coiDashPool: Pool | undefined;
}

function getPool(): Pool {
  if (!globalThis._coiDashPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('[coi] DATABASE_URL environment variable is not set');
    // Runtime require (NOT a static `import { Pool } from 'pg'`) so Next's file
    // tracer includes pg in the serverless bundle — matches the proven
    // substrate db.ts / coi/vendors.ts pattern. The static import resolved at
    // build but threw "Cannot find module 'pg'" at runtime → server-component
    // render error → /dashboard 500 (post-deploy audit 2026-06-09).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Pool: PgPool } = require('pg') as { Pool: new (cfg: Record<string, unknown>) => Pool };
    globalThis._coiDashPool = new PgPool({ connectionString, max: 10, idleTimeoutMillis: 30000 });
  }
  return globalThis._coiDashPool;
}

function computeStatus(
  expirationDate: Date | null,
  coverageAmount: number | null,
  requiredAmount: number | null,
): ComplianceStatus {
  if (!expirationDate) return 'missing';
  const daysUntil = Math.floor((expirationDate.getTime() - Date.now()) / 86400000);
  if (daysUntil < 0) return 'non_compliant';
  if (daysUntil <= 30) return 'expiring_soon';
  if (requiredAmount !== null && coverageAmount !== null && coverageAmount < requiredAmount) {
    return 'non_compliant';
  }
  return 'compliant';
}

function computeGapSeverity(
  status: ComplianceStatus,
  coverageAmount: number | null,
  requiredAmount: number | null,
  daysUntil: number | null,
): GapSeverity {
  if (status === 'missing') return 'critical';
  if (status === 'non_compliant') {
    if (requiredAmount !== null && coverageAmount !== null && requiredAmount > 0) {
      const ratio = (requiredAmount - coverageAmount) / requiredAmount;
      if (ratio > 0.5) return 'critical';
      if (ratio > 0.2) return 'high';
      return 'medium';
    }
    if (daysUntil !== null && Math.abs(daysUntil) > 30) return 'critical';
    return 'high';
  }
  if (status === 'expiring_soon') {
    return daysUntil !== null && daysUntil <= 7 ? 'high' : 'medium';
  }
  return 'none';
}

const SEVERITY_RANK: Record<GapSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
const STATUS_RANK: Record<ComplianceStatus, number> = { non_compliant: 3, missing: 2, expiring_soon: 1, compliant: 0 };

type RawRow = {
  vendor_id: string;
  vendor_name: string;
  property_id: string;
  property_name: string;
  certificate_type: string;
  expiration_date: Date | null;
  coverage_amount: string | null;
  required_coverage_amount: string | null;
  policy_number: string | null;
  insurer: string | null;
};

export async function getDashboardData(
  sortField: SortField = 'gap_severity',
  sortOrder: SortOrder = 'desc',
): Promise<DashboardData> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query<RawRow>(`
      SELECT
        v.id            AS vendor_id,
        v.name          AS vendor_name,
        p.id            AS property_id,
        p.name          AS property_name,
        ct.certificate_type,
        c.expiration_date,
        c.coverage_amount::text           AS coverage_amount,
        ct.required_coverage_amount::text AS required_coverage_amount,
        c.policy_number,
        c.insurer
      FROM coi_vendors v
      JOIN coi_vendor_properties vp ON vp.vendor_id = v.id
      JOIN coi_properties p         ON p.id = vp.property_id
      JOIN coi_compliance_templates ct ON ct.property_id = p.id
      LEFT JOIN coi_certificates c
        ON  c.vendor_id        = v.id
        AND c.property_id      = p.id
        AND c.certificate_type = ct.certificate_type
        AND c.is_active        = true
      WHERE v.deleted_at IS NULL
        AND p.deleted_at IS NULL
      ORDER BY v.name, p.name
    `);

    const records: VendorComplianceRecord[] = result.rows.map((row) => {
      const coverageAmount = row.coverage_amount !== null ? parseFloat(row.coverage_amount) : null;
      const requiredAmount = row.required_coverage_amount !== null ? parseFloat(row.required_coverage_amount) : null;
      const daysUntilExpiration = row.expiration_date
        ? Math.floor((row.expiration_date.getTime() - Date.now()) / 86400000)
        : null;
      const status = computeStatus(row.expiration_date, coverageAmount, requiredAmount);
      const gapSeverity = computeGapSeverity(status, coverageAmount, requiredAmount, daysUntilExpiration);
      return {
        vendorId: row.vendor_id,
        vendorName: row.vendor_name,
        propertyId: row.property_id,
        propertyName: row.property_name,
        certificateType: row.certificate_type,
        status,
        expirationDate: row.expiration_date,
        coverageAmount,
        requiredCoverageAmount: requiredAmount,
        daysUntilExpiration,
        gapSeverity,
        policyNumber: row.policy_number,
        insurer: row.insurer,
      };
    });

    records.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'expiration_date': {
          const at = a.expirationDate ? a.expirationDate.getTime() : Infinity;
          const bt = b.expirationDate ? b.expirationDate.getTime() : Infinity;
          cmp = at - bt;
          break;
        }
        case 'gap_severity':
          cmp = SEVERITY_RANK[a.gapSeverity] - SEVERITY_RANK[b.gapSeverity];
          break;
        case 'vendor_name':
          cmp = a.vendorName.localeCompare(b.vendorName);
          break;
        case 'property_name':
          cmp = a.propertyName.localeCompare(b.propertyName);
          break;
        case 'status':
          cmp = STATUS_RANK[a.status] - STATUS_RANK[b.status];
          break;
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    const summary: ComplianceSummary = {
      compliant: records.filter((r) => r.status === 'compliant').length,
      expiringSoon: records.filter((r) => r.status === 'expiring_soon').length,
      nonCompliant: records.filter((r) => r.status === 'non_compliant').length,
      missing: records.filter((r) => r.status === 'missing').length,
      total: records.length,
    };

    return { summary, records };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[coi:dashboard-aggregator] query error:', msg);
    return {
      summary: { compliant: 0, expiringSoon: 0, nonCompliant: 0, missing: 0, total: 0 },
      records: [],
    };
  } finally {
    client.release();
  }
}
