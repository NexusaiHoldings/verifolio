/**
 * /properties/[id] — property detail + edit page.
 *
 * Server component. Shows property details and the vendors assigned to it.
 * Edit form posts via a server action.
 */
import type { JSX } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCOIUser, resolveOrgId } from "@/lib/coi/access";
import {
  getProperty,
  listPropertyVendors,
  updateProperty,
  archiveProperty,
} from "@/lib/coi/properties";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: { id: string };
}

export default async function PropertyDetailPage({
  params,
}: PageProps): Promise<JSX.Element> {
  const user = await getCOIUser();
  if (!user) redirect("/login");

  const orgId = resolveOrgId(user.id);
  const propertyId = params.id;

  let property: Awaited<ReturnType<typeof getProperty>> = null;
  let vendors: Awaited<ReturnType<typeof listPropertyVendors>> = [];
  let fetchError: string | null = null;

  try {
    property = await getProperty(orgId, propertyId);
    if (!property) notFound();
    vendors = await listPropertyVendors(propertyId);
  } catch (err) {
    fetchError = `Failed to load property: ${String(err)}`;
  }

  async function handleUpdate(formData: FormData): Promise<void> {
    "use server";
    const serverUser = await getCOIUser();
    if (!serverUser) return;
    const serverOrgId = resolveOrgId(serverUser.id);
    const unitCountRaw = String(formData.get("unit_count") ?? "").trim();
    await updateProperty(serverOrgId, propertyId, {
      name: String(formData.get("name") ?? "").trim(),
      address: String(formData.get("address") ?? "").trim() || undefined,
      city: String(formData.get("city") ?? "").trim() || undefined,
      state: String(formData.get("state") ?? "").trim() || undefined,
      zip: String(formData.get("zip") ?? "").trim() || undefined,
      property_type: String(formData.get("property_type") ?? "managed"),
      unit_count: unitCountRaw ? parseInt(unitCountRaw, 10) : undefined,
      notes: String(formData.get("notes") ?? "").trim() || undefined,
      status: String(formData.get("status") ?? "active"),
    });
    redirect(`/properties/${propertyId}`);
  }

  async function handleArchive(): Promise<void> {
    "use server";
    const serverUser = await getCOIUser();
    if (!serverUser) return;
    const serverOrgId = resolveOrgId(serverUser.id);
    await archiveProperty(serverOrgId, propertyId);
    redirect("/properties");
  }

  if (fetchError || !property) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href="/properties"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to properties
        </Link>
        <div
          role="alert"
          className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {fetchError ?? "Property not found."}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div className="flex items-center justify-between">
        <Link
          href="/properties"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to properties
        </Link>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            property.status === "active"
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {property.status}
        </span>
      </div>

      <h1 className="text-2xl font-semibold text-gray-900">{property.name}</h1>

      {/* Edit form */}
      <section className="rounded-md border border-gray-200 p-6">
        <h2 className="mb-4 text-base font-medium text-gray-800">
          Property details
        </h2>
        <form action={handleUpdate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Name *</span>
              <input
                type="text"
                name="name"
                required
                defaultValue={property.name}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Type</span>
              <select
                name="property_type"
                defaultValue={property.property_type}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="managed">Managed</option>
                <option value="hoa">HOA</option>
                <option value="commercial">Commercial</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Units</span>
              <input
                type="number"
                name="unit_count"
                min={0}
                defaultValue={property.unit_count ?? ""}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Status</span>
              <select
                name="status"
                defaultValue={property.status}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Street address
            </span>
            <input
              type="text"
              name="address"
              defaultValue={property.address ?? ""}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">City</span>
              <input
                type="text"
                name="city"
                defaultValue={property.city ?? ""}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">State</span>
              <input
                type="text"
                name="state"
                maxLength={2}
                defaultValue={property.state ?? ""}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">ZIP</span>
              <input
                type="text"
                name="zip"
                defaultValue={property.zip ?? ""}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Notes</span>
            <textarea
              name="notes"
              rows={3}
              defaultValue={property.notes ?? ""}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Save changes
            </button>
          </div>
        </form>
      </section>

      {/* Assigned vendors */}
      <section className="rounded-md border border-gray-200 p-6">
        <h2 className="mb-4 text-base font-medium text-gray-800">
          Assigned vendors ({vendors.length})
        </h2>
        {vendors.length === 0 ? (
          <p className="text-sm text-gray-500">
            No vendors assigned to this property yet.{" "}
            <Link href="/vendors" className="text-blue-600 hover:underline">
              Browse vendors
            </Link>{" "}
            to make assignments.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {vendors.map((assignment) => (
              <li key={assignment.vendor_id} className="py-2">
                <Link
                  href={`/vendors/${encodeURIComponent(assignment.vendor_id)}`}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  {assignment.vendor_name}
                </Link>
                <span className="ml-2 text-xs text-gray-400">
                  assigned{" "}
                  {new Date(assignment.assigned_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Danger zone */}
      {property.status === "active" && (
        <section className="rounded-md border border-red-200 p-6">
          <h2 className="mb-2 text-base font-medium text-red-700">
            Danger zone
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            Archiving this property will remove it from active COI tracking.
            This can be reversed by setting the status back to active.
          </p>
          <form action={handleArchive}>
            <button
              type="submit"
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Archive property
            </button>
          </form>
        </section>
      )}

      <div className="text-xs text-gray-400">
        Created {new Date(property.created_at).toLocaleString()} · Last updated{" "}
        {new Date(property.updated_at).toLocaleString()}
      </div>
    </main>
  );
}
