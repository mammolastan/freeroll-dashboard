// app/[leagueSlug]/page.tsx
import HomeContent from "@/components/Home/HomeContent"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"

export default async function LeagueHomePage({
  params,
}: {
  params: Promise<{ leagueSlug: string }>;
}) {
  const { leagueSlug } = await params;

  // Get league name and id for the title and push notifications
  const league = await prisma.leagues.findUnique({
    where: { slug: leagueSlug },
    select: { id: true, name: true },
  });

  if (!league) {
    notFound();
  }

  return <HomeContent prefix={`/${leagueSlug}`} leagueName={league.name} leagueId={league.id} />
}
