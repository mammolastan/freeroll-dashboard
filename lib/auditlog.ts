// lib/auditLog.ts

import { prisma } from '@/lib/prisma';
import { AuditActionType, AuditActionCategory, AuditLogValue, AuditValue } from '@/types/audit';

interface LogAuditParams {
    tournamentId: number;
    actionType: AuditActionType;
    actionCategory: AuditActionCategory;
    actorId?: number | null;
    actorName?: string | null;
    targetPlayerId?: number | null;
    targetPlayerName?: string | null;
    previousValue?: AuditLogValue | null;
    newValue?: AuditLogValue | null;
    metadata?: Record<string, AuditValue> | null;
    ipAddress?: string | null;
}

export async function logAuditEvent(params: LogAuditParams): Promise<void> {
    try {
        await prisma.tournamentAuditLog.create({
            data: {
                tournament_id: params.tournamentId,
                action_type: params.actionType,
                action_category: params.actionCategory,
                actor_id: params.actorId ?? null,
                actor_name: params.actorName ?? null,
                target_player_id: params.targetPlayerId ?? null,
                target_player_name: params.targetPlayerName ?? null,
                previous_value: params.previousValue !== null && params.previousValue !== undefined ? JSON.stringify(params.previousValue) : null,
                new_value: params.newValue !== null && params.newValue !== undefined ? JSON.stringify(params.newValue) : null,
                metadata: params.metadata !== null && params.metadata !== undefined ? JSON.stringify(params.metadata) : null,
                ip_address: params.ipAddress ?? null,
            },
        });
    } catch (error) {
        console.error('Failed to write audit log:', error);
    }
}

export function getClientIP(request: Request): string | null {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return request.headers.get('x-real-ip') ?? null;
}

export function getAdminScreen(request: Request): string | null {
    return request.headers.get('x-admin-screen') ?? null;
}