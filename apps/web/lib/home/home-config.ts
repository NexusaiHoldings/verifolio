/**
 * home-config — chooses the company's root surface (company-root-landing-001).
 *
 * mode "landing"      → root renders a themed marketing page (<Landing>): hero +
 *                       feature sections + closing CTA. The conversation surface
 *                       lives at /assistant.
 * mode "conversation" → root renders the §6.1 ConversationSurface (chat-first
 *                       products); /assistant mirrors it.
 *
 * DEFAULT below is a generic landing so an undecided company still gets a real
 * front door. At provisioning, the engine OVERWRITES this whole file from the
 * homepage content generator (headline/subhead/features/CTA, grounded in the
 * plan). Do NOT hand-edit in a company repo — it's provisioning-owned.
 */
export interface HomeCta {
  label: string;
  href: string;
}

/** A feature / value block rendered in the landing page's section grid. */
export interface HomeFeature {
  title: string;
  body: string;
}

/* ── Bespoke composition (homepage-composition-001) ────────────────────────────
 * A homepage is an ORDERED sequence of section blocks. The composer agent picks
 * which sections a company gets and in what order, and writes each section's
 * content from the plan/brand — so a marketplace, a compliance SaaS, and a dev
 * tool get genuinely different pages, all from one vetted, theme-aware component
 * library (build-safe, every company still inherits substrate upgrades).
 *
 * Each section is a discriminated union on `type`. Landing.tsx maps type →
 * component. Unknown types are skipped (forward-compatible). When `sections` is
 * absent, Landing falls back to the legacy headline/subhead/features/closing
 * rendering, so existing companies are unaffected. */
export interface SectionImage {
  /** Public image URL, OR the literal "hero_image" to resolve from site_media. */
  url?: string;
  alt?: string;
  caption?: string;
}

export interface HeroSection {
  type: "hero";
  eyebrow?: string;
  headline: string;
  subhead?: string;
  primaryCta?: HomeCta;
  secondaryCta?: HomeCta;
  image?: SectionImage; // omit/"hero_image" → resolved from site_media at render
}
export interface StatsSection {
  type: "stats";
  title?: string;
  stats: { value: string; label: string }[];
}
export interface HowItWorksSection {
  type: "how_it_works";
  title?: string;
  subhead?: string;
  steps: { title: string; body: string }[];
}
export interface FeatureGridSection {
  type: "feature_grid";
  title?: string;
  subhead?: string;
  features: HomeFeature[];
}
export interface FeatureSpotlightSection {
  type: "feature_spotlight";
  title?: string;
  items: { title: string; body: string; image?: SectionImage }[];
}
export interface SocialProofSection {
  type: "social_proof";
  title?: string;
  quotes: { quote: string; author?: string; role?: string }[];
}
export interface FaqSection {
  type: "faq";
  title?: string;
  items: { q: string; a: string }[];
}
export interface PricingTeaserSection {
  type: "pricing_teaser";
  title?: string;
  subhead?: string;
  tiers: {
    name: string;
    price?: string;
    period?: string;
    features: string[];
    cta?: HomeCta;
    highlighted?: boolean;
  }[];
}
export interface GallerySection {
  type: "gallery";
  title?: string;
  images: SectionImage[];
}
export interface CtaBandSection {
  type: "cta_band";
  headline: string;
  subhead?: string;
  cta?: HomeCta;
}

export type HomeSection =
  | HeroSection
  | StatsSection
  | HowItWorksSection
  | FeatureGridSection
  | FeatureSpotlightSection
  | SocialProofSection
  | FaqSection
  | PricingTeaserSection
  | GallerySection
  | CtaBandSection;

export interface HomeConfig {
  mode: "landing" | "conversation";
  /** Bespoke section sequence (composer-generated). When present, Landing
   *  renders these in order and ignores the legacy fields below. */
  sections?: HomeSection[];

  // ── Legacy single-layout fields (fallback when `sections` is absent) ──
  headline?: string;
  subhead?: string;
  primaryCta?: HomeCta;
  secondaryCta?: HomeCta;
  /** Section heading above the feature grid (e.g. "Why teams choose us"). */
  featuresTitle?: string;
  /** 3-6 feature/value blocks. Rendered as a responsive card grid. */
  features?: HomeFeature[];
  /** Closing CTA band headline beneath the features. */
  closingHeadline?: string;
}

export const homeConfig: HomeConfig = {
  "mode": "landing",
  "sections": [
    {
      "type": "hero",
      "headline": "Stop tracking COIs in spreadsheets. Start sleeping better.",
      "eyebrow": "Insurance Compliance for Property Management",
      "subhead": "Verifolio uses AI to extract, score, and monitor every vendor certificate of insurance \u2014 so coverage gaps never slip through the cracks again.",
      "primaryCta": {
        "label": "See It in Action",
        "href": "/demo"
      },
      "image": {
        "url": "hero_image"
      }
    },
    {
      "type": "stats",
      "stats": [
        {
          "value": "73%",
          "label": "of property managers report at least one missed COI expiration per quarter"
        },
        {
          "value": "6 hrs",
          "label": "spent per week manually chasing, filing, and re-checking certificates"
        },
        {
          "value": "30\u2013200",
          "label": "vendor COIs the average 50\u2013500 unit company is tracking right now"
        },
        {
          "value": "< 2 min",
          "label": "for Verifolio to extract and score a new certificate of insurance"
        }
      ],
      "title": "The spreadsheet is costing you more than you think."
    },
    {
      "type": "how_it_works",
      "steps": [
        {
          "title": "Upload or forward a COI",
          "body": "Drag in a PDF, forward an email attachment, or connect your vendor portal. Verifolio accepts certificates exactly how vendors send them."
        },
        {
          "title": "AI extracts and scores coverage",
          "body": "Our extraction engine reads policy limits, coverage types, effective dates, and named-insured details \u2014 then scores each certificate against your property's compliance requirements."
        },
        {
          "title": "Gaps and expirations surface instantly",
          "body": "A live compliance dashboard flags every shortfall, upcoming expiration, and missing endorsement before they become a liability problem."
        },
        {
          "title": "Automated reminders close the loop",
          "body": "Verifolio contacts vendors directly when renewals are due or coverage falls short, so your team stops playing phone tag and starts managing exceptions only."
        }
      ],
      "title": "Compliance on autopilot. Set up in an afternoon.",
      "subhead": "Verifolio fits into the workflow you already have \u2014 no rip-and-replace required."
    },
    {
      "type": "feature_spotlight",
      "items": [
        {
          "title": "AI-Powered COI Extraction \u2014 Zero Data Entry",
          "body": "Verifolio reads any certificate format \u2014 ACORD 25, non-standard PDFs, scanned images \u2014 and pulls every material field without manual keying. Coverage limits, policy numbers, endorsements, and expiration dates land in your dashboard in seconds, not hours. Your team reviews exceptions, not every line.",
          "image": {
            "url": "https://runtime.nexusaiholdings.com/assets/d693375d-a3f1-4e61-894d-c617fa3c1acf",
            "alt": "AI-Powered COI Extraction \u2014 Zero Data Entry"
          }
        },
        {
          "title": "Compliance Scoring Against Your Requirements",
          "body": "Set minimum coverage thresholds per vendor category \u2014 landscapers, plumbers, general contractors \u2014 and Verifolio scores every incoming COI against those rules automatically. A clear red-amber-green status tells you exactly where you stand across your entire vendor roster at a glance.",
          "image": {
            "url": "https://runtime.nexusaiholdings.com/assets/62d577ad-d0e4-4027-a723-b2e9c4f9d794",
            "alt": "Compliance Scoring Against Your Requirements"
          }
        },
        {
          "title": "Proactive Expiration Monitoring and Vendor Outreach",
          "body": "Verifolio watches every policy end date and fires configurable reminders to vendors at 60, 30, and 7 days out. Renewal certificates are processed the moment they arrive, keeping your compliance record current without a single calendar reminder on your end.",
          "image": {
            "url": "https://runtime.nexusaiholdings.com/assets/2bac38a7-eb4f-4631-8af7-56ebf7243635",
            "alt": "Proactive Expiration Monitoring and Vendor Outreach"
          }
        }
      ],
      "title": "Built for the realities of property operations."
    },
    {
      "type": "feature_grid",
      "features": [
        {
          "title": "Centralized Vendor Registry",
          "body": "One searchable record per vendor \u2014 all certificates, history, and compliance status in a single view."
        },
        {
          "title": "Multi-Property Support",
          "body": "Manage compliance across every property in your portfolio from a single account, with per-property requirement sets."
        },
        {
          "title": "Audit-Ready Reporting",
          "body": "Export a timestamped compliance report for any property or date range \u2014 ready for ownership groups, lenders, or legal review."
        },
        {
          "title": "Role-Based Access",
          "body": "Give property managers visibility into their portfolio, while keeping admin controls in the hands of your compliance leads."
        },
        {
          "title": "Instant Gap Alerts",
          "body": "Get notified the moment a newly processed COI falls short of your requirements \u2014 before the vendor steps on site."
        },
        {
          "title": "Seamless Onboarding",
          "body": "Import your existing vendor list and bulk-upload historical certificates to get a full compliance picture from day one."
        }
      ],
      "title": "Everything your compliance workflow needs. Nothing it doesn't."
    },
    {
      "type": "social_proof",
      "quotes": [
        {
          "quote": "We were managing 140 vendor COIs in a shared spreadsheet. Verifolio replaced that entire process in a week. Now I get a dashboard instead of a panic attack every renewal season.",
          "author": "Operations Manager",
          "role": "Regional property management company, 280 units"
        },
        {
          "quote": "The automated vendor reminders alone saved us hours every month. Certificates just show up renewed \u2014 we only touch the ones that have a real problem.",
          "author": "Portfolio Administrator",
          "role": "Mid-market HOA management firm"
        },
        {
          "quote": "Our ownership group asked for a compliance audit and we had a full report ready in ten minutes. That would have taken two days before Verifolio.",
          "author": "Director of Operations",
          "role": "Mixed-use property management company, 400+ units"
        }
      ],
      "title": "Operations teams finally have a system they trust."
    },
    {
      "type": "pricing_teaser",
      "tiers": [
        {
          "name": "Starter",
          "features": [
            "Up to 2 user seats",
            "Up to 3 properties",
            "Unlimited COI uploads and extractions",
            "Automated expiration reminders",
            "Compliance dashboard and gap alerts"
          ],
          "price": "Contact us"
        },
        {
          "name": "Growth",
          "features": [
            "Up to 10 user seats",
            "Unlimited properties",
            "Multi-property compliance reporting",
            "Role-based access controls",
            "Audit-ready PDF exports",
            "Priority email support"
          ],
          "highlighted": true
        },
        {
          "name": "Enterprise",
          "features": [
            "Unlimited seats",
            "Custom compliance rule sets",
            "Dedicated onboarding and account management",
            "SSO and advanced permissions",
            "API access for property management platform integrations"
          ]
        }
      ],
      "title": "Straightforward pricing that scales with your team.",
      "subhead": "All plans include AI extraction, compliance scoring, and automated vendor reminders. No setup fees."
    },
    {
      "type": "faq",
      "items": [
        {
          "q": "What certificate formats does Verifolio support?",
          "a": "Verifolio handles standard ACORD 25 forms as well as non-standard PDFs and scanned certificates. If a vendor sends it, our extraction engine can read it."
        },
        {
          "q": "How long does it take to get our existing vendor list into the system?",
          "a": "Most teams are fully onboarded within a day. You can import a vendor list via CSV and bulk-upload historical certificates to establish a baseline compliance picture from the start."
        },
        {
          "q": "Can we set different coverage requirements for different vendor types?",
          "a": "Yes. You define minimum limits, required coverage types, and endorsement requirements per vendor category \u2014 landscapers, electricians, general contractors, and so on \u2014 and Verifolio scores every certificate against the right ruleset automatically."
        },
        {
          "q": "Does Verifolio contact our vendors directly, or do we control that?",
          "a": "You control it. Automated vendor reminders are fully configurable \u2014 you choose the timing, tone, and whether outreach goes out under your company name or Verifolio's. You can also disable automation and handle outreach manually."
        },
        {
          "q": "Is our certificate data secure?",
          "a": "All data is encrypted in transit and at rest. Verifolio is built on SOC 2-aligned infrastructure, and we never share your vendor data with third parties."
        }
      ],
      "title": "Questions we hear from operations teams."
    },
    {
      "type": "cta_band",
      "headline": "Your spreadsheet has had enough. So have you.",
      "subhead": "See how Verifolio brings calm, automated order to your entire vendor compliance workflow \u2014 in one live demo."
    }
  ]
};
