// app/[leagueSlug]/admin/game-defaults/page.tsx

import { getLeagueIdBySlug } from "@/lib/league-utils";
import { getLeagueConfig } from "@/lib/league-config";
import GameDefaultsForm from "@/components/admin/GameDefaultsForm";

interface PageProps {
  params: Promise<{ leagueSlug: string }>;
}

export default async function GameDefaultsPage({ params }: PageProps) {
  const { leagueSlug } = await params;
  const leagueId = await getLeagueIdBySlug(leagueSlug);
  const config = await getLeagueConfig(leagueId!);

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-white mb-1">Game Defaults</h2>
      <p className="text-white/40 text-sm mb-8">
        Default settings applied to each new game
      </p>
      <GameDefaultsForm
        leagueSlug={leagueSlug}
        initialConfig={config}
      />
    </div>
  );
}
