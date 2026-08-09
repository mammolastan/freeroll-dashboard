// app/l/[leagueSlug]/admin/sms/page.tsx

import { getLeagueIdBySlug } from "@/lib/league-utils";
import { getLeagueConfig } from "@/lib/league-config";
import { prisma } from "@/lib/prisma";
import SmsSettingsForm from "@/components/admin/SmsSettingsForm";

interface PageProps {
  params: Promise<{ leagueSlug: string }>;
}

export default async function SmsSettingsPage({ params }: PageProps) {
  const { leagueSlug } = await params;
  const leagueId = await getLeagueIdBySlug(leagueSlug);
  const config = await getLeagueConfig(leagueId!);

  const league = await prisma.leagues.findUnique({
    where: { id: leagueId! },
    select: { name: true },
  });

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-white mb-1">SMS</h2>
      <p className="text-white/40 text-sm mb-8">
        Configure SMS notification settings for your league.
      </p>
      <SmsSettingsForm
        leagueSlug={leagueSlug}
        leagueName={league?.name ?? "League"}
        initialSmsEnabled={config.smsEnabled}
      />
    </div>
  );
}
