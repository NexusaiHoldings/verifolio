/**
 * /review-queue/[extractionId] — COI extraction detail + review form.
 *
 * Feature F1-007: Reviewers can inspect all extracted field values, correct
 * any that are wrong, choose approve or reject, and add notes. On approval
 * the extraction is promoted to coi_certificates and compliance re-scoring
 * is triggered.
 */
import type { JSX } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/admin-auth";
import {
  getExtractionDetail,
  submitReview,
} from "@/lib/coi/review-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: { extractionId: string };
}

function fieldRow(
  label: string,
  name: string,
  value: string | null | undefined,
  confidence: number | undefined,
  type: "text" | "date" = "text",
): JSX.Element {
  const pct = confidence !== undefined ? Math.round(confidence * 100) : null;
  const badgeColor =
    pct === null
      ? "bg-gray-100 text-gray-500"
      : pct >= 80
        ? "bg-green-100 text-green-700"
        : pct >= 60
          ? "bg-yellow-100 text-yellow-800"
          : "bg-red-100 text-red-700";
  return (
    <div className="grid grid-cols-3 gap-4 py-3">
      <div className="flex items-center">
        <label
          htmlFor={name}
          className="block text-sm font-medium text-gray-700"
        >
          {label}
        </label>
      </div>
      <div className="col-span-2 flex items-center gap-3">
        <input
          id={name}
          name={name}
          type={type}
          defaultValue={value ?? ""}
          className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {pct !== null && (
          <span
            className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${badgeColor}`}
            title="AI extraction confidence"
          >
            {pct}%
          </span>
        )}
      </div>
    </div>
  );
}

export default async function ReviewDetailPage({
  params,
}: PageProps): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const detail = await getExtractionDetail(params.extractionId);
  if (!detail) notFound();

  const fc = detail.field_confidences ?? {};

  async function handleReviewSubmit(formData: FormData): Promise<void> {
    "use server";

    const sessionUser = await getSessionUser();
    if (!sessionUser) redirect("/login");

    const decision = formData.get("decision") as string;
    if (decision !== "approve" && decision !== "reject") {
      return;
    }

    const corrected_fields: Record<string, string> = {};
    const knownFields = [
      "policy_type",
      "insured_name",
      "policy_number",
      "effective_date",
      "expiration_date",
      "general_liability_limit",
      "auto_liability_limit",
      "workers_comp_limit",
      "umbrella_limit",
      "certificate_holder",
    ] as const;

    for (const field of knownFields) {
      const val = formData.get(field);
      if (typeof val === "string" && val.trim()) {
        corrected_fields[field] = val.trim();
      }
    }

    const extractionId = formData.get("extraction_id") as string;

    await submitReview({
      extraction_id: extractionId,
      decision,
      corrected_fields,
      reviewer_notes: (formData.get("reviewer_notes") as string | null) ?? "",
      reviewer_id: sessionUser.id,
    });

    redirect("/review-queue");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/review-queue"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          ← Review Queue
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-semibold text-gray-900">
          Review Extraction
        </h1>
      </div>

      {/* Meta summary */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
        <div className="grid grid-cols-2 gap-y-1 text-gray-600">
          <span className="font-medium">Vendor:</span>
          <span>{detail.vendor_name ?? "—"}</span>
          <span className="font-medium">Overall confidence:</span>
          <span>{Math.round(detail.confidence_score * 100)}%</span>
          <span className="font-medium">Status:</span>
          <span className="capitalize">{detail.status.replace("_", " ")}</span>
          {detail.escalation_reason && (
            <>
              <span className="font-medium">Escalation reason:</span>
              <span>{detail.escalation_reason}</span>
            </>
          )}
          {detail.document_url && (
            <>
              <span className="font-medium">Source document:</span>
              <a
                href={detail.document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                View document ↗
              </a>
            </>
          )}
        </div>
      </div>

      <form action={handleReviewSubmit}>
        <input
          type="hidden"
          name="extraction_id"
          value={detail.extraction_id}
        />

        {/* Extracted fields */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Extracted Fields
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Correct any fields that the AI extracted incorrectly. Confidence
              percentages are shown per field.
            </p>
          </div>
          <div className="divide-y divide-gray-100 px-4">
            {fieldRow("Policy Type", "policy_type", detail.policy_type, fc.policy_type)}
            {fieldRow("Insured Name", "insured_name", detail.insured_name, fc.insured_name)}
            {fieldRow("Policy Number", "policy_number", detail.policy_number, fc.policy_number)}
            {fieldRow("Effective Date", "effective_date", detail.effective_date, fc.effective_date, "date")}
            {fieldRow("Expiration Date", "expiration_date", detail.expiration_date, fc.expiration_date, "date")}
            {fieldRow("General Liability Limit", "general_liability_limit", detail.general_liability_limit, fc.general_liability_limit)}
            {fieldRow("Auto Liability Limit", "auto_liability_limit", detail.auto_liability_limit, fc.auto_liability_limit)}
            {fieldRow("Workers Comp Limit", "workers_comp_limit", detail.workers_comp_limit, fc.workers_comp_limit)}
            {fieldRow("Umbrella Limit", "umbrella_limit", detail.umbrella_limit, fc.umbrella_limit)}
            {fieldRow("Certificate Holder", "certificate_holder", detail.certificate_holder, fc.certificate_holder)}
          </div>
        </div>

        {/* Decision + notes */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Review Decision
            </h2>
          </div>
          <div className="space-y-4 px-4 py-4">
            <div className="flex gap-6">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="decision"
                  value="approve"
                  required
                  className="accent-green-600"
                />
                <span className="text-sm font-medium text-green-700">
                  Approve — promote to active certificate
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="decision"
                  value="reject"
                  className="accent-red-600"
                />
                <span className="text-sm font-medium text-red-700">
                  Reject — discard this extraction
                </span>
              </label>
            </div>

            <div>
              <label
                htmlFor="reviewer_notes"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Reviewer Notes
              </label>
              <textarea
                id="reviewer_notes"
                name="reviewer_notes"
                rows={3}
                defaultValue={detail.reviewer_notes ?? ""}
                placeholder="Optional notes about this review decision…"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/review-queue"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Submit Review
          </button>
        </div>
      </form>
    </main>
  );
}
