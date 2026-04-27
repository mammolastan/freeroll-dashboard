// app/[leagueSlug]/admin/page.tsx

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLeagueIdBySlug } from "@/lib/league-utils";
import { getLeagueConfig } from "@/lib/league-config";
import { getLeagueRole } from "@/lib/league-auth";
import { prisma } from "@/lib/prisma";
import { LeagueAdminsSection } from "./LeagueAdminsSection";
import Link from "next/link";

interface PageProps {
  params: Promise<{ leagueSlug: string }>;
}

export default async function AdminDashboardPage({ params }: PageProps) {
  const { leagueSlug } = await params;
  const session = await getServerSession(authOptions);
  const leagueId = await getLeagueIdBySlug(leagueSlug);
  const config = await getLeagueConfig(leagueId!);
  const role = await getLeagueRole(session!.user.uid, leagueId!);

  const [league, venues] = await Promise.all([
    prisma.leagues.findUnique({
      where: { id: leagueId! },
      select: { name: true, created: true },
    }),
    prisma.venues.findMany({
      where: { league_id: leagueId! },
      select: { id: true, name: true, is_active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const activeVenues = venues.filter((v) => v.is_active);
  const inactiveCount = venues.length - activeVenues.length;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-1">
        {league?.name ?? "League"} Admin
      </h1>
      <p className="text-white/40 text-sm mb-8">
        You are logged in as <span className="text-cyan-400">{role}</span>
      </p>

      {/* Game Defaults Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Game Defaults</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">
              Chat
            </p>
            <p className="text-white font-medium">
              {config.gameDefaults.allowChat ? "Enabled" : "Disabled"}
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">
              Self Check-In
            </p>
            <p className="text-white font-medium">
              {config.gameDefaults.allowSelfCheckIn ? "Enabled" : "Disabled"}
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 col-span-2">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">
              Late Registration Window
            </p>
            <p className="text-white font-medium">
              {config.gameDefaults.lateRegistrationWindowMinutes} minutes
            </p>
          </div>
        </div>
      </div>

      {/* Venues Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Venues</h2>
          <Link
            href={`/${leagueSlug}/admin/venues`}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            Manage →
          </Link>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex gap-4 text-sm mb-3">
            <span className="text-green-400">{activeVenues.length} active</span>
            <span className="text-white/40">{inactiveCount} inactive</span>
          </div>
          {activeVenues.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeVenues.map((venue) => (
                <span
                  key={venue.id}
                  className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/70"
                >
                  {venue.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-white/40 text-sm">No active venues</p>
          )}
        </div>
      </div>

      {/* League Settings Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">League Settings</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">
              Badges
            </p>
            <p className="text-white font-medium">
              {config.badgesEnabled ? "Enabled" : "Disabled"}
            </p>
          </div>
        </div>
      </div>

      <LeagueAdminsSection
        leagueSlug={leagueSlug}
        currentUserRole={role}
        currentUserUid={session!.user.uid}
      />

      <p className="text-white/20 text-xs mt-8">
        League created{" "}
        {league?.created ? new Date(league.created).toLocaleDateString() : "—"}
      </p>
    </div>
  );
}
