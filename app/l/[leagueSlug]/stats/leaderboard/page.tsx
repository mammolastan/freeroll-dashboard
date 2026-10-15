import FilteredLeaderboard from "@/components/AdvancedStats/FilteredLeaderboard";

interface PageProps {
  params: Promise<{ leagueSlug: string }>;
}

export default async function LeaderboardPage({ params }: PageProps) {
  const { leagueSlug } = await params;

  return <FilteredLeaderboard leagueSlug={leagueSlug} />;
}
