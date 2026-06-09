import { buildDb } from "@/lib/db";
import { evaluateRule } from "./rule-evaluator";
import type { CoverageRule, ExtractionCoverage, RuleEvaluationResult } from "./rule-evaluator";

export interface ComplianceTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly property_type: string;
  readonly rules: CoverageRule[];
}

export interface ComplianceTemplateSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly property_type: string;
  readonly rule_count: number;
  readonly created_at: string;
}

export interface ScoringResult {
  readonly template_id: string;
  readonly coi_id: string;
  readonly overall_status: "pass" | "fail" | "gap";
  readonly rule_results: RuleEvaluationResult[];
  readonly evaluated_at: string;
  readonly pass_count: number;
  readonly fail_count: number;
  readonly gap_count: number;
}

export function scoreCompliance(
  template: ComplianceTemplate,
  coi_id: string,
  coverages: ExtractionCoverage[]
): ScoringResult {
  const rule_results = template.rules.map((rule) => evaluateRule(rule, coverages));
  const pass_count = rule_results.filter((r) => r.status === "pass").length;
  const fail_count = rule_results.filter((r) => r.status === "fail").length;
  const gap_count = rule_results.filter((r) => r.status === "gap").length;
  const overall_status: "pass" | "fail" | "gap" =
    fail_count > 0 ? "fail" : gap_count > 0 ? "gap" : "pass";
  return {
    template_id: template.id,
    coi_id,
    overall_status,
    rule_results,
    evaluated_at: new Date().toISOString(),
    pass_count,
    fail_count,
    gap_count,
  };
}

export async function listTemplates(): Promise<ComplianceTemplateSummary[]> {
  const db = buildDb();
  return db.query<ComplianceTemplateSummary>(
    "SELECT t.id, t.name, t.description, t.property_type, t.created_at, " +
      "COALESCE(COUNT(r.id), 0)::int AS rule_count " +
      "FROM compliance_templates t " +
      "LEFT JOIN compliance_rules r ON r.template_id = t.id " +
      "GROUP BY t.id, t.name, t.description, t.property_type, t.created_at " +
      "ORDER BY t.name ASC"
  );
}

export async function fetchTemplate(
  templateId: string
): Promise<ComplianceTemplate | null> {
  const db = buildDb();
  const rows = await db.query<{
    id: string;
    name: string;
    description: string | null;
    property_type: string;
  }>(
    "SELECT id, name, description, property_type " +
      "FROM compliance_templates WHERE id = $1",
    templateId
  );
  if (rows.length === 0) return null;
  const tpl = rows[0];
  const rules = await db.query<CoverageRule>(
    "SELECT id, template_id, coverage_type, label, is_required, " +
      "min_per_occurrence, min_aggregate " +
      "FROM compliance_rules WHERE template_id = $1 ORDER BY label ASC",
    templateId
  );
  return { ...tpl, rules };
}

export async function saveComplianceResult(
  coiId: string,
  result: ScoringResult
): Promise<void> {
  const db = buildDb();
  await db.execute(
    "DELETE FROM compliance_results WHERE coi_id = $1 AND template_id = $2",
    coiId,
    result.template_id
  );
  await db.execute(
    "INSERT INTO compliance_results " +
      "(id, coi_id, template_id, overall_status, pass_count, fail_count, gap_count, evaluated_at) " +
      "VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)",
    coiId,
    result.template_id,
    result.overall_status,
    result.pass_count,
    result.fail_count,
    result.gap_count,
    result.evaluated_at
  );
  for (const rr of result.rule_results) {
    await db.execute(
      "INSERT INTO compliance_rule_results " +
        "(id, coi_id, template_id, rule_id, status, details, evaluated_at) " +
        "VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)",
      coiId,
      result.template_id,
      rr.rule_id,
      rr.status,
      rr.details,
      result.evaluated_at
    );
  }
}
