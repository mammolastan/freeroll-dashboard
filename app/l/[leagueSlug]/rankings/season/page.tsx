// app/l/[leagueSlug]/rankings/season/page.tsx

import QuarterlyRankings from "@/components/Rankings/QuarterlyRankings";

export const metadata = {
  title: "Season Rankings",
};

export default function SeasonRankingsPage() {
  return (
    <QuarterlyRankings
      periodType="season"
      title="Season Rankings"
      periodLabel="Season"
    />
  );
}
