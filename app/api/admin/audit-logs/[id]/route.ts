// app/api/admin/audit-logs/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-utils';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdmin();
  if (adminCheck.error) return adminCheck.error;

  const { id } = await params;
  const logId = parseInt(id);

  if (isNaN(logId)) {
    return NextResponse.json(
      { error: 'Invalid audit log ID' },
      { status: 400 }
    );
  }

  try {
    const logs = await prisma.$queryRaw<AuditLogRow[]>`
      SELECT *
      FROM TournamentAuditLog
      WHERE id = ${logId}
    `;

    if (logs.length === 0) {
      return NextResponse.json(
        { error: 'Audit log not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(transformLog(logs[0]));
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit log' },
      { status: 500 }
    );
  }
}
