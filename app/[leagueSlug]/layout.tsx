// app/[leagueSlug]/layout.tsx
import { LeagueProvider } from '@/lib/LeagueContext';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

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

  return (
    <LeagueProvider slug={leagueSlug}>
      {children}
    </LeagueProvider>
  );
}
