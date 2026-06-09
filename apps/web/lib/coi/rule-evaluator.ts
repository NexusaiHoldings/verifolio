export type RuleStatus = "pass" | "fail" | "gap";

export interface CoverageRule {
  readonly id: string;
  readonly template_id: string;
  readonly coverage_type: string;
  readonly label: string;
  readonly is_required: boolean;
  readonly min_per_occurrence: number | null;
  readonly min_aggregate: number | null;
}

export interface ExtractionCoverage {
  readonly coverage_type: string;
  readonly per_occurrence_limit: number | null;
  readonly aggregate_limit: number | null;
  readonly is_present: boolean;
}

export interface RuleEvaluationResult {
  readonly rule_id: string;
  readonly coverage_type: string;
  readonly label: string;
  readonly status: RuleStatus;
  readonly details: string;
  readonly expected_per_occurrence: number | null;
  readonly expected_aggregate: number | null;
  readonly actual_per_occurrence: number | null;
  readonly actual_aggregate: number | null;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function evaluateRule(
  rule: CoverageRule,
  coverages: ExtractionCoverage[]
): RuleEvaluationResult {
  const coverage = coverages.find((c) => c.coverage_type === rule.coverage_type);

  if (!coverage || !coverage.is_present) {
    const status: RuleStatus = rule.is_required ? "fail" : "gap";
    const details = rule.is_required
      ? `Required coverage "${rule.label}" is missing from the certificate`
      : `Coverage "${rule.label}" is not present (optional)`;
    return {
      rule_id: rule.id,
      coverage_type: rule.coverage_type,
      label: rule.label,
      status,
      details,
      expected_per_occurrence: rule.min_per_occurrence,
      expected_aggregate: rule.min_aggregate,
      actual_per_occurrence: null,
      actual_aggregate: null,
    };
  }

  const gaps: string[] = [];

  if (
    rule.min_per_occurrence !== null &&
    coverage.per_occurrence_limit !== null &&
    coverage.per_occurrence_limit < rule.min_per_occurrence
  ) {
    gaps.push(
      `Per-occurrence limit ${formatAmount(coverage.per_occurrence_limit)} ` +
        `is below required ${formatAmount(rule.min_per_occurrence)}`
    );
  }

  if (
    rule.min_aggregate !== null &&
    coverage.aggregate_limit !== null &&
    coverage.aggregate_limit < rule.min_aggregate
  ) {
    gaps.push(
      `Aggregate limit ${formatAmount(coverage.aggregate_limit)} ` +
        `is below required ${formatAmount(rule.min_aggregate)}`
    );
  }

  if (gaps.length > 0) {
    return {
      rule_id: rule.id,
      coverage_type: rule.coverage_type,
      label: rule.label,
      status: "gap",
      details: gaps.join("; "),
      expected_per_occurrence: rule.min_per_occurrence,
      expected_aggregate: rule.min_aggregate,
      actual_per_occurrence: coverage.per_occurrence_limit,
      actual_aggregate: coverage.aggregate_limit,
    };
  }

  return {
    rule_id: rule.id,
    coverage_type: rule.coverage_type,
    label: rule.label,
    status: "pass",
    details: `Coverage "${rule.label}" meets all requirements`,
    expected_per_occurrence: rule.min_per_occurrence,
    expected_aggregate: rule.min_aggregate,
    actual_per_occurrence: coverage.per_occurrence_limit,
    actual_aggregate: coverage.aggregate_limit,
  };
}
