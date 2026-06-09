import type { ComponentType } from "react";

export type NavLink = {
  href: string;
  label: string;
  exact?: boolean;
  icon?: ComponentType<{ className?: string }>;
  badge?: {
    label: string;
    tone?: "neutral" | "informative" | "positive" | "warning" | "critical";
  };
};

export type NavGroup = {
  title: string;
  items: NavLink[];
};

export type NavConfig = {
  primary: NavLink[];
  groups: NavGroup[];
};

const BASE_PRIMARY: NavLink[] = [
  {
    label: "Home",
    href: "/",
    exact: true,
  },
];

const BASE_GROUPS: NavGroup[] = [
  {
    title: "Workspace Surfaces",
    items: [
      {
        label: "Work Surface",
        href: "/work",
      },
      {
        label: "Conversation Surface",
        href: "/conversation",
      },
      {
        label: "Artifact Surface",
        href: "/artifact",
      },
      {
        label: "Approval Surface",
        href: "/approval",
      },
      {
        label: "Direct Surface",
        href: "/direct",
      },
    ],
  },
];

const VERIFOLIO_PRIMARY: NavLink[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
  },
  {
    label: "Reports",
    href: "/reports",
  },
  {
    label: "Review Queue",
    href: "/review-queue",
  },
  {
    label: "Vendors",
    href: "/vendors",
  },
  {
    label: "Properties",
    href: "/properties",
  },
  {
    label: "Certificates",
    href: "/certificates",
  },
  {
    label: "Compliance Templates",
    href: "/compliance/templates",
  },
];

const VERIFOLIO_GROUPS: NavGroup[] = [
  {
    title: "Compliance Operations",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
      },
      {
        label: "Reports",
        href: "/reports",
      },
      {
        label: "Vendors",
        href: "/vendors",
      },
      {
        label: "Properties",
        href: "/properties",
      },
      {
        label: "Certificates",
        href: "/certificates",
      },
      {
        label: "Compliance Templates",
        href: "/compliance/templates",
      },
      {
        label: "Review Queue",
        href: "/review-queue",
      },
    ],
  },
];

export const NAV_CONFIG: NavConfig = {
  primary: [...BASE_PRIMARY, ...VERIFOLIO_PRIMARY],
  groups: [...BASE_GROUPS, ...VERIFOLIO_GROUPS],
};

export default NAV_CONFIG;
