// types/audit.ts

export type AuditActionType =
    // Player Management
    | 'PLAYER_ADDED'
    | 'PLAYER_REMOVED'
    | 'PLAYER_CHECKED_IN'
    | 'PLAYER_CHECK_IN_REVERSED'

    // Tournament Entry Updates
    | 'KNOCKOUT_RECORDED'
    | 'KNOCKOUT_REMOVED'
    | 'KNOCKOUT_ORDER_CHANGED'
    | 'HITMAN_CHANGED'
    | 'PLACEMENT_SET'
    | 'BUYIN_UPDATED'
    | 'REBUY_ADDED'
    | 'ADDON_ADDED'
    | 'ENTRY_FIELD_UPDATED'

    // Timer Actions
    | 'TIMER_STARTED'
    | 'TIMER_PAUSED'
    | 'TIMER_RESUMED'
    | 'TIMER_RESET'
    | 'TIMER_TIME_SET'
    | 'BLIND_LEVEL_CHANGED'
    | 'BLIND_SCHEDULE_CHANGED'
    | 'BREAK_STARTED'
    | 'BREAK_ENDED'

    // Tournament Lifecycle
    | 'TOURNAMENT_CREATED'
    | 'TOURNAMENT_UPDATED'
    | 'TOURNAMENT_DELETED'
    | 'TOURNAMENT_FINALIZED'
    | 'TOURNAMENT_REVERTED'

    // System Actions
    | 'AUTO_CALCULATE_TRIGGERED'
    | 'PLACEMENTS_AUTO_ASSIGNED'
    | 'POINTS_CALCULATED'
    | 'AUTO_BLIND_ADVANCE';

export type AuditActionCategory = 'ADMIN' | 'PLAYER' | 'SYSTEM';

// Flexible but type-safe value type for audit log fields
export type AuditValue =
    | string
    | number
    | boolean
    | null
    | AuditValue[]
    | { [key: string]: AuditValue };

// Specific shapes for common audit scenarios
export interface PlayerChangeValue {
    playerId?: number;
    playerName?: string;
    knockedOutBy?: number | null;
    knockedOutByName?: string | null;
    placement?: number | null;
    hitman?: number | null;
    hitmanName?: string | null;
    rebuyCount?: number;
    addonCount?: number;
    buyinAmount?: number;
    checkedIn?: boolean;
}

export interface TimerChangeValue {
    blindLevel?: number;
    timeRemaining?: number;
    isPaused?: boolean;
    isBreak?: boolean;
}

export interface SystemCalculationValue {
    playersProcessed?: number;
    placementsAssigned?: number[];
    pointsAwarded?: { playerId: number; points: number }[];
}

// Union of known value shapes, plus generic record for extensibility
export type AuditLogValue =
    | PlayerChangeValue
    | TimerChangeValue
    | SystemCalculationValue
    | Record<string, AuditValue>;

export interface AuditLogEntry {
    id: number;
    tournamentId: number;
    actionType: AuditActionType;
    actionCategory: AuditActionCategory;
    actorId: number | null;
    actorName: string | null;
    targetPlayerId: number | null;
    targetPlayerName: string | null;
    previousValue: AuditLogValue | null;
    newValue: AuditLogValue | null;
    metadata: Record<string, AuditValue> | null;
    ipAddress: string | null;
    createdAt: Date;
}