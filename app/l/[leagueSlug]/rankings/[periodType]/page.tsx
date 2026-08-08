// app/l/[leagueSlug]/rankings/[periodType]/page.tsx

import QuarterlyRankings from "@/components/Rankings/QuarterlyRankings";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ periodType: string; leagueSlug: string }>;
}

export default async function DynamicRankingsPage({ params }: Props) {
  const { periodType } = await params;

  // Monthly has distinct venue-based logic - let static route handle it
  if (periodType === "monthly") {
    notFound();
  }

  const label = periodType.charAt(0).toUpperCase() + periodType.slice(1);

  return (
    <QuarterlyRankings
      periodType={periodType}
      title={`${label} Rankings`}
      periodLabel={label}
    />
  );
}
