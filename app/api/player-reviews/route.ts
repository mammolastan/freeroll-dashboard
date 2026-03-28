import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/player-reviews?reviewed_uid=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reviewed_uid = searchParams.get('reviewed_uid');
  const league_id = parseInt(searchParams.get('league_id') ?? '1');

  if (!reviewed_uid) {
    return NextResponse.json({ error: 'reviewed_uid required' }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const viewer_uid = session?.user?.uid ?? null;

  try {
    const reviews: any[] = await prisma.$queryRaw`
      SELECT
        pr.id,
        pr.league_id,
        pr.reviewed_uid,
        pr.reviewer_uid,
        COALESCE(p.nickname, CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) AS reviewer_name,
        p.photo_url AS reviewer_photo_url,
        pr.rating,
        pr.review_text,
        pr.tags,
        pr.created_at,
        pr.updated_at
      FROM player_reviews pr
      JOIN players_v2 p ON p.uid COLLATE utf8mb4_unicode_ci = pr.reviewer_uid
      WHERE pr.reviewed_uid COLLATE utf8mb4_unicode_ci = ${reviewed_uid}
        AND pr.league_id = ${league_id}
      ORDER BY pr.created_at DESC
    `;

    // Parse tags from comma string to array
    const parsed = reviews.map((r) => ({
      ...r,
      tags: r.tags ? r.tags.split(',').map((t: string) => t.trim()) : [],
      created_at: r.created_at?.toISOString?.() ?? r.created_at,
      updated_at: r.updated_at?.toISOString?.() ?? r.updated_at,
    }));

    // Build summary
    const total_reviews = parsed.length;
    const average_rating =
      total_reviews > 0
        ? Math.round((parsed.reduce((sum, r) => sum + r.rating, 0) / total_reviews) * 10) / 10
        : 0;

    const rating_distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>;
    parsed.forEach((r) => { rating_distribution[r.rating] = (rating_distribution[r.rating] ?? 0) + 1; });

    const my_review = viewer_uid ? (parsed.find((r) => r.reviewer_uid === viewer_uid) ?? null) : null;

    console.log(`[player-reviews GET] uid=${reviewed_uid} league=${league_id} total=${total_reviews}`);

    return NextResponse.json({
      reviews: parsed,
      summary: { average_rating, total_reviews, rating_distribution },
      my_review,
    });
  } catch (err) {
    console.error('[player-reviews GET] error:', err);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

// POST /api/player-reviews  (create or update)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const reviewer_uid = session?.user?.uid;

  if (!reviewer_uid) {
    return NextResponse.json({ error: 'Must be logged in to leave a review' }, { status: 401 });
  }

  const body = await req.json();
  const { reviewed_uid, rating, review_text, tags, league_id = 1 } = body;

  if (!reviewed_uid || !rating) {
    return NextResponse.json({ error: 'reviewed_uid and rating required' }, { status: 400 });
  }
  if (reviewed_uid === reviewer_uid) {
    return NextResponse.json({ error: 'Cannot review yourself' }, { status: 400 });
  }
  if (rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 });
  }

  const tagsString = Array.isArray(tags) && tags.length > 0 ? tags.join(',') : null;
  const cleanText = review_text?.trim() || null;

  try {
    await prisma.$executeRaw`
      INSERT INTO player_reviews
        (league_id, reviewed_uid, reviewer_uid, rating, review_text, tags)
      VALUES
        (${league_id}, ${reviewed_uid}, ${reviewer_uid}, ${rating}, ${cleanText}, ${tagsString})
      ON DUPLICATE KEY UPDATE
        rating = VALUES(rating),
        review_text = VALUES(review_text),
        tags = VALUES(tags),
        updated_at = current_timestamp()
    `;

    console.log(`[player-reviews POST] reviewer=${reviewer_uid} reviewed=${reviewed_uid} rating=${rating}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[player-reviews POST] error:', err);
    return NextResponse.json({ error: 'Failed to save review' }, { status: 500 });
  }
}
