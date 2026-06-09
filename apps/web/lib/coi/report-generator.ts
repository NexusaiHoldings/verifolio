/**
 * COI Report Generator
 *
 * Generates CSV reports and structured property report data for property owners
 * and board members. Per ceo_briefing key_features: exportable compliance reports.
 * All report outputs include liability_assessor required_disclaimers.
 */

import type {
  ComplianceStatus,
  VendorComplianceRecord,
} from "./dashboard-aggregator";
import { getVendorComplianceRecords } from "./dashboard-aggregator";

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

export const REQUIRED_DISCLAIMERS: readonly string[] = [
  "This compliance report is provided for informational purposes only and does not constitute legal advice.",
  "Certificate of Insurance data is sourced from submitted documents and may not reflect real-time policy status.",
  "Property owners and managers should verify coverage directly with insurance carriers for binding decisions.",
  "Expiration dates reflect the certificate issue date; actual policy terms may differ.",
  "This report does not guarantee that referenced policies are in force or that claims will be covered.",
];

export interface PropertyReport {
  propertyId: string;
  propertyName: string;
  reportDate: string;
  vendors: VendorComplianceRecord[];
  summaryStats: {
    total: number;
    compliant: number;
    expiringSoon: number;
    nonCompliant: number;
    missing: number;
  };
  requiredDisclaimers: readonly string[];
}

export function formatComplianceStatus(status: ComplianceStatus): string {
  const labels: Record<ComplianceStatus, string> = {
    compliant: "Compliant",
    expiring_soon: "Expiring Soon",
    non_compliant: "Non-Compliant",
    missing: "Missing",
  };
  return labels[status];
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function generateCSVReport(records: VendorComplianceRecord[]): string {
  const headers = [
    "Vendor ID",
    "Vendor Name",
    "Property ID",
    "Property Name",
    "Certificate ID",
    "Coverage Type",
    "Expiration Date",
    "Coverage Limit ($)",
    "Required Limit ($)",
    "Status",
    "Days Until Expiration",
  ];

  const disclaimerLine =
    "# DISCLAIMER: " + REQUIRED_DISCLAIMERS[0];

  const headerRow = headers.map(escapeCsvField).join(",");

  const dataRows = records.map((rec) =>
    [
      escapeCsvField(rec.vendorId),
      escapeCsvField(rec.vendorName),
      escapeCsvField(rec.propertyId),
      escapeCsvField(rec.propertyName),
      escapeCsvField(rec.certificateId ?? ""),
      escapeCsvField(rec.coverageType ?? ""),
      escapeCsvField(rec.expirationDate ?? ""),
      escapeCsvField(rec.coverageLimit !== null ? String(rec.coverageLimit) : ""),
      escapeCsvField(rec.requiredLimit !== null ? String(rec.requiredLimit) : ""),
      escapeCsvField(formatComplianceStatus(rec.status)),
      escapeCsvField(rec.daysUntilExpiration !== null ? String(rec.daysUntilExpiration) : ""),
    ].join(","),
  );

  return [disclaimerLine, headerRow, ...dataRows].join("\n");
}

export async function getPropertyReport(propertyId: string): Promise<PropertyReport> {
  const pool = getPool();

  let propertyName = "Unknown Property";
  try {
    const res = await pool.query(
      "SELECT name FROM coi_properties WHERE id = $1 LIMIT 1",
      [propertyId],
    );
    if (res.rows.length > 0 && res.rows[0].name) {
      propertyName = String(res.rows[0].name);
    }
  } catch {
    // Table may not be provisioned yet; continue with default name
  }

  const vendors = await getVendorComplianceRecords({
    propertyId,
    sortField: "gap_severity",
    sortOrder: "desc",
  });

  const summaryStats = { total: vendors.length, compliant: 0, expiringSoon: 0, nonCompliant: 0, missing: 0 };
  for (const v of vendors) {
    if (v.status === "compliant") summaryStats.compliant++;
    else if (v.status === "expiring_soon") summaryStats.expiringSoon++;
    else if (v.status === "non_compliant") summaryStats.nonCompliant++;
    else summaryStats.missing++;
  }

  return {
    propertyId,
    propertyName,
    reportDate: new Date().toISOString(),
    vendors,
    summaryStats,
    requiredDisclaimers: REQUIRED_DISCLAIMERS,
  };
}
