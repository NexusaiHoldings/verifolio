export const NAV_CONFIG = {
  primary: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Vendors", href: "/vendors" },
    { label: "Properties", href: "/properties" },
    { label: "Certificates", href: "/certificates" },
    { label: "Review Queue", href: "/review-queue" },
  ],
  groups: [
    {
      title: "Compliance",
      items: [
        { label: "Templates", href: "/compliance/templates" },
        { label: "Reports", href: "/reports" },
      ],
    },
  ],
} as const;
