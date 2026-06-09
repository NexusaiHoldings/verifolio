import Link from "next/link";
import { getAllTemplates } from "@/lib/coi/compliance-scorer";
import type { ComplianceTemplate } from "@/lib/coi/rule-evaluator";

export const dynamic = "force-dynamic";

const PROPERTY_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  HOA: { bg: "#eff6ff", text: "#1d4ed8" },
  commercial_lease: { bg: "#f5f3ff", text: "#6d28d9" },
  residential: { bg: "#ecfdf5", text: "#065f46" },
  industrial: { bg: "#fff7ed", text: "#9a3412" },
  retail: { bg: "#fef9c3", text: "#854d0e" },
};

function propertyTypeColor(
  pt: string,
): { bg: string; text: string } {
  return (
    PROPERTY_TYPE_COLORS[pt] ?? { bg: "#f3f4f6", text: "#374151" }
  );
}

function TemplateCard({
  template,
}: {
  template: ComplianceTemplate;
}): React.JSX.Element {
  const color = propertyTypeColor(template.propertyType);
  const ruleCount = template.rules.length;
  return (
    <Link
      href={`/compliance/templates/${template.id}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: "1.25rem 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          transition: "border-color 0.15s",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>
              {template.name}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                background: color.bg,
                color: color.text,
                borderRadius: 4,
                padding: "2px 8px",
                whiteSpace: "nowrap",
              }}
            >
              {template.propertyType}
            </span>
          </div>
          {template.description && (
            <p
              style={{
                fontSize: 13,
                color: "#6b7280",
                margin: "4px 0 0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 480,
              }}
            >
              {template.description}
            </p>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>
            {ruleCount}
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>
            {ruleCount === 1 ? "rule" : "rules"}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default async function ComplianceTemplatesPage(): Promise<React.JSX.Element> {
  let templates: ComplianceTemplate[] = [];
  let fetchError: string | null = null;

  try {
    templates = await getAllTemplates();
  } catch (err) {
    fetchError =
      err instanceof Error ? err.message : "Failed to load templates";
  }

  return (
    <main
      style={{
        maxWidth: 860,
        margin: "0 auto",
        padding: "2rem 1rem",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>
          Compliance Templates
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
          Per-property insurance requirement rules evaluated against each
          certificate of insurance
        </p>
      </header>

      {fetchError && (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: "0.875rem 1rem",
            marginBottom: "1.5rem",
            color: "#b91c1c",
            fontSize: 14,
          }}
        >
          {fetchError}
        </div>
      )}

      {!fetchError && templates.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "3rem 2rem",
            background: "#f9fafb",
            borderRadius: 10,
            border: "1px dashed #d1d5db",
            color: "#6b7280",
          }}
        >
          <p style={{ fontSize: 16, fontWeight: 500, margin: "0 0 8px" }}>
            No compliance templates configured
          </p>
          <p style={{ fontSize: 13, margin: 0 }}>
            Templates define the minimum insurance coverage required for each
            property type (e.g. HOA vendors, commercial tenants).
          </p>
        </div>
      )}

      {templates.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}
    </main>
  );
}
