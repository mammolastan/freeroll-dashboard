// app/l/[leagueSlug]/manifest.json/route.ts

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
  // Maskable icons: use league-specific if they uploaded a custom icon, otherwise use default
  // League-specific maskable icons are auto-generated at multiple sizes with padding when uploading
  const MASKABLE_SIZES = [192, 384, 512];
  const getMaskableUrl = (size: number) => {
    if (pwa.logoUrl) {
      return pwa.logoUrl.replace('.png', `-maskable-${size}.png`);
    }
    return '/uploads/pwa-icons/freeroll-maskable.png';
  };
  const trophyIconUrl = '/icons/trophy-1.png';
  const hexagonIconUrl = '/icons/table-overhead.png';

  // Build icons array with maskable icons first (multiple sizes), then regular icon
  const icons = [
    // Maskable icons at multiple sizes for better Android compatibility
    ...MASKABLE_SIZES.map(size => ({
      src: getMaskableUrl(size),
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose: 'maskable',
    })),
    // Regular icon for other contexts
    {
      src: logoUrl,
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
  ];

  const manifest = {
    id: `/l/${leagueSlug}/`,
    name: appName,
    short_name: shortName,
    description: `${appName} — Poker League`,
    start_url: `/l/${leagueSlug}/`,
    scope: '/',  // Root scope needed for service worker at /sw.js to work on iOS PWA
    display_override: ["standalone", "minimal-ui"],
    display: 'standalone',
    orientation: 'portrait',
    background_color: backgroundColor,
    theme_color: themeColor,
    icons,
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
