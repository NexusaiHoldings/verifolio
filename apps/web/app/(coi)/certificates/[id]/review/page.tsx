import type { JSX } from "react";
import { notFound, redirect } from "next/navigation";
import { buildDb } from "@/lib/db";
import type { AcordExtractionResult } from "@/lib/coi/acord-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ExtractionRow {
  id: string;
  confidence_score: number;
  low_confidence_fields: string[];
  requires_review: boolean;
  raw_extraction: AcordExtractionResult;
  created_at: string;
}

interface CertRow {
  id: string;
  filename: string;
  extraction_status: string;
}

function FieldRow({
  label,
  value,
  fieldKey,
  lowConfFields,
}: {
  label: string;
  value?: string | null;
  fieldKey: string;
  lowConfFields: string[];
}): JSX.Element {
  const isLowConf = lowConfFields.includes(fieldKey);
  return (
    <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
      <td style={{ padding: "8px 12px", fontSize: 13, color: "#6b7280", width: "40%" }}>
        {label}
        {isLowConf && (
          <span style={{ marginLeft: 6, background: "#fef3c7", color: "#92400e", fontSize: 10, padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>
            LOW CONF
          </span>
        )}
      </td>
      <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 500 }}>
        {value ?? <span style={{ color: "#9ca3af", fontStyle: "italic" }}>not extracted</span>}
      </td>
      <td style={{ padding: "8px 12px", width: "30%" }}>
        <input
          form="review-form"
          name={fieldKey}
          defaultValue={value ?? ""}
          placeholder="correct value…"
          style={{
            width: "100%", border: `1px solid ${isLowConf ? "#f59e0b" : "#d1d5db"}`,
            borderRadius: 4, padding: "4px 8px", fontSize: 12,
            background: isLowConf ? "#fffbeb" : "#fff",
          }}
        />
      </td>
    </tr>
  );
}

export default async function ReviewPage({
  params,
}: {
  params: { id: string };
}): Promise<JSX.Element> {
  const db = buildDb();

  const certs = await db.query<CertRow>(
    `SELECT id, filename, extraction_status FROM coi_certificates WHERE id = $1 LIMIT 1`,
    params.id,
  );
  if (certs.length === 0) notFound();
  const cert = certs[0];

  const rows = await db.query<ExtractionRow>(
    `SELECT id, confidence_score, low_confidence_fields, requires_review, raw_extraction, created_at
     FROM coi_extractions
     WHERE certificate_id = $1 AND requires_review = true
     ORDER BY created_at DESC
     LIMIT 1`,
    params.id,
  );
  if (rows.length === 0) redirect(`/certificates/${params.id}`);

  const row = rows[0];
  const ext = row.raw_extraction;
  const lowConf: string[] = Array.isArray(row.low_confidence_fields) ? row.low_confidence_fields : [];

  async function submitReview(formData: FormData): Promise<void> {
    "use server";
    const reviewDb = buildDb();
    const notes = formData.get("review_notes") as string | null;
    const action = formData.get("_action") as string | null;

    if (action === "reject") {
      await reviewDb.execute(
        `UPDATE coi_extractions SET requires_review = false, review_notes = $1, reviewed_at = NOW() WHERE id = $2`,
        notes ?? "Rejected by reviewer",
        row.id,
      );
      await reviewDb.execute(
        `UPDATE coi_certificates SET extraction_status = 'failed', updated_at = NOW() WHERE id = $1`,
        params.id,
      );
      redirect(`/certificates/${params.id}`);
    }

    // Approve: persist any field corrections back into the extraction
    const corrections: Record<string, string> = {};
    for (const [key, val] of formData.entries()) {
      if (key !== "_action" && key !== "review_notes" && typeof val === "string" && val.trim()) {
        corrections[key] = val.trim();
      }
    }

    await reviewDb.execute(
      `UPDATE coi_extractions
       SET requires_review  = false,
           review_notes     = $1,
           corrections      = $2::jsonb,
           reviewed_at      = NOW()
       WHERE id = $3`,
      notes ?? null,
      JSON.stringify(corrections),
      row.id,
    );
    await reviewDb.execute(
      `UPDATE coi_certificates
       SET extraction_status = 'completed',
           updated_at        = NOW()
       WHERE id = $1`,
      params.id,
    );
    redirect(`/certificates/${params.id}`);
  }

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "32px 16px", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <a href={`/certificates/${params.id}`} style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>← Back to certificate</a>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginTop: 8, marginBottom: 4 }}>
          Human Review — {cert.filename}
        </h1>
        <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
          Extraction confidence: <strong>{Math.round(row.confidence_score * 100)}%</strong>
          {lowConf.length > 0 && ` · ${lowConf.length} low-confidence field(s)`}
        </p>
      </div>

      <form id="review-form" action={submitReview}>
        <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: "#374151" }}>Insured &amp; Holder</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ textAlign: "left", padding: "6px 12px", fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>FIELD</th>
                <th style={{ textAlign: "left", padding: "6px 12px", fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>EXTRACTED VALUE</th>
                <th style={{ textAlign: "left", padding: "6px 12px", fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>CORRECTION</th>
              </tr>
            </thead>
            <tbody>
              <FieldRow label="Named Insured" value={ext.named_insured?.name} fieldKey="named_insured.name" lowConfFields={lowConf} />
              <FieldRow label="Insured Address" value={ext.named_insured?.address} fieldKey="named_insured.address" lowConfFields={lowConf} />
              <FieldRow label="Certificate Holder" value={ext.certificate_holder?.name} fieldKey="certificate_holder.name" lowConfFields={lowConf} />
              <FieldRow label="Effective Date" value={ext.policy_period?.effective_date} fieldKey="policy_period.effective_date" lowConfFields={lowConf} />
              <FieldRow label="Expiration Date" value={ext.policy_period?.expiration_date} fieldKey="policy_period.expiration_date" lowConfFields={lowConf} />
            </tbody>
          </table>
        </section>

        {ext.general_liability && (
          <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: "#374151" }}>General Liability</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <FieldRow label="Policy Number" value={ext.general_liability.policy_number} fieldKey="general_liability.policy_number" lowConfFields={lowConf} />
                <FieldRow label="Each Occurrence" value={ext.general_liability.each_occurrence} fieldKey="general_liability.each_occurrence" lowConfFields={lowConf} />
                <FieldRow label="General Aggregate" value={ext.general_liability.general_aggregate} fieldKey="general_liability.general_aggregate" lowConfFields={lowConf} />
                <FieldRow label="Products/Completed Ops" value={ext.general_liability.products_comp_ops_aggregate} fieldKey="general_liability.products_comp_ops_aggregate" lowConfFields={lowConf} />
              </tbody>
            </table>
          </section>
        )}

        {ext.auto_liability && (
          <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: "#374151" }}>Auto Liability</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <FieldRow label="Policy Number" value={ext.auto_liability.policy_number} fieldKey="auto_liability.policy_number" lowConfFields={lowConf} />
                <FieldRow label="Combined Single Limit" value={ext.auto_liability.combined_single_limit} fieldKey="auto_liability.combined_single_limit" lowConfFields={lowConf} />
              </tbody>
            </table>
          </section>
        )}

        {ext.umbrella_liability && (
          <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: "#374151" }}>Umbrella / Excess</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <FieldRow label="Policy Number" value={ext.umbrella_liability.policy_number} fieldKey="umbrella_liability.policy_number" lowConfFields={lowConf} />
                <FieldRow label="Each Occurrence" value={ext.umbrella_liability.each_occurrence} fieldKey="umbrella_liability.each_occurrence" lowConfFields={lowConf} />
                <FieldRow label="Aggregate" value={ext.umbrella_liability.aggregate} fieldKey="umbrella_liability.aggregate" lowConfFields={lowConf} />
              </tbody>
            </table>
          </section>
        )}

        {ext.workers_compensation && (
          <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: "#374151" }}>Workers Compensation</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <FieldRow label="Policy Number" value={ext.workers_compensation.policy_number} fieldKey="workers_compensation.policy_number" lowConfFields={lowConf} />
                <FieldRow label="E.L. Each Accident" value={ext.workers_compensation.el_each_accident} fieldKey="workers_compensation.el_each_accident" lowConfFields={lowConf} />
                <FieldRow label="E.L. Disease – Ea Employee" value={ext.workers_compensation.el_disease_ea_employee} fieldKey="workers_compensation.el_disease_ea_employee" lowConfFields={lowConf} />
              </tbody>
            </table>
          </section>
        )}

        <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#374151" }}>
            Review Notes (optional)
          </label>
          <textarea
            name="review_notes"
            rows={3}
            style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 4, padding: "8px 10px", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
            placeholder="Any notes about the extraction quality or corrections made…"
          />
        </section>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            type="submit"
            name="_action"
            value="reject"
            style={{
              background: "#fee2e2", color: "#991b1b", border: "none",
              padding: "10px 20px", borderRadius: 6, fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}
          >
            Reject &amp; Flag
          </button>
          <button
            type="submit"
            name="_action"
            value="approve"
            style={{
              background: "#10b981", color: "#fff", border: "none",
              padding: "10px 20px", borderRadius: 6, fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}
          >
            Approve
          </button>
        </div>
      </form>
    </main>
  );
}
