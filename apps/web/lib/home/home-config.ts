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
      "eyebrow": "Insurance Compliance for Property Management",
      "subhead": "Verifolio uses AI to extract, score, and monitor vendor certificates of insurance automatically \u2014 so your team stops managing spreadsheets and starts managing properties.",
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
          "value": "11 hrs",
          "label": "lost per week per operations manager chasing and verifying vendor COIs"
        },
        {
          "value": "1 in 4",
          "label": "vendor certificates contain a coverage gap missed during manual review"
        },
        {
          "value": "73%",
          "label": "of property management liability claims involve an uninsured or underinsured ven"
        }
      ],
      "title": "The cost of tracking COIs the old way"
    },
    {
      "type": "how_it_works",
      "steps": [
        {
          "title": "Collect certificates automatically",
          "body": "Vendors email or upload their COI to your dedicated Verifolio inbox. Our AI reads every field \u2014 carrier, policy number, coverage limits, effective dates, additional insured endorsements \u2014 in seconds."
        },
        {
          "title": "Score every vendor against your requirements",
          "body": "Verifolio compares extracted coverage data against the compliance rules you set per property or vendor category. Each vendor gets a live compliance score and a clear gap report \u2014 no manual cross-referencing required."
        },
        {
          "title": "Monitor, alert, and renew without lifting a finger",
          "body": "When a policy approaches expiration or a gap is detected, Verifolio automatically notifies the right vendor and flags the issue for your team. Your compliance dashboard stays green without daily babysitting."
        }
      ],
      "title": "Compliance on autopilot in three steps",
      "subhead": "Verifolio fits into the way your team already works \u2014 no rekeying, no new vendor portals, no training marathons."
    },
    {
      "type": "feature_spotlight",
      "items": [
        {
          "title": "AI-powered COI extraction that actually works",
          "body": "Verifolio's document intelligence engine handles the messy reality of real-world certificates \u2014 scanned PDFs, low-resolution faxes, non-standard ACORD formats, and handwritten endorsements. It extracts policy limits, coverage types, named insureds, and expiration dates with high accuracy, then flags anything it isn't certain about for a one-click human review. Your team stops being data-entry cler",
          "image": {
            "url": "https://runtime.nexusaiholdings.com/assets/fb573509-ae56-44f3-a11b-8470a2ae7c50",
            "alt": "AI-powered COI extraction that actually works"
          }
        },
        {
          "title": "Compliance rules built around your properties, not a generic template",
          "body": "Every property you manage can carry its own insurance requirements \u2014 minimum general liability limits, workers' comp mandates, umbrella thresholds, additional insured language. Verifolio lets you define those rules once per property class or per individual property, then enforces them automatically against every incoming certificate. When a vendor falls short, you know exactly which requirement fa",
          "image": {
            "url": "https://runtime.nexusaiholdings.com/assets/461ff2ad-fe31-41b2-be43-ef08879c5986",
            "alt": "Compliance rules built around your properties, not a generic template"
          }
        },
        {
          "title": "A live compliance dashboard your whole team can trust",
          "body": "Replace the shared spreadsheet that's always one edit behind with a real-time dashboard showing every vendor's current compliance status, upcoming expirations, open gaps, and renewal history. Filter by property, vendor type, or risk level. Export an audit-ready report in one click when ownership or regulators ask for proof of due diligence.",
          "image": {
            "url": "https://runtime.nexusaiholdings.com/assets/c76f38e0-f950-4573-8af7-1915c2c13577",
            "alt": "A live compliance dashboard your whole team can trust"
          }
        }
      ],
      "title": "Intelligence working quietly in the background"
    },
    {
      "type": "feature_grid",
      "features": [
        {
          "title": "Dedicated vendor certificate inbox",
          "body": "Each company gets a unique email address. Vendors send COIs directly there \u2014 no portal login required on their end, no manual upload on yours."
        },
        {
          "title": "Automated expiration reminders",
          "body": "Verifolio sends tiered renewal reminders to vendors at 60, 30, and 7 days before expiration, and escalates to your team if a vendor goes dark."
        },
        {
          "title": "Multi-property rule sets",
          "body": "Define different insurance requirements for residential, commercial, and mixed-use properties. Verifolio applies the right rules to the right vendors automatically."
        },
        {
          "title": "Gap and deficiency reports",
          "body": "When a COI falls short, Verifolio generates a plain-language deficiency notice you can forward to the vendor in one click \u2014 no legal jargon, no manual drafting."
        },
        {
          "title": "Full certificate history and audit trail",
          "body": "Every certificate ever received, every status change, and every team action is logged with a timestamp \u2014 giving you defensible documentation if a claim dispute arises."
        },
        {
          "title": "Seat-based team access with role permissions",
          "body": "Give your property managers view access, your compliance leads edit rights, and your principals a read-only executive summary \u2014 all under one subscription."
        }
      ],
      "title": "Everything your compliance workflow needs",
      "subhead": "Purpose-built for operations teams managing dozens to hundreds of vendor relationships across multiple properties."
    },
    {
      "type": "social_proof",
      "quotes": [
        {
          "quote": "We manage 340 units across 12 properties and were drowning in COI emails every renewal season. Verifolio cut our weekly compliance work from most of a day to about thirty minutes. The gap alerts alone have probably saved us from a serious liability situation.",
          "author": "Operations Director",
          "role": "Regional property management company, 340 units"
        },
        {
          "quote": "Our old spreadsheet was always wrong because no one had time to keep it current. Now the dashboard just shows us the truth in real time. When an owner asks if all our vendors are compliant, I can actually answer with confidence.",
          "author": "Portfolio Manager",
          "role": "Mid-market HOA management firm, 180 units"
        },
        {
          "quote": "The vendor-facing side is seamless. We told our contractors to email their COI to our Verifolio address and most of them didn't even notice anything changed on their end. That zero-friction handoff was the thing that made adoption stick.",
          "author": "VP of Operations",
          "role": "Residential property management group, 520 units"
        }
      ],
      "title": "What operations teams say after switching from spreadsheets"
    },
    {
      "type": "pricing_teaser",
      "tiers": [
        {
          "name": "Starter",
          "features": [
            "Up to 3 team seats",
            "Unlimited vendor COIs",
            "Up to 5 properties",
            "AI extraction and compliance scoring",
            "Automated expiration reminders",
            "Email support"
          ],
          "period": "per month"
        },
        {
          "name": "Growth",
          "features": [
            "Up to 10 team seats",
            "Unlimited vendor COIs",
            "Unlimited properties",
            "Custom compliance rule sets per property",
            "Audit-ready export reports",
            "Gap and deficiency notice generation",
            "Priority support"
          ],
          "period": "per month",
          "highlighted": true
        },
        {
          "name": "Enterprise",
          "features": [
            "Unlimited seats",
            "Unlimited properties and vendors",
            "SSO and advanced role permissions",
            "Dedicated onboarding and migration support",
            "SLA-backed uptime",
            "Custom integrations on request"
          ],
          "period": "custom"
        }
      ],
      "title": "Simple, seat-based pricing that scales with your team",
      "subhead": "No per-certificate fees, no surprise overages. Pay for the seats your team uses and get unlimited vendor COIs, properties, and compliance rules."
    },
    {
      "type": "faq",
      "items": [
        {
          "q": "What happens to COIs our vendors already sent us? Do we have to start from scratch?",
          "a": "No. During onboarding, you can bulk-upload your existing certificate files and Verifolio will extract and score them automatically. Most teams have their historical COI library imported and scored within a day or two of signing up."
        },
        {
          "q": "How accurate is the AI extraction? What if it misreads a certificate?",
          "a": "Verifolio's extraction engine is trained specifically on ACORD and non-standard insurance certificate formats. When confidence is below our accuracy threshold on any field, the certificate is flagged for a one-click human review rather than silently passed through. You stay in control of anything the AI isn't certain about."
        },
        {
          "q": "Do our vendors need to create an account or learn a new system?",
          "a": "No. Vendors send their COI to your company's dedicated Verifolio email address exactly as they would send it to you today. There is no vendor portal, no login, and no change to their workflow."
        },
        {
          "q": "Can Verifolio handle different insurance requirements for different property types?",
          "a": "Yes. You define compliance rules at the property level, the property-class level, or the vendor-category level. A landscaping contractor at a commercial property can be held to different limits than a plumber at a residential building \u2014 all within the same account."
        },
        {
          "q": "Is our certificate data secure?",
          "a": "Verifolio encrypts all documents and extracted data at rest and in transit. We do not share or sell your vendor data. Access is controlled by the role permissions you configure for your team, and a full audit log records every action taken in your account."
        }
      ],
      "title": "Questions operations teams ask before switching"
    },
    {
      "type": "cta_band",
      "headline": "Your spreadsheet can't tell you what's missing. Verifolio can.",
      "subhead": "Join property management teams who've replaced manual COI tracking with a compliance system that works quietly, accurately, and continuously \u2014 so your liability exposure stops being a guessing game."
    }
  ]
};
