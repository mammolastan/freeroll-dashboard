import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getLeagueRole, canAccessAdmin } from '@/lib/league-auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user?.uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const reviewId = parseInt(id);
  if (isNaN(reviewId)) {
    return NextResponse.json({ error: 'Invalid review id' }, { status: 400 });
  }

  try {
    // Fetch the review to check ownership
    const rows: any[] = await prisma.$queryRaw`
      SELECT id, reviewer_uid FROM player_reviews WHERE id = ${reviewId} LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    const isOwner = rows[0].reviewer_uid === user.uid;

    // Check if user has admin role in their league
    const leagueId = user.leagueId;
    const role = await getLeagueRole(user.uid, leagueId);
    const hasAdminAccess = canAccessAdmin(role);

    if (!isOwner && !hasAdminAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.$executeRaw`DELETE FROM player_reviews WHERE id = ${reviewId}`;

    console.log(`[player-reviews DELETE] id=${reviewId} by=${user.uid}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[player-reviews DELETE] error:', err);
    return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 });
  }
}
