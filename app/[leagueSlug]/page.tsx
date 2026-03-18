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

  // Get league name for the title
  const league = await prisma.leagues.findUnique({
    where: { slug: leagueSlug },
    select: { name: true },
  });

  if (!league) {
    notFound();
  }

  return <HomeContent prefix={`/${leagueSlug}`} leagueName={league.name} />
}
