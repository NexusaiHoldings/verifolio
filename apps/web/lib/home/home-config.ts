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
      "eyebrow": "Insurance Compliance, Automated",
      "subhead": "Verifolio uses AI to extract, score, and monitor every vendor certificate of insurance \u2014 so your team stops managing spreadsheets and starts managing properties.",
      "primaryCta": {
        "label": "See Verifolio in Action",
        "href": "/demo"
      },
      "secondaryCta": {
        "label": "Start Free Trial",
        "href": "/signup"
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
          "label": "spent per week chasing and re-checking vendor certificates"
        },
        {
          "value": "1 in 4",
          "label": "COIs on a typical vendor roster has a coverage gap or lapsed date"
        },
        {
          "value": "72%",
          "label": "of property managers have no automated alert when a policy expires"
        },
        {
          "value": "$0",
          "label": "additional liability coverage when a gap slips through a spreadsheet"
        }
      ],
      "title": "The cost of tracking COIs the old way"
    },
    {
      "type": "how_it_works",
      "steps": [
        {
          "title": "Upload or forward any COI",
          "body": "Email a certificate directly to your Verifolio inbox, drag-and-drop a PDF, or connect your existing vendor onboarding workflow. Verifolio accepts any format from any carrier."
        },
        {
          "title": "AI extracts and scores instantly",
          "body": "Our extraction engine reads every field \u2014 policy limits, effective dates, additional insured endorsements, and exclusions \u2014 then scores each certificate against your property's required coverage thresholds."
        },
        {
          "title": "Monitor, alert, and stay audit-ready",
          "body": "Verifolio tracks expiration dates across your entire vendor roster and sends automated renewal reminders to vendors before a lapse occurs. Your compliance dashboard is always current and exportable for ownership reviews."
        }
      ],
      "title": "Compliance that runs itself",
      "subhead": "From certificate upload to audit-ready dashboard in three steps \u2014 no manual data entry required."
    },
    {
      "type": "feature_spotlight",
      "items": [
        {
          "title": "AI-powered COI extraction that reads what humans miss",
          "body": "Verifolio's document intelligence parses complex carrier formats, handwritten endorsements, and multi-page certificates in seconds. It flags discrepancies between what a vendor submitted and what your property actually requires \u2014 catching coverage gaps before they become liability events. No templates to configure, no fields to map manually."
        },
        {
          "title": "Compliance scoring tailored to your coverage requirements",
          "body": "Set minimum limits, required endorsements, and acceptable policy types once per property or portfolio. Every incoming COI is automatically scored against your standards and given a clear pass, warning, or fail status. Operations managers get a single view of which vendors are compliant today \u2014 and which need action before tomorrow."
        },
        {
          "title": "Proactive expiration monitoring across every vendor",
          "body": "Verifolio watches every expiration date across your entire vendor roster and sends automated, branded renewal requests to vendors at 60, 30, and 7 days before lapse. Your team stops being the reminder service and starts receiving updated certificates \u2014 already extracted and re-scored \u2014 without lifting a finger."
        }
      ],
      "title": "The intelligence your spreadsheet never had"
    },
    {
      "type": "feature_grid",
      "features": [
        {
          "title": "Vendor roster management",
          "body": "Maintain a centralized, searchable directory of every contractor, landscaper, and service provider \u2014 each linked to their current compliance status and certificate history."
        },
        {
          "title": "Multi-property portfolio support",
          "body": "Manage compliance across multiple properties with different coverage requirements from a single account. Filter your dashboard by property, vendor type, or compliance status."
        },
        {
          "title": "Audit-ready reporting",
          "body": "Generate a full compliance report for any property at any moment \u2014 formatted for ownership groups, lenders, or insurance auditors with one click."
        },
        {
          "title": "Automated vendor outreach",
          "body": "Verifolio sends expiration reminders and certificate requests on your behalf, with your company name, so vendors receive a professional, consistent experience."
        },
        {
          "title": "Coverage gap alerts",
          "body": "Receive immediate notifications when a submitted certificate falls below required limits, omits a required endorsement, or lists the wrong additional insured."
        },
        {
          "title": "Seat-based team access",
          "body": "Give property managers, compliance coordinators, and ownership stakeholders role-appropriate access to the data they need without sharing a single login or spreadsheet."
        }
      ],
      "title": "Everything operations teams need to stay covered",
      "subhead": "Purpose-built for property management companies managing 50 to 500 units and the vendor networks that serve them."
    },
    {
      "type": "social_proof",
      "quotes": [
        {
          "quote": "We were managing 140 vendor COIs across four properties in a shared Google Sheet. Verifolio replaced that entire process in the first week. I can't overstate how much time we've reclaimed.",
          "author": "Operations Manager",
          "role": "Regional property management company, 280 units"
        },
        {
          "quote": "The expiration alerts alone were worth it. A landscaping contractor's policy lapsed and Verifolio caught it before we had any work done on site. That's exactly the liability exposure we were worried about.",
          "author": "Director of Property Operations",
          "role": "Mid-market HOA management firm, 6 communities"
        },
        {
          "quote": "Our ownership group started asking for compliance reports during quarterly reviews. Before Verifolio, pulling that together took half a day. Now it's a button.",
          "author": "Portfolio Manager",
          "role": "Residential property management, 410 units"
        }
      ],
      "title": "What operations teams say after switching"
    },
    {
      "type": "pricing_teaser",
      "tiers": [
        {
          "name": "Starter",
          "features": [
            "Up to 3 team seats",
            "Up to 5 properties",
            "Unlimited COI uploads and AI extraction",
            "Automated expiration alerts",
            "Compliance scoring dashboard",
            "Email support"
          ],
          "period": "per month"
        },
        {
          "name": "Growth",
          "features": [
            "Up to 10 team seats",
            "Unlimited properties",
            "Everything in Starter",
            "Automated vendor outreach and renewal requests",
            "Audit-ready compliance reports",
            "Coverage gap alerts with same-day notification",
            "Priority support"
          ],
          "period": "per month",
          "highlighted": true
        },
        {
          "name": "Enterprise",
          "features": [
            "Unlimited seats",
            "Unlimited properties and portfolios",
            "Everything in Growth",
            "Custom coverage requirement templates",
            "Dedicated onboarding and account management",
            "SSO and advanced role permissions",
            "SLA-backed uptime commitment"
          ],
          "period": "custom"
        }
      ],
      "title": "Simple, predictable pricing for your whole team",
      "subhead": "Monthly plans scale with your team size \u2014 not your vendor count. Every tier includes unlimited COI uploads and AI extraction."
    },
    {
      "type": "faq",
      "items": [
        {
          "q": "What certificate formats does Verifolio accept?",
          "a": "Verifolio handles any PDF or image-based certificate of insurance, regardless of carrier or form type. The most common format is the ACORD 25, but our extraction engine is trained on hundreds of carrier-specific layouts and non-standard certificates as well. You don't need to standardize what your vendors send."
        },
        {
          "q": "How do I set the coverage requirements for each property?",
          "a": "During onboarding you define the minimum policy limits, required endorsements, and acceptable coverage types for each property in your portfolio. Verifolio scores every incoming COI against those thresholds automatically. You can update requirements at any time and re-score your existing vendor roster instantly."
        },
        {
          "q": "Will vendors need to create a Verifolio account to submit certificates?",
          "a": "No. Vendors submit certificates by replying to an email or uploading to a simple, branded link \u2014 no account creation required on their end. The goal is zero friction for vendors so you actually receive the certificates you need."
        },
        {
          "q": "How long does it take to migrate from our current spreadsheet?",
          "a": "Most teams are fully operational within one business day. You can import your existing vendor list via CSV, and Verifolio will automatically request current certificates from vendors who need to submit. Our onboarding team walks you through the process at no additional cost."
        },
        {
          "q": "Is Verifolio a replacement for our insurance broker or legal counsel?",
          "a": "Verifolio automates the operational work of collecting, reading, and monitoring certificates \u2014 it does not provide legal or insurance advice. We help your team enforce the coverage standards that your broker or legal counsel has already defined, consistently and without manual effort."
        }
      ],
      "title": "Questions from operations teams like yours"
    },
    {
      "type": "cta_band",
      "headline": "Your vendor roster is either compliant or it isn't. Know which.",
      "subhead": "Join property management teams that replaced their COI spreadsheets with Verifolio. Start your free trial today \u2014 no credit card required."
    }
  ]
};
