/**
 * Agent tool handler: score_coi_compliance_gap
 *
 * Evaluates extracted COI fields against property compliance template rules
 * and returns a structured gap report with pass/fail per coverage line,
 * gap severity, and recommended remediation actions.
 *
 * Autonomy class: confirm (mutation — writes to coi_compliance_results).
 * Mutations route through the cross-boundary bridge; the confirm gate
 * ensures a human approves the write before it is persisted.
 */

import type { HandlerContext, HandlerResult } from "@nexus/identity-and-access";

type Args = Record<string, unknown>;

interface CoverageField {
  field_name: string;
  required_value: string | number | null;
  operator: string; // "gte", "eq", "present", "lte"
  actual_value: string | number | null;
}

interface GapLine {
  field_name: string;
  required: string | number | null;
  actual: string | number | null;
  passed: boolean;
  severity: "critical" | "major" | "minor";
  remediation: string;
}

interface ComplianceTemplate {
  id: string;
  name: string;
  coverage_lines: CoverageField[];
}

interface ExtractionResult {
  id: string;
  certificate_id: string;
  vendor_id: string;
  extracted_fields: Record<string, string | number | null>;
}

function evaluateCoverageField(field: CoverageField): { passed: boolean; severity: "critical" | "major" | "minor"; remediation: string } {
  const { field_name, required_value, operator, actual_value } = field;

  if (required_value === null) {
    return { passed: true, severity: "minor", remediation: "" };
  }

  let passed = false;

  if (operator === "present") {
    passed = actual_value !== null && actual_value !== undefined && actual_value !== "";
  } else if (operator === "gte") {
    const req = Number(required_value);
    const act = Number(actual_value);
    passed = !isNaN(act) && act >= req;
  } else if (operator === "lte") {
    const req = Number(required_value);
    const act = Number(actual_value);
    passed = !isNaN(act) && act <= req;
  } else if (operator === "eq") {
    passed = String(actual_value).toLowerCase() === String(required_value).toLowerCase();
  } else {
    // Default: treat as presence check
    passed = actual_value !== null && actual_value !== undefined && actual_value !== "";
  }

  if (passed) {
    return { passed: true, severity: "minor", remediation: "" };
  }

  // Determine severity based on field category
  const criticalFields = [
    "general_liability_each_occurrence",
    "general_liability_aggregate",
    "workers_comp_el_each_accident",
    "additional_insured",
    "waiver_of_subrogation",
    "policy_expiration_date",
  ];
  const majorFields = [
    "umbrella_each_occurrence",
    "umbrella_aggregate",
    "auto_liability_combined_single_limit",
    "professional_liability_each_claim",
  ];

  let severity: "critical" | "major" | "minor" = "minor";
  if (criticalFields.some((f) => field_name.includes(f))) {
    severity = "critical";
  } else if (majorFields.some((f) => field_name.includes(f))) {
    severity = "major";
  }

  let remediation = "";
  if (operator === "present") {
    remediation = `Field "${field_name}" is missing from the certificate. Request an updated COI from the vendor that includes this coverage.`;
  } else if (operator === "gte") {
    remediation = `"${field_name}" is below the required minimum of ${required_value}. Current value: ${actual_value ?? "not found"}. Request an endorsement or updated policy from the vendor's insurer.`;
  } else if (operator === "lte") {
    remediation = `"${field_name}" exceeds the maximum allowed value of ${required_value}. Current value: ${actual_value ?? "not found"}. Verify policy terms with vendor.`;
  } else {
    remediation = `"${field_name}" does not match required value "${required_value}". Current value: "${actual_value ?? "not found"}". Contact vendor to correct the certificate.`;
  }

  return { passed, severity, remediation };
}

export async function handleScoreCoiComplianceGap(
  ctx: HandlerContext,
  args: Args,
): Promise<HandlerResult> {
  const extraction_id = args["extraction_id"] as string | undefined;
  const certificate_id = args["certificate_id"] as string | undefined;
  const template_id = args["template_id"] as string | undefined;

  if (!extraction_id && !certificate_id) {
    return {
      status: 400,
      body: "Missing required argument: extraction_id or certificate_id",
    };
  }

  try {
    // 1. Load the extraction result
    let extraction: ExtractionResult | null = null;

    if (extraction_id) {
      const row = await ctx.db.queryRow<{
        id: string;
        certificate_id: string;
        vendor_id: string;
        extracted_fields: string;
      }>(
        `SELECT id, certificate_id, vendor_id, extracted_fields
         FROM coi_extraction_results
         WHERE id = $1`,
        [extraction_id],
      );
      if (row) {
        extraction = {
          id: row.id,
          certificate_id: row.certificate_id,
          vendor_id: row.vendor_id,
          extracted_fields:
            typeof row.extracted_fields === "string"
              ? JSON.parse(row.extracted_fields)
              : (row.extracted_fields as Record<string, string | number | null>),
        };
      }
    } else if (certificate_id) {
      const row = await ctx.db.queryRow<{
        id: string;
        certificate_id: string;
        vendor_id: string;
        extracted_fields: string;
      }>(
        `SELECT id, certificate_id, vendor_id, extracted_fields
         FROM coi_extraction_results
         WHERE certificate_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [certificate_id],
      );
      if (row) {
        extraction = {
          id: row.id,
          certificate_id: row.certificate_id,
          vendor_id: row.vendor_id,
          extracted_fields:
            typeof row.extracted_fields === "string"
              ? JSON.parse(row.extracted_fields)
              : (row.extracted_fields as Record<string, string | number | null>),
        };
      }
    }

    if (!extraction) {
      return { status: 404, body: "Extraction result not found" };
    }

    // 2. Resolve the compliance template
    let template: ComplianceTemplate | null = null;

    if (template_id) {
      const row = await ctx.db.queryRow<{
        id: string;
        name: string;
        coverage_lines: string;
      }>(
        `SELECT id, name, coverage_lines
         FROM coi_compliance_templates
         WHERE id = $1`,
        [template_id],
      );
      if (row) {
        template = {
          id: row.id,
          name: row.name,
          coverage_lines:
            typeof row.coverage_lines === "string"
              ? JSON.parse(row.coverage_lines)
              : (row.coverage_lines as CoverageField[]),
        };
      }
    } else {
      // Auto-resolve: find the template bound to the property/vendor
      const row = await ctx.db.queryRow<{
        id: string;
        name: string;
        coverage_lines: string;
      }>(
        `SELECT ct.id, ct.name, ct.coverage_lines
         FROM coi_compliance_templates ct
         JOIN coi_certificates cc ON cc.vendor_id = $1
         JOIN coi_vendor_template_bindings vtb
           ON vtb.vendor_id = cc.vendor_id AND vtb.template_id = ct.id
         WHERE cc.id = $2
         ORDER BY ct.created_at DESC
         LIMIT 1`,
        [extraction.vendor_id, extraction.certificate_id],
      );
      if (row) {
        template = {
          id: row.id,
          name: row.name,
          coverage_lines:
            typeof row.coverage_lines === "string"
              ? JSON.parse(row.coverage_lines)
              : (row.coverage_lines as CoverageField[]),
        };
      }
    }

    if (!template) {
      // Fall back to the default template if no binding found
      const row = await ctx.db.queryRow<{
        id: string;
        name: string;
        coverage_lines: string;
      }>(
        `SELECT id, name, coverage_lines
         FROM coi_compliance_templates
         WHERE is_default = true
         ORDER BY created_at DESC
         LIMIT 1`,
        [],
      );
      if (row) {
        template = {
          id: row.id,
          name: row.name,
          coverage_lines:
            typeof row.coverage_lines === "string"
              ? JSON.parse(row.coverage_lines)
              : (row.coverage_lines as CoverageField[]),
        };
      }
    }

    if (!template) {
      return {
        status: 422,
        body: "No compliance template found for this certificate. Create or assign a compliance template before scoring.",
      };
    }

    // 3. Evaluate each coverage line
    const gapLines: GapLine[] = template.coverage_lines.map((field) => {
      const actual = extraction!.extracted_fields[field.field_name] ?? null;
      const fieldWithActual: CoverageField = { ...field, actual_value: actual };
      const evaluation = evaluateCoverageField(fieldWithActual);
      return {
        field_name: field.field_name,
        required: field.required_value,
        actual,
        passed: evaluation.passed,
        severity: evaluation.severity,
        remediation: evaluation.remediation,
      };
    });

    const totalLines = gapLines.length;
    const passedLines = gapLines.filter((g) => g.passed).length;
    const failedLines = gapLines.filter((g) => !g.passed);
    const criticalGaps = failedLines.filter((g) => g.severity === "critical").length;
    const majorGaps = failedLines.filter((g) => g.severity === "major").length;
    const minorGaps = failedLines.filter((g) => g.severity === "minor").length;

    const overallPassed = criticalGaps === 0 && majorGaps === 0;
    const overallStatus = overallPassed
      ? "compliant"
      : criticalGaps > 0
        ? "non_compliant_critical"
        : "non_compliant_major";

    const scoredAt = new Date().toISOString();

    // 4. Write result to coi_compliance_results (confirm-gated mutation)
    await ctx.db.execute(
      `INSERT INTO coi_compliance_results (
         id,
         extraction_id,
         certificate_id,
         vendor_id,
         template_id,
         template_name,
         overall_status,
         total_lines,
         passed_lines,
         critical_gaps,
         major_gaps,
         minor_gaps,
         gap_lines,
         scored_at,
         created_at,
         updated_at
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, now(), now()
       )
       ON CONFLICT (extraction_id)
       DO UPDATE SET
         template_id    = EXCLUDED.template_id,
         template_name  = EXCLUDED.template_name,
         overall_status = EXCLUDED.overall_status,
         total_lines    = EXCLUDED.total_lines,
         passed_lines   = EXCLUDED.passed_lines,
         critical_gaps  = EXCLUDED.critical_gaps,
         major_gaps     = EXCLUDED.major_gaps,
         minor_gaps     = EXCLUDED.minor_gaps,
         gap_lines      = EXCLUDED.gap_lines,
         scored_at      = EXCLUDED.scored_at,
         updated_at     = now()`,
      [
        extraction.id,
        extraction.certificate_id,
        extraction.vendor_id,
        template.id,
        template.name,
        overallStatus,
        totalLines,
        passedLines,
        criticalGaps,
        majorGaps,
        minorGaps,
        JSON.stringify(gapLines),
        scoredAt,
      ],
    );

    // 5. Emit compliance-scored event
    await ctx.events.emit("coi.compliance_scored", {
      extraction_id: extraction.id,
      certificate_id: extraction.certificate_id,
      vendor_id: extraction.vendor_id,
      overall_status: overallStatus,
      critical_gaps: criticalGaps,
      scored_at: scoredAt,
    });

    return {
      status: 200,
      body: {
        extraction_id: extraction.id,
        certificate_id: extraction.certificate_id,
        vendor_id: extraction.vendor_id,
        template_id: template.id,
        template_name: template.name,
        overall_status: overallStatus,
        summary: {
          total_lines: totalLines,
          passed_lines: passedLines,
          failed_lines: totalLines - passedLines,
          critical_gaps: criticalGaps,
          major_gaps: majorGaps,
          minor_gaps: minorGaps,
        },
        gap_report: gapLines,
        scored_at: scoredAt,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, body: `score_coi_compliance_gap failed: ${message}` };
  }
}
