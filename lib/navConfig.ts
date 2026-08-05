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
import { HomepageTilesConfig } from "@/types/league-config";

export interface NavChild {
  href: string;
  text: string;
  tileKey?: keyof HomepageTilesConfig;
}

export interface NavItem {
  href: string;
  icon: LucideIcon;
  text: string;
  tileKey?: keyof HomepageTilesConfig;
  children?: NavChild[];
}

/**
 * Returns all navigation items with the league prefix applied to hrefs.
 * If homepageTiles config is provided, filters items based on enabled tiles.
 */
export function getNavItems(
  prefix: string = "",
  homepageTiles?: HomepageTilesConfig
): NavItem[] {
  const allItems: NavItem[] = [
    {
      href: `${prefix}/games`,
      icon: GalleryHorizontalEnd,
      text: "Recent Games",
      tileKey: "recentGames",
    },
    {
      href: `${prefix}/check-in`,
      icon: ClipboardCheck,
      text: "Active Games",
      tileKey: "activeGames",
    },
    {
      href: "#",
      icon: Trophy,
      text: "Rankings",
      children: [
        { href: `${prefix}/rankings/season`, text: "Season Rankings", tileKey: "seasonRankings" },
        { href: `${prefix}/rankings/quarterly`, text: "Quarterly Rankings", tileKey: "quarterlyRankings" },
        { href: `${prefix}/rankings/monthly`, text: "Monthly Rankings", tileKey: "monthlyRankings" },
      ],
    },
    {
      href: `${prefix}/players`,
      icon: CircleUserRound,
      text: "Players",
      tileKey: "players",
    },
    {
      href: `${prefix}/venues`,
      icon: Store,
      text: "Venues",
      tileKey: "venues",
    },
    {
      href: `${prefix}/badges`,
      icon: Award,
      text: "Badges",
      tileKey: "badges",
    },
  ];

  // If no config provided, return all items
  if (!homepageTiles) {
    return allItems;
  }

  // Filter items based on config
  return allItems
    .map((item) => {
      // If item has children, filter children first
      if (item.children) {
        const filteredChildren = item.children.filter(
          (child) => !child.tileKey || homepageTiles[child.tileKey]
        );

        // If no children remain visible, exclude the parent item entirely
        if (filteredChildren.length === 0) {
          return null;
        }

        return { ...item, children: filteredChildren };
      }

      // For regular items, check if they should be visible
      if (item.tileKey && !homepageTiles[item.tileKey]) {
        return null;
      }

      return item;
    })
    .filter((item): item is NavItem => item !== null);
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
