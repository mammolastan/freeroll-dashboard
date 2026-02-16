'use client';

import { AuditLogEntry } from '@/types/auditLogUI';

interface AuditLogDetailModalProps {
  log: AuditLogEntry;
  onClose: () => void;
}

export default function AuditLogDetailModal({ log, onClose }: AuditLogDetailModalProps) {
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const formatJson = (data: Record<string, unknown> | null): string => {
    if (!data) return 'null';
    return JSON.stringify(data, null, 2);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Audit Log Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-500">ID</label>
              <div className="mt-1 text-sm text-gray-900">{log.id}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Timestamp</label>
              <div className="mt-1 text-sm text-gray-900">{formatTimestamp(log.createdAt)}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Action Type</label>
              <div className="mt-1 text-sm text-gray-900">{log.actionType}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Category</label>
              <div className="mt-1 text-sm text-gray-900">{log.actionCategory}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Actor</label>
              <div className="mt-1 text-sm text-gray-900">
                {log.actorName || 'System'}
                {log.actorId && <span className="text-gray-500 ml-1">(ID: {log.actorId})</span>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Target Player</label>
              <div className="mt-1 text-sm text-gray-900">
                {log.targetPlayerName || '-'}
                {log.targetPlayerId && <span className="text-gray-500 ml-1">(ID: {log.targetPlayerId})</span>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">IP Address</label>
              <div className="mt-1 text-sm text-gray-900">{log.ipAddress || '-'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Tournament ID</label>
              <div className="mt-1 text-sm text-gray-900">{log.tournamentId}</div>
            </div>
          </div>

          {/* Previous Value */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-500 mb-2">Previous Value</label>
            <pre className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-gray-800 overflow-x-auto">
              {formatJson(log.previousValue)}
            </pre>
          </div>

          {/* New Value */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-500 mb-2">New Value</label>
            <pre className="bg-green-50 border border-green-200 rounded-md p-3 text-sm text-gray-800 overflow-x-auto">
              {formatJson(log.newValue)}
            </pre>
          </div>

          {/* Metadata */}
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-500 mb-2">Metadata</label>
              <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-sm text-gray-800 overflow-x-auto">
                {formatJson(log.metadata)}
              </pre>
            </div>
          )}

          {/* Value Diff (for field updates) */}
          {log.previousValue && log.newValue && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-500 mb-2">Changes</label>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                <DiffView previous={log.previousValue} current={log.newValue} />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Simple diff view component
function DiffView({
  previous,
  current
}: {
  previous: Record<string, unknown>;
  current: Record<string, unknown>
}) {
  const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);
  const changes: { key: string; oldValue: unknown; newValue: unknown }[] = [];

  allKeys.forEach(key => {
    const oldVal = previous[key];
    const newVal = current[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ key, oldValue: oldVal, newValue: newVal });
    }
  });

  if (changes.length === 0) {
    return <div className="text-sm text-gray-500">No changes detected</div>;
  }

  return (
    <div className="space-y-2">
      {changes.map(({ key, oldValue, newValue }) => (
        <div key={key} className="text-sm">
          <span className="font-medium text-gray-700">{key}:</span>
          <div className="ml-4 flex items-center gap-2">
            <span className="text-red-600 line-through">
              {JSON.stringify(oldValue)}
            </span>
            <span className="text-gray-400">-&gt;</span>
            <span className="text-green-600">
              {JSON.stringify(newValue)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
