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
      "headline": "Stop chasing COIs. Start knowing you're covered.",
      "eyebrow": "Insurance Compliance, Reinvented",
      "subhead": "Verifolio automatically extracts, scores, and tracks vendor certificates of insurance \u2014 so your team stops managing spreadsheets and starts managing properties.",
      "primaryCta": {
        "label": "Request Early Access",
        "href": "/signup"
      },
      "secondaryCta": {
        "label": "See How It Works",
        "href": "#how-it-works"
      },
      "image": {
        "url": "hero_image"
      }
    },
    {
      "type": "stats",
      "stats": [
        {
          "value": "6+ hrs",
          "label": "spent per week chasing and re-entering COI data"
        },
        {
          "value": "1 in 4",
          "label": "COIs have a coverage gap missed on first review"
        },
        {
          "value": "30\u2013200",
          "label": "vendor certificates the average PM company tracks"
        },
        {
          "value": "$0",
          "label": "liability protection from an expired policy you didn't catch"
        }
      ],
      "title": "The cost of doing this manually"
    },
    {
      "type": "how_it_works",
      "steps": [
        {
          "title": "Forward or upload the COI",
          "body": "Email a certificate directly to your Verifolio inbox or drag-and-drop a PDF. Verifolio accepts any standard ACORD form from any insurer."
        },
        {
          "title": "AI extracts and scores instantly",
          "body": "Our extraction engine reads policy limits, effective dates, additional insured status, and coverage types \u2014 then generates a compliance score against your requirements in seconds."
        },
        {
          "title": "Get alerted before gaps become liability",
          "body": "Automated expiration reminders go to you and your vendors. Your dashboard shows every vendor's live compliance status, so nothing slips through."
        }
      ],
      "title": "Compliance on autopilot in three steps",
      "subhead": "Verifolio fits into how your team already works \u2014 no rearchitecting your vendor process."
    },
    {
      "type": "feature_spotlight",
      "items": [
        {
          "title": "AI extraction that reads any COI format",
          "body": "Verifolio's document intelligence parses ACORD 25, ACORD 28, and non-standard certificates alike \u2014 pulling policy numbers, coverage limits, endorsements, and named insureds without manual data entry. What used to take 10 minutes per certificate takes under 10 seconds.",
          "image": {
            "url": "https://runtime.nexusaiholdings.com/assets/ddcd0009-5337-4065-aa95-7971504b2958",
            "alt": "AI extraction that reads any COI format"
          }
        },
        {
          "title": "Compliance scoring against your own requirements",
          "body": "Set minimum coverage thresholds by vendor category \u2014 landscapers, plumbers, general contractors \u2014 and Verifolio automatically flags every gap. Green means covered. Red means action required. No more judgment calls on whether a policy is good enough.",
          "image": {
            "url": "https://runtime.nexusaiholdings.com/assets/cf810137-8150-4389-bab0-701d73bd627b",
            "alt": "Compliance scoring against your own requirements"
          }
        },
        {
          "title": "Proactive expiration management",
          "body": "Verifolio tracks every policy end date and sends tiered reminders to your vendors at 60, 30, and 7 days out. Your team gets a consolidated digest so you're never surprised by a lapsed certificate on the day work begins.",
          "image": {
            "url": "https://runtime.nexusaiholdings.com/assets/003bc930-2903-43bd-944c-ec6b986ed610",
            "alt": "Proactive expiration management"
          }
        }
      ],
      "title": "Built for the realities of property management"
    },
    {
      "type": "feature_grid",
      "features": [
        {
          "title": "Centralized vendor registry",
          "body": "One searchable home for every vendor relationship, COI history, and compliance status across your entire portfolio."
        },
        {
          "title": "Multi-property rule sets",
          "body": "Define different insurance requirements for residential, commercial, or mixed-use properties and apply them automatically."
        },
        {
          "title": "Audit-ready reporting",
          "body": "Export a full compliance history by vendor, property, or date range \u2014 formatted for owner reports, audits, or insurance renewals."
        },
        {
          "title": "Vendor self-service portal",
          "body": "Vendors upload their own updated certificates through a branded link. Your team reviews and approves \u2014 no email tag required."
        },
        {
          "title": "Team permissions and activity log",
          "body": "Assign roles across your operations team with a full audit trail of every review, approval, and status change."
        },
        {
          "title": "Integrations-ready architecture",
          "body": "Built with open APIs to connect with property management platforms like AppFolio, Buildium, and Yardi as your needs grow."
        }
      ],
      "title": "Everything your spreadsheet was never built to do",
      "subhead": "A purpose-built compliance layer for every vendor, every property, every policy."
    },
    {
      "type": "social_proof",
      "quotes": [
        {
          "quote": "We were managing 140 vendor COIs in a shared Google Sheet. Someone would update a cell wrong and we'd have no idea a policy had lapsed. Verifolio made that entire problem disappear.",
          "author": "Operations Manager",
          "role": "Regional property management company, 280 units"
        },
        {
          "quote": "The compliance scoring alone is worth it. Instead of reading every certificate line by line, I get a red or green status and I know exactly what needs attention.",
          "author": "Director of Vendor Relations",
          "role": "Mid-market HOA management firm"
        },
        {
          "quote": "Our insurance broker actually commented on how clean our vendor documentation was at renewal. That's never happened before.",
          "author": "Principal",
          "role": "Boutique property management company, 90 units"
        }
      ],
      "title": "What operations teams say"
    },
    {
      "type": "pricing_teaser",
      "tiers": [
        {
          "name": "Essentials",
          "features": [
            "Up to 3 team seats",
            "AI COI extraction and scoring",
            "Automated expiration reminders",
            "Up to 100 active vendor records",
            "Standard compliance reports"
          ],
          "period": "per month"
        },
        {
          "name": "Professional",
          "features": [
            "Up to 10 team seats",
            "Unlimited vendor records",
            "Multi-property rule sets",
            "Vendor self-service upload portal",
            "Audit-ready export and history",
            "Priority support"
          ],
          "period": "per month",
          "highlighted": true
        },
        {
          "name": "Enterprise",
          "features": [
            "Unlimited seats",
            "Custom compliance rule logic",
            "API access and integrations",
            "Dedicated onboarding",
            "SLA-backed uptime and support"
          ],
          "period": "custom"
        }
      ],
      "title": "Simple, predictable pricing",
      "subhead": "Monthly plans that scale with your team \u2014 no per-certificate fees, no surprise overages."
    },
    {
      "type": "faq",
      "items": [
        {
          "q": "We already have a process in spreadsheets. How hard is it to migrate?",
          "a": "Most teams are fully migrated within a day. You can bulk-import your existing vendor list via CSV and start uploading COIs immediately. Verifolio's onboarding team walks you through setup at no extra cost."
        },
        {
          "q": "Can Verifolio read certificates from any insurance carrier?",
          "a": "Yes. Our AI is trained on thousands of ACORD forms and non-standard certificates from carriers of all sizes. If a document is legible, Verifolio can extract it."
        },
        {
          "q": "What if a vendor sends a certificate that doesn't meet our requirements?",
          "a": "Verifolio flags the gap immediately and shows you exactly which coverage limit or requirement is missing. You can send the vendor a templated request for an updated certificate directly from the platform."
        },
        {
          "q": "Is our vendor and policy data secure?",
          "a": "Verifolio is built on SOC 2-aligned infrastructure with encryption at rest and in transit. Your data is never used to train models or shared with third parties."
        },
        {
          "q": "We manage properties for multiple ownership groups. Can we keep their data separate?",
          "a": "Yes. Verifolio supports multiple property portfolios under a single account with separate compliance rules, vendor registries, and reporting \u2014 all accessible from one login."
        }
      ],
      "title": "Questions from operations teams like yours"
    },
    {
      "type": "cta_band",
      "headline": "Your next missed COI is the last one you'll miss.",
      "subhead": "Join operations teams replacing spreadsheet chaos with quiet, confident compliance. Early access is open now."
    }
  ]
};
