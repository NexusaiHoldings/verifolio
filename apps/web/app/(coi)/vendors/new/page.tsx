/**
 * /vendors/new — add a vendor.
 *
 * Server component + inline server action (mirrors /vendors/[id]'s edit
 * pattern). The list page's "Add vendor" CTA pointed here since launch but
 * the route never existed — the QA gate flagged the resulting dead end.
 */
import type { CSSProperties, JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCOIUser, resolveOrgId } from "@/lib/coi/access";
import { createVendor } from "@/lib/coi/vendors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FIELD_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  marginBottom: "0.9rem",
};

const LABEL_STYLE: CSSProperties = { fontSize: "0.85rem", fontWeight: 600 };

export default async function NewVendorPage(): Promise<JSX.Element> {
  const user = await getCOIUser();
  if (!user) redirect("/login");

  async function handleCreate(formData: FormData): Promise<void> {
    "use server";
    const serverUser = await getCOIUser();
    if (!serverUser) redirect("/login");
    const serverOrgId = resolveOrgId(serverUser.id);
    const name = String(formData.get("name") ?? "").trim();
    if (!name) redirect("/vendors/new?error=name");
    const vendor = await createVendor(serverOrgId, {
      name,
      trade: String(formData.get("trade") ?? "").trim() || undefined,
      license_number: String(formData.get("license_number") ?? "").trim() || undefined,
      contact_email: String(formData.get("contact_email") ?? "").trim() || undefined,
      contact_phone: String(formData.get("contact_phone") ?? "").trim() || undefined,
      address: String(formData.get("address") ?? "").trim() || undefined,
      notes: String(formData.get("notes") ?? "").trim() || undefined,
    });
    redirect(`/vendors/${vendor.id}`);
  }

  return (
    <main>
      <nav aria-label="Breadcrumb" style={{ marginBottom: "1rem" }}>
        <Link href="/vendors" style={{ fontSize: "0.9rem" }}>
          ← Back to vendors
        </Link>
      </nav>

      <h1 style={{ marginBottom: "0.25rem" }}>Add vendor</h1>
      <p className="muted" style={{ marginTop: 0, maxWidth: "40rem" }}>
        Add a contractor or service provider to your registry. Once added, upload their
        certificate of insurance from the vendor&rsquo;s page to start compliance tracking —
        only the name is required to get started.
      </p>

      <section className="surface" style={{ maxWidth: "40rem" }}>
        <form action={handleCreate}>
          <div style={FIELD_STYLE}>
            <label htmlFor="vendor-name" style={LABEL_STYLE}>
              Vendor name <span aria-hidden="true" style={{ color: "var(--substrate-danger)" }}>*</span>
            </label>
            <input id="vendor-name" name="name" type="text" required maxLength={200} />
          </div>

          <div style={FIELD_STYLE}>
            <label htmlFor="vendor-trade" style={LABEL_STYLE}>
              Trade
            </label>
            <input
              id="vendor-trade"
              name="trade"
              type="text"
              maxLength={100}
              placeholder="e.g. Roofing, Landscaping, HVAC"
            />
          </div>

          <div style={FIELD_STYLE}>
            <label htmlFor="vendor-license" style={LABEL_STYLE}>
              License number
            </label>
            <input id="vendor-license" name="license_number" type="text" maxLength={100} />
          </div>

          <div style={FIELD_STYLE}>
            <label htmlFor="vendor-email" style={LABEL_STYLE}>
              Contact email
            </label>
            <input id="vendor-email" name="contact_email" type="email" maxLength={200} />
          </div>

          <div style={FIELD_STYLE}>
            <label htmlFor="vendor-phone" style={LABEL_STYLE}>
              Contact phone
            </label>
            <input id="vendor-phone" name="contact_phone" type="tel" maxLength={40} />
          </div>

          <div style={FIELD_STYLE}>
            <label htmlFor="vendor-address" style={LABEL_STYLE}>
              Address
            </label>
            <input id="vendor-address" name="address" type="text" maxLength={300} />
          </div>

          <div style={FIELD_STYLE}>
            <label htmlFor="vendor-notes" style={LABEL_STYLE}>
              Notes
            </label>
            <textarea id="vendor-notes" name="notes" rows={3} maxLength={2000} />
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button type="submit">Add vendor</button>
            <Link href="/vendors" style={{ fontSize: "0.9rem" }}>
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
