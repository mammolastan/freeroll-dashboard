// app/[leagueSlug]/layout.tsx
import { LeagueProvider } from '@/lib/LeagueContext';
import { prisma } from '@/lib/prisma';
import { getLeagueConfig } from '@/lib/league-config';
import { notFound } from 'next/navigation';
import { Metadata, Viewport } from 'next';
import { InstallPrompt } from '@/components/ui/InstallPrompt';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

export async function generateViewport({
  params,
}: {
  params: Promise<{ leagueSlug: string }>;
}): Promise<Viewport> {
  const { leagueSlug } = await params;

  const league = await prisma.leagues.findUnique({
    where: { slug: leagueSlug },
    select: { id: true },
  });

  const config = league ? await getLeagueConfig(league.id) : null;
  const themeColor = config?.pwa?.themeColor ?? '#06b6d4';

  return {
    themeColor: themeColor,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ leagueSlug: string }>;
}): Promise<Metadata> {
  const { leagueSlug } = await params;

  const league = await prisma.leagues.findUnique({
    where: { slug: leagueSlug },
    select: { id: true, name: true },
  });

  const leagueName = league?.name ?? 'League';
  const config = league ? await getLeagueConfig(league.id) : null;
  const iconUrl = config?.pwa?.logoUrl || '/icons/default-icon-512.png';

  return {
    title: {
      default: `${leagueName} Player Dashboard`,
      template: `%s | ${leagueName}`,
    },
    description: `Dashboard for ${leagueName} poker tournament player statistics`,
    manifest: `/${leagueSlug}/manifest.json`,
    icons: {
      icon: [
        { url: iconUrl, sizes: '512x512', type: 'image/png' },
        { url: iconUrl, sizes: '32x32', type: 'image/png' },
      ],
      apple: { url: iconUrl, sizes: '180x180', type: 'image/png' },
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: leagueName,
    },
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
    <ThemeProvider themeId={config.branding?.themeId ?? 'default'}>
      <LeagueProvider slug={leagueSlug} timezone={config.timezone}>
        {children}
        <InstallPrompt />
      </LeagueProvider>
    </ThemeProvider>
  );
}
