import type { Pool } from 'pg';
import { getDashboardData } from './dashboard-aggregator';
import type { VendorComplianceRecord, ComplianceSummary } from './dashboard-aggregator';

export interface PropertyReport {
  propertyId: string;
  propertyName: string;
  propertyAddress: string | null;
  generatedAt: Date;
  summary: ComplianceSummary;
  records: VendorComplianceRecord[];
  disclaimers: string[];
}

// Required disclaimers per liability_assessor specification.
export const REQUIRED_DISCLAIMERS: readonly string[] = [
  'This report is generated for informational purposes only and does not constitute legal advice.',
  'Certificate of Insurance data reflects the state as of the report generation date and requires independent verification.',
  'Compliance determinations are based on coverage amounts and expiration dates as reported by insurers and may not reflect policy amendments.',
  'This report does not substitute for professional legal or insurance counsel. Consult qualified advisors before acting on any finding.',
  'Coverage gaps identified herein represent potential liability exposure and must be remediated promptly to maintain contractual compliance.',
];

// Separate pool for report-generator to avoid contention with dashboard queries.
declare global {
  // eslint-disable-next-line no-var
  var _coiReportPool: Pool | undefined;
}

function getPool(): Pool {
  if (!globalThis._coiReportPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('[coi] DATABASE_URL environment variable is not set');
    // Runtime require (not static import) so pg is traced into the bundle — see
    // dashboard-aggregator.ts. Static `import { Pool } from 'pg'` → runtime
    // "Cannot find module 'pg'" → 500.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Pool: PgPool } = require('pg') as { Pool: new (cfg: Record<string, unknown>) => Pool };
    globalThis._coiReportPool = new PgPool({ connectionString, max: 5, idleTimeoutMillis: 30000 });
  }
  return globalThis._coiReportPool;
}

export async function getPropertyReport(propertyId: string): Promise<PropertyReport | null> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const propResult = await client.query<{ id: string; name: string; address: string | null }>(
      'SELECT id, name, address FROM coi_properties WHERE id = $1 AND deleted_at IS NULL',
      [propertyId],
    );
    if (propResult.rows.length === 0) return null;

    const property = propResult.rows[0];
    const allData = await getDashboardData('gap_severity', 'desc');
    const records = allData.records.filter((rec) => rec.propertyId === propertyId);

    const summary: ComplianceSummary = {
      compliant: records.filter((rec) => rec.status === 'compliant').length,
      expiringSoon: records.filter((rec) => rec.status === 'expiring_soon').length,
      nonCompliant: records.filter((rec) => rec.status === 'non_compliant').length,
      missing: records.filter((rec) => rec.status === 'missing').length,
      total: records.length,
    };

    return {
      propertyId: property.id,
      propertyName: property.name,
      propertyAddress: property.address,
      generatedAt: new Date(),
      summary,
      records,
      disclaimers: [...REQUIRED_DISCLAIMERS],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[coi:report-generator] query error:', msg);
    return null;
  } finally {
    client.release();
  }
}

function escapeCsv(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = value instanceof Date ? value.toISOString().split('T')[0] : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCsvReport(report: PropertyReport): string {
  const header = [
    'Vendor', 'Certificate Type', 'Status', 'Expiration Date',
    'Days Until Expiration', 'Coverage Amount', 'Required Coverage',
    'Gap Severity', 'Policy Number', 'Insurer',
  ].join(',');

  const rows = report.records.map((rec) =>
    [
      escapeCsv(rec.vendorName),
      escapeCsv(rec.certificateType),
      escapeCsv(rec.status.replace(/_/g, ' ')),
      escapeCsv(rec.expirationDate),
      escapeCsv(rec.daysUntilExpiration),
      escapeCsv(rec.coverageAmount),
      escapeCsv(rec.requiredCoverageAmount),
      escapeCsv(rec.gapSeverity),
      escapeCsv(rec.policyNumber),
      escapeCsv(rec.insurer),
    ].join(','),
  );

  return [
    `# COI Compliance Report: ${report.propertyName}`,
    `# Generated: ${report.generatedAt.toISOString()}`,
    `# Disclaimer: ${REQUIRED_DISCLAIMERS[0]}`,
    '',
    header,
    ...rows,
    '',
    `# Summary — Compliant=${report.summary.compliant} ExpiringSoon=${report.summary.expiringSoon} NonCompliant=${report.summary.nonCompliant} Missing=${report.summary.missing} Total=${report.summary.total}`,
  ].join('\n');
}
