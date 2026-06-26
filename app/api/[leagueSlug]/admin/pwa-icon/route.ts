import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getLeagueConfig, saveLeagueConfig } from '@/lib/league-config';
import { unlink, mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import sharp from 'sharp';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'pwa-icons');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
];

// PWA icons should be 512x512 PNG
const ICON_SIZE = 512;
// Maskable icons need content in the center ~80% (safe zone)
const MASKABLE_INNER_SIZE = 410;
const MASKABLE_PADDING = 51; // (512 - 410) / 2

async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

async function isLeagueAdmin(leagueSlug: string, userUid: string): Promise<boolean> {
  const league = await prisma.leagues.findUnique({
    where: { slug: leagueSlug },
    select: { id: true },
  });

  if (!league) return false;

  const adminRole = await prisma.league_roles.findFirst({
    where: {
      league_id: league.id,
      player_uid: userUid,
      role: { in: ['admin', 'owner'] },
    },
  });

  return !!adminRole;
}

// POST - Upload PWA icon
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leagueSlug: string }> }
) {
  try {
    const { leagueSlug } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin for this league
    const isAdmin = await isLeagueAdmin(leagueSlug, session.user.uid);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const league = await prisma.leagues.findUnique({
      where: { slug: leagueSlug },
      select: { id: true },
    });

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('icon') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPG, PNG, GIF, WebP, HEIC' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    await ensureUploadDir();

    // Save as PNG for PWA compatibility
    const filename = `${leagueSlug}.png`;
    const maskableFilename = `${leagueSlug}-maskable.png`;
    const filepath = path.join(UPLOAD_DIR, filename);
    const maskableFilepath = path.join(UPLOAD_DIR, maskableFilename);

    // Delete old icons if they exist
    const config = await getLeagueConfig(league.id);
    if (config.pwa.logoUrl) {
      const oldFilename = config.pwa.logoUrl.split('/').pop()?.split('?')[0];
      if (oldFilename && oldFilename !== filename) {
        const oldFilepath = path.join(UPLOAD_DIR, oldFilename);
        const oldMaskablePath = path.join(UPLOAD_DIR, oldFilename.replace('.png', '-maskable.png'));
        try {
          await unlink(oldFilepath);
          await unlink(oldMaskablePath);
        } catch {
          // Files might not exist, ignore
        }
      }
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process image: resize to 512x512, convert to PNG
    let processedBuffer: Buffer;
    let maskableBuffer: Buffer;

    // Get background color for maskable icon padding
    const backgroundColor = config.pwa.backgroundColor || '#0f172a';

    try {
      // Regular icon: full 512x512
      processedBuffer = await sharp(buffer)
        .resize(ICON_SIZE, ICON_SIZE, {
          fit: 'cover',
          position: 'center',
        })
        .png()
        .toBuffer();

      // Maskable icon: smaller image centered with padding
      // This ensures content stays in the safe zone when Android crops to circles/shapes
      maskableBuffer = await sharp(buffer)
        .resize(MASKABLE_INNER_SIZE, MASKABLE_INNER_SIZE, {
          fit: 'cover',
          position: 'center',
        })
        .extend({
          top: MASKABLE_PADDING,
          bottom: MASKABLE_PADDING,
          left: MASKABLE_PADDING,
          right: MASKABLE_PADDING,
          background: backgroundColor,
        })
        .png()
        .toBuffer();
    } catch (err) {
      console.error('Image processing error:', err);
      return NextResponse.json({ error: 'Image processing failed' }, { status: 500 });
    }

    // Write processed images to files
    try {
      await writeFile(filepath, processedBuffer);
      await writeFile(maskableFilepath, maskableBuffer);
    } catch (err) {
      console.error('File write error:', err);
      return NextResponse.json({ error: 'Could not save icon' }, { status: 500 });
    }

    // Update league config with cache-busting timestamp
    const timestamp = Date.now();
    const iconUrl = `/api/uploads/pwa-icons/${filename}?t=${timestamp}`;

    await saveLeagueConfig(league.id, {
      pwa: {
        ...config.pwa,
        logoUrl: iconUrl,
      },
    });

    return NextResponse.json({ logoUrl: iconUrl });
  } catch (error) {
    console.error('PWA icon upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload icon' },
      { status: 500 }
    );
  }
}

// DELETE - Remove PWA icon
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ leagueSlug: string }> }
) {
  try {
    const { leagueSlug } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isLeagueAdmin(leagueSlug, session.user.uid);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const league = await prisma.leagues.findUnique({
      where: { slug: leagueSlug },
      select: { id: true },
    });

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    const config = await getLeagueConfig(league.id);

    if (config.pwa.logoUrl) {
      // Delete files (both regular and maskable)
      const filename = config.pwa.logoUrl.split('/').pop()?.split('?')[0];
      if (filename) {
        const filepath = path.join(UPLOAD_DIR, filename);
        const maskableFilepath = path.join(UPLOAD_DIR, filename.replace('.png', '-maskable.png'));
        try {
          await unlink(filepath);
          await unlink(maskableFilepath);
        } catch {
          // Files might not exist, continue anyway
        }
      }

      // Clear logoUrl in config
      await saveLeagueConfig(league.id, {
        pwa: {
          ...config.pwa,
          logoUrl: '',
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PWA icon delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete icon' },
      { status: 500 }
    );
  }
}
