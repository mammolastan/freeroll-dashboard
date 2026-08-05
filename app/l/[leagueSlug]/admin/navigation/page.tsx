// app/l/[leagueSlug]/admin/navigation/page.tsx

import { getLeagueIdBySlug } from "@/lib/league-utils";
import { getLeagueConfig } from "@/lib/league-config";
import NavigationSettingsForm from "@/components/admin/NavigationSettingsForm";

interface PageProps {
  params: Promise<{ leagueSlug: string }>;
}

export default async function NavigationSettingsPage({ params }: PageProps) {
  const { leagueSlug } = await params;
  const leagueId = await getLeagueIdBySlug(leagueSlug);
  const config = await getLeagueConfig(leagueId!);

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-white mb-1">Navigation</h2>
      <p className="text-white/40 text-sm mb-8">
        Control which pages appear on your homepage and in the navigation menu.
      </p>
      <NavigationSettingsForm
        leagueSlug={leagueSlug}
        initialTiles={config.homepageTiles}
      />
    </div>
  );
}
