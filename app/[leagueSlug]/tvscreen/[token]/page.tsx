// app/[leagueSlug]/tvscreen/[token]/page.tsx
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import TVScreenPage from "@/app/tvscreen/[token]/page"

export default async function LeagueTVScreenTokenPage({
  params,
}: {
  params: Promise<{ leagueSlug: string; token: string }>;
}) {
  const { leagueSlug } = await params;

  const league = await prisma.leagues.findUnique({
    where: { slug: leagueSlug },
    select: { id: true },
  });

  if (!league) {
    notFound();
  }

  return <TVScreenPage />;
}
