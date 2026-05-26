// app/[leagueSlug]/admin/seasons/page.tsx

import { getLeagueIdBySlug } from "@/lib/league-utils";
import SeasonManager from "../SeasonManager";

interface PageProps {
  params: Promise<{ leagueSlug: string }>;
}

export default async function SeasonsPage({ params }: PageProps) {
  const { leagueSlug } = await params;
  const leagueId = await getLeagueIdBySlug(leagueSlug);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-1">
        Competition Seasons
      </h1>
      <p className="text-white/40 text-sm mb-8">
        Manage your league&apos;s competition periods for rankings and
        tournaments.
        <br></br>
        Active seasons will be visible on the rankings pages.
        <br></br>Seasons of the same &quot;type&quot; (e.g.
        &quot;Quarterly/Monthly&quot;) will be grouped together on the rankings
        pages.
        <br></br>You can drag/drop the active seasons to reorder them.{" "}
      </p>

      <SeasonManager
        leagueId={leagueId!}
        leagueSlug={leagueSlug}
      />
    </div>
  );
}
