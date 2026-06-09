/**
 * COI human-review handler — queries and mutates coi_extraction_results,
 * promotes approved extractions to coi_certificates for re-scoring.
 *
 * All DB access is via raw parameterized SQL through buildDb().
 * No ORM. No string interpolation in queries.
 */

import { buildDb } from "@/lib/db";

export interface ExtractionSummary {
  id: string;
  vendor_name: string | null;
  policy_number: string | null;
  insurance_type: string | null;
  confidence_score: number | null;
  status: string;
  escalation_reason: string | null;
  created_at: string;
}

export interface ExtractionDetail extends ExtractionSummary {
  extracted_fields: Record<string, unknown>;
  corrected_fields: Record<string, unknown> | null;
  reviewer_id: string | null;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  document_url: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  coverage_amount: number | null;
}

export interface ReviewInput {
  extractionId: string;
  reviewerId: string;
  decision: "approved" | "rejected";
  correctedFields?: Record<string, unknown>;
  notes?: string;
}

export interface ReviewResult {
  success: boolean;
  certificateId?: string;
  error?: string;
}

/**
 * Return all extractions awaiting human review, ordered by urgency:
 * escalated items first, then oldest first within each group.
 */
export async function listPendingExtractions(): Promise<ExtractionSummary[]> {
  const db = buildDb();
  try {
    const rows = await db.query<ExtractionSummary>(
      `SELECT
         id,
         vendor_name,
         policy_number,
         insurance_type,
         confidence_score,
         status,
         escalation_reason,
         created_at::text AS created_at
       FROM coi_extraction_results
       WHERE status IN ('pending_review', 'escalated')
       ORDER BY
         CASE WHEN status = 'escalated' THEN 0 ELSE 1 END,
         created_at ASC
       LIMIT 200`,
    );
    return rows;
  } catch (err) {
    console.error("[review-handler] listPendingExtractions error:", err);
    return [];
  }
}

/** Return a single extraction with all reviewer-relevant fields, or null. */
export async function getExtractionDetail(
  extractionId: string,
): Promise<ExtractionDetail | null> {
  const db = buildDb();
  try {
    const rows = await db.query<ExtractionDetail>(
      `SELECT
         id,
         vendor_name,
         policy_number,
         insurance_type,
         confidence_score,
         status,
         escalation_reason,
         created_at::text  AS created_at,
         extracted_fields,
         corrected_fields,
         reviewer_id,
         reviewer_notes,
         reviewed_at::text AS reviewed_at,
         document_url,
         effective_date::text  AS effective_date,
         expiration_date::text AS expiration_date,
         coverage_amount
       FROM coi_extraction_results
       WHERE id = $1`,
      extractionId,
    );

    if (rows.length === 0) return null;

    const row = rows[0];

    // pg returns JSONB columns as JS objects; guard against string just in case.
    if (typeof row.extracted_fields === "string") {
      try {
        row.extracted_fields = JSON.parse(row.extracted_fields) as Record<string, unknown>;
      } catch {
        row.extracted_fields = {};
      }
    }
    row.extracted_fields ??= {};

    if (typeof row.corrected_fields === "string") {
      try {
        row.corrected_fields = JSON.parse(row.corrected_fields) as Record<string, unknown>;
      } catch {
        row.corrected_fields = null;
      }
    }

    return row;
  } catch (err) {
    console.error("[review-handler] getExtractionDetail error:", err);
    return null;
  }
}

/**
 * Record a reviewer's decision on an extraction.
 *
 * On approval:
 *   1. Marks the extraction row approved + stores corrected fields and notes.
 *   2. Upserts a row in coi_certificates (idempotent via ON CONFLICT).
 *   3. Sets compliance_status = 'pending_scoring' so the scoring pipeline
 *      re-evaluates the certificate automatically.
 *
 * On rejection:
 *   1. Marks the extraction rejected + stores corrected fields and notes.
 *   2. No certificate row is written.
 */
export async function submitReview(input: ReviewInput): Promise<ReviewResult> {
  const db = buildDb();
  const { extractionId, reviewerId, decision, correctedFields = {}, notes } = input;

  try {
    const newStatus = decision === "approved" ? "approved" : "rejected";

    await db.execute(
      `UPDATE coi_extraction_results
         SET
           status           = $1,
           reviewer_id      = $2,
           reviewer_notes   = $3,
           reviewed_at      = NOW(),
           corrected_fields = $4::jsonb
       WHERE id = $5`,
      newStatus,
      reviewerId,
      notes ?? null,
      JSON.stringify(correctedFields),
      extractionId,
    );

    if (decision !== "approved") {
      console.log(
        `[review-handler] extraction ${extractionId} rejected by reviewer ${reviewerId}`,
      );
      return { success: true };
    }

    // Fetch full record so we can build the certificate row.
    const rows = await db.query<{
      vendor_name: string | null;
      policy_number: string | null;
      insurance_type: string | null;
      effective_date: string | null;
      expiration_date: string | null;
      coverage_amount: number | null;
      extracted_fields: Record<string, unknown>;
    }>(
      `SELECT
         vendor_name,
         policy_number,
         insurance_type,
         effective_date::text  AS effective_date,
         expiration_date::text AS expiration_date,
         coverage_amount,
         extracted_fields
       FROM coi_extraction_results
       WHERE id = $1`,
      extractionId,
    );

    if (rows.length === 0) {
      return { success: false, error: "Extraction not found after status update" };
    }

    const ext = rows[0];

    // Reviewer corrections take precedence over AI-extracted values.
    const mergedData: Record<string, unknown> = {
      ...(ext.extracted_fields ?? {}),
      ...correctedFields,
    };

    // Upsert into coi_certificates; ON CONFLICT handles resubmissions.
    const certRows = await db.query<{ id: string }>(
      `INSERT INTO coi_certificates (
         id,
         extraction_id,
         vendor_name,
         policy_number,
         insurance_type,
         effective_date,
         expiration_date,
         coverage_amount,
         certificate_data,
         approved_by,
         approved_at,
         compliance_status,
         created_at
       ) VALUES (
         gen_random_uuid(),
         $1, $2, $3, $4,
         $5::date,
         $6::date,
         $7,
         $8::jsonb,
         $9,
         NOW(),
         'pending_scoring',
         NOW()
       )
       ON CONFLICT (extraction_id) DO UPDATE
         SET
           vendor_name       = EXCLUDED.vendor_name,
           policy_number     = EXCLUDED.policy_number,
           insurance_type    = EXCLUDED.insurance_type,
           effective_date    = EXCLUDED.effective_date,
           expiration_date   = EXCLUDED.expiration_date,
           coverage_amount   = EXCLUDED.coverage_amount,
           certificate_data  = EXCLUDED.certificate_data,
           approved_by       = EXCLUDED.approved_by,
           approved_at       = EXCLUDED.approved_at,
           compliance_status = 'pending_scoring'
       RETURNING id`,
      extractionId,
      ext.vendor_name,
      ext.policy_number,
      ext.insurance_type,
      ext.effective_date,
      ext.expiration_date,
      ext.coverage_amount,
      JSON.stringify(mergedData),
      reviewerId,
    );

    const certificateId = certRows[0]?.id ?? "";
    console.log(
      `[review-handler] extraction ${extractionId} → certificate ${certificateId} (reviewer: ${reviewerId})`,
    );

    return { success: true, certificateId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(
      `[review-handler] submitReview error for ${extractionId}: ${message}`,
    );
    return { success: false, error: message };
  }
}
