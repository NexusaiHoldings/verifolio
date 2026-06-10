/**
 * home-config (company-root-landing-001 backport). Do NOT hand-edit.
 */
export interface HomeCta { label: string; href: string; }
export interface HomeConfig {
  mode: "landing" | "conversation";
  headline?: string;
  subhead?: string;
  primaryCta?: HomeCta;
  secondaryCta?: HomeCta;
}

export const homeConfig: HomeConfig = {
  "mode": "landing",
  "headline": "Never be caught without vendor coverage again \u2014 Verifolio catches every expiration and coverage gap before your board do",
  "subhead": "Verifolio (getverifolio.com) is the AI-native COI compliance platform built exclusively for SMB property and community association management companies \u2014 it automatically ingests, extracts, and validates certificates of insurance against co"
};
