/**
 * Certificate of Insurance — detail page.
 * Server component: fetches certificate and latest extraction from DB,
 * renders extracted fields with confidence indicators.
 */

import { notFound } from "next/navigation";
import type { JSX, ReactNode } from "react";
import {
  getCertificate,
  getLatestExtraction,
  type CertificateRow,
  type ExtractionRow,
} from "@/lib/coi/extract";
import { acordFormLabel, CONFIDENCE_THRESHOLD } from "@/lib/coi/acord-schema";
import type { AcordExtractionResult, ConfidenceField } from "@/lib/coi/acord-schema";
import { getSessionUser } from "@/lib/admin-auth";

// ── Helpers ────────────────────────────────────────────────────────────────────

function confidenceColor(c: number): string {
  if (c >= CONFIDENCE_THRESHOLD) return "#15803d"; // green
  if (c >= 0.6) return "#ca8a04";                  // amber
  return "#dc2626";                                  // red
}

function ConfidenceBadge({ score }: { score: number }): JSX.Element {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: confidenceColor(score),
        background: `${confidenceColor(score)}18`,
        padding: "1px 6px",
        borderRadius: 4,
        marginLeft: 6,
      }}
    >
      {Math.round(score * 100)}%
    </span>
  );
}

function FieldRow<T extends string | number | boolean | null>({
  label,
  field,
}: {
  label: string;
  field: ConfidenceField<T> | null | undefined;
}): JSX.Element {
  if (!field) return <></>;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "6px 0",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        gap: 12,
      }}
    >
      <span style={{ fontSize: 13, color: "#6b7280", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, textAlign: "right" }}>
        {field.value !== null && field.value !== undefined ? String(field.value) : "—"}
        <ConfidenceBadge score={field.confidence} />
      </span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 8,
        padding: "16px 20px",
        marginBottom: 16,
      }}
    >
      <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px 0", color: "#111" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function CurrencyField({
  label,
  field,
}: {
  label: string;
  field: ConfidenceField<number> | null | undefined;
}): JSX.Element {
  if (!field) return <></>;
  const formatted =
    field.value !== null && field.value !== undefined
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(field.value)
      : "—";
  return (
    <FieldRow
      label={label}
      field={{ value: formatted, confidence: field.confidence }}
    />
  );
}

// ── Coverage sections ──────────────────────────────────────────────────────────

function GeneralLiabilitySection({
  data,
}: {
  data: AcordExtractionResult["general_liability"];
}): JSX.Element {
  if (!data) return <></>;
  return (
    <Section title="General Liability">
      <FieldRow label="Policy Number" field={data.policy_number} />
      <FieldRow label="Effective Date" field={data.effective_date} />
      <FieldRow label="Expiration Date" field={data.expiration_date} />
      <FieldRow label="Form Type" field={{ value: data.is_occurrence_form?.value ? "Occurrence" : data.is_claims_made?.value ? "Claims-Made" : null, confidence: data.is_occurrence_form?.confidence ?? 0 }} />
      <FieldRow label="Additional Insured" field={data.additional_insured} />
      <FieldRow label="Subrogation Waived" field={data.subrogation_waived} />
      <CurrencyField label="Each Occurrence" field={data.limits.each_occurrence} />
      <CurrencyField label="General Aggregate" field={data.limits.general_aggregate} />
      <CurrencyField label="Products/Completed Ops Aggregate" field={data.limits.products_completed_ops_aggregate} />
      <CurrencyField label="Personal & Advertising Injury" field={data.limits.personal_advertising_injury} />
      <CurrencyField label="Damage to Rented Premises" field={data.limits.damage_to_rented_premises} />
      <CurrencyField label="Med Exp (Any One Person)" field={data.limits.med_exp_any_one_person} />
    </Section>
  );
}

function AutoLiabilitySection({
  data,
}: {
  data: AcordExtractionResult["automobile_liability"];
}): JSX.Element {
  if (!data) return <></>;
  return (
    <Section title="Automobile Liability">
      <FieldRow label="Policy Number" field={data.policy_number} />
      <FieldRow label="Effective Date" field={data.effective_date} />
      <FieldRow label="Expiration Date" field={data.expiration_date} />
      <FieldRow label="Any Auto" field={data.any_auto} />
      <FieldRow label="All Owned Autos" field={data.all_owned_autos} />
      <FieldRow label="Hired Autos" field={data.hired_autos} />
      <FieldRow label="Non-Owned Autos" field={data.non_owned_autos} />
      <CurrencyField label="Combined Single Limit" field={data.limits.combined_single_limit} />
      <CurrencyField label="Bodily Injury (Per Person)" field={data.limits.bodily_injury_per_person} />
      <CurrencyField label="Bodily Injury (Per Accident)" field={data.limits.bodily_injury_per_accident} />
      <CurrencyField label="Property Damage (Per Accident)" field={data.limits.property_damage_per_accident} />
    </Section>
  );
}

function WorkersCompSection({
  data,
}: {
  data: AcordExtractionResult["workers_compensation"];
}): JSX.Element {
  if (!data) return <></>;
  return (
    <Section title="Workers Compensation &amp; Employer's Liability">
      <FieldRow label="Policy Number" field={data.policy_number} />
      <FieldRow label="Effective Date" field={data.effective_date} />
      <FieldRow label="Expiration Date" field={data.expiration_date} />
      <CurrencyField label="EL Each Accident" field={data.limits.el_each_accident} />
      <CurrencyField label="EL Disease – Policy Limit" field={data.limits.el_disease_policy_limit} />
      <CurrencyField label="EL Disease – Each Employee" field={data.limits.el_disease_each_employee} />
    </Section>
  );
}

function UmbrellaSection({
  data,
}: {
  data: AcordExtractionResult["umbrella_excess"];
}): JSX.Element {
  if (!data) return <></>;
  return (
    <Section title="Umbrella / Excess Liability">
      <FieldRow label="Policy Number" field={data.policy_number} />
      <FieldRow label="Effective Date" field={data.effective_date} />
      <FieldRow label="Expiration Date" field={data.expiration_date} />
      <FieldRow label="Form" field={{ value: data.is_umbrella?.value ? "Umbrella" : data.is_excess?.value ? "Excess" : null, confidence: data.is_umbrella?.confidence ?? 0 }} />
      <CurrencyField label="Each Occurrence" field={data.limits.each_occurrence} />
      <CurrencyField label="Aggregate" field={data.limits.aggregate} />
    </Section>
  );
}

function PropertySection({
  data,
}: {
  data: AcordExtractionResult["property_coverage"];
}): JSX.Element {
  if (!data) return <></>;
  return (
    <Section title="Property Coverage">
      <FieldRow label="Policy Number" field={data.policy_number} />
      <FieldRow label="Effective Date" field={data.effective_date} />
      <FieldRow label="Expiration Date" field={data.expiration_date} />
      <FieldRow label="Causes of Loss" field={data.causes_of_loss} />
      <FieldRow label="Valuation" field={data.valuation} />
      <FieldRow label="Coinsurance" field={data.coinsurance_pct} />
      <CurrencyField label="Building Limit" field={data.limits.building_limit} />
      <CurrencyField label="Business Personal Property" field={data.limits.business_personal_property_limit} />
      <CurrencyField label="Business Income" field={data.limits.business_income_limit} />
      <CurrencyField label="Deductible" field={data.limits.deductible} />
    </Section>
  );
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }): JSX.Element {
  const colors: Record<string, { bg: string; text: string }> = {
    pending:      { bg: "#f3f4f6", text: "#6b7280" },
    extracted:    { bg: "#dcfce7", text: "#15803d" },
    needs_review: { bg: "#fef3c7", text: "#92400e" },
    reviewed:     { bg: "#dbeafe", text: "#1d4ed8" },
    approved:     { bg: "#dcfce7", text: "#15803d" },
  };
  const style = colors[status] ?? colors.pending;
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        padding: "2px 10px",
        borderRadius: 12,
        background: style.bg,
        color: style.text,
      }}
    >
      {status.replace(/_/g, " ").toUpperCase()}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

interface PageProps {
  params: { id: string };
}

export default async function CertificatePage({ params }: PageProps): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) notFound();

  const orgId = process.env.DEFAULT_ORG_ID ?? "";
  if (!orgId) notFound();

  const cert: CertificateRow | null = await getCertificate(params.id, orgId);

  if (!cert) {
    notFound();
  }

  const extraction: ExtractionRow | null = await getLatestExtraction(params.id, orgId);
  const data: AcordExtractionResult | null = extraction?.extraction_data ?? null;

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "32px 16px",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        color: "#111",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{cert.vendor_name}</h1>
          <StatusBadge status={cert.status} />
        </div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          {data ? acordFormLabel(data.form_type) : cert.form_type.replace("_", " ")}
          {cert.expiration_date ? ` · Expires ${cert.expiration_date}` : ""}
          {" · "}
          <span style={{ fontFamily: "monospace", fontSize: 12 }}>{cert.id}</span>
        </div>
      </div>

      {/* Review callout */}
      {cert.status === "needs_review" && extraction && (
        <div
          style={{
            background: "#fef3c7",
            border: "1px solid #fcd34d",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <strong style={{ fontSize: 13 }}>Human review required</strong>
            <div style={{ fontSize: 12, color: "#92400e", marginTop: 2 }}>
              {extraction.low_confidence_fields.length} field(s) have low extraction confidence.
            </div>
          </div>
          <a
            href={`/certificates/${params.id}/review`}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#92400e",
              background: "#fcd34d",
              padding: "6px 14px",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            Review Now
          </a>
        </div>
      )}

      {!data ? (
        <div
          style={{
            background: "#f9fafb",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 8,
            padding: 32,
            textAlign: "center",
            color: "#6b7280",
          }}
        >
          Extraction not yet available for this certificate.
        </div>
      ) : (
        <>
          {/* Overall confidence */}
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
            }}
          >
            <span style={{ color: "#6b7280" }}>Overall extraction confidence:</span>
            <strong style={{ color: confidenceColor(data.overall_confidence) }}>
              {Math.round(data.overall_confidence * 100)}%
            </strong>
            {extraction?.reviewed_at && (
              <span style={{ marginLeft: "auto", color: "#6b7280" }}>
                Reviewed {extraction.reviewed_at.slice(0, 10)}
              </span>
            )}
          </div>

          {/* Named insured + certificate holder */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <Section title="Named Insured">
              <FieldRow label="Name" field={data.named_insured.name} />
              <FieldRow label="Address" field={data.named_insured.address} />
              <FieldRow label="City / State / ZIP" field={data.named_insured.city_state_zip} />
            </Section>
            <Section title="Certificate Holder">
              <FieldRow label="Name" field={data.certificate_holder.name} />
              <FieldRow label="Address" field={data.certificate_holder.address} />
              <FieldRow label="City / State / ZIP" field={data.certificate_holder.city_state_zip} />
            </Section>
          </div>

          {/* Coverage sections */}
          <GeneralLiabilitySection data={data.general_liability} />
          <AutoLiabilitySection data={data.automobile_liability} />
          <WorkersCompSection data={data.workers_compensation} />
          <UmbrellaSection data={data.umbrella_excess} />
          <PropertySection data={data.property_coverage} />

          {/* Additional insureds */}
          {data.additional_insureds.length > 0 && (
            <Section title={`Additional Insureds (${data.additional_insureds.length})`}>
              {data.additional_insureds.map((ai, idx) => (
                <div key={idx} style={{ marginBottom: 8 }}>
                  <FieldRow label="Name" field={ai.name} />
                  <FieldRow label="Address" field={ai.address} />
                </div>
              ))}
            </Section>
          )}

          {/* Description of operations */}
          {data.description_of_operations.value && (
            <Section title="Description of Operations">
              <p style={{ fontSize: 13, margin: 0, lineHeight: 1.6, color: "#374151" }}>
                {data.description_of_operations.value}
                <ConfidenceBadge score={data.description_of_operations.confidence} />
              </p>
            </Section>
          )}

          {/* Producer */}
          <Section title="Producer">
            <FieldRow label="Agency" field={data.producer.name} />
            <FieldRow label="Contact" field={data.producer.contact_name} />
            <FieldRow label="Address" field={data.producer.address} />
            <FieldRow label="Phone" field={data.producer.phone} />
            <FieldRow label="Email" field={data.producer.email} />
          </Section>
        </>
      )}
    </main>
  );
}
