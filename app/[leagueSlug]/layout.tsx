// app/[leagueSlug]/layout.tsx
import { LeagueProvider } from '@/lib/LeagueContext';
import { prisma } from '@/lib/prisma';
import { getLeagueConfig } from '@/lib/league-config';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ leagueSlug: string }>;
}): Promise<Metadata> {
  const { leagueSlug } = await params;

  const league = await prisma.leagues.findUnique({
    where: { slug: leagueSlug },
    select: { name: true },
  });

  const leagueName = league?.name ?? 'League';

  return {
    title: {
      default: `${leagueName} Player Dashboard`,
      template: `%s | ${leagueName}`,
    },
    description: `Dashboard for ${leagueName} poker tournament player statistics`,
  };
}

export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ leagueSlug: string }>;
}) {
  const { leagueSlug } = await params;

  // Validate slug exists — returns 404 for unknown slugs
  // This also prevents reserved paths from being treated as league slugs
  const league = await prisma.leagues.findUnique({
    where: { slug: leagueSlug },
    select: { id: true, name: true, is_active: true },
  });

  if (!league || !league.is_active) {
    notFound();
  }

  // Fetch league config to get timezone
  const config = await getLeagueConfig(league.id);

  return (
    <LeagueProvider slug={leagueSlug} timezone={config.timezone}>
      {children}
    </LeagueProvider>
  );
}
