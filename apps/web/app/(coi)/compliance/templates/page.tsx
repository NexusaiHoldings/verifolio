import type { JSX } from "react";
import { listTemplates } from "@/lib/coi/compliance-scorer";
import type { ComplianceTemplateSummary } from "@/lib/coi/compliance-scorer";

export const dynamic = "force-dynamic";

function TemplateCard({ template }: { readonly template: ComplianceTemplateSummary }): JSX.Element {
  return (
    <a
      href={`/compliance/templates/${template.id}`}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: "1.25rem 1.5rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#111" }}>{template.name}</div>
          {template.description && (
            <div style={{ marginTop: 4, fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
              {template.description}
            </div>
          )}
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 12,
                background: "#f3f4f6",
                color: "#374151",
                padding: "2px 10px",
                borderRadius: 9999,
                fontWeight: 500,
              }}
            >
              {template.property_type}
            </span>
            <span
              style={{
                fontSize: 12,
                background: "#eff6ff",
                color: "#1d4ed8",
                padding: "2px 10px",
                borderRadius: 9999,
                fontWeight: 500,
              }}
            >
              {template.rule_count} {template.rule_count === 1 ? "rule" : "rules"}
            </span>
          </div>
        </div>
        <div style={{ fontSize: 20, color: "#d1d5db", marginLeft: 12, flexShrink: 0 }}>›</div>
      </div>
    </a>
  );
}

export default async function ComplianceTemplatesPage(): Promise<JSX.Element> {
  let templates: ComplianceTemplateSummary[] = [];
  let fetchError: string | null = null;

  try {
    templates = await listTemplates();
  } catch (err) {
    fetchError = String(err);
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
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "#111" }}>
          Compliance Templates
        </h1>
        <p style={{ marginTop: 8, color: "#6b7280", fontSize: 14, lineHeight: 1.6, maxWidth: 600 }}>
          Configure per-property compliance requirements. Each template defines the minimum coverage
          thresholds vendors must carry on their certificates of insurance.
        </p>
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
          Failed to load templates: {fetchError}
        </div>
      )}

      {!fetchError && templates.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "3rem",
            color: "#9ca3af",
            fontSize: 14,
            background: "#fafafa",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
          }}
        >
          No compliance templates configured yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.875rem" }}>
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      )}
    </main>
  );
}
