import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { JSX } from "react";
import { getSessionUser } from "@/lib/admin-auth";
import {
  getPropertyReport,
  generateCSVReport,
  formatComplianceStatus,
  REQUIRED_DISCLAIMERS,
} from "@/lib/coi/report-generator";
import type { ComplianceStatus, VendorComplianceRecord } from "@/lib/coi/dashboard-aggregator";

// ── Inline UI components ───────────────────────────────────────────────────

function DisclaimerBanner(): JSX.Element {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4 mb-6">
      <p className="text-sm font-semibold text-amber-800">Liability Disclaimer</p>
      <ul className="mt-2 space-y-1">
        {REQUIRED_DISCLAIMERS.map((disclaimer, idx) => (
          <li key={idx} className="text-xs text-amber-700 leading-relaxed">
            • {disclaimer}
          </li>
        ))}
      </ul>
    </div>
  );
}

const STATUS_CONFIG: Record<
  ComplianceStatus,
  { label: string; badge: string; dot: string }
> = {
  compliant: {
    label: "Compliant",
    badge: "bg-green-100 text-green-800 border-green-200",
    dot: "bg-green-500",
  },
  expiring_soon: {
    label: "Expiring Soon",
    badge: "bg-yellow-100 text-yellow-800 border-yellow-200",
    dot: "bg-yellow-500",
  },
  non_compliant: {
    label: "Non-Compliant",
    badge: "bg-red-100 text-red-800 border-red-200",
    dot: "bg-red-500",
  },
  missing: {
    label: "Missing",
    badge: "bg-gray-100 text-gray-600 border-gray-200",
    dot: "bg-gray-400",
  },
};

function StatusBadge({ status }: { status: ComplianceStatus }): JSX.Element {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.badge}`}
    >
      <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass: string;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
    </div>
  );
}

function VendorRow({ vendor }: { vendor: VendorComplianceRecord }): JSX.Element {
  const severityLabels = ["Low", "Medium", "High", "Critical"];
  const severityColors = [
    "text-green-600",
    "text-yellow-600",
    "text-orange-600",
    "text-red-700",
  ];
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 text-sm font-medium text-gray-900">
        {vendor.vendorName}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {vendor.coverageType ?? "—"}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {vendor.coverageLimit !== null
          ? `$${vendor.coverageLimit.toLocaleString()}`
          : "—"}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {vendor.requiredLimit !== null
          ? `$${vendor.requiredLimit.toLocaleString()}`
          : "—"}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {vendor.expirationDate
          ? new Date(vendor.expirationDate).toLocaleDateString()
          : "—"}
        {vendor.daysUntilExpiration !== null &&
          vendor.daysUntilExpiration >= 0 && (
            <span className="ml-1 text-xs text-gray-400">
              ({vendor.daysUntilExpiration}d)
            </span>
          )}
      </td>
      <td className="px-4 py-3">
        <span
          className={`text-sm font-medium ${severityColors[vendor.gapSeverity] ?? "text-gray-600"}`}
        >
          {severityLabels[vendor.gapSeverity] ?? "Unknown"}
        </span>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={vendor.status} />
      </td>
    </tr>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

interface ReportPageProps {
  params: { propertyId: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}

export default async function ReportPage({
  params,
  searchParams,
}: ReportPageProps): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) redirect("/api/auth/login");

  const { propertyId } = params;
  if (!propertyId || typeof propertyId !== "string") notFound();

  const report = await getPropertyReport(propertyId);

  // Build CSV download as base64 data URL (no route handler needed)
  const csvContent = generateCSVReport(report.vendors);
  const csvBase64 = Buffer.from(csvContent, "utf-8").toString("base64");
  const csvDataUrl = `data:text/csv;charset=utf-8;base64,${csvBase64}`;
  const csvFilename = `compliance-report-${propertyId}-${new Date().toISOString().slice(0, 10)}.csv`;

  const reportDateFormatted = new Date(report.reportDate).toLocaleString();

  return (
    <main className="min-h-screen bg-gray-50 print:bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 print:px-0 print:py-4">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between print:hidden">
          <div>
            <Link
              href="/dashboard"
              className="mb-2 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              Compliance Report
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {report.propertyName} — Generated {reportDateFormatted}
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href={csvDataUrl}
              download={csvFilename}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Download CSV
            </a>
            <button
              id="print-pdf-btn"
              className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
            >
              Print / Save PDF
            </button>
          </div>
        </div>

        {/* Print header (hidden on screen) */}
        <div className="hidden print:block print:mb-6">
          <h1 className="text-xl font-bold">
            COI Compliance Report — {report.propertyName}
          </h1>
          <p className="text-sm text-gray-500">Generated {reportDateFormatted}</p>
        </div>

        <DisclaimerBanner />

        {/* Summary stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Vendors" value={report.summaryStats.total} colorClass="text-gray-800" />
          <StatCard label="Compliant" value={report.summaryStats.compliant} colorClass="text-green-700" />
          <StatCard label="Expiring Soon" value={report.summaryStats.expiringSoon} colorClass="text-yellow-700" />
          <StatCard label="Non-Compliant / Missing" value={report.summaryStats.nonCompliant + report.summaryStats.missing} colorClass="text-red-700" />
        </div>

        {/* Vendor table */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-800">
            Vendor Compliance Details
          </h2>
          {report.vendors.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-gray-500">No vendor records found for this property.</p>
              <p className="mt-1 text-sm text-gray-400">
                Add vendors and upload Certificates of Insurance to begin tracking.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {[
                        "Vendor",
                        "Coverage Type",
                        "Coverage Limit",
                        "Required Limit",
                        "Expiration Date",
                        "Severity",
                        "Status",
                      ].map((col) => (
                        <th
                          key={col}
                          className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {report.vendors.map((vendor, idx) => (
                      <VendorRow key={`${vendor.vendorId}-${idx}`} vendor={vendor} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Status legend */}
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-2 text-sm font-semibold text-gray-700">Status Legend</p>
          <div className="flex flex-wrap gap-4">
            {(["compliant", "expiring_soon", "non_compliant", "missing"] as ComplianceStatus[]).map(
              (status) => (
                <div key={status} className="flex items-center gap-2">
                  <StatusBadge status={status} />
                  <span className="text-xs text-gray-500">
                    {status === "compliant" && "Certificate valid, not expiring within 30 days"}
                    {status === "expiring_soon" && "Expires within 30 days"}
                    {status === "non_compliant" && "Expired or insufficient coverage"}
                    {status === "missing" && "No certificate on file"}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
      </div>

      {/* Print stylesheet + PDF button handler */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              .print\\:hidden { display: none !important; }
              .print\\:block { display: block !important; }
              .print\\:bg-white { background-color: #fff !important; }
              .print\\:px-0 { padding-left: 0 !important; padding-right: 0 !important; }
              .print\\:py-4 { padding-top: 1rem !important; padding-bottom: 1rem !important; }
            }
          `,
        }}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              var btn = document.getElementById('print-pdf-btn');
              if (btn) btn.onclick = function() { window.print(); };
            })();
          `,
        }}
      />
    </main>
  );
}
