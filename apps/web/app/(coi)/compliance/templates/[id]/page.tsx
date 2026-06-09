import type { JSX } from "react";
import { notFound } from "next/navigation";
import { fetchTemplate } from "@/lib/coi/compliance-scorer";
import type { ComplianceTemplate } from "@/lib/coi/compliance-scorer";
import type { CoverageRule } from "@/lib/coi/rule-evaluator";

export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: { readonly id: string };
}

function formatAmount(amount: number | null): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function RuleRow({ rule }: { readonly rule: CoverageRule }): JSX.Element {
  return (
    <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
      <td style={{ padding: "0.875rem 1rem", fontSize: 14, color: "#111", fontWeight: 500 }}>
        {rule.label}
      </td>
      <td style={{ padding: "0.875rem 1rem", fontSize: 13, color: "#6b7280" }}>
        {rule.coverage_type}
      </td>
      <td style={{ padding: "0.875rem 1rem", textAlign: "center" }}>
        <span
          style={{
            fontSize: 12,
            background: rule.is_required ? "#fef3c7" : "#f3f4f6",
            color: rule.is_required ? "#92400e" : "#6b7280",
            padding: "2px 10px",
            borderRadius: 9999,
            fontWeight: 500,
          }}
        >
          {rule.is_required ? "Required" : "Optional"}
        </span>
      </td>
      <td style={{ padding: "0.875rem 1rem", fontSize: 13, color: "#374151", textAlign: "right" }}>
        {formatAmount(rule.min_per_occurrence)}
      </td>
      <td style={{ padding: "0.875rem 1rem", fontSize: 13, color: "#374151", textAlign: "right" }}>
        {formatAmount(rule.min_aggregate)}
      </td>
    </tr>
  );
}

function RulesTable({ rules }: { readonly rules: CoverageRule[] }): JSX.Element {
  if (rules.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "2.5rem",
          color: "#9ca3af",
          fontSize: 14,
          background: "#fafafa",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
        }}
      >
        No rules defined for this template.
      </div>
    );
  }
  return (
    <div
      style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
            {(
              ["Coverage", "Type", "Required", "Min/Occurrence", "Min Aggregate"] as const
            ).map((heading, idx) => (
              <th
                key={heading}
                style={{
                  padding: "0.75rem 1rem",
                  textAlign: idx >= 3 ? "right" : idx === 2 ? "center" : "left",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  whiteSpace: "nowrap",
                }}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <RuleRow key={rule.id} rule={rule} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScoringExplainer(): JSX.Element {
  const statuses: Array<{ label: string; color: string; bg: string; desc: string }> = [
    { label: "Pass", color: "#065f46", bg: "#d1fae5", desc: "All required coverages meet minimum thresholds" },
    { label: "Gap", color: "#92400e", bg: "#fef3c7", desc: "Optional coverage absent or below threshold" },
    { label: "Fail", color: "#991b1b", bg: "#fee2e2", desc: "Required coverage missing or below minimum" },
  ];
  return (
    <section style={{ marginTop: "2.5rem" }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 0.75rem", color: "#111" }}>
        How Compliance Scoring Works
      </h2>
      <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7, margin: "0 0 1rem" }}>
        The scoring worker evaluates each extracted COI against the rules above and assigns a
        per-coverage status. Rules are human-configured to avoid the insurance advisory liability
        boundary — the system reports facts, not recommendations.
      </p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        {statuses.map((s) => (
          <div
            key={s.label}
            style={{
              flex: "1 1 180px",
              background: s.bg,
              borderRadius: 8,
              padding: "0.875rem 1rem",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: s.color, marginBottom: 4 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 12, color: s.color, opacity: 0.85, lineHeight: 1.5 }}>
              {s.desc}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function ComplianceTemplateDetailPage({
  params,
}: PageProps): Promise<JSX.Element> {
  let template: ComplianceTemplate | null = null;
  let fetchError: string | null = null;

  try {
    template = await fetchTemplate(params.id);
  } catch (err) {
    fetchError = String(err);
  }

  if (!fetchError && !template) {
    notFound();
  }

  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "2rem 1.5rem",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        color: "#111",
      }}
    >
      <div style={{ marginBottom: "1.5rem" }}>
        <a
          href="/compliance/templates"
          style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}
        >
          ← Compliance Templates
        </a>
      </div>

      {fetchError && (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
            color: "#b91c1c",
            fontSize: 14,
          }}
        >
          Failed to load template: {fetchError}
        </div>
      )}

      {template && (
        <>
          <div style={{ marginBottom: "2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#111" }}>
                {template.name}
              </h1>
              <span
                style={{
                  fontSize: 12,
                  background: "#f3f4f6",
                  color: "#374151",
                  padding: "3px 10px",
                  borderRadius: 9999,
                  fontWeight: 500,
                }}
              >
                {template.property_type}
              </span>
            </div>
            {template.description && (
              <p style={{ marginTop: 10, color: "#6b7280", fontSize: 14, lineHeight: 1.6 }}>
                {template.description}
              </p>
            )}
          </div>

          <section>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 1rem", color: "#111" }}>
              Coverage Rules ({template.rules.length})
            </h2>
            <RulesTable rules={template.rules} />
          </section>

          <ScoringExplainer />
        </>
      )}
    </main>
  );
}
