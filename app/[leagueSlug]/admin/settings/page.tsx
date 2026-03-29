import { getLeagueIdBySlug } from '@/lib/league-utils';
import { getLeagueConfig } from '@/lib/league-config';
import IdentitySettingsForm from '@/components/admin/IdentitySettingsForm';

interface PageProps {
  params: Promise<{ leagueSlug: string }>;
}

export default async function IdentitySettingsPage({ params }: PageProps) {
  const { leagueSlug } = await params;
  const leagueId = await getLeagueIdBySlug(leagueSlug);
  const config = await getLeagueConfig(leagueId!);

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-white mb-1">Identity</h2>
      <p className="text-white/40 text-sm mb-8">
        Basic information about your league.
      </p>
      <IdentitySettingsForm
        leagueSlug={leagueSlug}
        initialConfig={config}
      />
    </div>
  );
}
