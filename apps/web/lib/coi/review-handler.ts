/**
 * COI Human Review Queue — server-side data layer.
 *
 * Feature F1-007: Operator-facing queue for low-confidence AI extractions
 * and escalated compliance disputes. Reviewers can correct field values,
 * approve or reject compliance determinations, and add notes. Approved
 * reviews promote the corrected extraction to coi_certificates and
 * re-trigger compliance scoring.
 */

import type { AcordExtractionResult } from "./acord-schema";

// ── DB pool (same pattern as apps/web/lib/db.ts) ─────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pool: any = null;

function getPool(): {
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: unknown[]; rowCount: number }>;
} {
  if (_pool) return _pool;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool: PgPool } = require("pg") as {
    Pool: new (config: Record<string, unknown>) => {
      query: (
        sql: string,
        params?: unknown[],
      ) => Promise<{ rows: unknown[]; rowCount: number }>;
    };
  };
  _pool = new PgPool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  return _pool;
}

async function dbQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReviewStatus = "pending" | "in_review" | "approved" | "rejected";

export interface PendingReview {
  id: string;
  extraction_id: string;
  vendor_id: string | null;
  vendor_name: string | null;
  policy_type: string | null;
  submitted_at: string;
  confidence_score: number;
  escalation_reason: string | null;
  status: ReviewStatus;
}

export interface ExtractionDetail {
  id: string;
  extraction_id: string;
  vendor_id: string | null;
  vendor_name: string | null;
  policy_type: string | null;
  submitted_at: string;
  confidence_score: number;
  escalation_reason: string | null;
  status: ReviewStatus;
  document_url: string | null;
  insured_name: string | null;
  policy_number: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  general_liability_limit: string | null;
  auto_liability_limit: string | null;
  workers_comp_limit: string | null;
  umbrella_limit: string | null;
  additional_insured: boolean | null;
  certificate_holder: string | null;
  field_confidences: Record<string, number> | null;
  reviewer_notes: string | null;
}

export interface ReviewSubmission {
  extraction_id: string;
  decision: "approve" | "reject";
  corrected_fields: Record<string, string>;
  reviewer_notes: string;
  reviewer_id: string;
}

export interface ReviewResult {
  success: boolean;
  certificate_id?: string;
  error?: string;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listPendingReviews(): Promise<PendingReview[]> {
  // policy_type comes from the extraction's form_type (coi_extractions stores
  // the ACORD payload as a jsonb blob, not flat columns).
  return dbQuery<PendingReview>(`
    SELECT
      rq.id,
      rq.extraction_id,
      rq.vendor_id,
      v.name          AS vendor_name,
      ce.form_type    AS policy_type,
      rq.created_at   AS submitted_at,
      rq.confidence_score,
      rq.escalation_reason,
      rq.status
    FROM coi_review_queue rq
    LEFT JOIN coi_extractions ce ON ce.id = rq.extraction_id
    LEFT JOIN coi_vendors     v  ON v.id  = rq.vendor_id
    WHERE rq.status IN ('pending', 'in_review')
    ORDER BY rq.created_at ASC
  `);
}

/** Parse a jsonb extraction_data column (node-pg may hand back an object or a string). */
function parseExtraction(raw: unknown): AcordExtractionResult | null {
  if (!raw) return null;
  try {
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as AcordExtractionResult;
  } catch {
    return null;
  }
}

function numToStr(v: number | null | undefined): string | null {
  return typeof v === "number" && !Number.isNaN(v) ? String(v) : null;
}

interface FlatCert {
  policy_type: string | null;
  insured_name: string | null;
  policy_number: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  general_liability_limit: string | null;
  auto_liability_limit: string | null;
  workers_comp_limit: string | null;
  umbrella_limit: string | null;
  additional_insured: boolean | null;
  certificate_holder: string | null;
}

/** Flatten an ACORD extraction payload to the COI columns the review UI +
 *  coi_certificates use. Single source of truth for the jsonb → flat mapping. */
function flattenExtraction(d: AcordExtractionResult | null): FlatCert {
  const gl = d?.general_liability ?? null;
  const auto = d?.automobile_liability ?? null;
  const wc = d?.workers_compensation ?? null;
  const umb = d?.umbrella_excess ?? null;
  return {
    policy_type: d?.form_type ?? null,
    insured_name: d?.named_insured?.name?.value ?? null,
    policy_number: gl?.policy_number?.value ?? auto?.policy_number?.value ?? null,
    effective_date: gl?.effective_date?.value ?? null,
    expiration_date: gl?.expiration_date?.value ?? null,
    general_liability_limit: numToStr(gl?.limits?.each_occurrence?.value),
    auto_liability_limit: numToStr(auto?.limits?.combined_single_limit?.value),
    workers_comp_limit: numToStr(wc?.limits?.el_each_accident?.value),
    umbrella_limit: numToStr(umb?.limits?.each_occurrence?.value),
    additional_insured: gl?.additional_insured?.value ?? null,
    certificate_holder: d?.certificate_holder?.name?.value ?? null,
  };
}

export async function getExtractionDetail(
  extractionId: string,
): Promise<ExtractionDetail | null> {
  // The detailed COI fields live in coi_extractions.extraction_data (a jsonb
  // AcordExtractionResult) at review time — they are NOT flat columns and are
  // only flattened onto coi_certificates on promotion. Read the jsonb + the
  // queue row, then map to the flat ExtractionDetail shape the page expects.
  const rows = await dbQuery<{
    id: string;
    extraction_id: string;
    vendor_id: string | null;
    vendor_name: string | null;
    submitted_at: string;
    confidence_score: number;
    escalation_reason: string | null;
    status: ReviewStatus;
    reviewer_notes: string | null;
    form_type: string | null;
    extraction_data: unknown;
    document_url: string | null;
  }>(
    `SELECT
      rq.id,
      rq.extraction_id,
      rq.vendor_id,
      v.name            AS vendor_name,
      rq.created_at     AS submitted_at,
      rq.confidence_score,
      rq.escalation_reason,
      rq.status,
      rq.reviewer_notes,
      ce.form_type,
      ce.extraction_data,
      cc.file_url       AS document_url
    FROM coi_review_queue rq
    LEFT JOIN coi_extractions  ce ON ce.id = rq.extraction_id
    LEFT JOIN coi_certificates cc ON cc.id = ce.certificate_id
    LEFT JOIN coi_vendors      v  ON v.id  = rq.vendor_id
    WHERE rq.extraction_id = $1`,
    [extractionId],
  );
  const row = rows[0];
  if (!row) return null;

  const d = parseExtraction(row.extraction_data);
  const gl = d?.general_liability ?? null;
  const auto = d?.automobile_liability ?? null;
  const wc = d?.workers_compensation ?? null;
  const umb = d?.umbrella_excess ?? null;

  const field_confidences: Record<string, number> = {};
  if (d) {
    const add = (k: string, c: number | undefined) => {
      if (typeof c === "number") field_confidences[k] = c;
    };
    add("insured_name", d.named_insured?.name?.confidence);
    add("certificate_holder", d.certificate_holder?.name?.confidence);
    add("policy_number", gl?.policy_number?.confidence);
    add("effective_date", gl?.effective_date?.confidence);
    add("expiration_date", gl?.expiration_date?.confidence);
    add("general_liability_limit", gl?.limits?.each_occurrence?.confidence);
    add("auto_liability_limit", auto?.limits?.combined_single_limit?.confidence);
    add("workers_comp_limit", wc?.limits?.el_each_accident?.confidence);
    add("umbrella_limit", umb?.limits?.each_occurrence?.confidence);
  }

  return {
    id: row.id,
    extraction_id: row.extraction_id,
    vendor_id: row.vendor_id,
    vendor_name: row.vendor_name,
    policy_type: row.form_type,
    submitted_at: row.submitted_at,
    confidence_score: row.confidence_score,
    escalation_reason: row.escalation_reason,
    status: row.status,
    document_url: row.document_url,
    insured_name: d?.named_insured?.name?.value ?? null,
    policy_number: gl?.policy_number?.value ?? auto?.policy_number?.value ?? null,
    effective_date: gl?.effective_date?.value ?? null,
    expiration_date: gl?.expiration_date?.value ?? null,
    general_liability_limit: numToStr(gl?.limits?.each_occurrence?.value),
    auto_liability_limit: numToStr(auto?.limits?.combined_single_limit?.value),
    workers_comp_limit: numToStr(wc?.limits?.el_each_accident?.value),
    umbrella_limit: numToStr(umb?.limits?.each_occurrence?.value),
    additional_insured: gl?.additional_insured?.value ?? null,
    certificate_holder: d?.certificate_holder?.name?.value ?? null,
    field_confidences: Object.keys(field_confidences).length > 0 ? field_confidences : null,
    reviewer_notes: row.reviewer_notes,
  };
}

export async function submitReview(
  submission: ReviewSubmission,
): Promise<ReviewResult> {
  const pool = getPool();
  try {
    await pool.query("BEGIN");

    const newStatus =
      submission.decision === "approve" ? "approved" : "rejected";

    await pool.query(
      `UPDATE coi_review_queue
          SET status           = $1,
              reviewer_id      = $2,
              reviewer_notes   = $3,
              corrected_fields = $4::jsonb,
              reviewed_at      = NOW()
        WHERE extraction_id = $5`,
      [
        newStatus,
        submission.reviewer_id,
        submission.reviewer_notes,
        JSON.stringify(submission.corrected_fields),
        submission.extraction_id,
      ],
    );

    let certificate_id: string | undefined;

    if (submission.decision === "approve") {
      const c = submission.corrected_fields;

      // Load the extraction's jsonb payload + its linked certificate. The flat
      // COI values are derived from the jsonb (not flat columns on
      // coi_extractions); reviewer corrected_fields override the derived values.
      const exRows = await pool.query(
        `SELECT ce.extraction_data, ce.certificate_id,
                cc.vendor_id, cc.file_url
         FROM coi_extractions ce
         LEFT JOIN coi_certificates cc ON cc.id = ce.certificate_id
         WHERE ce.id = $1`,
        [submission.extraction_id],
      );
      const ex = (exRows.rows[0] ?? null) as
        | { extraction_data: unknown; certificate_id: string | null; vendor_id: string | null; file_url: string | null }
        | null;
      const base = flattenExtraction(parseExtraction(ex?.extraction_data));
      const aiText =
        c.additional_insured ??
        (base.additional_insured == null ? null : base.additional_insured ? "yes" : "no");

      const certRows = await pool.query(
        `INSERT INTO coi_certificates (
           extraction_id, vendor_id, policy_type,
           insured_name, policy_number,
           effective_date, expiration_date,
           general_liability_limit, auto_liability_limit,
           workers_comp_limit, umbrella_limit,
           additional_insured, certificate_holder, document_url,
           status, promoted_at, promoted_by
         ) VALUES (
           $1, $2, $3, $4, $5, ($6)::date, ($7)::date, $8, $9, $10, $11, $12, $13, $14,
           'active', NOW(), $15
         )
         RETURNING id`,
        [
          submission.extraction_id,
          ex?.vendor_id ?? null,
          c.policy_type ?? base.policy_type,
          c.insured_name ?? base.insured_name,
          c.policy_number ?? base.policy_number,
          c.effective_date ?? base.effective_date,
          c.expiration_date ?? base.expiration_date,
          c.general_liability_limit ?? base.general_liability_limit,
          c.auto_liability_limit ?? base.auto_liability_limit,
          c.workers_comp_limit ?? base.workers_comp_limit,
          c.umbrella_limit ?? base.umbrella_limit,
          aiText,
          c.certificate_holder ?? base.certificate_holder,
          ex?.file_url ?? null,
          submission.reviewer_id,
        ],
      );

      const certRow = (certRows.rows[0] ?? null) as { id: string } | null;
      certificate_id = certRow?.id;

      if (certificate_id) {
        await pool.query(
          `INSERT INTO coi_compliance_jobs
             (id, certificate_id, triggered_by, status, created_at)
           VALUES (gen_random_uuid(), $1, 'human_review_approval', 'pending', NOW())`,
          [certificate_id],
        );
      }
    }

    await pool.query("COMMIT");
    return { success: true, certificate_id };
  } catch (err) {
    await pool.query("ROLLBACK");
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
