// components/Home/HomeContent.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { getNavItems, getAdminNavItems, NavItem } from "@/lib/navConfig";
import PushSubscribeButton from "@/components/push/PushSubscribeButton";

interface HomeContentProps {
  prefix?: string;
  leagueName?: string;
  leagueId?: number;
}

function NavButton({ item }: { item: NavItem; isAdmin?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="flex flex-col items-center justify-center p-6 bg-theme-surface hover:bg-theme-surface-hover rounded-lg transition-colors text-white"
    >
      <Icon
        size={32}
        className="mb-3 text-theme-primary"
      />
      <span className="text-lg font-medium text-center">{item.text}</span>
    </Link>
  );
}

function AdminNavButton({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="flex flex-col items-center justify-center p-6 bg-amber-900/50 hover:bg-amber-800/50 border border-amber-600/30 rounded-lg transition-colors text-white"
    >
      <Icon
        size={32}
        className="mb-3 text-amber-400"
      />
      <span className="text-lg font-medium text-center">{item.text}</span>
    </Link>
  );
}

export default function HomeContent({
  prefix = "",
  leagueName,
  leagueId,
}: HomeContentProps) {
  const { data: session, status } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const title = leagueName
    ? `${leagueName} Player Dashboard`
    : "Freeroll Atlanta Poker Player Dashboard";

  const navItems = getNavItems(prefix);
  const adminNavItems = getAdminNavItems(prefix);

  // Extract league slug from prefix (e.g., "/l/freeroll-atlanta" -> "freeroll-atlanta")
  // The prefix is now in format "/l/[leagueSlug]"
  const leagueSlug = prefix.startsWith("/l/") ? prefix.slice(3) : prefix.replace(/^\//, "");

  // Fetch the user's role for this league
  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user || !leagueSlug) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    fetch(`/api/${leagueSlug}/my-role`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          // User is admin if they have league role (owner/admin) or are global admin
          const hasAdminAccess =
            data.role === "owner" ||
            data.role === "admin" ||
            data.isGlobalAdmin;
          setIsAdmin(hasAdminAccess);
        }
      })
      .catch(() => setIsAdmin(false))
      .finally(() => setIsLoading(false));
  }, [session, status, leagueSlug]);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="text-4xl font-bold">{title}</h1>
        {session?.user && leagueId && (
          <PushSubscribeButton leagueId={leagueId} />
        )}
      </div>
      {/* Admin Section - only visible to admins/owners */}
      {!isLoading && isAdmin && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {adminNavItems.map((item) => (
              <AdminNavButton
                key={item.href}
                item={item}
              />
            ))}
          </div>
        </>
      )}
      <div className="grid grid-cols-2 pt-4 md:grid-cols-3 gap-4">
        {navItems.map((item) => {
          const Icon = item.icon;

          // If item has children, render each child as a separate button
          if (item.children) {
            return item.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                className="flex flex-col items-center justify-center p-6 bg-theme-surface hover:bg-theme-surface-hover rounded-lg transition-colors text-white"
              >
                <Icon
                  size={32}
                  className="mb-3 text-theme-primary"
                />
                <span className="text-lg font-medium text-center">
                  {child.text}
                </span>
              </Link>
            ));
          }

          return (
            <NavButton
              key={item.href}
              item={item}
            />
          );
        })}
      </div>
    </main>
  );
}
