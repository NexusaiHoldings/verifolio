import { redirect } from "next/navigation";
import Link from "next/link";
import type { JSX } from "react";
import { getSessionUser } from "@/lib/admin-auth";
import {
  getDashboardData,
  type ComplianceStatus,
  type DashboardData,
  type SortField,
  type SortOrder,
} from "@/lib/coi/dashboard-aggregator";

// ── Inline UI components ───────────────────────────────────────────────────

function DisclaimerBanner(): JSX.Element {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4 mb-6">
      <p className="text-sm font-semibold text-amber-800">Liability Disclaimer</p>
      <p className="mt-1 text-xs text-amber-700 leading-relaxed">
        This dashboard is provided for informational purposes only and does not
        constitute legal advice. Certificate of Insurance data is sourced from
        submitted documents and may not reflect real-time policy status. Verify
        coverage directly with insurance carriers for any binding decisions.
        Expiration dates reflect certificate issue dates; actual policy terms may differ.
      </p>
    </div>
  );
}

const STATUS_CONFIG: Record<
  ComplianceStatus,
  { label: string; badge: string; dot: string; card: string; text: string }
> = {
  compliant: {
    label: "Compliant",
    badge: "bg-green-100 text-green-800 border-green-200",
    dot: "bg-green-500",
    card: "border-green-200 bg-green-50",
    text: "text-green-700",
  },
  expiring_soon: {
    label: "Expiring Soon",
    badge: "bg-yellow-100 text-yellow-800 border-yellow-200",
    dot: "bg-yellow-500",
    card: "border-yellow-200 bg-yellow-50",
    text: "text-yellow-700",
  },
  non_compliant: {
    label: "Non-Compliant",
    badge: "bg-red-100 text-red-800 border-red-200",
    dot: "bg-red-500",
    card: "border-red-200 bg-red-50",
    text: "text-red-700",
  },
  missing: {
    label: "Missing",
    badge: "bg-gray-100 text-gray-600 border-gray-200",
    dot: "bg-gray-400",
    card: "border-gray-200 bg-gray-50",
    text: "text-gray-600",
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

function SummaryCard({
  label,
  count,
  status,
}: {
  label: string;
  count: number;
  status: ComplianceStatus;
}): JSX.Element {
  const cfg = STATUS_CONFIG[status];
  return (
    <div className={`rounded-lg border p-4 ${cfg.card}`}>
      <p className={`text-3xl font-bold ${cfg.text}`}>{count}</p>
      <p className={`mt-1 text-sm font-medium ${cfg.text}`}>{label}</p>
    </div>
  );
}

function SeverityLabel({ severity }: { severity: number }): JSX.Element {
  const labels = ["Low", "Medium", "High", "Critical"];
  const colors = [
    "text-green-600",
    "text-yellow-600",
    "text-orange-600",
    "text-red-700",
  ];
  return (
    <span className={`text-sm font-medium ${colors[severity] ?? "text-gray-600"}`}>
      {labels[severity] ?? "Unknown"}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

interface DashboardPageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

const VALID_SORT_FIELDS: SortField[] = [
  "expiration_date",
  "gap_severity",
  "vendor_name",
  "property_name",
];

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) redirect("/api/auth/login");

  const rawSort =
    typeof searchParams?.sort === "string" ? searchParams.sort : "gap_severity";
  const rawOrder =
    typeof searchParams?.order === "string" ? searchParams.order : "desc";

  const sortField: SortField = VALID_SORT_FIELDS.includes(rawSort as SortField)
    ? (rawSort as SortField)
    : "gap_severity";
  const sortOrder: SortOrder = rawOrder === "asc" ? "asc" : "desc";

  const data: DashboardData = await getDashboardData({ sortField, sortOrder });

  function sortHref(field: SortField): string {
    const newOrder = sortField === field && sortOrder === "asc" ? "desc" : "asc";
    return `/dashboard?sort=${field}&order=${newOrder}`;
  }

  function sortArrow(field: SortField): string {
    if (sortField !== field) return "";
    return sortOrder === "asc" ? " ↑" : " ↓";
  }

  const TABLE_COLUMNS: Array<{ label: string; field: SortField | null }> = [
    { label: "Vendor", field: "vendor_name" },
    { label: "Property", field: "property_name" },
    { label: "Coverage Type", field: null },
    { label: "Expiration Date", field: "expiration_date" },
    { label: "Severity", field: "gap_severity" },
    { label: "Status", field: null },
  ];

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Compliance Status Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Certificate of Insurance tracking — all vendors and properties.
          </p>
        </header>

        <DisclaimerBanner />

        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCard label="Compliant" count={data.totalCompliant} status="compliant" />
          <SummaryCard label="Expiring Soon" count={data.totalExpiringSoon} status="expiring_soon" />
          <SummaryCard label="Non-Compliant" count={data.totalNonCompliant} status="non_compliant" />
          <SummaryCard label="Missing COI" count={data.totalMissing} status="missing" />
        </div>

        {data.properties.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-gray-800">
              Properties Overview
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.properties.map((prop) => (
                <Link
                  key={prop.propertyId}
                  href={`/reports/${prop.propertyId}`}
                  className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{prop.propertyName}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {prop.totalVendors} vendor{prop.totalVendors !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <StatusBadge status={prop.overallStatus} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {prop.compliantCount > 0 && (
                      <span className="text-green-700">{prop.compliantCount} compliant</span>
                    )}
                    {prop.expiringSoonCount > 0 && (
                      <span className="text-yellow-700">{prop.expiringSoonCount} expiring</span>
                    )}
                    {prop.nonCompliantCount > 0 && (
                      <span className="text-red-700">{prop.nonCompliantCount} non-compliant</span>
                    )}
                    {prop.missingCount > 0 && (
                      <span className="text-gray-500">{prop.missingCount} missing</span>
                    )}
                  </div>
                  {prop.nextExpirationDate && (
                    <p className="mt-2 text-xs text-gray-400">
                      Next expiry:{" "}
                      {new Date(prop.nextExpirationDate).toLocaleDateString()}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              Vendor Compliance Details
            </h2>
            <p className="text-xs text-gray-400">
              Updated {new Date(data.generatedAt).toLocaleString()}
            </p>
          </div>

          {data.vendors.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-gray-500">No vendor compliance data found.</p>
              <p className="mt-1 text-sm text-gray-400">
                Add vendors and upload certificates to begin tracking compliance.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {TABLE_COLUMNS.map(({ label, field }) => (
                        <th
                          key={label}
                          className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                        >
                          {field ? (
                            <Link
                              href={sortHref(field)}
                              className="hover:text-gray-700"
                            >
                              {label}{sortArrow(field)}
                            </Link>
                          ) : (
                            label
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {data.vendors.map((vendor, idx) => (
                      <tr
                        key={`${vendor.vendorId}-${idx}`}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {vendor.vendorName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <Link
                            href={`/reports/${vendor.propertyId}`}
                            className="hover:text-blue-600 hover:underline"
                          >
                            {vendor.propertyName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {vendor.coverageType ?? "—"}
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
                          <SeverityLabel severity={vendor.gapSeverity} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={vendor.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
