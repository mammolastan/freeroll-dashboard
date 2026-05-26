// app/l/[leagueSlug]/apple-icon.tsx
import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/prisma';
import { getLeagueConfig } from '@/lib/league-config';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = { width: 180, height: 180 };

export default async function AppleIcon({
  params,
}: {
  params: Promise<{ leagueSlug: string }>;
}) {
  const { leagueSlug } = await params;

  const league = await prisma.leagues.findUnique({
    where: { slug: leagueSlug },
    select: { id: true },
  });

  const config = league ? await getLeagueConfig(league.id) : null;
  const logoUrl = config?.pwa?.logoUrl;

  // If league has a custom icon, try to read it from disk
  if (logoUrl) {
    try {
      const match = logoUrl.match(/\/api\/uploads\/pwa-icons\/([^?]+)/);
      if (match) {
        const filename = match[1];
        const filePath = join(process.cwd(), 'public', 'uploads', 'pwa-icons', filename);
        const buffer = await readFile(filePath);
        return new Response(buffer, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          },
        });
      }
    } catch (e) {
      console.error('[apple-icon.tsx] Failed to read league icon from disk:', e);
    }
  }

  // Try default icon
  try {
    const defaultPath = join(process.cwd(), 'public', 'icons', 'default-icon-512.png');
    const buffer = await readFile(defaultPath);
    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch {
    // Final fallback: Generate a simple icon with league initial
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#06b6d4',
            borderRadius: '24px',
            color: 'white',
            fontSize: '100px',
            fontWeight: 'bold',
          }}
        >
          {leagueSlug.charAt(0).toUpperCase()}
        </div>
      ),
      {
        ...size,
      }
    );
  }
}
