/**
 * /properties — property registry list page.
 *
 * Server component. Requires an authenticated session. Supports search via
 * the ?q= query param (handled server-side for SEO + accessibility).
 */
import type { JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCOIUser, resolveOrgId } from "@/lib/coi/access";
import { listProperties } from "@/lib/coi/properties";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  searchParams: {
    q?: string;
    status?: string;
    type?: string;
    page?: string;
  };
}

export default async function PropertiesPage({
  searchParams,
}: PageProps): Promise<JSX.Element> {
  const user = await getCOIUser();
  if (!user) redirect("/login");

  const orgId = resolveOrgId(user.id);
  const search = searchParams.q ?? "";
  const status = searchParams.status ?? "active";
  const propertyType = searchParams.type ?? "";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const limit = 50;
  const offset = (page - 1) * limit;

  let properties: Awaited<ReturnType<typeof listProperties>> = [];
  let fetchError: string | null = null;

  try {
    properties = await listProperties(orgId, {
      search,
      status,
      property_type: propertyType,
      limit,
      offset,
    });
  } catch (err) {
    fetchError = `Failed to load properties: ${String(err)}`;
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Properties</h1>
          <p className="mt-1 text-sm text-gray-500">
            Managed units and HOA communities in your portfolio.
          </p>
        </div>
        <Link
          href="/properties/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Add property
        </Link>
      </div>

      {/* Search + filter bar */}
      <form method="GET" className="flex flex-wrap gap-3">
        <input
          type="text"
          name="q"
          defaultValue={search}
          placeholder="Search by name, address, or city…"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          name="type"
          defaultValue={propertyType}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">All types</option>
          <option value="managed">Managed</option>
          <option value="hoa">HOA</option>
          <option value="commercial">Commercial</option>
        </select>
        <select
          name="status"
          defaultValue={status}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="">All statuses</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Search
        </button>
        {(search || status !== "active" || propertyType) && (
          <Link
            href="/properties"
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Clear
          </Link>
        )}
      </form>

      {fetchError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {fetchError}
        </div>
      )}

      {properties.length === 0 && !fetchError ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
          {search
            ? `No properties match "${search}".`
            : "No properties yet. Add your first property to get started."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left font-medium text-gray-700">Name</th>
                <th className="p-3 text-left font-medium text-gray-700">Type</th>
                <th className="p-3 text-left font-medium text-gray-700">Address</th>
                <th className="p-3 text-left font-medium text-gray-700">Units</th>
                <th className="p-3 text-left font-medium text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {properties.map((property) => (
                <tr key={property.id} className="hover:bg-gray-50">
                  <td className="p-3">
                    <Link
                      href={`/properties/${encodeURIComponent(property.id)}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {property.name}
                    </Link>
                  </td>
                  <td className="p-3">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {property.property_type}
                    </span>
                  </td>
                  <td className="p-3 text-gray-700">
                    {[property.address, property.city, property.state]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                  <td className="p-3 text-gray-700">
                    {property.unit_count != null ? property.unit_count : "—"}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        property.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {property.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {properties.length === limit && (
        <div className="flex justify-end gap-2">
          {page > 1 && (
            <Link
              href={`/properties?q=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&type=${encodeURIComponent(propertyType)}&page=${page - 1}`}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Previous
            </Link>
          )}
          <Link
            href={`/properties?q=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&type=${encodeURIComponent(propertyType)}&page=${page + 1}`}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Next
          </Link>
        </div>
      )}
    </main>
  );
}
