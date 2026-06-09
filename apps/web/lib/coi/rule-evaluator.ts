export type CoverageType =
  | "CGL"
  | "workers_comp"
  | "umbrella"
  | "auto"
  | "professional_liability"
  | "cyber"
  | "pollution"
  | (string & Record<never, never>);

export type RuleStatus = "pass" | "fail" | "gap";

export interface CoverageRule {
  id: string;
  coverageType: CoverageType;
  required: boolean;
  minOccurrenceLimit: number | null;
  minAggregateLimit: number | null;
  additionalInsuredRequired: boolean;
  waiverOfSubrogationRequired: boolean;
}

export interface ComplianceTemplate {
  id: string;
  name: string;
  propertyType: string;
  description: string | null;
  rules: CoverageRule[];
}

export interface ExtractedCoverage {
  coverageType: CoverageType;
  occurrenceLimit: number | null;
  aggregateLimit: number | null;
  isAdditionalInsured: boolean;
  hasWaiverOfSubrogation: boolean;
  expirationDate: string | null;
}

export interface RuleEvaluationResult {
  ruleId: string;
  coverageType: CoverageType;
  status: RuleStatus;
  gaps: string[];
  requiredOccurrenceLimit: number | null;
  actualOccurrenceLimit: number | null;
  requiredAggregateLimit: number | null;
  actualAggregateLimit: number | null;
}

export interface TemplateEvaluationResult {
  templateId: string;
  overallStatus: RuleStatus;
  ruleResults: RuleEvaluationResult[];
  passCount: number;
  failCount: number;
  gapCount: number;
}

function isCoverageExpired(expirationDate: string | null): boolean {
  if (!expirationDate) return false;
  return new Date(expirationDate) < new Date();
}

function formatAmount(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${amount.toLocaleString()}`;
}

export function evaluateRule(
  rule: CoverageRule,
  coverages: ExtractedCoverage[],
): RuleEvaluationResult {
  const coverage = coverages.find(
    (c) => c.coverageType.toLowerCase() === rule.coverageType.toLowerCase(),
  );

  if (!coverage) {
    if (rule.required) {
      return {
        ruleId: rule.id,
        coverageType: rule.coverageType,
        status: "gap",
        gaps: [
          `Required coverage "${rule.coverageType}" not found in certificate`,
        ],
        requiredOccurrenceLimit: rule.minOccurrenceLimit,
        actualOccurrenceLimit: null,
        requiredAggregateLimit: rule.minAggregateLimit,
        actualAggregateLimit: null,
      };
    }
    return {
      ruleId: rule.id,
      coverageType: rule.coverageType,
      status: "pass",
      gaps: [],
      requiredOccurrenceLimit: rule.minOccurrenceLimit,
      actualOccurrenceLimit: null,
      requiredAggregateLimit: rule.minAggregateLimit,
      actualAggregateLimit: null,
    };
  }

  const gaps: string[] = [];

  if (isCoverageExpired(coverage.expirationDate)) {
    gaps.push(`Coverage "${rule.coverageType}" is expired`);
  }

  if (
    rule.minOccurrenceLimit !== null &&
    (coverage.occurrenceLimit === null ||
      coverage.occurrenceLimit < rule.minOccurrenceLimit)
  ) {
    const actual = coverage.occurrenceLimit ?? 0;
    gaps.push(
      `Per-occurrence limit ${formatAmount(actual)} is below required ${formatAmount(rule.minOccurrenceLimit)}`,
    );
  }

  if (
    rule.minAggregateLimit !== null &&
    (coverage.aggregateLimit === null ||
      coverage.aggregateLimit < rule.minAggregateLimit)
  ) {
    const actual = coverage.aggregateLimit ?? 0;
    gaps.push(
      `Aggregate limit ${formatAmount(actual)} is below required ${formatAmount(rule.minAggregateLimit)}`,
    );
  }

  if (rule.additionalInsuredRequired && !coverage.isAdditionalInsured) {
    gaps.push(
      `Additional insured endorsement required for "${rule.coverageType}" but not present`,
    );
  }

  if (rule.waiverOfSubrogationRequired && !coverage.hasWaiverOfSubrogation) {
    gaps.push(
      `Waiver of subrogation required for "${rule.coverageType}" but not present`,
    );
  }

  const hasExpiredOrMissing = gaps.some(
    (g) => g.includes("expired") || g.includes("not found"),
  );
  const status: RuleStatus =
    hasExpiredOrMissing ? "gap" : gaps.length > 0 ? "fail" : "pass";

  return {
    ruleId: rule.id,
    coverageType: rule.coverageType,
    status,
    gaps,
    requiredOccurrenceLimit: rule.minOccurrenceLimit,
    actualOccurrenceLimit: coverage.occurrenceLimit,
    requiredAggregateLimit: rule.minAggregateLimit,
    actualAggregateLimit: coverage.aggregateLimit,
  };
}

export function evaluateTemplate(
  template: ComplianceTemplate,
  coverages: ExtractedCoverage[],
): TemplateEvaluationResult {
  const ruleResults = template.rules.map((rule) =>
    evaluateRule(rule, coverages),
  );

  const passCount = ruleResults.filter((r) => r.status === "pass").length;
  const failCount = ruleResults.filter((r) => r.status === "fail").length;
  const gapCount = ruleResults.filter((r) => r.status === "gap").length;

  let overallStatus: RuleStatus = "pass";
  if (gapCount > 0) overallStatus = "gap";
  if (failCount > 0) overallStatus = "fail";

  return {
    templateId: template.id,
    overallStatus,
    ruleResults,
    passCount,
    failCount,
    gapCount,
  };
}
