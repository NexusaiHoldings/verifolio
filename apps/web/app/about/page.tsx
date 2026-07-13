/**
 * About page.
 *
 * Repo-backed marketing copy (product-flywheel-001 queue #3). The previous
 * version rendered COMPANY_DESCRIPTION verbatim — an internal product pitch
 * ("…charge the first monthly subscription") that the QA gate flagged as
 * placeholder/internal content on a public page. Copy here is grounded in
 * what the product actually does (vendor registry, COI extraction + review,
 * per-property requirements, expiration tracking); no invented team,
 * history, or testimonials.
 */
import type { JSX } from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Verifolio — COI tracking for property managers",
  description:
    "Verifolio tracks vendor certificates of insurance for property managers: collect COIs, extract coverage details, review them against your requirements, and stay ahead of expirations.",
};

export default function AboutPage(): JSX.Element {
  return (
    <main>
      <span className="eyebrow">About Verifolio</span>
      <h1 style={{ marginBottom: "0.5rem" }}>
        Vendor insurance compliance, out of the spreadsheet
      </h1>
      <p style={{ maxWidth: "44rem", fontSize: "1.05rem", lineHeight: 1.7 }}>
        Verifolio is compliance software for property managers who collect certificates of
        insurance from the contractors and service providers working on their properties. If
        your COI tracking lives in a spreadsheet and a shared inbox, Verifolio replaces both.
      </p>

      <section style={{ marginTop: "2rem", maxWidth: "44rem" }}>
        <h2>Why COI tracking matters</h2>
        <p style={{ lineHeight: 1.7 }}>
          When an uninsured vendor causes damage or an injury on a property you manage, the
          claim lands on your owner — and on you. A certificate of insurance is only protection
          if someone actually read it, checked the coverage against your requirements, and
          noticed when it expired. That work is tedious, repetitive, and exactly the kind of
          thing that slips when a portfolio grows.
        </p>
      </section>

      <section style={{ marginTop: "2rem", maxWidth: "44rem" }}>
        <h2>What Verifolio does</h2>
        <ul style={{ lineHeight: 1.8 }}>
          <li>
            <strong>Vendor registry</strong> — every contractor and service provider in one
            place, with trades, licenses, and contacts.
          </li>
          <li>
            <strong>Certificate intake and extraction</strong> — forward a COI email (or have
            the vendor send it directly) and Verifolio reads the ACORD form&rsquo;s carrier,
            policy numbers, coverage limits, and dates into structured fields for your review.
          </li>
          <li>
            <strong>Review queue</strong> — extracted certificates wait in a queue where you
            confirm or correct each field before anything counts as verified. You stay the
            authority; the software does the typing.
          </li>
          <li>
            <strong>Per-property requirements</strong> — set the coverage each property
            demands and see which vendors meet it and which don&rsquo;t.
          </li>
          <li>
            <strong>Expiration tracking</strong> — a dashboard of what&rsquo;s current,
            what&rsquo;s lapsing, and what already lapsed, so renewals get chased before work
            starts, not after an incident.
          </li>
        </ul>
      </section>

      <section style={{ marginTop: "2rem", maxWidth: "44rem" }}>
        <h2>Get in touch</h2>
        <p style={{ lineHeight: 1.7 }}>
          Questions about the product? Read the <Link href="/help">Help Center</Link>, reach us
          through <Link href="/support">support</Link>, or email{" "}
          <a href="mailto:hello@getverifolio.com">hello@getverifolio.com</a>. For background on
          COI practice, the <Link href="/blog">blog</Link> covers topics like reading an ACORD
          25 field by field.
        </p>
      </section>

      <section className="cta-band" style={{ marginTop: "2.5rem", padding: "2rem", maxWidth: "44rem" }}>
        <h2 style={{ marginTop: 0 }}>See it with your own vendors</h2>
        <p>
          Create an account, add a vendor, and forward one certificate email — the review queue
          will show you exactly what Verifolio extracts.
        </p>
        <Link href="/signup" className="btn">
          Create an account
        </Link>
      </section>
    </main>
  );
}
