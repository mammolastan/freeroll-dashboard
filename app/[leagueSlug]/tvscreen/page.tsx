// app/[leagueSlug]/tvscreen/page.tsx
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import TVScreenSelectPage from "@/app/tvscreen/page"

export default async function LeagueTVScreenPage({
  params,
}: {
  params: Promise<{ leagueSlug: string }>;
}) {
  const { leagueSlug } = await params;

  const league = await prisma.leagues.findUnique({
    where: { slug: leagueSlug },
    select: { id: true },
  });

  if (!league) {
    notFound();
  }

  return <TVScreenSelectPage />;
}
