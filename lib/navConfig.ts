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
 * If activePeriodTypes is provided, builds rankings children dynamically.
 */
export function getNavItems(
  prefix: string = "",
  homepageTiles?: HomepageTilesConfig,
  activePeriodTypes?: string[]
): NavItem[] {
  // Build rankings children dynamically from active period types
  let rankingsChildren: NavChild[] = [];

  if (activePeriodTypes && activePeriodTypes.length > 0) {
    rankingsChildren = activePeriodTypes.map((periodType) => {
      const label = periodType.charAt(0).toUpperCase() + periodType.slice(1);
      return {
        href: `${prefix}/rankings/${periodType}`,
        text: `${label} Rankings`,
      };
    });
  }

  // Add monthly rankings if enabled (uses static route with distinct venue-based logic)
  if (homepageTiles?.monthlyRankings) {
    rankingsChildren.push({
      href: `${prefix}/rankings/monthly`,
      text: "Monthly Rankings",
      tileKey: "monthlyRankings",
    });
  }

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
      children: rankingsChildren.length > 0 ? rankingsChildren : undefined,
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

  // Filter out items that have no children and no direct href (like Rankings with no period types)
  const filteredItems = allItems.filter((item) => {
    // If item has children, keep it
    if (item.children && item.children.length > 0) {
      return true;
    }
    // If item has a valid href (not "#"), keep it
    if (item.href !== "#") {
      return true;
    }
    // Otherwise, exclude it (e.g., Rankings with no active period types)
    return false;
  });

  // If no config provided, return filtered items
  if (!homepageTiles) {
    return filteredItems;
  }

  // Filter items based on config
  return filteredItems
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
