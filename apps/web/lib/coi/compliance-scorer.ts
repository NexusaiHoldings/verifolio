import { Pool, PoolClient } from "pg";
import {
  ComplianceTemplate,
  CoverageRule,
  ExtractedCoverage,
  RuleEvaluationResult,
  evaluateTemplate,
} from "./rule-evaluator";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CreateTemplateInput {
  name: string;
  propertyType: string;
  description?: string | null;
}

export interface UpdateTemplateInput {
  name?: string;
  propertyType?: string;
  description?: string | null;
}

export interface CreateRuleInput {
  templateId: string;
  coverageType: string;
  required?: boolean;
  minOccurrenceLimit?: number | null;
  minAggregateLimit?: number | null;
  additionalInsuredRequired?: boolean;
  waiverOfSubrogationRequired?: boolean;
}

export interface UpdateRuleInput {
  coverageType?: string;
  required?: boolean;
  minOccurrenceLimit?: number | null;
  minAggregateLimit?: number | null;
  additionalInsuredRequired?: boolean;
  waiverOfSubrogationRequired?: boolean;
}

export interface ComplianceResult {
  id: string;
  coiExtractionId: string;
  templateId: string;
  overallStatus: "pass" | "fail" | "gap";
  ruleResults: RuleEvaluationResult[];
  passCount: number;
  failCount: number;
  gapCount: number;
  evaluatedAt: Date;
}

// ── DB row shapes ──────────────────────────────────────────────────────────

interface TemplateRow {
  id: string;
  name: string;
  property_type: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

interface RuleRow {
  id: string;
  template_id: string;
  coverage_type: string;
  required: boolean;
  min_occurrence_limit: string | null;
  min_aggregate_limit: string | null;
  additional_insured_required: boolean;
  waiver_of_subrogation_required: boolean;
}

interface ResultRow {
  id: string;
  coi_extraction_id: string;
  template_id: string;
  overall_status: string;
  rule_results: RuleEvaluationResult[];
  pass_count: number;
  fail_count: number;
  gap_count: number;
  evaluated_at: Date;
}

// ── Pool singleton ─────────────────────────────────────────────────────────

let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return _pool;
}

// ── Schema bootstrap ───────────────────────────────────────────────────────

async function ensureTables(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS compliance_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      property_type TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS compliance_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_id UUID NOT NULL REFERENCES compliance_templates(id) ON DELETE CASCADE,
      coverage_type TEXT NOT NULL,
      required BOOLEAN NOT NULL DEFAULT TRUE,
      min_occurrence_limit NUMERIC,
      min_aggregate_limit NUMERIC,
      additional_insured_required BOOLEAN NOT NULL DEFAULT FALSE,
      waiver_of_subrogation_required BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS compliance_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      coi_extraction_id UUID NOT NULL,
      template_id UUID NOT NULL REFERENCES compliance_templates(id),
      overall_status TEXT NOT NULL,
      rule_results JSONB NOT NULL DEFAULT '[]',
      pass_count INTEGER NOT NULL DEFAULT 0,
      fail_count INTEGER NOT NULL DEFAULT 0,
      gap_count INTEGER NOT NULL DEFAULT 0,
      evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

// ── Row mapper ─────────────────────────────────────────────────────────────

function rowToRule(row: RuleRow): CoverageRule {
  return {
    id: row.id,
    coverageType: row.coverage_type,
    required: row.required,
    minOccurrenceLimit:
      row.min_occurrence_limit !== null
        ? parseFloat(row.min_occurrence_limit)
        : null,
    minAggregateLimit:
      row.min_aggregate_limit !== null
        ? parseFloat(row.min_aggregate_limit)
        : null,
    additionalInsuredRequired: row.additional_insured_required,
    waiverOfSubrogationRequired: row.waiver_of_subrogation_required,
  };
}

// ── Template queries ───────────────────────────────────────────────────────

export async function getAllTemplates(): Promise<ComplianceTemplate[]> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTables(client);
    const { rows: templateRows } = await client.query<TemplateRow>(
      "SELECT * FROM compliance_templates ORDER BY created_at DESC",
    );
    if (templateRows.length === 0) return [];
    const ids = templateRows.map((t) => t.id);
    const { rows: ruleRows } = await client.query<RuleRow>(
      "SELECT * FROM compliance_rules WHERE template_id = ANY($1::uuid[]) ORDER BY created_at ASC",
      [ids],
    );
    return templateRows.map((t) => ({
      id: t.id,
      name: t.name,
      propertyType: t.property_type,
      description: t.description,
      rules: ruleRows.filter((r) => r.template_id === t.id).map(rowToRule),
    }));
  } finally {
    client.release();
  }
}

export async function getTemplateById(
  id: string,
): Promise<ComplianceTemplate | null> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTables(client);
    const { rows } = await client.query<TemplateRow>(
      "SELECT * FROM compliance_templates WHERE id = $1",
      [id],
    );
    if (rows.length === 0) return null;
    const t = rows[0];
    const { rows: ruleRows } = await client.query<RuleRow>(
      "SELECT * FROM compliance_rules WHERE template_id = $1 ORDER BY created_at ASC",
      [id],
    );
    return {
      id: t.id,
      name: t.name,
      propertyType: t.property_type,
      description: t.description,
      rules: ruleRows.map(rowToRule),
    };
  } finally {
    client.release();
  }
}

export async function createTemplate(
  input: CreateTemplateInput,
): Promise<ComplianceTemplate> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTables(client);
    const { rows } = await client.query<TemplateRow>(
      `INSERT INTO compliance_templates (name, property_type, description)
       VALUES ($1, $2, $3) RETURNING *`,
      [input.name, input.propertyType, input.description ?? null],
    );
    return {
      id: rows[0].id,
      name: rows[0].name,
      propertyType: rows[0].property_type,
      description: rows[0].description,
      rules: [],
    };
  } finally {
    client.release();
  }
}

export async function updateTemplate(
  id: string,
  input: UpdateTemplateInput,
): Promise<ComplianceTemplate | null> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const setParts: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (input.name !== undefined) {
      setParts.push(`name = $${idx++}`);
      values.push(input.name);
    }
    if (input.propertyType !== undefined) {
      setParts.push(`property_type = $${idx++}`);
      values.push(input.propertyType);
    }
    if (input.description !== undefined) {
      setParts.push(`description = $${idx++}`);
      values.push(input.description);
    }
    if (setParts.length === 0) return getTemplateById(id);
    setParts.push("updated_at = NOW()");
    values.push(id);
    const { rows } = await client.query<TemplateRow>(
      `UPDATE compliance_templates SET ${setParts.join(", ")} WHERE id = $${idx} RETURNING *`,
      values,
    );
    if (rows.length === 0) return null;
    const { rows: ruleRows } = await client.query<RuleRow>(
      "SELECT * FROM compliance_rules WHERE template_id = $1 ORDER BY created_at ASC",
      [id],
    );
    return {
      id: rows[0].id,
      name: rows[0].name,
      propertyType: rows[0].property_type,
      description: rows[0].description,
      rules: ruleRows.map(rowToRule),
    };
  } finally {
    client.release();
  }
}

export async function deleteTemplate(id: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM compliance_templates WHERE id = $1", [id]);
  } finally {
    client.release();
  }
}

// ── Rule queries ───────────────────────────────────────────────────────────

export async function createRule(input: CreateRuleInput): Promise<CoverageRule> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query<RuleRow>(
      `INSERT INTO compliance_rules
         (template_id, coverage_type, required,
          min_occurrence_limit, min_aggregate_limit,
          additional_insured_required, waiver_of_subrogation_required)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        input.templateId,
        input.coverageType,
        input.required ?? true,
        input.minOccurrenceLimit ?? null,
        input.minAggregateLimit ?? null,
        input.additionalInsuredRequired ?? false,
        input.waiverOfSubrogationRequired ?? false,
      ],
    );
    return rowToRule(rows[0]);
  } finally {
    client.release();
  }
}

export async function updateRule(
  id: string,
  input: UpdateRuleInput,
): Promise<CoverageRule | null> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const setParts: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (input.coverageType !== undefined) {
      setParts.push(`coverage_type = $${idx++}`);
      values.push(input.coverageType);
    }
    if (input.required !== undefined) {
      setParts.push(`required = $${idx++}`);
      values.push(input.required);
    }
    if (input.minOccurrenceLimit !== undefined) {
      setParts.push(`min_occurrence_limit = $${idx++}`);
      values.push(input.minOccurrenceLimit);
    }
    if (input.minAggregateLimit !== undefined) {
      setParts.push(`min_aggregate_limit = $${idx++}`);
      values.push(input.minAggregateLimit);
    }
    if (input.additionalInsuredRequired !== undefined) {
      setParts.push(`additional_insured_required = $${idx++}`);
      values.push(input.additionalInsuredRequired);
    }
    if (input.waiverOfSubrogationRequired !== undefined) {
      setParts.push(`waiver_of_subrogation_required = $${idx++}`);
      values.push(input.waiverOfSubrogationRequired);
    }
    if (setParts.length === 0) {
      const { rows } = await client.query<RuleRow>(
        "SELECT * FROM compliance_rules WHERE id = $1",
        [id],
      );
      return rows.length > 0 ? rowToRule(rows[0]) : null;
    }
    setParts.push("updated_at = NOW()");
    values.push(id);
    const { rows } = await client.query<RuleRow>(
      `UPDATE compliance_rules SET ${setParts.join(", ")} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return rows.length > 0 ? rowToRule(rows[0]) : null;
  } finally {
    client.release();
  }
}

export async function deleteRule(id: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM compliance_rules WHERE id = $1", [id]);
  } finally {
    client.release();
  }
}

// ── Scoring ────────────────────────────────────────────────────────────────

export async function scoreCoiExtraction(
  coiExtractionId: string,
  templateId: string,
  coverages: ExtractedCoverage[],
): Promise<ComplianceResult> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTables(client);
    const { rows: tRows } = await client.query<TemplateRow>(
      "SELECT * FROM compliance_templates WHERE id = $1",
      [templateId],
    );
    if (tRows.length === 0) {
      throw new Error(`Compliance template ${templateId} not found`);
    }
    const { rows: rRows } = await client.query<RuleRow>(
      "SELECT * FROM compliance_rules WHERE template_id = $1 ORDER BY created_at ASC",
      [templateId],
    );
    const template: ComplianceTemplate = {
      id: tRows[0].id,
      name: tRows[0].name,
      propertyType: tRows[0].property_type,
      description: tRows[0].description,
      rules: rRows.map(rowToRule),
    };
    const evaluation = evaluateTemplate(template, coverages);
    const { rows: resultRows } = await client.query<ResultRow>(
      `INSERT INTO compliance_results
         (coi_extraction_id, template_id, overall_status,
          rule_results, pass_count, fail_count, gap_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        coiExtractionId,
        templateId,
        evaluation.overallStatus,
        JSON.stringify(evaluation.ruleResults),
        evaluation.passCount,
        evaluation.failCount,
        evaluation.gapCount,
      ],
    );
    const row = resultRows[0];
    return {
      id: row.id,
      coiExtractionId: row.coi_extraction_id,
      templateId: row.template_id,
      overallStatus: row.overall_status as "pass" | "fail" | "gap",
      ruleResults: evaluation.ruleResults,
      passCount: row.pass_count,
      failCount: row.fail_count,
      gapCount: row.gap_count,
      evaluatedAt: row.evaluated_at,
    };
  } finally {
    client.release();
  }
}
