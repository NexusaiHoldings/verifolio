export const NAV_CONFIG = {
  primary: [
    { title: "Home", href: "/" },
    { title: "Dashboard", href: "/dashboard" },
    { title: "Vendors", href: "/vendors" },
    { title: "Properties", href: "/properties" },
    { title: "Certificates", href: "/certificates" },
    { title: "Compliance Templates", href: "/compliance/templates" },
    { title: "Reports", href: "/reports" },
    { title: "Review Queue", href: "/review-queue" },
  ],
  groups: [
    {
      title: "Operations",
      items: [
        {
          title: "Dashboard",
          href: "/dashboard",
          description: "Monitor compliance status and key insurance metrics at a glance.",
        },
        {
          title: "Vendors",
          href: "/vendors",
          description: "Manage vendor rosters and track certificate of insurance compliance.",
        },
        {
          title: "Properties",
          href: "/properties",
          description: "Organize properties and view associated vendor coverage.",
        },
        {
          title: "Certificates",
          href: "/certificates",
          description: "Search and review uploaded certificates for coverage gaps or expirations.",
        },
        {
          title: "Review Queue",
          href: "/review-queue",
          description: "Triage newly ingested documents that require verification or follow-up.",
        },
      ],
    },
    {
      title: "Compliance",
      items: [
        {
          title: "Compliance Templates",
          href: "/compliance/templates",
          description: "Define insurance requirements and map coverage rules across portfolios.",
        },
        {
          title: "Reports",
          href: "/reports",
          description: "Run portfolio-wide compliance analytics and export audit-ready reports.",
        },
      ],
    },
  ],
} as const;
