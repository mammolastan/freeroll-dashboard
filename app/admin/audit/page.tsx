'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Tournament {
  id: number;
  tournament_date: string;
  venue: string;
  status: string;
  director_name: string;
  player_count?: number;
}

export default function AuditLogSelectorPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchTournaments() {
      try {
        const response = await fetch('/api/tournament-drafts?limit=50');
        if (response.ok) {
          const data = await response.json();
          setTournaments(data);
        }
      } catch (error) {
        console.error('Error fetching tournaments:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchTournaments();
  }, []);

  const filteredTournaments = tournaments.filter(t =>
    t.venue?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.director_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'integrated':
        return 'bg-green-100 text-green-800';
      case 'finalized':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Tournament Audit Logs</h1>
            <Link
              href="/admin"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              &larr; Back to Admin
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by venue or director..."
            className="w-full border border-gray-300 rounded-md px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Tournament List */}
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading tournaments...</div>
        ) : filteredTournaments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchTerm ? 'No tournaments match your search' : 'No tournaments found'}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
            {filteredTournaments.map((tournament) => (
              <button
                key={tournament.id}
                onClick={() => router.push(`/admin/audit/${tournament.id}`)}
                className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 text-left transition-colors"
              >
                <div>
                  <div className="font-medium text-gray-900">{tournament.venue}</div>
                  <div className="text-sm text-gray-500">
                    {formatDate(tournament.tournament_date)}
                    {tournament.director_name && ` - ${tournament.director_name}`}
                    {tournament.player_count !== undefined && ` - ${tournament.player_count} players`}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(tournament.status)}`}>
                    {tournament.status.replace('_', ' ')}
                  </span>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
