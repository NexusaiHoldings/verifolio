/**
 * Certificate Review Page — human review queue for low-confidence extractions.
 *
 * Server component. Uses a native HTML <form> submitting to a server action
 * so no client component is required. Fields are rendered with the current
 * AI-extracted value pre-filled; reviewers overwrite and submit.
 */

import { notFound, redirect } from "next/navigation";
import type { JSX } from "react";
import {
  getCertificate,
  getLatestExtraction,
  type ExtractionRow,
} from "@/lib/coi/extract";
import { CONFIDENCE_THRESHOLD, acordFormLabel } from "@/lib/coi/acord-schema";
import type { AcordExtractionResult } from "@/lib/coi/acord-schema";
import { getServerSession } from "@nexus/identity-and-access";

// ── Server action ──────────────────────────────────────────────────────────────

async function submitReview(formData: FormData): Promise<void> {
  "use server";

  const { markExtractionReviewed } = await import("@/lib/coi/extract");
  const session = await getServerSession();

  if (!session?.user?.id) return;

  const extractionId = formData.get("extractionId") as string;
  if (!extractionId) return;

  const corrections: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "extractionId" || typeof value !== "string") continue;
    // Each field stores as a ConfidenceField with reviewer confidence = 1.0
    corrections[key] = { value, confidence: 1.0 };
  }

  await markExtractionReviewed(
    extractionId,
    session.user.id as string,
    corrections as Partial<AcordExtractionResult>,
  );

  const certificateId = formData.get("certificateId") as string;
  redirect(`/certificates/${certificateId}`);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

interface FieldEntry {
  path: string;
  label: string;
  currentValue: string;
  confidence: number;
}

function buildLowConfidenceEntries(data: AcordExtractionResult): FieldEntry[] {
  const entries: FieldEntry[] = [];

  function probe(
    path: string,
    label: string,
    field: { value: unknown; confidence: number } | null | undefined,
  ): void {
    if (!field) return;
    if (field.confidence < CONFIDENCE_THRESHOLD) {
      entries.push({
        path,
        label,
        currentValue:
          field.value !== null && field.value !== undefined ? String(field.value) : "",
        confidence: field.confidence,
      });
    }
  }

  probe("certificate_number", "Certificate Number", data.certificate_number);
  probe("date_issued", "Date Issued", data.date_issued);
  probe("named_insured.name", "Named Insured – Name", data.named_insured?.name);
  probe("named_insured.address", "Named Insured – Address", data.named_insured?.address);
  probe(
    "named_insured.city_state_zip",
    "Named Insured – City / State / ZIP",
    data.named_insured?.city_state_zip,
  );
  probe(
    "certificate_holder.name",
    "Certificate Holder – Name",
    data.certificate_holder?.name,
  );
  probe(
    "certificate_holder.address",
    "Certificate Holder – Address",
    data.certificate_holder?.address,
  );

  const gl = data.general_liability;
  if (gl) {
    probe("general_liability.policy_number", "GL – Policy Number", gl.policy_number);
    probe("general_liability.effective_date", "GL – Effective Date", gl.effective_date);
    probe("general_liability.expiration_date", "GL – Expiration Date", gl.expiration_date);
    probe(
      "general_liability.limits.each_occurrence",
      "GL – Each Occurrence Limit",
      gl.limits.each_occurrence,
    );
    probe(
      "general_liability.limits.general_aggregate",
      "GL – General Aggregate",
      gl.limits.general_aggregate,
    );
  }

  const al = data.automobile_liability;
  if (al) {
    probe("automobile_liability.policy_number", "Auto – Policy Number", al.policy_number);
    probe(
      "automobile_liability.effective_date",
      "Auto – Effective Date",
      al.effective_date,
    );
    probe(
      "automobile_liability.expiration_date",
      "Auto – Expiration Date",
      al.expiration_date,
    );
    probe(
      "automobile_liability.limits.combined_single_limit",
      "Auto – Combined Single Limit",
      al.limits.combined_single_limit,
    );
  }

  const wc = data.workers_compensation;
  if (wc) {
    probe("workers_compensation.policy_number", "WC – Policy Number", wc.policy_number);
    probe(
      "workers_compensation.effective_date",
      "WC – Effective Date",
      wc.effective_date,
    );
    probe(
      "workers_compensation.expiration_date",
      "WC – Expiration Date",
      wc.expiration_date,
    );
    probe(
      "workers_compensation.limits.el_each_accident",
      "WC – EL Each Accident",
      wc.limits.el_each_accident,
    );
  }

  const umb = data.umbrella_excess;
  if (umb) {
    probe("umbrella_excess.policy_number", "Umbrella – Policy Number", umb.policy_number);
    probe(
      "umbrella_excess.effective_date",
      "Umbrella – Effective Date",
      umb.effective_date,
    );
    probe(
      "umbrella_excess.expiration_date",
      "Umbrella – Expiration Date",
      umb.expiration_date,
    );
    probe(
      "umbrella_excess.limits.each_occurrence",
      "Umbrella – Each Occurrence",
      umb.limits.each_occurrence,
    );
    probe(
      "umbrella_excess.limits.aggregate",
      "Umbrella – Aggregate",
      umb.limits.aggregate,
    );
  }

  const prop = data.property_coverage;
  if (prop) {
    probe(
      "property_coverage.policy_number",
      "Property – Policy Number",
      prop.policy_number,
    );
    probe(
      "property_coverage.effective_date",
      "Property – Effective Date",
      prop.effective_date,
    );
    probe(
      "property_coverage.expiration_date",
      "Property – Expiration Date",
      prop.expiration_date,
    );
    probe(
      "property_coverage.limits.building_limit",
      "Property – Building Limit",
      prop.limits.building_limit,
    );
  }

  probe(
    "description_of_operations",
    "Description of Operations",
    data.description_of_operations,
  );

  return entries;
}

// ── UI helpers ─────────────────────────────────────────────────────────────────

function confidenceColor(score: number): string {
  if (score >= CONFIDENCE_THRESHOLD) return "#15803d";
  if (score >= 0.6) return "#ca8a04";
  return "#dc2626";
}

function FieldReviewRow({ entry }: { entry: FieldEntry }): JSX.Element {
  return (
    <div
      style={{
        padding: "14px 0",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
      }}
    >
      <label
        htmlFor={entry.path}
        style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}
      >
        {entry.label}
        <span
          style={{
            marginLeft: 8,
            fontSize: 11,
            fontWeight: 600,
            color: confidenceColor(entry.confidence),
            background: `${confidenceColor(entry.confidence)}18`,
            padding: "1px 6px",
            borderRadius: 4,
          }}
        >
          AI confidence: {Math.round(entry.confidence * 100)}%
        </span>
      </label>
      <input
        id={entry.path}
        name={entry.path}
        type="text"
        defaultValue={entry.currentValue}
        style={{
          width: "100%",
          padding: "8px 10px",
          fontSize: 13,
          border: "1px solid",
          borderColor: entry.confidence < 0.6 ? "#fca5a5" : "#fcd34d",
          borderRadius: 6,
          background:
            entry.confidence < 0.6
              ? "rgba(254,202,202,0.2)"
              : "rgba(253,230,138,0.2)",
          boxSizing: "border-box",
          outline: "none",
        }}
        placeholder="Enter correct value…"
      />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

interface PageProps {
  params: { id: string };
}

export default async function ReviewPage({ params }: PageProps): Promise<JSX.Element> {
  const session = await getServerSession();
  if (!session?.user?.orgId) {
    notFound();
  }

  const orgId = session.user.orgId as string;
  const cert = await getCertificate(params.id, orgId);

  if (!cert) {
    notFound();
  }

  if (cert.status === "approved") {
    redirect(`/certificates/${params.id}`);
  }

  const extraction: ExtractionRow | null = await getLatestExtraction(params.id, orgId);

  if (!extraction) {
    return (
      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "48px 16px",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          textAlign: "center",
          color: "#6b7280",
        }}
      >
        <p>No extraction data found for this certificate.</p>
        <a href={`/certificates/${params.id}`} style={{ color: "#2563eb" }}>
          ← Back to certificate
        </a>
      </main>
    );
  }

  const data: AcordExtractionResult = extraction.extraction_data;
  const lowFields = buildLowConfidenceEntries(data);

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "32px 16px",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        color: "#111",
      }}
    >
      {/* Breadcrumb */}
      <div style={{ marginBottom: 20 }}>
        <a
          href={`/certificates/${params.id}`}
          style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}
        >
          ← Back to certificate
        </a>
      </div>

      {/* Header */}
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>
        Review Extraction
      </h1>
      <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 24px" }}>
        {cert.vendor_name} · {acordFormLabel(data.form_type)}
      </p>

      {/* Summary banner */}
      <div
        style={{
          background: "#fef3c7",
          border: "1px solid #fcd34d",
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 24,
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        <strong>{lowFields.length}</strong> field(s) extracted with confidence below{" "}
        <strong>{Math.round(CONFIDENCE_THRESHOLD * 100)}%</strong>. Correct any errors,
        then click <em>Approve &amp; Save</em>.
        <br />
        Overall AI confidence:{" "}
        <strong
          style={{
            color:
              data.overall_confidence < CONFIDENCE_THRESHOLD ? "#dc2626" : "#15803d",
          }}
        >
          {Math.round(data.overall_confidence * 100)}%
        </strong>
      </div>

      {lowFields.length === 0 ? (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: 8,
            padding: 24,
            textAlign: "center",
            color: "#15803d",
            fontSize: 14,
          }}
        >
          All fields meet the confidence threshold. No corrections needed.
          <br />
          <a
            href={`/certificates/${params.id}`}
            style={{ color: "#15803d", marginTop: 8, display: "block" }}
          >
            Return to certificate →
          </a>
        </div>
      ) : (
        <form action={submitReview}>
          {/* Hidden fields for routing */}
          <input type="hidden" name="extractionId" value={extraction.id} />
          <input type="hidden" name="certificateId" value={params.id} />

          {/* Field rows */}
          <div
            style={{
              background: "#fff",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 8,
              padding: "4px 20px 20px",
              marginBottom: 20,
            }}
          >
            {lowFields.map((entry) => (
              <FieldReviewRow key={entry.path} entry={entry} />
            ))}
          </div>

          {/* Low-confidence field list for reference */}
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid rgba(0,0,0,0.06)",
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 20,
              fontSize: 12,
              color: "#6b7280",
            }}
          >
            <strong style={{ display: "block", marginBottom: 4 }}>
              Fields flagged for review:
            </strong>
            {extraction.low_confidence_fields.join(" · ") || "None"}
          </div>

          {/* Submit */}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <a
              href={`/certificates/${params.id}`}
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#374151",
                padding: "9px 18px",
                border: "1px solid rgba(0,0,0,0.15)",
                borderRadius: 6,
                textDecoration: "none",
              }}
            >
              Cancel
            </a>
            <button
              type="submit"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                background: "#2563eb",
                padding: "9px 22px",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Approve &amp; Save
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
