// types/auditLogUI.ts

import { AuditActionType, AuditActionCategory } from './audit';

export interface AuditLogEntry {
  id: number;
  tournamentId: number;
  actionType: AuditActionType;
  actionCategory: AuditActionCategory;
  actorId: number | null;
  actorName: string | null;
  targetPlayerId: number | null;
  targetPlayerName: string | null;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditLogPagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface AuditLogResponse {
  logs: AuditLogEntry[];
  pagination: AuditLogPagination;
}

export interface AuditLogStats {
  totalCount: number;
  recentCount: number;
  dateRange: {
    earliest: string | null;
    latest: string | null;
  };
  byActionType: { actionType: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byActor: { actorName: string; count: number }[];
}

export interface AuditLogFilters {
  actionType?: string;
  actionCategory?: string;
  targetPlayerId?: number;
  actorName?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}
