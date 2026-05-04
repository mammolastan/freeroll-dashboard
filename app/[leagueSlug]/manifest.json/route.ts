// app/[leagueSlug]/manifest.json/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLeagueConfig } from '@/lib/league-config';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ leagueSlug: string }> }
) {
  const { leagueSlug } = await params;

  // Fetch the league
  const league = await prisma.leagues.findUnique({
    where: { slug: leagueSlug },
    select: { id: true, name: true, slug: true },
  });

  if (!league) {
    return new NextResponse('League not found', { status: 404 });
  }

  const config = await getLeagueConfig(league.id);
  const pwa = config.pwa;

  const appName = league.name;
  const shortName = pwa.shortName || league.name;
  const themeColor = pwa.themeColor || '#06b6d4';
  const backgroundColor = pwa.backgroundColor || '#0f172a';
  const logoUrl = pwa.logoUrl || '/icons/default-icon-512.png';
  // Static maskable icon with solid background for Android adaptive icons
  const maskableLogoUrl = '/uploads/pwa-icons/freeroll-maskable.png';
  const trophyIconUrl = '/icons/trophy-1.png';
  const hexagonIconUrl = '/icons/table-overhead.png';

  const manifest = {
    id: `/${leagueSlug}/`,
    name: appName,
    short_name: shortName,
    description: `${appName} — Poker League`,
    start_url: `/${leagueSlug}/`,
    scope: `/${leagueSlug}/`,
    display_override: ["standalone", "minimal-ui"],
    display: 'standalone',
    orientation: 'portrait',
    background_color: backgroundColor,
    theme_color: themeColor,
    icons: [
      {
        src: logoUrl,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: maskableLogoUrl,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Quarterly Rankings',
        short_name: 'Quarterly rankings',
        url: `rankings/quarterly`,
        icons: [{ src: trophyIconUrl, sizes: '256x256', type: 'image/png' }],
      },
      {
        name: 'Monthly Rankings',
        short_name: 'Monthly rankings',
        url: `rankings/monthly`,
        icons: [{ src: trophyIconUrl, sizes: '256x256', type: 'image/png' }],
      },
      {
        name: 'Active games',
        short_name: 'Active games',
        url: `check-in`,
        icons: [{ src: hexagonIconUrl, sizes: '256x256', type: 'image/png' }],
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      // Cache for 1 hour; leagues don't change their branding often
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
