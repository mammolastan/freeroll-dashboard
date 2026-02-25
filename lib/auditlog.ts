// lib/auditLog.ts

import { prisma } from '@/lib/prisma';
import { getServerSession, Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AuditActionType, AuditActionCategory, AuditLogValue, AuditValue } from '@/types/audit';

/**
 * Actor info extracted from a session for audit logging
 */
export interface AuditActorInfo {
    actorUid: string | null;
    actorName: string | null;
}

/**
 * Get the current admin session for audit logging.
 * Returns the session if authenticated, null otherwise.
 */
export async function getAuditSession(): Promise<Session | null> {
    return await getServerSession(authOptions);
}

/**
 * Extract actor info from a session for audit logging.
 * Uses nickname if available, otherwise falls back to name.
 */
export function getActorFromSession(session: Session | null): AuditActorInfo {
    if (!session?.user) {
        return { actorUid: null, actorName: 'Admin' };
    }

    return {
        actorUid: session.user.uid || null,
        actorName: session.user.nickname || session.user.name || 'Admin',
    };
}

/**
 * Merge actor UID into existing metadata for audit logging.
 * Returns a new metadata object with actorUid included.
 */
export function withActorMetadata(
    actor: AuditActorInfo,
    existingMetadata?: Record<string, AuditValue> | null
): Record<string, AuditValue> {
    return {
        ...existingMetadata,
        actorUid: actor.actorUid,
    };
}

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