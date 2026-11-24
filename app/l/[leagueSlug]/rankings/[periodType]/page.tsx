// app/l/[leagueSlug]/rankings/[periodType]/page.tsx

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getLeagueConfig } from "@/lib/league-config";
import {
  getCachedCompetitionPeriods,
  fetchRankingsWithBadges,
  type RankingsData,
} from "@/lib/rankings-data";
import QuarterlyRankingsClient from "@/components/Rankings/QuarterlyRankingsClient";

interface Props {
  params: Promise<{ periodType: string; leagueSlug: string }>;
  searchParams: Promise<{ period_id?: string }>;
}

export default async function DynamicRankingsPage({
  params,
  searchParams,
}: Props) {
  const { periodType, leagueSlug } = await params;
  const { period_id } = await searchParams;

  // Monthly has distinct venue-based logic - let static route handle it
  if (periodType === "monthly") {
    notFound();
  }

  // Get league ID from slug
  const league = await prisma.leagues.findUnique({
    where: { slug: leagueSlug },
    select: { id: true },
  });

  if (!league) {
    notFound();
  }

  const leagueId = league.id;

  // Fetch league config to check if badges are enabled
  const leagueConfig = await getLeagueConfig(leagueId);
  const badgesEnabled = leagueConfig.badgesEnabled ?? true;

  // Fetch competition periods
  const periods = await getCachedCompetitionPeriods(leagueId, periodType);

  if (!periods || periods.length === 0) {
    // No periods configured for this period type
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="text-xl text-white">
          No {periodType} periods configured yet. Check back soon.
        </div>
      </div>
    );
  }

  // Determine which period to show
  let selectedPeriodId: number;
  if (period_id) {
    const parsedId = parseInt(period_id);
    // Validate that the period exists in our list
    if (!isNaN(parsedId) && periods.some((p) => p.id === parsedId)) {
      selectedPeriodId = parsedId;
    } else {
      // Invalid period_id, use first (most recent)
      selectedPeriodId = periods[0].id;
    }
  } else {
    // No period_id in URL, use first (most recent)
    selectedPeriodId = periods[0].id;
  }

  // Fetch rankings with badges
  const rankingsResult = await fetchRankingsWithBadges(
    leagueId,
    selectedPeriodId,
    periodType,
    badgesEnabled
  );

  if ("error" in rankingsResult) {
    notFound();
  }

  const label = periodType.charAt(0).toUpperCase() + periodType.slice(1);

  return (
    <QuarterlyRankingsClient
      periodType={periodType}
      title={`${label} Rankings`}
      periodLabel={label}
      leagueSlug={leagueSlug}
      periods={periods}
      rankingsData={rankingsResult as RankingsData}
      selectedPeriodId={selectedPeriodId}
      badgesEnabled={badgesEnabled}
    />
  );
}
