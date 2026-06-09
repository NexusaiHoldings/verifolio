/**
 * ACORD 25/27/28 field schema for AI extraction.
 * ACORD 25 — Certificate of Liability Insurance
 * ACORD 27 — Evidence of Property Insurance
 * ACORD 28 — Evidence of Commercial Property Insurance
 */

export type AcordFormType = "ACORD_25" | "ACORD_27" | "ACORD_28";

export const CONFIDENCE_THRESHOLD = 0.85;

export interface ConfidenceField<T> {
  value: T | null;
  confidence: number; // 0.0 – 1.0
}

// ── Coverage limit blocks ──────────────────────────────────────────────────────

export interface GeneralLiabilityLimits {
  each_occurrence: ConfidenceField<number>;
  damage_to_rented_premises: ConfidenceField<number>;
  med_exp_any_one_person: ConfidenceField<number>;
  personal_advertising_injury: ConfidenceField<number>;
  general_aggregate: ConfidenceField<number>;
  products_completed_ops_aggregate: ConfidenceField<number>;
}

export interface AutoLiabilityLimits {
  combined_single_limit: ConfidenceField<number>;
  bodily_injury_per_person: ConfidenceField<number>;
  bodily_injury_per_accident: ConfidenceField<number>;
  property_damage_per_accident: ConfidenceField<number>;
}

export interface WorkersCompLimits {
  el_each_accident: ConfidenceField<number>;
  el_disease_policy_limit: ConfidenceField<number>;
  el_disease_each_employee: ConfidenceField<number>;
}

export interface UmbrellaExcessLimits {
  each_occurrence: ConfidenceField<number>;
  aggregate: ConfidenceField<number>;
}

export interface PropertyCoverageLimits {
  building_limit: ConfidenceField<number>;
  business_personal_property_limit: ConfidenceField<number>;
  business_income_limit: ConfidenceField<number>;
  deductible: ConfidenceField<number>;
  coinsurance_pct: ConfidenceField<string>;
  valuation: ConfidenceField<string>;
}

// ── Coverage sections ──────────────────────────────────────────────────────────

export interface GeneralLiabilityCoverage {
  is_occurrence_form: ConfidenceField<boolean>;
  is_claims_made: ConfidenceField<boolean>;
  additional_insured: ConfidenceField<boolean>;
  subrogation_waived: ConfidenceField<boolean>;
  policy_number: ConfidenceField<string>;
  effective_date: ConfidenceField<string>; // ISO date string
  expiration_date: ConfidenceField<string>;
  limits: GeneralLiabilityLimits;
  insurer_letter: ConfidenceField<string>; // "A" | "B" | … | "F"
}

export interface AutoLiabilityCoverage {
  any_auto: ConfidenceField<boolean>;
  all_owned_autos: ConfidenceField<boolean>;
  scheduled_autos: ConfidenceField<boolean>;
  hired_autos: ConfidenceField<boolean>;
  non_owned_autos: ConfidenceField<boolean>;
  additional_insured: ConfidenceField<boolean>;
  subrogation_waived: ConfidenceField<boolean>;
  policy_number: ConfidenceField<string>;
  effective_date: ConfidenceField<string>;
  expiration_date: ConfidenceField<string>;
  limits: AutoLiabilityLimits;
  insurer_letter: ConfidenceField<string>;
}

export interface WorkersCompCoverage {
  policy_number: ConfidenceField<string>;
  effective_date: ConfidenceField<string>;
  expiration_date: ConfidenceField<string>;
  limits: WorkersCompLimits;
  insurer_letter: ConfidenceField<string>;
}

export interface UmbrellaExcessCoverage {
  is_umbrella: ConfidenceField<boolean>;
  is_excess: ConfidenceField<boolean>;
  claims_made: ConfidenceField<boolean>;
  deductible: ConfidenceField<number>;
  retention: ConfidenceField<number>;
  policy_number: ConfidenceField<string>;
  effective_date: ConfidenceField<string>;
  expiration_date: ConfidenceField<string>;
  limits: UmbrellaExcessLimits;
  insurer_letter: ConfidenceField<string>;
}

export interface PropertyCoverage {
  policy_number: ConfidenceField<string>;
  effective_date: ConfidenceField<string>;
  expiration_date: ConfidenceField<string>;
  limits: PropertyCoverageLimits;
  insurer_letter: ConfidenceField<string>;
  blanket_or_specific: ConfidenceField<string>;
  causes_of_loss: ConfidenceField<string>; // "Basic" | "Broad" | "Special"
}

// ── Parties ────────────────────────────────────────────────────────────────────

export interface InsurerEntry {
  name: ConfidenceField<string>;
  naic_code: ConfidenceField<string>;
}

export interface NamedInsured {
  name: ConfidenceField<string>;
  address: ConfidenceField<string>;
  city_state_zip: ConfidenceField<string>;
}

export interface AdditionalInsuredEntry {
  name: ConfidenceField<string>;
  address: ConfidenceField<string>;
}

export interface CertificateHolder {
  name: ConfidenceField<string>;
  address: ConfidenceField<string>;
  city_state_zip: ConfidenceField<string>;
}

export interface ProducerInfo {
  name: ConfidenceField<string>;
  contact_name: ConfidenceField<string>;
  address: ConfidenceField<string>;
  phone: ConfidenceField<string>;
  fax: ConfidenceField<string>;
  email: ConfidenceField<string>;
  license_no: ConfidenceField<string>;
}

// ── Top-level extraction result ────────────────────────────────────────────────

export interface AcordExtractionResult {
  form_type: AcordFormType;
  certificate_number: ConfidenceField<string>;
  date_issued: ConfidenceField<string>;

  producer: ProducerInfo;
  named_insured: NamedInsured;

  insurers: {
    insurer_a: InsurerEntry;
    insurer_b: InsurerEntry;
    insurer_c: InsurerEntry;
    insurer_d: InsurerEntry;
    insurer_e: InsurerEntry;
    insurer_f: InsurerEntry;
  };

  general_liability: GeneralLiabilityCoverage | null;
  automobile_liability: AutoLiabilityCoverage | null;
  workers_compensation: WorkersCompCoverage | null;
  umbrella_excess: UmbrellaExcessCoverage | null;
  property_coverage: PropertyCoverage | null;

  additional_insureds: AdditionalInsuredEntry[];
  certificate_holder: CertificateHolder;
  description_of_operations: ConfidenceField<string>;

  overall_confidence: number;
  needs_human_review: boolean;
  low_confidence_fields: string[];
}

// ── JSON schema passed to the AI for structured output ─────────────────────────

export const ACORD_EXTRACTION_FUNCTION = {
  name: "extract_acord_fields",
  description:
    "Extract all fields from an ACORD 25, 27, or 28 Certificate of Insurance. " +
    "Return null for sections not present in the document. " +
    "Confidence scores range from 0.0 (cannot read) to 1.0 (certain).",
  parameters: {
    type: "object",
    required: ["form_type", "certificate_number", "date_issued", "named_insured", "certificate_holder", "overall_confidence"],
    properties: {
      form_type: { type: "string", enum: ["ACORD_25", "ACORD_27", "ACORD_28"] },
      certificate_number: {
        type: "object",
        required: ["value", "confidence"],
        properties: {
          value: { type: ["string", "null"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
      date_issued: {
        type: "object",
        required: ["value", "confidence"],
        properties: {
          value: { type: ["string", "null"], description: "ISO date YYYY-MM-DD" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
      producer: {
        type: "object",
        properties: {
          name: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] },
          contact_name: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] },
          address: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] },
          phone: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] },
          fax: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] },
          email: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] },
          license_no: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] },
        },
      },
      named_insured: {
        type: "object",
        required: ["name", "address", "city_state_zip"],
        properties: {
          name: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] },
          address: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] },
          city_state_zip: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] },
        },
      },
      insurers: {
        type: "object",
        description: "Up to 6 insurers labeled A through F",
        properties: {
          insurer_a: { type: "object", properties: { name: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] }, naic_code: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] } } },
          insurer_b: { type: "object", properties: { name: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] }, naic_code: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] } } },
          insurer_c: { type: "object", properties: { name: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] }, naic_code: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] } } },
          insurer_d: { type: "object", properties: { name: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] }, naic_code: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] } } },
          insurer_e: { type: "object", properties: { name: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] }, naic_code: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] } } },
          insurer_f: { type: "object", properties: { name: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] }, naic_code: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] } } },
        },
      },
      general_liability: {
        type: ["object", "null"],
        description: "General liability coverage block — null if not present",
      },
      automobile_liability: {
        type: ["object", "null"],
        description: "Auto liability coverage block — null if not present",
      },
      workers_compensation: {
        type: ["object", "null"],
        description: "Workers compensation coverage block — null if not present",
      },
      umbrella_excess: {
        type: ["object", "null"],
        description: "Umbrella/excess liability block — null if not present",
      },
      property_coverage: {
        type: ["object", "null"],
        description: "Property coverage block (ACORD 27/28) — null if not present",
      },
      additional_insureds: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] },
            address: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] },
          },
        },
      },
      certificate_holder: {
        type: "object",
        required: ["name", "address", "city_state_zip"],
        properties: {
          name: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] },
          address: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] },
          city_state_zip: { type: "object", properties: { value: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["value", "confidence"] },
        },
      },
      description_of_operations: {
        type: "object",
        properties: {
          value: { type: ["string", "null"] },
          confidence: { type: "number" },
        },
        required: ["value", "confidence"],
      },
      overall_confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "Weighted average confidence across all extracted fields",
      },
    },
  },
} as const;

/** Returns the human-readable label for a form type. */
export function acordFormLabel(form: AcordFormType): string {
  const labels: Record<AcordFormType, string> = {
    ACORD_25: "ACORD 25 — Certificate of Liability Insurance",
    ACORD_27: "ACORD 27 — Evidence of Property Insurance",
    ACORD_28: "ACORD 28 — Evidence of Commercial Property Insurance",
  };
  return labels[form];
}

/** Collects field paths with confidence below the threshold. */
export function collectLowConfidenceFields(
  result: Omit<AcordExtractionResult, "needs_human_review" | "low_confidence_fields">,
  threshold: number = CONFIDENCE_THRESHOLD,
): string[] {
  const low: string[] = [];

  function check(path: string, field: { confidence: number } | null | undefined): void {
    if (field && field.confidence < threshold) {
      low.push(path);
    }
  }

  check("certificate_number", result.certificate_number);
  check("date_issued", result.date_issued);
  check("named_insured.name", result.named_insured?.name);
  check("named_insured.address", result.named_insured?.address);
  check("certificate_holder.name", result.certificate_holder?.name);
  check("certificate_holder.address", result.certificate_holder?.address);

  const gl = result.general_liability;
  if (gl) {
    check("gl.policy_number", gl.policy_number);
    check("gl.effective_date", gl.effective_date);
    check("gl.expiration_date", gl.expiration_date);
    check("gl.limits.each_occurrence", gl.limits.each_occurrence);
    check("gl.limits.general_aggregate", gl.limits.general_aggregate);
  }

  const al = result.automobile_liability;
  if (al) {
    check("auto.policy_number", al.policy_number);
    check("auto.effective_date", al.effective_date);
    check("auto.expiration_date", al.expiration_date);
  }

  const wc = result.workers_compensation;
  if (wc) {
    check("wc.policy_number", wc.policy_number);
    check("wc.effective_date", wc.effective_date);
    check("wc.expiration_date", wc.expiration_date);
  }

  const umb = result.umbrella_excess;
  if (umb) {
    check("umbrella.policy_number", umb.policy_number);
    check("umbrella.effective_date", umb.effective_date);
    check("umbrella.expiration_date", umb.expiration_date);
  }

  const prop = result.property_coverage;
  if (prop) {
    check("property.policy_number", prop.policy_number);
    check("property.effective_date", prop.effective_date);
    check("property.expiration_date", prop.expiration_date);
  }

  return low;
}
