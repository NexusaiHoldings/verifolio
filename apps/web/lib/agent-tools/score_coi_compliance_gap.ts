/**
 * Agent tool: score_coi_compliance_gap
 *
 * Evaluates extracted COI fields against the applicable property compliance
 * template rules and returns a structured gap report with pass/fail status
 * per coverage line, gap severity, and recommended remediation actions.
 * Writes the result to coi_compliance_results.
 *
 * Autonomy = confirm (mutation) — routes through the confirm-gate bridge.
 */

import type { HandlerContext, HandlerResult } from "@nexus/identity-and-access";
import { err, ok } from "@nexus/identity-and-access";

export type Args = Record<string, unknown>;

interface CoverageLineResult {
  line_name: string;
  required: boolean;
  found: boolean;
  meets_limit: boolean;
  required_limit: number | null;
  actual_limit: number | null;
  gap_severity: "none" | "low" | "medium" | "high" | "critical";
  remediation: string | null;
}

interface ComplianceGapReport {
  certificate_id: string;
  template_id: string;
  overall_pass: boolean;
  score: number;
  coverage_lines: CoverageLineResult[];
  created_at: string;
}

interface ExtractionRow {
  readonly id: string;
  readonly vendor_id: string;
  readonly policy_number: string | null;
  readonly effective_date: string | null;
  readonly expiration_date: string | null;
  readonly insurer_name: string | null;
  readonly extracted_fields: Record<string, unknown> | string | null;
}

interface TemplateRuleRow {
  readonly id: string;
  readonly template_id: string;
  readonly coverage_type: string;
  readonly required: boolean;
  readonly minimum_limit: number | null;
  readonly description: string | null;
}

function parseNumericLimit(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function severityFromGap(required: boolean, found: boolean, meetsLimit: boolean): "none" | "low" | "medium" | "high" | "critical" {
  if (!required && found && meetsLimit) return "none";
  if (!required && !found) return "low";
  if (required && found && meetsLimit) return "none";
  if (required && found && !meetsLimit) return "high";
  if (required && !found) return "critical";
  return "none";
}

function buildRemediation(
  coverageType: string,
  required: boolean,
  found: boolean,
  meetsLimit: boolean,
  requiredLimit: number | null,
  actualLimit: number | null,
): string | null {
  if (!required && found && meetsLimit) return null;
  if (!required && !found) return null;
  if (required && !found) {
    return `Obtain ${coverageType} coverage and provide a valid certificate of insurance reflecting active coverage.`;
  }
  if (required && found && !meetsLimit) {
    const req = requiredLimit !== null ? ` of at least $${requiredLimit.toLocaleString()}` : "";
    const act = actualLimit !== null ? ` (currently $${actualLimit.toLocaleString()})` : "";
    return `Increase ${coverageType} coverage limit${req}${act}. Request an updated certificate from the vendor's insurance carrier.`;
  }
  return null;
}

export async function handleScoreCoiComplianceGap(
  ctx: HandlerContext,
  args: Args,
): Promise<HandlerResult> {
  const certificateId = args["certificate_id"];
  const propertyId = args["property_id"];

  if (typeof certificateId !== "string" || !certificateId.trim()) {
    return err(400, "certificate_id is required");
  }
  if (typeof propertyId !== "string" || !propertyId.trim()) {
    return err(400, "property_id is required");
  }

  // Load the COI extraction record
  let extractions: ExtractionRow[];
  try {
    extractions = await ctx.db.query<ExtractionRow>(
      `SELECT id, vendor_id, policy_number, effective_date, expiration_date,
              insurer_name, extracted_fields
       FROM coi_extractions
       WHERE id = $1::uuid
       LIMIT 1`,
      certificateId.trim(),
    );
  } catch {
    return err(500, "failed to load COI extraction record");
  }

  if (extractions.length === 0) {
    return err(404, "certificate not found");
  }
  const extraction = extractions[0];

  // Resolve the compliance template for this property
  let templateRows: Array<{ readonly template_id: string }>;
  try {
    templateRows = await ctx.db.query<{ readonly template_id: string }>(
      `SELECT pt.id AS template_id
       FROM property_compliance_templates pt
       WHERE pt.property_id = $1::uuid
         AND pt.active = true
       LIMIT 1`,
      propertyId.trim(),
    );
  } catch {
    return err(500, "failed to load compliance template");
  }

  if (templateRows.length === 0) {
    return err(404, "no active compliance template found for property");
  }
  const templateId = templateRows[0].template_id;

  // Load template rules
  let rules: TemplateRuleRow[];
  try {
    rules = await ctx.db.query<TemplateRuleRow>(
      `SELECT id, template_id, coverage_type, required, minimum_limit, description
       FROM compliance_template_rules
       WHERE template_id = $1::uuid
       ORDER BY coverage_type`,
      templateId,
    );
  } catch {
    return err(500, "failed to load compliance template rules");
  }

  // Parse extracted coverage fields
  let extractedFields: Record<string, unknown> = {};
  if (extraction.extracted_fields) {
    if (typeof extraction.extracted_fields === "string") {
      try {
        extractedFields = JSON.parse(extraction.extracted_fields) as Record<string, unknown>;
      } catch {
        extractedFields = {};
      }
    } else {
      extractedFields = extraction.extracted_fields;
    }
  }

  // Score each coverage line against template rules
  const coverageLines: CoverageLineResult[] = rules.map((rule) => {
    const coverageKey = rule.coverage_type.toLowerCase().replace(/\s+/g, "_");
    const coverageData = (extractedFields[coverageKey] ?? extractedFields[rule.coverage_type]) as Record<string, unknown> | undefined;

    const found = coverageData !== null && coverageData !== undefined;
    const actualLimit = found ? parseNumericLimit(coverageData?.limit ?? coverageData?.each_occurrence ?? coverageData?.combined_single_limit) : null;
    const requiredLimit = rule.minimum_limit !== null ? rule.minimum_limit : null;

    const meetsLimit =
      !found
        ? false
        : requiredLimit === null
          ? true
          : actualLimit !== null && actualLimit >= requiredLimit;

    const severity = severityFromGap(rule.required, found, meetsLimit);
    const remediation = buildRemediation(
      rule.coverage_type,
      rule.required,
      found,
      meetsLimit,
      requiredLimit,
      actualLimit,
    );

    return {
      line_name: rule.coverage_type,
      required: rule.required,
      found,
      meets_limit: meetsLimit,
      required_limit: requiredLimit,
      actual_limit: actualLimit,
      gap_severity: severity,
      remediation,
    };
  });

  // Compute overall pass/fail and numeric score
  const requiredLines = coverageLines.filter((l) => l.required);
  const passedRequired = requiredLines.filter((l) => l.found && l.meets_limit);
  const overallPass = requiredLines.length === 0 || passedRequired.length === requiredLines.length;
  const score =
    requiredLines.length === 0
      ? 100
      : Math.round((passedRequired.length / requiredLines.length) * 100);

  const createdAt = new Date().toISOString();
  const resultId = crypto.randomUUID();

  // Persist result to coi_compliance_results
  try {
    await ctx.db.execute(
      `INSERT INTO coi_compliance_results
         (id, extraction_id, template_id, property_id, overall_pass, score, coverage_lines, created_at)
       VALUES
         ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8)
       ON CONFLICT (extraction_id, template_id) DO UPDATE SET
         overall_pass    = EXCLUDED.overall_pass,
         score           = EXCLUDED.score,
         coverage_lines  = EXCLUDED.coverage_lines,
         created_at      = EXCLUDED.created_at`,
      resultId,
      certificateId.trim(),
      templateId,
      propertyId.trim(),
      overallPass,
      score,
      JSON.stringify(coverageLines),
      createdAt,
    );
  } catch {
    return err(500, "failed to persist compliance result");
  }

  await ctx.events.publish("coi.compliance_scored", {
    result_id: resultId,
    certificate_id: certificateId.trim(),
    property_id: propertyId.trim(),
    overall_pass: overallPass,
    score,
  });

  const report: ComplianceGapReport = {
    certificate_id: certificateId.trim(),
    template_id: templateId,
    overall_pass: overallPass,
    score,
    coverage_lines: coverageLines,
    created_at: createdAt,
  };

  return ok({ result: report });
}
