// lib/navConfig.ts
import {
  Trophy,
  GalleryHorizontalEnd,
  ClipboardCheck,
  CircleUserRound,
  Store,
  Award,
  Settings,
  Play,
  Tv
} from "lucide-react";
import { LucideIcon } from "lucide-react";

export interface NavChild {
  href: string;
  text: string;
}

export interface NavItem {
  href: string;
  icon: LucideIcon;
  text: string;
  children?: NavChild[];
}

/**
 * Returns navigation items with the league prefix applied to hrefs
 */
export function getNavItems(prefix: string = ""): NavItem[] {
  return [
    {
      href: `${prefix}/games`,
      icon: GalleryHorizontalEnd,
      text: "Recent Games",
    },
    {
      href: `${prefix}/check-in`,
      icon: ClipboardCheck,
      text: "Active Games",
    },
    {
      href: "#",
      icon: Trophy,
      text: "Rankings",
      children: [
        { href: `${prefix}/rankings/quarterly`, text: "Quarterly Rankings" },
        { href: `${prefix}/rankings/monthly`, text: "Monthly Rankings" },
      ],
    },
    {
      href: `${prefix}/players`,
      icon: CircleUserRound,
      text: "Players",
    },
    {
      href: `${prefix}/venues`,
      icon: Store,
      text: "Venues",
    },
    {
      href: `${prefix}/badges`,
      icon: Award,
      text: "Badges",
    },
  ];
}

/**
 * Returns admin navigation items (only shown to admins/owners)
 */
export function getAdminNavItems(prefix: string = ""): NavItem[] {
  return [
    {
      href: `${prefix}/admin/tournament-entry`,
      icon: Play,
      text: "Tournament Entry",
    },
    {
      href: `${prefix}/tvscreen`,
      icon: Tv,
      text: "TV Display",
    },
    {
      href: `${prefix}/admin`,
      icon: Settings,
      text: "League Settings",
    },
  ];
}
