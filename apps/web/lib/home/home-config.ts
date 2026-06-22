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
  "headline": "Stop Missing Vendor COIs Before They Become Liability",
  "subhead": "Verifolio is AI-powered COI compliance software built for property management companies. Operations teams managing 30 to 200+ vendors finally ditch the spreadsheet and get instant coverage gap alerts.",
  "featuresTitle": "Everything your operations team needs to stay covered",
  "features": [
    {
      "title": "AI-Powered COI Data Extraction",
      "body": "Upload any certificate of insurance and Verifolio's AI instantly reads and extracts policy limits, expiration dates, and named insureds\u2014no manual data entry required."
    },
    {
      "title": "Automated Compliance Scoring",
      "body": "Every vendor receives a real-time compliance score based on your required coverage thresholds, so you always know which vendors are compliant and which are putting you at risk."
    },
    {
      "title": "Coverage Gap Alerts",
      "body": "Verifolio flags missing, expired, or insufficient coverage before it becomes a liability event, sending proactive alerts so your team can chase vendors down before deadlines pass."
    },
    {
      "title": "Centralized Vendor COI Dashboard",
      "body": "Replace scattered spreadsheets with a single dashboard showing compliance status across all 30 to 200+ vendors, giving operations managers an instant portfolio-wide view at any time."
    }
  ],
  "closingHeadline": "Your next missed COI is the last one you can afford\u2014get covered today",
  "mode": "landing"
};
