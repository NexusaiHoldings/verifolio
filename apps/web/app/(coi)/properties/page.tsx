/**
 * /properties — COI property registry list page.
 * Server component; requires authenticated session.
 */

import type { JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCoiSession } from "@/lib/coi/access";
import { listProperties } from "@/lib/coi/properties";
import type { CoiProperty } from "@/lib/coi/properties";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PropertiesPageProps {
  searchParams?: { q?: string };
}

export default async function PropertiesPage({
  searchParams,
}: PropertiesPageProps): Promise<JSX.Element> {
  const session = await getCoiSession();
  if (!session) redirect("/login");

  const query = searchParams?.q?.trim() ?? "";

  let properties: CoiProperty[] = [];
  try {
    properties = await listProperties(session.orgId, query || undefined);
  } catch {
    properties = [];
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Properties</h1>
        <Link
          href="/properties/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add property
        </Link>
      </div>

      <form method="GET" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search properties by name, address, or type…"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Search
        </button>
        {query && (
          <Link
            href="/properties"
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Clear
          </Link>
        )}
      </form>

      {properties.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 py-12 text-center">
          <p className="text-gray-500">
            {query
              ? `No properties match "${query}".`
              : "No properties yet. Add your first property to get started."}
          </p>
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
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="p-3">
                    <Link
                      href={`/properties/${encodeURIComponent(p.id)}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="p-3 text-gray-600">{p.property_type ?? "—"}</td>
                  <td className="p-3 text-gray-600">{p.address ?? "—"}</td>
                  <td className="p-3 text-gray-600">
                    {p.unit_count != null ? p.unit_count.toString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">
        {properties.length} propert{properties.length !== 1 ? "ies" : "y"} shown
      </p>
    </main>
  );
}
