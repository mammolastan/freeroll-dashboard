// app/[leagueSlug]/admin/tournaments/page.tsx

import { TournamentsSection } from "../TournamentsSection";

interface PageProps {
  params: Promise<{ leagueSlug: string }>;
}

export default async function TournamentsPage({ params }: PageProps) {
  const { leagueSlug } = await params;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-1">Tournaments</h1>
      <p className="text-white/40 text-sm mb-8">
        Edit integrated games - change venues, dates, bonus points, and competition periods.
      </p>

      <TournamentsSection leagueSlug={leagueSlug} />
    </div>
  );
}
