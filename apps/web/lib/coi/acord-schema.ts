/**
 * ACORD 25/27/28 field types and JSON Schema for GPT structured-output extraction.
 * ACORD 25 = Certificate of Liability Insurance
 * ACORD 27 = Evidence of Property Insurance
 * ACORD 28 = Evidence of Commercial Property Insurance
 */

export type AcordFormType = "ACORD_25" | "ACORD_27" | "ACORD_28";

export interface NamedInsured {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface Insurer {
  name: string;
  naic?: string;
}

export interface PolicyPeriod {
  effective_date: string;  // ISO 8601 date (YYYY-MM-DD)
  expiration_date: string; // ISO 8601 date (YYYY-MM-DD)
}

export interface GeneralLiabilityLimits {
  policy_number?: string;
  each_occurrence?: string;
  damage_to_rented_premises?: string;
  med_exp?: string;
  personal_advertising_injury?: string;
  general_aggregate?: string;
  products_comp_ops_aggregate?: string;
}

export interface AutoLiabilityLimits {
  policy_number?: string;
  combined_single_limit?: string;
  bodily_injury_per_person?: string;
  bodily_injury_per_accident?: string;
  property_damage?: string;
}

export interface UmbrellaLimits {
  policy_number?: string;
  each_occurrence?: string;
  aggregate?: string;
}

export interface WorkersCompLimits {
  policy_number?: string;
  el_each_accident?: string;
  el_disease_ea_employee?: string;
  el_disease_policy_limit?: string;
}

export interface PropertyLimits {
  policy_number?: string;
  building?: string;
  business_personal_property?: string;
  business_income?: string;
}

export interface AdditionalInsured {
  name: string;
  is_additional_insured: boolean;
  is_subrogation_waived?: boolean;
}

export interface AcordExtractionResult {
  form_type: AcordFormType;
  named_insured: NamedInsured;
  insurers: Insurer[];
  policy_number?: string;
  policy_period: PolicyPeriod;
  general_liability?: GeneralLiabilityLimits;
  auto_liability?: AutoLiabilityLimits;
  umbrella_liability?: UmbrellaLimits;
  workers_compensation?: WorkersCompLimits;
  property?: PropertyLimits;
  additional_insureds: AdditionalInsured[];
  certificate_holder: NamedInsured;
  description_of_operations?: string;
  confidence_score: number; // 0.0 – 1.0
  low_confidence_fields: string[];
}

export const CONFIDENCE_THRESHOLD = 0.85;

/** JSON Schema passed to GPT structured-output (response_format.json_schema.schema). */
export const ACORD_EXTRACTION_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "form_type", "named_insured", "insurers", "policy_period",
    "additional_insureds", "certificate_holder", "confidence_score",
    "low_confidence_fields",
  ],
  properties: {
    form_type: { type: "string", enum: ["ACORD_25", "ACORD_27", "ACORD_28"] },
    named_insured: {
      type: "object", additionalProperties: false,
      required: ["name"],
      properties: {
        name: { type: "string" }, address: { type: "string" },
        city: { type: "string" }, state: { type: "string" }, zip: { type: "string" },
      },
    },
    insurers: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["name"],
        properties: { name: { type: "string" }, naic: { type: "string" } },
      },
    },
    policy_number: { type: "string" },
    policy_period: {
      type: "object", additionalProperties: false,
      required: ["effective_date", "expiration_date"],
      properties: {
        effective_date: { type: "string" },
        expiration_date: { type: "string" },
      },
    },
    general_liability: {
      type: "object", additionalProperties: false,
      properties: {
        policy_number: { type: "string" }, each_occurrence: { type: "string" },
        damage_to_rented_premises: { type: "string" }, med_exp: { type: "string" },
        personal_advertising_injury: { type: "string" },
        general_aggregate: { type: "string" },
        products_comp_ops_aggregate: { type: "string" },
      },
    },
    auto_liability: {
      type: "object", additionalProperties: false,
      properties: {
        policy_number: { type: "string" }, combined_single_limit: { type: "string" },
        bodily_injury_per_person: { type: "string" },
        bodily_injury_per_accident: { type: "string" },
        property_damage: { type: "string" },
      },
    },
    umbrella_liability: {
      type: "object", additionalProperties: false,
      properties: {
        policy_number: { type: "string" },
        each_occurrence: { type: "string" }, aggregate: { type: "string" },
      },
    },
    workers_compensation: {
      type: "object", additionalProperties: false,
      properties: {
        policy_number: { type: "string" }, el_each_accident: { type: "string" },
        el_disease_ea_employee: { type: "string" },
        el_disease_policy_limit: { type: "string" },
      },
    },
    property: {
      type: "object", additionalProperties: false,
      properties: {
        policy_number: { type: "string" }, building: { type: "string" },
        business_personal_property: { type: "string" },
        business_income: { type: "string" },
      },
    },
    additional_insureds: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["name", "is_additional_insured"],
        properties: {
          name: { type: "string" },
          is_additional_insured: { type: "boolean" },
          is_subrogation_waived: { type: "boolean" },
        },
      },
    },
    certificate_holder: {
      type: "object", additionalProperties: false,
      required: ["name"],
      properties: {
        name: { type: "string" }, address: { type: "string" },
        city: { type: "string" }, state: { type: "string" }, zip: { type: "string" },
      },
    },
    description_of_operations: { type: "string" },
    confidence_score: { type: "number" },
    low_confidence_fields: { type: "array", items: { type: "string" } },
  },
};
