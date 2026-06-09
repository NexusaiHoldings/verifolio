/**
 * /properties/[id] — COI property detail / edit page.
 * Server component; requires authenticated session.
 * Use id="new" to render a blank creation form.
 */

import type { JSX } from "react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCoiSession } from "@/lib/coi/access";
import { getProperty, createProperty, updateProperty } from "@/lib/coi/properties";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PropertyDetailPageProps {
  params: { id: string };
  searchParams?: { saved?: string; error?: string };
}

export default async function PropertyDetailPage({
  params,
  searchParams,
}: PropertyDetailPageProps): Promise<JSX.Element> {
  const session = await getCoiSession();
  if (!session) redirect("/login");

  const isNew = params.id === "new";

  let property = null;
  if (!isNew) {
    try {
      property = await getProperty(session.orgId, params.id);
    } catch {
      property = null;
    }
    if (!property) notFound();
  }

  const saved = searchParams?.saved === "1";
  const errorMsg = searchParams?.error ?? null;

  const orgId = session.orgId;
  const propertyId = params.id;

  async function handleSave(data: FormData): Promise<never> {
    "use server";
    const name = (data.get("name") as string | null)?.trim() ?? "";
    if (!name) {
      redirect(`/properties/${propertyId}?error=Name+is+required`);
    }

    const unitCountRaw = (data.get("unit_count") as string | null)?.trim() ?? "";
    const parsedCount = unitCountRaw ? parseInt(unitCountRaw, 10) : null;
    const unitCount =
      parsedCount !== null && !isNaN(parsedCount) ? parsedCount : null;

    const input = {
      name,
      address: (data.get("address") as string | null) || null,
      property_type: (data.get("property_type") as string | null) || null,
      unit_count: unitCount,
      notes: (data.get("notes") as string | null) || null,
    };

    let dest: string;
    try {
      if (propertyId === "new") {
        const created = await createProperty(orgId, input);
        dest = `/properties/${created.id}?saved=1`;
      } else {
        await updateProperty(orgId, propertyId, input);
        dest = `/properties/${propertyId}?saved=1`;
      }
    } catch (err) {
      const msg = encodeURIComponent(
        err instanceof Error ? err.message : "Save failed",
      );
      dest = `/properties/${propertyId}?error=${msg}`;
    }
    redirect(dest);
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="flex items-center gap-4">
        <Link
          href="/properties"
          className="text-sm text-blue-600 hover:underline"
        >
          ← All properties
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">
          {isNew ? "New property" : (property?.name ?? "Property")}
        </h1>
      </div>

      {saved && (
        <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
          Property saved successfully.
        </div>
      )}
      {errorMsg && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      <form action={handleSave} className="space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700"
          >
            Property name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={property?.name ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="property_type"
              className="block text-sm font-medium text-gray-700"
            >
              Property type
            </label>
            <input
              id="property_type"
              name="property_type"
              type="text"
              defaultValue={property?.property_type ?? ""}
              placeholder="e.g. HOA, Apartment, Commercial"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="unit_count"
              className="block text-sm font-medium text-gray-700"
            >
              Unit count
            </label>
            <input
              id="unit_count"
              name="unit_count"
              type="number"
              min="0"
              defaultValue={property?.unit_count?.toString() ?? ""}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="address"
            className="block text-sm font-medium text-gray-700"
          >
            Address
          </label>
          <input
            id="address"
            name="address"
            type="text"
            defaultValue={property?.address ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-gray-700"
          >
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={property?.notes ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {isNew ? "Create property" : "Save changes"}
          </button>
          <Link
            href="/properties"
            className="rounded-md border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>

      {!isNew && property && (
        <div className="border-t border-gray-200 pt-4">
          <p className="text-xs text-gray-400">
            ID: {property.id} &nbsp;·&nbsp; Created:{" "}
            {new Date(property.created_at).toLocaleDateString()} &nbsp;·&nbsp;
            Updated: {new Date(property.updated_at).toLocaleDateString()}
          </p>
        </div>
      )}
    </main>
  );
}
