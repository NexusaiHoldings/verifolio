/**
 * COI Human Review Queue — server-side data layer.
 *
 * Feature F1-007: Operator-facing queue for low-confidence AI extractions
 * and escalated compliance disputes. Reviewers can correct field values,
 * approve or reject compliance determinations, and add notes. Approved
 * reviews promote the corrected extraction to coi_certificates and
 * re-trigger compliance scoring.
 */

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
  return dbQuery<PendingReview>(`
    SELECT
      rq.id,
      rq.extraction_id,
      rq.vendor_id,
      v.name          AS vendor_name,
      ce.policy_type,
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

export async function getExtractionDetail(
  extractionId: string,
): Promise<ExtractionDetail | null> {
  const rows = await dbQuery<ExtractionDetail>(
    `SELECT
      rq.id,
      rq.extraction_id,
      rq.vendor_id,
      v.name              AS vendor_name,
      ce.policy_type,
      rq.created_at       AS submitted_at,
      rq.confidence_score,
      rq.escalation_reason,
      rq.status,
      ce.document_url,
      ce.insured_name,
      ce.policy_number,
      ce.effective_date::text   AS effective_date,
      ce.expiration_date::text  AS expiration_date,
      ce.general_liability_limit,
      ce.auto_liability_limit,
      ce.workers_comp_limit,
      ce.umbrella_limit,
      ce.additional_insured,
      ce.certificate_holder,
      ce.field_confidences,
      rq.reviewer_notes
    FROM coi_review_queue rq
    LEFT JOIN coi_extractions ce ON ce.id = rq.extraction_id
    LEFT JOIN coi_vendors     v  ON v.id  = rq.vendor_id
    WHERE rq.extraction_id = $1`,
    [extractionId],
  );
  return rows[0] ?? null;
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
      const certRows = await pool.query(
        `INSERT INTO coi_certificates (
           id, extraction_id, vendor_id, policy_type,
           insured_name, policy_number,
           effective_date, expiration_date,
           general_liability_limit, auto_liability_limit,
           workers_comp_limit, umbrella_limit,
           additional_insured, certificate_holder, document_url,
           status, promoted_at, promoted_by
         )
         SELECT
           gen_random_uuid(),
           ce.id,
           rq.vendor_id,
           COALESCE($1,  ce.policy_type),
           COALESCE($2,  ce.insured_name),
           COALESCE($3,  ce.policy_number),
           COALESCE(($4)::date,  ce.effective_date),
           COALESCE(($5)::date,  ce.expiration_date),
           COALESCE($6,  ce.general_liability_limit),
           COALESCE($7,  ce.auto_liability_limit),
           COALESCE($8,  ce.workers_comp_limit),
           COALESCE($9,  ce.umbrella_limit),
           ce.additional_insured,
           COALESCE($10, ce.certificate_holder),
           ce.document_url,
           'active',
           NOW(),
           $11
         FROM coi_extractions ce
         JOIN coi_review_queue rq ON rq.extraction_id = ce.id
         WHERE ce.id = $12
         RETURNING id`,
        [
          c.policy_type ?? null,
          c.insured_name ?? null,
          c.policy_number ?? null,
          c.effective_date ?? null,
          c.expiration_date ?? null,
          c.general_liability_limit ?? null,
          c.auto_liability_limit ?? null,
          c.workers_comp_limit ?? null,
          c.umbrella_limit ?? null,
          c.certificate_holder ?? null,
          submission.reviewer_id,
          submission.extraction_id,
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
