import type { JSX } from "react";
import { notFound } from "next/navigation";
import { buildDb } from "@/lib/db";
import type {
  AcordExtractionResult,
  GeneralLiabilityLimits,
  AutoLiabilityLimits,
  UmbrellaLimits,
  WorkersCompLimits,
  PropertyLimits,
} from "@/lib/coi/acord-schema";
import { CONFIDENCE_THRESHOLD } from "@/lib/coi/acord-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface CertificateRow {
  id: string;
  filename: string;
  source: string;
  sender_email: string;
  subject: string;
  extraction_status: string;
  form_type: string | null;
  named_insured_name: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  created_at: string;
  updated_at: string;
}

interface ExtractionRow {
  id: string;
  confidence_score: number;
  low_confidence_fields: string[];
  requires_review: boolean;
  raw_extraction: AcordExtractionResult;
  created_at: string;
}

function LimitRow({ label, value }: { label: string; value?: string }): JSX.Element | null {
  if (!value) return null;
  return (
    <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
      <td style={{ padding: "6px 12px", color: "#6b7280", fontSize: 14 }}>{label}</td>
      <td style={{ padding: "6px 12px", fontWeight: 500, fontSize: 14 }}>{value}</td>
    </tr>
  );
}

function CoverageSection({
  title,
  children,
}: {
  title: string;
  children: JSX.Element | null | (JSX.Element | null)[];
}): JSX.Element {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 8 }}>{title}</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#f9fafb", borderRadius: 6 }}>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default async function CertificatePage({
  params,
}: {
  params: { id: string };
}): Promise<JSX.Element> {
  const db = buildDb();

  const certs = await db.query<CertificateRow>(
    `SELECT * FROM coi_certificates WHERE id = $1 LIMIT 1`,
    params.id,
  );
  if (certs.length === 0) notFound();
  const cert = certs[0];

  const extractions = await db.query<ExtractionRow>(
    `SELECT id, confidence_score, low_confidence_fields, requires_review, raw_extraction, created_at
     FROM coi_extractions
     WHERE certificate_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    params.id,
  );
  const extraction: AcordExtractionResult | null =
    extractions.length > 0 ? extractions[0].raw_extraction : null;
  const conf = extractions.length > 0 ? extractions[0].confidence_score : null;
  const requiresReview = extractions.length > 0 ? extractions[0].requires_review : false;

  const gl = extraction?.general_liability as GeneralLiabilityLimits | undefined;
  const al = extraction?.auto_liability as AutoLiabilityLimits | undefined;
  const ul = extraction?.umbrella_liability as UmbrellaLimits | undefined;
  const wc = extraction?.workers_compensation as WorkersCompLimits | undefined;
  const prop = extraction?.property as PropertyLimits | undefined;

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 16px", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>
            {cert.filename ?? "Certificate of Insurance"}
          </h1>
          <p style={{ color: "#6b7280", marginTop: 4, fontSize: 14 }}>
            {cert.form_type ?? "ACORD form"} · received via {cert.source}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {requiresReview && (
            <a
              href={`/certificates/${params.id}/review`}
              style={{
                background: "#f59e0b", color: "#fff", padding: "6px 14px",
                borderRadius: 6, textDecoration: "none", fontSize: 13, fontWeight: 600,
              }}
            >
              Review Required
            </a>
          )}
          <span
            style={{
              background: cert.extraction_status === "completed" ? "#d1fae5" : cert.extraction_status === "pending_review" ? "#fef3c7" : "#fee2e2",
              color: cert.extraction_status === "completed" ? "#065f46" : cert.extraction_status === "pending_review" ? "#92400e" : "#991b1b",
              padding: "4px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
            }}
          >
            {cert.extraction_status}
          </span>
        </div>
      </div>

      {conf !== null && (
        <div style={{ background: conf >= CONFIDENCE_THRESHOLD ? "#ecfdf5" : "#fff7ed", border: `1px solid ${conf >= CONFIDENCE_THRESHOLD ? "#6ee7b7" : "#fbbf24"}`, borderRadius: 8, padding: "10px 16px", marginBottom: 24, fontSize: 13 }}>
          <strong>Extraction confidence:</strong> {Math.round(conf * 100)}%
          {conf < CONFIDENCE_THRESHOLD && " — some fields may need review"}
        </div>
      )}

      {extraction && (
        <>
          <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#111827" }}>Parties</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 2px" }}>NAMED INSURED</p>
                <p style={{ fontWeight: 600, margin: 0 }}>{extraction.named_insured.name}</p>
                {extraction.named_insured.address && <p style={{ fontSize: 13, color: "#374151", margin: "2px 0 0" }}>{extraction.named_insured.address}, {extraction.named_insured.city} {extraction.named_insured.state} {extraction.named_insured.zip}</p>}
              </div>
              <div>
                <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 2px" }}>CERTIFICATE HOLDER</p>
                <p style={{ fontWeight: 600, margin: 0 }}>{extraction.certificate_holder.name}</p>
                {extraction.certificate_holder.address && <p style={{ fontSize: 13, color: "#374151", margin: "2px 0 0" }}>{extraction.certificate_holder.address}, {extraction.certificate_holder.city} {extraction.certificate_holder.state} {extraction.certificate_holder.zip}</p>}
              </div>
            </div>
          </section>

          <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#111827" }}>Policy Period</h2>
            <p style={{ fontSize: 14, margin: 0 }}>
              <strong>Effective:</strong> {extraction.policy_period.effective_date}
              &nbsp;&nbsp;→&nbsp;&nbsp;
              <strong>Expires:</strong> {extraction.policy_period.expiration_date}
            </p>
          </section>

          <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#111827" }}>Coverage Limits</h2>
            {gl && (
              <CoverageSection title="General Liability">
                <LimitRow label="Policy #" value={gl.policy_number} />
                <LimitRow label="Each Occurrence" value={gl.each_occurrence} />
                <LimitRow label="Damage to Rented Premises" value={gl.damage_to_rented_premises} />
                <LimitRow label="Med Exp" value={gl.med_exp} />
                <LimitRow label="Personal & Adv Injury" value={gl.personal_advertising_injury} />
                <LimitRow label="General Aggregate" value={gl.general_aggregate} />
                <LimitRow label="Products/Completed Ops Aggregate" value={gl.products_comp_ops_aggregate} />
              </CoverageSection>
            )}
            {al && (
              <CoverageSection title="Auto Liability">
                <LimitRow label="Policy #" value={al.policy_number} />
                <LimitRow label="Combined Single Limit" value={al.combined_single_limit} />
                <LimitRow label="Bodily Injury (per person)" value={al.bodily_injury_per_person} />
                <LimitRow label="Bodily Injury (per accident)" value={al.bodily_injury_per_accident} />
                <LimitRow label="Property Damage" value={al.property_damage} />
              </CoverageSection>
            )}
            {ul && (
              <CoverageSection title="Umbrella / Excess Liability">
                <LimitRow label="Policy #" value={ul.policy_number} />
                <LimitRow label="Each Occurrence" value={ul.each_occurrence} />
                <LimitRow label="Aggregate" value={ul.aggregate} />
              </CoverageSection>
            )}
            {wc && (
              <CoverageSection title="Workers Compensation">
                <LimitRow label="Policy #" value={wc.policy_number} />
                <LimitRow label="E.L. Each Accident" value={wc.el_each_accident} />
                <LimitRow label="E.L. Disease – Ea Employee" value={wc.el_disease_ea_employee} />
                <LimitRow label="E.L. Disease – Policy Limit" value={wc.el_disease_policy_limit} />
              </CoverageSection>
            )}
            {prop && (
              <CoverageSection title="Property">
                <LimitRow label="Policy #" value={prop.policy_number} />
                <LimitRow label="Building" value={prop.building} />
                <LimitRow label="Business Personal Property" value={prop.business_personal_property} />
                <LimitRow label="Business Income" value={prop.business_income} />
              </CoverageSection>
            )}
          </section>

          {extraction.additional_insureds.length > 0 && (
            <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#111827" }}>Additional Insureds</h2>
              {extraction.additional_insureds.map((ai, idx) => (
                <div key={idx} style={{ padding: "8px 0", borderBottom: "1px solid #f3f4f6", fontSize: 14 }}>
                  <span style={{ fontWeight: 500 }}>{ai.name}</span>
                  {ai.is_subrogation_waived && (
                    <span style={{ marginLeft: 8, background: "#dbeafe", color: "#1e40af", borderRadius: 4, padding: "1px 6px", fontSize: 11 }}>Subrogation Waived</span>
                  )}
                </div>
              ))}
            </section>
          )}

          {extraction.description_of_operations && (
            <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#111827" }}>Description of Operations</h2>
              <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, margin: 0 }}>{extraction.description_of_operations}</p>
            </section>
          )}

          <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#111827" }}>Insurers</h2>
            {extraction.insurers.map((ins, idx) => (
              <div key={idx} style={{ fontSize: 14, padding: "4px 0" }}>
                <span style={{ fontWeight: 500 }}>{ins.name}</span>
                {ins.naic && <span style={{ color: "#6b7280", marginLeft: 8 }}>NAIC {ins.naic}</span>}
              </div>
            ))}
          </section>
        </>
      )}

      {!extraction && (
        <div style={{ textAlign: "center", padding: 48, color: "#6b7280" }}>
          <p>Extraction is in progress. Refresh to see results.</p>
        </div>
      )}
    </main>
  );
}
