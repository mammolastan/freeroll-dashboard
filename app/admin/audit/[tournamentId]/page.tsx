'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  AuditLogEntry,
  AuditLogResponse,
  AuditLogStats,
  AuditLogFilters
} from '@/types/auditLogUI';
import AuditLogDetailModal from './AuditLogDetailModal';

// Action type display configuration
const ACTION_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  PLAYER_CREATED: { label: 'Player Created', color: 'bg-emerald-100 text-emerald-800', icon: '★' },
  PLAYER_ADDED: { label: 'Player Added', color: 'bg-green-100 text-green-800', icon: '+' },
  PLAYER_REMOVED: { label: 'Player Removed', color: 'bg-red-100 text-red-800', icon: '-' },
  PLAYER_CHECKED_IN: { label: 'Check-in', color: 'bg-blue-100 text-blue-800', icon: 'v' },
  PLAYER_CHECK_IN_REVERSED: { label: 'Check-in Reversed', color: 'bg-yellow-100 text-yellow-800', icon: 'x' },
  KNOCKOUT_RECORDED: { label: 'Knockout', color: 'bg-orange-100 text-orange-800', icon: 'KO' },
  KNOCKOUT_REMOVED: { label: 'Knockout Undone', color: 'bg-yellow-100 text-yellow-800', icon: '<-' },
  KNOCKOUT_ORDER_CHANGED: { label: 'KO Order Changed', color: 'bg-purple-100 text-purple-800', icon: '#' },
  HITMAN_CHANGED: { label: 'Hitman Changed', color: 'bg-indigo-100 text-indigo-800', icon: '*' },
  PLACEMENT_SET: { label: 'Placement Set', color: 'bg-teal-100 text-teal-800', icon: '#' },
  BUYIN_UPDATED: { label: 'Buy-in Updated', color: 'bg-gray-100 text-gray-800', icon: '$' },
  REBUY_ADDED: { label: 'Rebuy Added', color: 'bg-gray-100 text-gray-800', icon: '+$' },
  ADDON_ADDED: { label: 'Add-on Added', color: 'bg-gray-100 text-gray-800', icon: '++' },
  ENTRY_FIELD_UPDATED: { label: 'Field Updated', color: 'bg-gray-100 text-gray-800', icon: '~' },
  TIMER_STARTED: { label: 'Timer Started', color: 'bg-green-100 text-green-800', icon: '>' },
  TIMER_PAUSED: { label: 'Timer Paused', color: 'bg-yellow-100 text-yellow-800', icon: '||' },
  TIMER_RESUMED: { label: 'Timer Resumed', color: 'bg-green-100 text-green-800', icon: '>' },
  TIMER_RESET: { label: 'Timer Reset', color: 'bg-gray-100 text-gray-800', icon: 'O' },
  TIMER_TIME_SET: { label: 'Timer Set', color: 'bg-blue-100 text-blue-800', icon: 'T' },
  BLIND_LEVEL_CHANGED: { label: 'Blind Level Changed', color: 'bg-blue-100 text-blue-800', icon: 'B' },
  BLIND_SCHEDULE_CHANGED: { label: 'Schedule Changed', color: 'bg-blue-100 text-blue-800', icon: 'S' },
  BREAK_STARTED: { label: 'Break Started', color: 'bg-gray-100 text-gray-800', icon: '=' },
  BREAK_ENDED: { label: 'Break Ended', color: 'bg-gray-100 text-gray-800', icon: '>' },
  TOURNAMENT_CREATED: { label: 'Tournament Created', color: 'bg-green-100 text-green-800', icon: '+' },
  TOURNAMENT_FINALIZED: { label: 'Tournament Finalized', color: 'bg-green-100 text-green-800', icon: 'v' },
  TOURNAMENT_REVERTED: { label: 'Tournament Reverted', color: 'bg-red-100 text-red-800', icon: '<-' },
  TOURNAMENT_UPDATED: { label: 'Tournament Updated', color: 'bg-blue-100 text-blue-800', icon: '~' },
  TOURNAMENT_DELETED: { label: 'Tournament Deleted', color: 'bg-red-100 text-red-800', icon: 'X' },
  POINTS_CALCULATED: { label: 'Points Calculated', color: 'bg-purple-100 text-purple-800', icon: '#' },
  PLACEMENTS_AUTO_ASSIGNED: { label: 'Placements Assigned', color: 'bg-teal-100 text-teal-800', icon: '#' },
  AUTO_CALCULATE_TRIGGERED: { label: 'Auto Calculate', color: 'bg-gray-100 text-gray-800', icon: 'A' },
  AUTO_BLIND_ADVANCE: { label: 'Auto Blind Advance', color: 'bg-gray-100 text-gray-800', icon: '>>' },
};

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  ADMIN: { label: 'Admin', color: 'bg-blue-500 text-white' },
  PLAYER: { label: 'Player', color: 'bg-green-500 text-white' },
  SYSTEM: { label: 'System', color: 'bg-gray-500 text-white' },
};

export default function AuditLogViewerPage() {
  const params = useParams();
  const tournamentId = params.tournamentId as string;

  // State
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<AuditLogStats | null>(null);
  const [pagination, setPagination] = useState<AuditLogResponse['pagination'] | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [tournamentName, setTournamentName] = useState<string>('');

  // Fetch tournament info
  useEffect(() => {
    async function fetchTournamentInfo() {
      try {
        const response = await fetch(`/api/tournament-drafts/${tournamentId}`);
        if (response.ok) {
          const data = await response.json();
          // Format the name from venue and date
          const date = data.tournament_date ? new Date(data.tournament_date).toLocaleDateString() : '';
          setTournamentName(`${data.venue || 'Tournament'} - ${date}`);
        }
      } catch (error) {
        console.error('Error fetching tournament info:', error);
        setTournamentName(`Tournament ${tournamentId}`);
      }
    }
    fetchTournamentInfo();
  }, [tournamentId]);

  // Fetch audit logs
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        tournamentId,
        page: currentPage.toString(),
        limit: '50',
      });

      // Add filters
      if (filters.actionType) queryParams.set('actionType', filters.actionType);
      if (filters.actionCategory) queryParams.set('actionCategory', filters.actionCategory);
      if (filters.targetPlayerId) queryParams.set('targetPlayerId', filters.targetPlayerId.toString());
      if (filters.actorName) queryParams.set('actorName', filters.actorName);
      if (filters.startDate) queryParams.set('startDate', filters.startDate);
      if (filters.endDate) queryParams.set('endDate', filters.endDate);
      if (filters.search) queryParams.set('search', filters.search);

      const response = await fetch(`/api/admin/audit-logs?${queryParams}`);
      if (response.ok) {
        const data: AuditLogResponse = await response.json();
        setLogs(data.logs);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tournamentId, currentPage, filters]);

  // Fetch statistics
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/audit-logs/stats?tournamentId=${tournamentId}`);
      if (response.ok) {
        const data: AuditLogStats = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching audit stats:', error);
    }
  }, [tournamentId]);

  // Initial fetch and refetch on filter/page change
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  // Get action type display config
  const getActionConfig = (actionType: string) => {
    return ACTION_TYPE_CONFIG[actionType] || {
      label: actionType.replace(/_/g, ' '),
      color: 'bg-gray-100 text-gray-800',
      icon: '*'
    };
  };

  // Get category display config
  const getCategoryConfig = (category: string) => {
    return CATEGORY_CONFIG[category] || {
      label: category,
      color: 'bg-gray-500 text-white'
    };
  };

  // Build description for an audit entry
  const buildDescription = (log: AuditLogEntry): string => {
    const actor = log.actorName || 'System';
    const target = log.targetPlayerName;

    switch (log.actionType) {
      case 'PLAYER_CREATED':
        return `${target || 'A player'} was added to the global players table`;
      case 'PLAYER_ADDED':
        return `${actor} added ${target || 'a player'} to the tournament`;
      case 'PLAYER_REMOVED':
        return `${actor} removed ${target || 'a player'} from the tournament`;
      case 'PLAYER_CHECKED_IN':
        return `${target || 'A player'} checked in`;
      case 'PLAYER_CHECK_IN_REVERSED':
        return `${actor} reversed check-in for ${target || 'a player'}`;
      case 'KNOCKOUT_RECORDED': {
        const knockedOutBy = (log.newValue as Record<string, unknown>)?.knockedOutByName ||
                             (log.newValue as Record<string, unknown>)?.hitmanName;
        return `${target || 'A player'} was knocked out${knockedOutBy ? ` by ${knockedOutBy}` : ''}`;
      }
      case 'KNOCKOUT_REMOVED':
        return `${actor} undid knockout for ${target || 'a player'}`;
      case 'KNOCKOUT_ORDER_CHANGED':
        return `${actor} changed knockout order for ${target || 'a player'}`;
      case 'HITMAN_CHANGED':
        return `${actor} changed hitman for ${target || 'a player'}`;
      case 'PLACEMENT_SET': {
        const placement = (log.newValue as Record<string, unknown>)?.placement;
        return `${actor} set placement ${placement ? `#${placement}` : ''} for ${target || 'a player'}`;
      }
      case 'TIMER_STARTED':
        return `${actor} started the tournament timer`;
      case 'TIMER_PAUSED':
        return `${actor} paused the tournament timer`;
      case 'TIMER_RESUMED':
        return `${actor} resumed the tournament timer`;
      case 'TIMER_RESET':
        return `${actor} reset the tournament timer`;
      case 'TIMER_TIME_SET':
        return `${actor} set the timer time`;
      case 'BLIND_LEVEL_CHANGED': {
        const newLevel = (log.newValue as Record<string, unknown>)?.blindLevel ||
                         (log.newValue as Record<string, unknown>)?.level;
        return `${actor} changed blind level${newLevel ? ` to ${newLevel}` : ''}`;
      }
      case 'BLIND_SCHEDULE_CHANGED': {
        const schedule = (log.newValue as Record<string, unknown>)?.blindSchedule;
        return `${actor} changed blind schedule${schedule ? ` to ${schedule}` : ''}`;
      }
      case 'BREAK_STARTED':
        return `${actor} started a break`;
      case 'BREAK_ENDED':
        return `${actor} ended the break`;
      case 'TOURNAMENT_CREATED':
        return `${actor} created the tournament`;
      case 'TOURNAMENT_FINALIZED':
        return `${actor} finalized the tournament`;
      case 'TOURNAMENT_REVERTED':
        return `${actor} reverted the tournament to draft status`;
      case 'TOURNAMENT_UPDATED':
        return `${actor} updated tournament settings`;
      case 'TOURNAMENT_DELETED':
        return `${actor} deleted the tournament`;
      case 'POINTS_CALCULATED': {
        const playersAwarded = (log.newValue as Record<string, unknown>)?.playersProcessed ||
                               (log.newValue as Record<string, unknown>)?.playersAwarded;
        return `Points calculated${playersAwarded ? ` for ${playersAwarded} players` : ''}`;
      }
      case 'PLACEMENTS_AUTO_ASSIGNED': {
        const count = (log.newValue as Record<string, unknown>)?.placementsAssigned;
        const assignedCount = Array.isArray(count) ? count.length : count;
        return `Placements auto-assigned${assignedCount ? ` for ${assignedCount} players` : ''}`;
      }
      case 'AUTO_CALCULATE_TRIGGERED':
        return 'Auto-calculate was triggered';
      case 'AUTO_BLIND_ADVANCE':
        return 'Blinds auto-advanced';
      default:
        return `${actor} performed ${log.actionType.replace(/_/g, ' ').toLowerCase()}`;
    }
  };

  // Get unique action types from stats for the filter dropdown
  const actionTypes = stats?.byActionType.map(a => a.actionType) || Object.keys(ACTION_TYPE_CONFIG);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
              <p className="mt-1 text-sm text-gray-500">{tournamentName}</p>
            </div>
            <Link
              href={`/admin/tournament-entry?id=${tournamentId}`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              &larr; Back to Tournament
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm font-medium text-gray-500">Total Events</div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalCount}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm font-medium text-gray-500">Last 24 Hours</div>
              <div className="text-2xl font-bold text-gray-900">{stats.recentCount}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm font-medium text-gray-500">Admin Actions</div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.byCategory.find(c => c.category === 'ADMIN')?.count || 0}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm font-medium text-gray-500">System Actions</div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.byCategory.find(c => c.category === 'SYSTEM')?.count || 0}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                placeholder="Search players, actions..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={filters.search || ''}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>

            {/* Action Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action Type
              </label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={filters.actionType || ''}
                onChange={(e) => setFilters({ ...filters, actionType: e.target.value || undefined })}
              >
                <option value="">All Types</option>
                {actionTypes.map((key) => (
                  <option key={key} value={key}>
                    {ACTION_TYPE_CONFIG[key]?.label || key.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={filters.actionCategory || ''}
                onChange={(e) => setFilters({ ...filters, actionCategory: e.target.value || undefined })}
              >
                <option value="">All Categories</option>
                <option value="ADMIN">Admin</option>
                <option value="PLAYER">Player</option>
                <option value="SYSTEM">System</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="datetime-local"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={filters.startDate || ''}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })}
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="datetime-local"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={filters.endDate || ''}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })}
              />
            </div>
          </div>

          {/* Clear Filters */}
          {Object.keys(filters).some(k => filters[k as keyof AuditLogFilters]) && (
            <div className="mt-4">
              <button
                onClick={() => setFilters({})}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* Audit Log Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading audit logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No audit logs found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actor
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => {
                    const actionConfig = getActionConfig(log.actionType);
                    const categoryConfig = getCategoryConfig(log.actionCategory);

                    return (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {formatTimestamp(log.createdAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${actionConfig.color}`}>
                            <span className="font-mono">{actionConfig.icon}</span>
                            {actionConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${categoryConfig.color}`}>
                            {categoryConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-md truncate">
                          {buildDescription(log)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {log.actorName || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalCount} total)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={!pagination.hasPreviousPage}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <AuditLogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}
