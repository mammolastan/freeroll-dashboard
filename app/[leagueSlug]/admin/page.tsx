// app/[leagueSlug]/admin/page.tsx

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLeagueIdBySlug } from "@/lib/league-utils";
import { getLeagueConfig } from "@/lib/league-config";
import { getLeagueRole } from "@/lib/league-auth";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: Promise<{ leagueSlug: string }>;
}

export default async function AdminDashboardPage({ params }: PageProps) {
  const { leagueSlug } = await params;
  const session = await getServerSession(authOptions);
  const leagueId = await getLeagueIdBySlug(leagueSlug);
  const config = await getLeagueConfig(leagueId!);
  const role = await getLeagueRole(session!.user.uid, leagueId!);

  const league = await prisma.leagues.findUnique({
    where: { id: leagueId! },
    select: { name: true, created: true },
  });

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-1">
        {league?.name ?? "League"} Admin
      </h1>
      <p className="text-white/40 text-sm mb-8">
        You are logged in as <span className="text-cyan-400">{role}</span>
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-1">
            Timezone
          </p>
          <p className="text-white font-medium">{config.timezone}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-1">
            Self Registration
          </p>
          <p className="text-white font-medium">
            {config.allowSelfRegistration ? "Enabled" : "Disabled"}
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-1">
            Badges
          </p>
          <p className="text-white font-medium">
            {config.badgesEnabled ? "Enabled" : "Disabled"}
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-1">
            Chat
          </p>
          <p className="text-white font-medium">
            {config.chatEnabled ? "Enabled" : "Disabled"}
          </p>
        </div>
      </div>

      <p className="text-white/20 text-xs mt-8">
        League created{" "}
        {league?.created ? new Date(league.created).toLocaleDateString() : "—"}
      </p>
    </div>
  );
}
