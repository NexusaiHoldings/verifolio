/** home-config — provisioning-owned (homepage-content-001). Do NOT hand-edit. */
export interface HomeCta { label: string; href: string; }
export interface HomeFeature { title: string; body: string; }
export interface HomeConfig {
  mode: "landing" | "conversation";
  headline?: string;
  subhead?: string;
  primaryCta?: HomeCta;
  secondaryCta?: HomeCta;
  featuresTitle?: string;
  features?: HomeFeature[];
  closingHeadline?: string;
}

export const homeConfig: HomeConfig = {
  "headline": "Your vendor insurance compliance, handled automatically",
  "subhead": "Verifolio is AI-powered COI tracking built for property management companies. Stop chasing spreadsheets and start knowing \u2014 instantly \u2014 which vendors are covered, which aren't, and what's at risk.",
  "featuresTitle": "Everything your operations team actually needs",
  "features": [
    {
      "title": "AI-powered COI extraction",
      "body": "Upload any certificate of insurance and Verifolio reads it automatically \u2014 pulling coverage types, limits, dates, and named insureds in seconds so your team never manually enters a policy detail again."
    },
    {
      "title": "Real-time compliance scoring",
      "body": "Every vendor receives a live compliance score against your required coverage standards, so you can see at a glance who is fully covered, who has gaps, and where your liability exposure sits right now."
    },
    {
      "title": "Expiration alerts that follow up for you",
      "body": "Verifolio automatically flags expiring certificates and notifies vendors before coverage lapses, replacing the calendar reminders and follow-up emails your team sends manually today."
    },
    {
      "title": "One dashboard for 30 to 200 vendors",
      "body": "Replace the spreadsheet with a clean, centralized compliance dashboard that gives operations managers a single source of truth across every vendor, property, and coverage requirement in your portfolio."
    }
  ],
  "closingHeadline": "Your next COI audit starts with zero spreadsheets",
  "mode": "landing"
};
