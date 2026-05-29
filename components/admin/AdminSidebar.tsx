// components/admin/AdminSidebar.tsx

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LeagueRole, canManageRoles } from "@/lib/league-auth";
import {
  Settings,
  MapPin,
  Trophy,
  Users,
  Gamepad2,
  LayoutDashboard,
  Star,
  Calendar,
  ListOrdered,
  Menu,
  X,
  Award,
  Palette,
  TrendingUp,
} from "lucide-react";

interface AdminSidebarProps {
  leagueSlug: string;
  role: LeagueRole;
}

export default function AdminSidebar({ leagueSlug, role }: AdminSidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const base = `/l/${leagueSlug}/admin`;

  const navItems: {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    isDisabled?: boolean;
  }[] = [
    { href: base, label: "Dashboard", icon: LayoutDashboard },
    { href: `${base}/trends`, label: "Trends", icon: TrendingUp },
    { href: `${base}/tournaments`, label: "Tournaments", icon: Award },
    { href: `${base}/seasons`, label: "Seasons", icon: Calendar },
    { href: `${base}/venues`, label: "Venues", icon: MapPin },
    {
      href: `${base}/game-defaults`,
      label: "Game Defaults",
      icon: Gamepad2,
    },
    {
      href: `${base}/blind-schedules`,
      label: "Blind Schedules",
      icon: ListOrdered,
    },
    { href: `${base}/badges`, label: "Badges", icon: Star },

    { href: `${base}/members`, label: "Players", icon: Users },
    ...(canManageRoles(role)
      ? [
          {
            href: `${base}/scoring`,
            label: "Scoring",
            icon: Trophy,
          },
          { href: `${base}/settings`, label: "Identity", icon: Settings },
          { href: `${base}/branding`, label: "Branding", icon: Palette },
        ]
      : []),
  ];

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-amber-600 hover:bg-amber-500 rounded-lg shadow-lg"
        aria-label="Toggle admin menu"
      >
        {isOpen ? (
          <X
            size={20}
            className="text-white"
          />
        ) : (
          <Menu
            size={20}
            className="text-white"
          />
        )}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          w-56 min-h-screen bg-black/90 md:bg-black/30 border-r border-white/10 flex flex-col
          fixed md:static z-40 transition-transform duration-200 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className="p-4 border-b border-white/10 mt-14 md:mt-0">
          <p className="text-xs text-white/40 uppercase tracking-widest">
            League Admin
          </p>
          <p className="text-sm text-white/60 mt-1 capitalize">{role}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon, isDisabled }) => {
            // Dashboard is exact match only, others use startsWith for nested routes
            const active =
              href === base
                ? pathname === href
                : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={handleLinkClick}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
    ${
      isDisabled
        ? "line-through opacity-40 cursor-not-allowed"
        : active
          ? "bg-cyan-500/20 text-cyan-300"
          : "text-white/60 hover:text-white hover:bg-white/5"
    }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
