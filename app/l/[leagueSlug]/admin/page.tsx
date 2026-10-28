// app/[leagueSlug]/admin/page.tsx

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLeagueIdBySlug } from "@/lib/league-utils";
import { getLeagueConfig } from "@/lib/league-config";
import { getLeagueRole } from "@/lib/league-auth";
import { prisma } from "@/lib/prisma";
import { LeagueAdminsSection } from "./LeagueAdminsSection";
import PushBroadcastPanel from "@/components/admin/PushBroadcastPanel";
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

  const [league, venues, seasons, recentTournaments] = await Promise.all([
    prisma.leagues.findUnique({
      where: { id: leagueId! },
      select: { name: true, created: true },
    }),
    prisma.venues.findMany({
      where: { league_id: leagueId! },
      select: { id: true, name: true, is_active: true },
      orderBy: { name: "asc" },
    }),
    prisma.competition_periods.findMany({
      where: { league_id: leagueId!, is_active: true },
      select: { id: true, name: true, period_type: true },
      orderBy: { display_order: "asc" },
    }),
    prisma.games.findMany({
      where: { league_id: leagueId! },
      orderBy: { date: "desc" },
      take: 8,
      select: {
        id: true,
        uid: true,
        date: true,
        venues: { select: { name: true } },
        game_periods: {
          select: { competition_periods: { select: { name: true } } },
        },
        _count: { select: { appearances: true } },
        tournament_drafts: {
          select: {
            players: {
              where: { is_new_player: true },
              select: { id: true },
            },
          },
        },
      },
    }),
  ]);

  const activeVenues = venues.filter((v) => v.is_active);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-1">
        {league?.name ?? "League"} Admin
      </h1>
      <p className="text-white/40 text-sm mb-8">
        You are logged in as <span className="text-cyan-400">{role}</span>
      </p>

      {/* Tournaments Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Tournaments</h2>
          <Link
            href={`/l/${leagueSlug}/admin/tournaments`}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            View All →
          </Link>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
          {recentTournaments.length > 0 ? (
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2 text-[10px] text-white/40 uppercase tracking-wider px-2 pb-1 border-b border-white/5">
                <span>Venue</span>
                <span>Seasons</span>
                <span className="text-right">Date</span>
                <span className="text-right">Players</span>
                <span className="text-right">New</span>
              </div>
              {recentTournaments.map((game) => {
                const seasonNames = game.game_periods.map(
                  (gp) => gp.competition_periods.name,
                );
                const newPlayers = game.tournament_drafts?.players.length ?? 0;
                // Anchor date to noon UTC to avoid timezone shift issues
                const dateStr = game.date.toISOString().split("T")[0];
                const anchoredDate = new Date(`${dateStr}T12:00:00Z`);
                const dayOfWeek = new Intl.DateTimeFormat("en-US", {
                  timeZone: config.timezone,
                  weekday: "short",
                }).format(anchoredDate).slice(0, 2);
                const formattedDate = `${dayOfWeek} ${new Intl.DateTimeFormat("en-US", {
                  timeZone: config.timezone,
                  month: "numeric",
                  day: "numeric",
                }).format(anchoredDate)}`;
                return (
                  <div
                    key={game.id}
                    className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2 text-xs py-1.5 px-2 items-center"
                  >
                    <span className="text-white/80 truncate">
                      {game.venues.name}
                    </span>
                    <span className="text-white/50 truncate text-[10px]">
                      {seasonNames.length > 0 ? seasonNames.join(", ") : "—"}
                    </span>
                    <span className="text-white/50 tabular-nums">
                      {formattedDate}
                    </span>
                    <span className="text-white/70 tabular-nums text-right w-8">
                      {game._count.appearances}
                    </span>
                    <span
                      className={`tabular-nums text-right w-6 ${
                        newPlayers > 0 ? "text-green-400" : "text-white/30"
                      }`}
                    >
                      {newPlayers}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-white/40 text-sm text-center py-2">
              No tournaments yet
            </p>
          )}
        </div>
      </div>

      {/* Seasons Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Seasons</h2>
          <Link
            href={`/l/${leagueSlug}/admin/seasons`}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            Manage →
          </Link>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-sm mb-3">
            <span className="text-green-400">{seasons.length} active</span>
          </div>
          {seasons.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {seasons.map((season) => (
                <span
                  key={season.id}
                  className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/70"
                >
                  {season.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-white/40 text-sm">No active seasons</p>
          )}
        </div>
      </div>

      {/* Venues Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Venues</h2>
          <Link
            href={`/l/${leagueSlug}/admin/venues`}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            Manage →
          </Link>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-sm mb-3">
            <span className="text-green-400">{activeVenues.length} active</span>
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

      {/* Game Defaults Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Game Defaults</h2>
          <Link
            href={`/l/${leagueSlug}/admin/game-defaults`}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            Manage →
          </Link>
        </div>
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
        </div>
      </div>

      {/* League Settings Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">
          League Settings
        </h2>
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

      {/* Push Notification Broadcast */}
      <div className="mb-8">
        <PushBroadcastPanel leagueSlug={leagueSlug} />
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
