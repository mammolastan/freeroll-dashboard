// app/api/admin/audit-logs/stats/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface ActionTypeCount {
  action_type: string;
  count: bigint;
}

interface CategoryCount {
  action_category: string;
  count: bigint;
}

interface ActorCount {
  actor_name: string | null;
  count: bigint;
}

interface DateRange {
  min_date: Date | null;
  max_date: Date | null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tournamentId = searchParams.get('tournamentId');

  if (!tournamentId) {
    return NextResponse.json(
      { error: 'tournamentId is required' },
      { status: 400 }
    );
  }

  const tournamentIdInt = parseInt(tournamentId);
  if (isNaN(tournamentIdInt)) {
    return NextResponse.json(
      { error: 'Invalid tournamentId' },
      { status: 400 }
    );
  }

  try {
    // Get counts by action type
    const actionTypeCounts = await prisma.$queryRaw<ActionTypeCount[]>`
      SELECT action_type, COUNT(*) as count
      FROM TournamentAuditLog
      WHERE tournament_id = ${tournamentIdInt}
      GROUP BY action_type
      ORDER BY count DESC
    `;

    // Get counts by action category
    const categoryCounts = await prisma.$queryRaw<CategoryCount[]>`
      SELECT action_category, COUNT(*) as count
      FROM TournamentAuditLog
      WHERE tournament_id = ${tournamentIdInt}
      GROUP BY action_category
    `;

    // Get counts by actor (top 10)
    const actorCounts = await prisma.$queryRaw<ActorCount[]>`
      SELECT actor_name, COUNT(*) as count
      FROM TournamentAuditLog
      WHERE tournament_id = ${tournamentIdInt}
        AND actor_name IS NOT NULL
      GROUP BY actor_name
      ORDER BY count DESC
      LIMIT 10
    `;

    // Get total count
    const totalCountResult = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM TournamentAuditLog
      WHERE tournament_id = ${tournamentIdInt}
    `;
    const totalCount = Number(totalCountResult[0]?.count ?? 0);

    // Get date range
    const dateRange = await prisma.$queryRaw<DateRange[]>`
      SELECT MIN(created_at) as min_date, MAX(created_at) as max_date
      FROM TournamentAuditLog
      WHERE tournament_id = ${tournamentIdInt}
    `;

    // Get recent activity (last 24 hours)
    const recentCountResult = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM TournamentAuditLog
      WHERE tournament_id = ${tournamentIdInt}
        AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `;
    const recentCount = Number(recentCountResult[0]?.count ?? 0);

    return NextResponse.json({
      totalCount,
      recentCount,
      dateRange: {
        earliest: dateRange[0]?.min_date?.toISOString() ?? null,
        latest: dateRange[0]?.max_date?.toISOString() ?? null,
      },
      byActionType: actionTypeCounts.map(item => ({
        actionType: item.action_type,
        count: Number(item.count),
      })),
      byCategory: categoryCounts.map(item => ({
        category: item.action_category,
        count: Number(item.count),
      })),
      byActor: actorCounts
        .filter(item => item.actor_name !== null)
        .map(item => ({
          actorName: item.actor_name,
          count: Number(item.count),
        })),
    });
  } catch (error) {
    console.error('Error fetching audit log stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit log statistics' },
      { status: 500 }
    );
  }
}
