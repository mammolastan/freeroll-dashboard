// app/admin/error-logs/page.tsx
// TODO: Implement error log viewer
// Query: prisma.appErrorLog.findMany({ orderBy: { created_at: 'desc' }, take: 100 })
// Useful filters: feature, severity, error_code, date range, resolved status

export default function ErrorLogsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Logs</h1>
      <p className="text-gray-600">Error logs viewer — coming soon</p>
    </div>
  );
}
