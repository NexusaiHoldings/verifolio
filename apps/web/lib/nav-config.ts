export type NavLink = { href: string; label: string; description?: string };
export type NavGroup = { label: string; links: NavLink[] };

export const NAV_CONFIG: {
  primary: NavLink[];
  groups: NavGroup[];
} = {
  primary: [
    { label: "Home", href: "/" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Vendors", href: "/vendors" },
    { label: "Properties", href: "/properties" },
    { label: "Certificates", href: "/certificates" },
    { label: "Compliance Templates", href: "/compliance/templates" },
    { label: "Reports", href: "/reports" },
    { label: "Review Queue", href: "/review-queue" },
  ],
  groups: [
    {
      label: "Operations",
      links: [
        {
          label: "Dashboard",
          href: "/dashboard",
          description: "Monitor compliance status and key insurance metrics at a glance.",
        },
        {
          label: "Vendors",
          href: "/vendors",
          description: "Manage vendor rosters and track certificate of insurance compliance.",
        },
        {
          label: "Properties",
          href: "/properties",
          description: "Organize properties and view associated vendor coverage.",
        },
        {
          label: "Certificates",
          href: "/certificates",
          description: "Search and review uploaded certificates for coverage gaps or expirations.",
        },
        {
          label: "Review Queue",
          href: "/review-queue",
          description: "Triage newly ingested documents that require verification or follow-up.",
        },
      ],
    },
    {
      label: "Compliance",
      links: [
        {
          label: "Compliance Templates",
          href: "/compliance/templates",
          description: "Define insurance requirements and map coverage rules across portfolios.",
        },
        {
          label: "Reports",
          href: "/reports",
          description: "Run portfolio-wide compliance analytics and export audit-ready reports.",
        },
      ],
    },
  ],
} as const;
