// app/[leagueSlug]/admin/branding/page.tsx

import { getLeagueIdBySlug } from '@/lib/league-utils';
import { getLeagueConfig } from '@/lib/league-config';
import BrandingSettingsForm from '@/components/admin/BrandingSettingsForm';

interface PageProps {
  params: Promise<{ leagueSlug: string }>;
}

export default async function BrandingSettingsPage({ params }: PageProps) {
  const { leagueSlug } = await params;
  const leagueId = await getLeagueIdBySlug(leagueSlug);
  const config = await getLeagueConfig(leagueId!);

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-white mb-1">Branding</h2>
      <p className="text-white/40 text-sm mb-8">
        Customize the color theme for your league&apos;s dashboard.
      </p>
      <BrandingSettingsForm
        leagueSlug={leagueSlug}
        initialThemeId={config.branding?.themeId ?? 'default'}
      />
    </div>
  );
}
