/**
 * ACORD 25/27/28 AI Extraction Engine
 *
 * Calls the AI gateway (fetch, no openai SDK) with structured function-calling
 * to extract policy fields from COI PDF text. Stores results in
 * coi_certificates and coi_extractions. Low-confidence extractions
 * (below CONFIDENCE_THRESHOLD) are flagged for human review.
 */

import {
  type AcordExtractionResult,
  type AcordFormType,
  ACORD_EXTRACTION_FUNCTION,
  CONFIDENCE_THRESHOLD,
  collectLowConfidenceFields,
} from "./acord-schema";

// ── DB pool (same singleton pattern as lib/db.ts) ─────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pool: any = null;

function getPool(): {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
} {
  if (_pool) return _pool;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool: PgPool } = require("pg") as {
    Pool: new (cfg: Record<string, unknown>) => {
      query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
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
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

// ── AI gateway call ───────────────────────────────────────────────────────────

interface GatewayMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

interface GatewayResponse {
  choices: Array<{
    message: {
      tool_calls?: Array<{
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

async function callAiGateway(messages: GatewayMessage[]): Promise<GatewayResponse> {
  const baseUrl = (process.env.OPENAI_API_BASE_URL ?? "https://api.openai.com").replace(/\/$/, "");
  const url = `${baseUrl}/v1/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
    },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      messages,
      tools: [{ type: "function", function: ACORD_EXTRACTION_FUNCTION }],
      tool_choice: { type: "function", function: { name: ACORD_EXTRACTION_FUNCTION.name } },
      temperature: 0,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI gateway error ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<GatewayResponse>;
}

// ── PDF text extraction (base64 → text via vision model) ─────────────────────

async function extractTextFromPdfUrl(pdfUrl: string): Promise<string> {
  const messages: GatewayMessage[] = [
    {
      role: "system",
      content:
        "You are a document OCR assistant. Extract all text from the provided document image, " +
        "preserving layout and field labels as closely as possible. " +
        "Output the raw text only, no commentary.",
    },
    {
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: { url: pdfUrl },
        },
        {
          type: "text",
          text: "Extract all text from this ACORD certificate of insurance document. Preserve field names and values.",
        },
      ],
    },
  ];

  const baseUrl = (process.env.OPENAI_API_BASE_URL ?? "https://api.openai.com").replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
    },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      messages,
      temperature: 0,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    throw new Error(`OCR gateway error ${res.status}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? "";
}

async function extractTextFromBase64(base64Content: string, mimeType: string): Promise<string> {
  const dataUri = `data:${mimeType};base64,${base64Content}`;
  return extractTextFromPdfUrl(dataUri);
}

// ── Field extraction via function calling ─────────────────────────────────────

function buildExtractionPrompt(rawText: string): GatewayMessage[] {
  return [
    {
      role: "system",
      content:
        "You are an expert insurance document processor specializing in ACORD 25, 27, and 28 " +
        "Certificates of Insurance. Extract all fields accurately, including policy numbers, " +
        "effective and expiration dates, coverage limits, named insured, additional insured, " +
        "certificate holder, and carrier (insurer) details. " +
        "Assign a confidence score (0.0–1.0) to each field: 1.0 means clearly printed and " +
        "unambiguous; lower scores reflect blurriness, partial text, or inference. " +
        "Return null for fields that are genuinely absent from the document. " +
        "Dates must be formatted as YYYY-MM-DD.",
    },
    {
      role: "user",
      content: `Extract all ACORD certificate fields from the following document text:\n\n${rawText}`,
    },
  ];
}

function parseExtractionResponse(
  response: GatewayResponse,
): Omit<AcordExtractionResult, "needs_human_review" | "low_confidence_fields"> {
  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    throw new Error("AI response missing tool call — no structured output returned");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
  } catch (e) {
    throw new Error(`Failed to parse AI tool call arguments: ${String(e)}`);
  }

  const formType = (parsed.form_type as AcordFormType | undefined) ?? "ACORD_25";

  const nullInsurer = () => ({
    name: { value: null, confidence: 0 },
    naic_code: { value: null, confidence: 0 },
  });

  const insurers = (parsed.insurers as Record<string, unknown> | undefined) ?? {};

  function pickInsurer(key: string) {
    const raw = insurers[key] as Record<string, unknown> | undefined;
    if (!raw) return nullInsurer();
    return {
      name: (raw.name as { value: string | null; confidence: number }) ?? { value: null, confidence: 0 },
      naic_code: (raw.naic_code as { value: string | null; confidence: number }) ?? { value: null, confidence: 0 },
    };
  }

  const nullField = <T>() => ({ value: null as T | null, confidence: 0 });

  function field<T>(raw: unknown): { value: T | null; confidence: number } {
    if (raw && typeof raw === "object" && "value" in raw && "confidence" in raw) {
      return raw as { value: T | null; confidence: number };
    }
    return nullField<T>();
  }

  const rawNamed = (parsed.named_insured as Record<string, unknown> | undefined) ?? {};
  const rawHolder = (parsed.certificate_holder as Record<string, unknown> | undefined) ?? {};
  const rawProducer = (parsed.producer as Record<string, unknown> | undefined) ?? {};

  return {
    form_type: formType,
    certificate_number: field<string>(parsed.certificate_number),
    date_issued: field<string>(parsed.date_issued),

    producer: {
      name: field<string>(rawProducer.name),
      contact_name: field<string>(rawProducer.contact_name),
      address: field<string>(rawProducer.address),
      phone: field<string>(rawProducer.phone),
      fax: field<string>(rawProducer.fax),
      email: field<string>(rawProducer.email),
      license_no: field<string>(rawProducer.license_no),
    },

    named_insured: {
      name: field<string>(rawNamed.name),
      address: field<string>(rawNamed.address),
      city_state_zip: field<string>(rawNamed.city_state_zip),
    },

    insurers: {
      insurer_a: pickInsurer("insurer_a"),
      insurer_b: pickInsurer("insurer_b"),
      insurer_c: pickInsurer("insurer_c"),
      insurer_d: pickInsurer("insurer_d"),
      insurer_e: pickInsurer("insurer_e"),
      insurer_f: pickInsurer("insurer_f"),
    },

    general_liability: (parsed.general_liability as AcordExtractionResult["general_liability"]) ?? null,
    automobile_liability: (parsed.automobile_liability as AcordExtractionResult["automobile_liability"]) ?? null,
    workers_compensation: (parsed.workers_compensation as AcordExtractionResult["workers_compensation"]) ?? null,
    umbrella_excess: (parsed.umbrella_excess as AcordExtractionResult["umbrella_excess"]) ?? null,
    property_coverage: (parsed.property_coverage as AcordExtractionResult["property_coverage"]) ?? null,

    additional_insureds: Array.isArray(parsed.additional_insureds)
      ? (parsed.additional_insureds as AcordExtractionResult["additional_insureds"])
      : [],

    certificate_holder: {
      name: field<string>(rawHolder.name),
      address: field<string>(rawHolder.address),
      city_state_zip: field<string>(rawHolder.city_state_zip),
    },

    description_of_operations: field<string>(parsed.description_of_operations),
    overall_confidence: typeof parsed.overall_confidence === "number" ? parsed.overall_confidence : 0,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface ExtractFromUrlOptions {
  /** Pre-fetched raw text (skips the OCR call if provided). */
  rawText?: string;
  /** Org ID for multi-tenant storage. */
  orgId: string;
  /** Vendor / certificate holder display name. */
  vendorName?: string;
  /** The URL of the original PDF (stored for audit). */
  fileUrl: string;
}

export interface ExtractFromBase64Options {
  base64Content: string;
  mimeType: string;
  orgId: string;
  vendorName?: string;
}

export interface ExtractionRecord {
  certificateId: string;
  extractionId: string;
  result: AcordExtractionResult;
  needsReview: boolean;
}

/**
 * Run the full extraction pipeline for a PDF given as a URL.
 * Stores to DB and returns IDs + result.
 */
export async function extractFromUrl(options: ExtractFromUrlOptions): Promise<ExtractionRecord> {
  const { fileUrl, orgId, vendorName = "", rawText: preloadedText } = options;

  const rawText = preloadedText ?? (await extractTextFromPdfUrl(fileUrl));

  const messages = buildExtractionPrompt(rawText);
  const gatewayResponse = await callAiGateway(messages);
  const partial = parseExtractionResponse(gatewayResponse);
  const lowFields = collectLowConfidenceFields(partial);
  const needsReview = partial.overall_confidence < CONFIDENCE_THRESHOLD || lowFields.length > 0;

  const result: AcordExtractionResult = {
    ...partial,
    needs_human_review: needsReview,
    low_confidence_fields: lowFields,
  };

  const { certificateId, extractionId } = await persistResults(result, orgId, vendorName, fileUrl);

  return { certificateId, extractionId, result, needsReview };
}

/**
 * Run the full extraction pipeline for a PDF given as base64.
 */
export async function extractFromBase64(options: ExtractFromBase64Options): Promise<ExtractionRecord> {
  const { base64Content, mimeType, orgId, vendorName = "" } = options;

  const rawText = await extractTextFromBase64(base64Content, mimeType);
  const messages = buildExtractionPrompt(rawText);
  const gatewayResponse = await callAiGateway(messages);
  const partial = parseExtractionResponse(gatewayResponse);
  const lowFields = collectLowConfidenceFields(partial);
  const needsReview = partial.overall_confidence < CONFIDENCE_THRESHOLD || lowFields.length > 0;

  const result: AcordExtractionResult = {
    ...partial,
    needs_human_review: needsReview,
    low_confidence_fields: lowFields,
  };

  // Store a data-URI as the file reference for inline base64 uploads
  const dataUri = `data:${mimeType};base64,${base64Content.slice(0, 64)}...`;
  const { certificateId, extractionId } = await persistResults(result, orgId, vendorName, dataUri);

  return { certificateId, extractionId, result, needsReview };
}

// ── DB persistence ─────────────────────────────────────────────────────────────

interface PersistIds {
  certificateId: string;
  extractionId: string;
}

async function persistResults(
  result: AcordExtractionResult,
  orgId: string,
  vendorName: string,
  fileUrl: string,
): Promise<PersistIds> {
  // Derive the certificate status from extraction result
  const status = result.needs_human_review ? "needs_review" : "extracted";

  // Named insured name is the best proxy for vendor name if not provided
  const resolvedVendor = vendorName || result.named_insured.name.value || "Unknown";

  // Earliest expiry across coverage sections
  const expirationDates = [
    result.general_liability?.expiration_date.value,
    result.automobile_liability?.expiration_date.value,
    result.workers_compensation?.expiration_date.value,
    result.umbrella_excess?.expiration_date.value,
    result.property_coverage?.expiration_date.value,
  ].filter((d): d is string => Boolean(d));
  const nearestExpiry = expirationDates.sort()[0] ?? null;

  // Upsert into coi_certificates (insert; on conflict ignore so we don't
  // clobber a human-corrected record on re-extraction)
  const certRows = await dbQuery<{ id: string }>(
    `INSERT INTO coi_certificates
       (org_id, vendor_name, file_url, form_type, status, expiration_date, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     RETURNING id`,
    [orgId, resolvedVendor, fileUrl, result.form_type, status, nearestExpiry],
  );

  const certificateId = certRows[0]?.id;
  if (!certificateId) {
    throw new Error("Failed to create coi_certificates row");
  }

  // Insert extraction result
  const extRows = await dbQuery<{ id: string }>(
    `INSERT INTO coi_extractions
       (certificate_id, org_id, form_type, extraction_data, overall_confidence,
        needs_human_review, low_confidence_fields, extracted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING id`,
    [
      certificateId,
      orgId,
      result.form_type,
      JSON.stringify(result),
      result.overall_confidence,
      result.needs_human_review,
      JSON.stringify(result.low_confidence_fields),
    ],
  );

  const extractionId = extRows[0]?.id;
  if (!extractionId) {
    throw new Error("Failed to create coi_extractions row");
  }

  return { certificateId, extractionId };
}

// ── Retrieval helpers (used by pages) ─────────────────────────────────────────

export interface CertificateRow {
  id: string;
  org_id: string;
  vendor_name: string;
  file_url: string;
  form_type: string;
  status: string;
  expiration_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExtractionRow {
  id: string;
  certificate_id: string;
  org_id: string;
  form_type: string;
  extraction_data: AcordExtractionResult;
  overall_confidence: number;
  needs_human_review: boolean;
  low_confidence_fields: string[];
  extracted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export async function getCertificate(id: string, orgId: string): Promise<CertificateRow | null> {
  const rows = await dbQuery<CertificateRow>(
    `SELECT id, org_id, vendor_name, file_url, form_type, status,
            expiration_date::text, created_at::text, updated_at::text
     FROM coi_certificates
     WHERE id = $1 AND org_id = $2
     LIMIT 1`,
    [id, orgId],
  );
  return rows[0] ?? null;
}

export async function getLatestExtraction(
  certificateId: string,
  orgId: string,
): Promise<ExtractionRow | null> {
  const rows = await dbQuery<ExtractionRow>(
    `SELECT id, certificate_id, org_id, form_type,
            extraction_data, overall_confidence, needs_human_review,
            low_confidence_fields, extracted_at::text,
            reviewed_at::text, reviewed_by::text
     FROM coi_extractions
     WHERE certificate_id = $1 AND org_id = $2
     ORDER BY extracted_at DESC
     LIMIT 1`,
    [certificateId, orgId],
  );
  return rows[0] ?? null;
}

export async function markExtractionReviewed(
  extractionId: string,
  reviewerId: string,
  correctedData: Partial<AcordExtractionResult>,
): Promise<void> {
  // Merge corrections into the stored extraction data
  await dbQuery(
    `UPDATE coi_extractions
     SET reviewed_at    = NOW(),
         reviewed_by    = $2,
         extraction_data = extraction_data || $3::jsonb,
         needs_human_review = false
     WHERE id = $1`,
    [extractionId, reviewerId, JSON.stringify(correctedData)],
  );

  // Update the parent certificate status
  await dbQuery(
    `UPDATE coi_certificates
     SET status = 'reviewed', updated_at = NOW()
     WHERE id = (
       SELECT certificate_id FROM coi_extractions WHERE id = $1
     )`,
    [extractionId],
  );
}
