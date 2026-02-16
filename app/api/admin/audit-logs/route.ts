// app/api/admin/audit-logs/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

interface AuditLogRow {
  id: number;
  tournament_id: number;
  action_type: string;
  action_category: string;
  actor_id: number | null;
  actor_name: string | null;
  target_player_id: number | null;
  target_player_name: string | null;
  previous_value: string | null;
  new_value: string | null;
  metadata: string | null;
  ip_address: string | null;
  created_at: Date | null;
}

function parseJsonSafe(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function transformLog(log: AuditLogRow) {
  return {
    id: log.id,
    tournamentId: log.tournament_id,
    actionType: log.action_type,
    actionCategory: log.action_category,
    actorId: log.actor_id,
    actorName: log.actor_name,
    targetPlayerId: log.target_player_id,
    targetPlayerName: log.target_player_name,
    previousValue: parseJsonSafe(log.previous_value),
    newValue: parseJsonSafe(log.new_value),
    metadata: parseJsonSafe(log.metadata),
    ipAddress: log.ip_address,
    createdAt: log.created_at?.toISOString() ?? null,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Required parameter
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

  // Optional filters
  const actionType = searchParams.get('actionType');
  const actionCategory = searchParams.get('actionCategory');
  const targetPlayerId = searchParams.get('targetPlayerId');
  const actorName = searchParams.get('actorName');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const searchTerm = searchParams.get('search');

  // Pagination
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = (page - 1) * limit;

  try {
    // Build dynamic WHERE conditions
    const conditions: Prisma.Sql[] = [Prisma.sql`tournament_id = ${tournamentIdInt}`];

    if (actionType) {
      conditions.push(Prisma.sql`action_type = ${actionType}`);
    }

    if (actionCategory) {
      conditions.push(Prisma.sql`action_category = ${actionCategory}`);
    }

    if (targetPlayerId) {
      conditions.push(Prisma.sql`target_player_id = ${parseInt(targetPlayerId)}`);
    }

    if (actorName) {
      conditions.push(Prisma.sql`actor_name LIKE ${`%${actorName}%`}`);
    }

    if (startDate) {
      conditions.push(Prisma.sql`created_at >= ${new Date(startDate)}`);
    }

    if (endDate) {
      conditions.push(Prisma.sql`created_at <= ${new Date(endDate)}`);
    }

    if (searchTerm) {
      const searchPattern = `%${searchTerm}%`;
      conditions.push(Prisma.sql`(
        actor_name LIKE ${searchPattern} OR
        target_player_name LIKE ${searchPattern} OR
        action_type LIKE ${searchPattern}
      )`);
    }

    const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

    // Fetch logs with pagination
    const logs = await prisma.$queryRaw<AuditLogRow[]>`
      SELECT *
      FROM TournamentAuditLog
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    // Get total count for pagination
    const countResult = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM TournamentAuditLog
      ${whereClause}
    `;

    const totalCount = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      logs: logs.map(transformLog),
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
