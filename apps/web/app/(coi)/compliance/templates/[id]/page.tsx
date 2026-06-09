import Link from "next/link";
import { notFound } from "next/navigation";
import { getTemplateById } from "@/lib/coi/compliance-scorer";
import type { CoverageRule } from "@/lib/coi/rule-evaluator";

export const dynamic = "force-dynamic";

const COVERAGE_LABELS: Record<string, string> = {
  CGL: "Commercial General Liability",
  workers_comp: "Workers' Compensation",
  umbrella: "Umbrella / Excess Liability",
  auto: "Commercial Auto",
  professional_liability: "Professional Liability (E&O)",
  cyber: "Cyber Liability",
  pollution: "Pollution Liability",
  builders_risk: "Builder's Risk",
  inland_marine: "Inland Marine",
};

function formatLimit(amount: number | null): string {
  if (amount === null) return "—";
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${amount.toLocaleString()}`;
}

function RuleCard({ rule }: { rule: CoverageRule }): React.JSX.Element {
  const label = COVERAGE_LABELS[rule.coverageType] ?? rule.coverageType;
  const hasLimits =
    rule.minOccurrenceLimit !== null || rule.minAggregateLimit !== null;
  const hasEndorsements =
    rule.additionalInsuredRequired || rule.waiverOfSubrogationRequired;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: "1rem 1.25rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: hasLimits || hasEndorsements ? 12 : 0,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 15, color: "#111827" }}>
          {label}
        </span>
        {rule.required && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              background: "#fef3c7",
              color: "#92400e",
              borderRadius: 4,
              padding: "1px 7px",
            }}
          >
            Required
          </span>
        )}
        {!rule.required && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              background: "#f3f4f6",
              color: "#6b7280",
              borderRadius: 4,
              padding: "1px 7px",
            }}
          >
            Optional
          </span>
        )}
      </div>

      {(hasLimits || hasEndorsements) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {rule.minOccurrenceLimit !== null && (
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>
                Per Occurrence Min
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                {formatLimit(rule.minOccurrenceLimit)}
              </div>
            </div>
          )}
          {rule.minAggregateLimit !== null && (
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>
                Aggregate Min
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                {formatLimit(rule.minAggregateLimit)}
              </div>
            </div>
          )}
          {rule.additionalInsuredRequired && (
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>
                Additional Insured
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#059669" }}>
                ✓ Required
              </div>
            </div>
          )}
          {rule.waiverOfSubrogationRequired && (
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>
                Waiver of Subrogation
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#059669" }}>
                ✓ Required
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ComplianceTemplatePage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  let template = null;
  try {
    template = await getTemplateById(id);
  } catch {
    // DB unavailable — fall through to notFound
  }

  if (!template) {
    notFound();
  }

  return (
    <main
      style={{
        maxWidth: 800,
        margin: "0 auto",
        padding: "2rem 1rem",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <div style={{ marginBottom: "1.5rem" }}>
        <Link
          href="/compliance/templates"
          style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}
        >
          ← Compliance Templates
        </Link>
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              margin: "0 0 6px",
              color: "#111827",
            }}
          >
            {template.name}
          </h1>
          <span
            style={{
              display: "inline-block",
              fontSize: 12,
              fontWeight: 600,
              background: "#eff6ff",
              color: "#1d4ed8",
              borderRadius: 4,
              padding: "2px 8px",
            }}
          >
            {template.propertyType}
          </span>
        </div>
        {template.description && (
          <p style={{ fontSize: 14, color: "#6b7280", margin: "8px 0 0" }}>
            {template.description}
          </p>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "#111827" }}>
          Coverage Requirements
          <span
            style={{
              fontSize: 13,
              fontWeight: 400,
              color: "#9ca3af",
              marginLeft: 8,
            }}
          >
            ({template.rules.length})
          </span>
        </h2>
      </div>

      {template.rules.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "2.5rem",
            background: "#f9fafb",
            borderRadius: 8,
            border: "1px dashed #d1d5db",
            color: "#6b7280",
            fontSize: 14,
          }}
        >
          No coverage rules configured for this template.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {template.rules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} />
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: "2rem",
          padding: "1rem 1.25rem",
          background: "#f9fafb",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
        }}
      >
        <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
          These rules are evaluated by the compliance scoring worker against
          each certificate of insurance extraction. Results are stored as
          pass / fail / gap per coverage line and feed the compliance dashboard
          and reminder workflows.
        </p>
      </div>
    </main>
  );
}
