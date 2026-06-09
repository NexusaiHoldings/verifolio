/**
 * COI extraction engine — parses ACORD 25/27/28 PDFs via pdf-parse + GPT structured output.
 * Never imports the `openai` SDK; calls the chat completions endpoint via fetch.
 */
import { buildDb } from "@/lib/db";
import {
  ACORD_EXTRACTION_SCHEMA,
  AcordExtractionResult,
  CONFIDENCE_THRESHOLD,
} from "./acord-schema";

export interface ExtractionInput {
  pdfBuffer: Buffer;
  filename?: string;
  certificateId: string;
}

export interface ExtractionOutput {
  extraction: AcordExtractionResult;
  requiresReview: boolean;
  extractionId: string;
}

async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  // webpackIgnore keeps Next.js from bundling pdf-parse for the browser bundle.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require(/* webpackIgnore: true */ "pdf-parse") as (
    data: Buffer,
    options?: Record<string, unknown>
  ) => Promise<{ text: string; numpages: number }>;
  const result = await pdfParse(pdfBuffer, { max: 0 });
  if (!result.text || result.text.trim().length === 0) {
    throw new Error("PDF yielded no extractable text; document may be image-only");
  }
  return result.text;
}

async function callGptExtraction(pdfText: string): Promise<AcordExtractionResult> {
  const apiBase = process.env.OPENAI_API_BASE_URL ?? "https://api.openai.com/v1";
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY env var is not set");

  const systemPrompt =
    "You are an expert insurance document parser specializing in ACORD 25, 27, and 28 forms.\n" +
    "Extract every field from the certificate of insurance text supplied.\n" +
    "ACORD 25: Certificate of Liability Insurance — general liability, auto, umbrella/excess, workers comp limits.\n" +
    "ACORD 27: Evidence of Property Insurance — property coverage details.\n" +
    "ACORD 28: Evidence of Commercial Property Insurance — commercial property limits.\n" +
    "Always extract: named insured, certificate holder, policy periods (ISO 8601 YYYY-MM-DD), " +
    "all insurers with NAIC codes, all coverage limits, and additional insured endorsements.\n" +
    "Set confidence_score (0.0–1.0) to reflect overall extraction reliability.\n" +
    "List field names below 85% confidence in low_confidence_fields.\n" +
    "Format all currency amounts as strings (e.g. '1,000,000').";

  const response = await fetch(`${apiBase}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Extract all fields from this certificate of insurance document:\n\n${pdfText}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "acord_extraction",
          strict: true,
          schema: ACORD_EXTRACTION_SCHEMA,
        },
      },
      max_tokens: 4096,
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GPT API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string }; finish_reason: string }>;
  };
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from GPT");

  return JSON.parse(content) as AcordExtractionResult;
}

export async function extractCOIFromPdf(
  input: ExtractionInput
): Promise<ExtractionOutput> {
  const db = buildDb();

  const pdfText = await extractTextFromPdf(input.pdfBuffer);
  const extraction = await callGptExtraction(pdfText);

  const requiresReview =
    extraction.confidence_score < CONFIDENCE_THRESHOLD ||
    extraction.low_confidence_fields.length > 0;

  const extractionId = crypto.randomUUID();

  await db.execute(
    `INSERT INTO coi_extractions (
       id, certificate_id, form_type, named_insured, insurers,
       policy_period, general_liability, auto_liability, umbrella_liability,
       workers_compensation, property_coverage, additional_insureds,
       certificate_holder, description_of_operations, confidence_score,
       low_confidence_fields, requires_review, raw_extraction, created_at
     ) VALUES (
       $1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb,
       $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb,
       $14, $15, $16::jsonb, $17, $18::jsonb, NOW()
     )`,
    extractionId,
    input.certificateId,
    extraction.form_type,
    JSON.stringify(extraction.named_insured),
    JSON.stringify(extraction.insurers),
    JSON.stringify(extraction.policy_period),
    JSON.stringify(extraction.general_liability ?? null),
    JSON.stringify(extraction.auto_liability ?? null),
    JSON.stringify(extraction.umbrella_liability ?? null),
    JSON.stringify(extraction.workers_compensation ?? null),
    JSON.stringify(extraction.property ?? null),
    JSON.stringify(extraction.additional_insureds),
    JSON.stringify(extraction.certificate_holder),
    extraction.description_of_operations ?? null,
    extraction.confidence_score,
    JSON.stringify(extraction.low_confidence_fields),
    requiresReview,
    JSON.stringify(extraction),
  );

  await db.execute(
    `UPDATE coi_certificates
     SET form_type              = $1,
         named_insured_name     = $2,
         effective_date         = $3,
         expiration_date        = $4,
         extraction_status      = $5,
         latest_extraction_id   = $6,
         updated_at             = NOW()
     WHERE id = $7`,
    extraction.form_type,
    extraction.named_insured.name,
    extraction.policy_period.effective_date,
    extraction.policy_period.expiration_date,
    requiresReview ? "pending_review" : "completed",
    extractionId,
    input.certificateId,
  );

  return { extraction, requiresReview, extractionId };
}
