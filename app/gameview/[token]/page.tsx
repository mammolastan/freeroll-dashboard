// /app/gameview/[token]/page.tsx

'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useRealtimeGameData } from '@/lib/realtime/hooks/useRealtimeGameData';
import { Player } from '@/lib/realtime/types';
import { GameTimer } from '@/components/Timer/GameTimer';
import { CheckInModal } from '@/components/CheckInModal';
import { QrCode, UserPlus } from 'lucide-react';
import { QRCodeModal } from "@/app/admin/tournament-entry/QRCodeModal";
import { formatGameDate } from '@/lib/utils';

function PlayerCard({ player }: { player: Player }) {
  return (
    <div className={`p-4 border rounded-lg ${player.is_active
      ? 'bg-green-50 border-green-200'
      : 'bg-red-50 border-red-200'
      }`}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-black">
            {player.name}
            {player.nickname && (
              <span className="text-gray-600 ml-2">&quot;{player.nickname}&quot;</span>
            )}
          </h3>
          {player.is_new_player ? (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
              New Player
            </span>
          ) : ''}
        </div>

        <div className="text-right">
          {player.is_active ? (
            ''
          ) : (
            <div className="text-red-600">
              <div className="font-medium">Eliminated</div>
              {player.elimination_position && (
                <div className="text-sm">
                  KO order: {player.elimination_position}
                </div>
              )}
              {player.placement && (
                <div className="text-sm">
                  Final Placement: {player.placement}
                </div>
              )}
              {player.hitman && (
                <div className="text-sm">
                  Eliminated by: {player.hitman.name}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TournamentHeader({ tournament, stats }: {
  tournament: any,
  stats: any
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{tournament.title}</h1>
          <p className="text-gray-600 mt-1">{formatGameDate(tournament.date.toString())}</p>
          {tournament.venue && (
            <p className="text-gray-600">
              📍 {tournament.venue}
            </p>
          )}
        </div>


      </div>


    </div>
  );
}

export default function GameViewPage() {
  const { token } = useParams();
  const { gameData, computedStats, loading, error } = useRealtimeGameData(token as string);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInToken, setCheckInToken] = useState<string | null>(null);
  const [gettingToken, setGettingToken] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [checkInUrl, setCheckInUrl] = useState<string>(`/gameview/${token}`);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setCheckInUrl(`${window.location.origin}/gameview/${token}`);
    }
  }, [token]);

  const handleCheckInClick = async () => {
    if (checkInToken) {
      setShowCheckInModal(true);
      return;
    }

    setGettingToken(true);
    try {
      const response = await fetch(`/api/tournaments/${token}/checkin-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setCheckInToken(data.token);
        setShowCheckInModal(true);
      } else {
        console.error('Failed to get check-in token');
        // Could add error handling here
      }
    } catch (error) {
      console.error('Error getting check-in token:', error);
      // Could add error handling here
    } finally {
      setGettingToken(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tournament data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!gameData || !computedStats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No tournament data available</p>
        </div>
      </div>
    );
  }

  const activePlayers = gameData.players.filter(p => p.is_active);
  const eliminatedPlayers = gameData.players.filter(p => !p.is_active);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <TournamentHeader
          tournament={gameData.tournament}
          stats={computedStats}
        />

        {/* Check In Button */}
        <div className="mb-6 flex justify-center">
          <button
            onClick={handleCheckInClick}
            disabled={gettingToken}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <UserPlus size={20} />
            {gettingToken ? 'Getting Ready...' : 'Check In'}
          </button>

          {/* Share Button */}
          <button
            onClick={() => setShowQRCode(true)}
            className="flex items-center gap-2  px-4 mx-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <QrCode className="h-4 w-4" /> Share

          </button>
          {showQRCode && gameData && (
            <QRCodeModal
              checkInUrl={checkInUrl}
              showQRCode={showQRCode}
              setShowQRCode={setShowQRCode}
              currentDraft={{
                tournament_date: formatGameDate(gameData.tournament.date.toString()),
                venue: gameData.tournament.venue || ''
              }}
            />
          )}

        </div>



        {/* Game Timer */}
        <div className="mb-6">
          <GameTimer tournamentId={parseInt(token as string)} isAdmin={false} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded">
            <div className="text-2xl font-bold text-blue-600">{computedStats.totalPlayers}</div>
            <div className="text-sm text-gray-600">Total Players</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded">
            <div className="text-2xl font-bold text-green-600">{computedStats.playersRemaining}</div>
            <div className="text-sm text-gray-600">Remaining</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded">
            <div className="text-2xl font-bold text-red-600">{computedStats.eliminatedPlayers}</div>
            <div className="text-sm text-gray-600">Eliminated</div>
          </div>
          {gameData.tournament.max_players && (
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-gray-600">{gameData.tournament.max_players}</div>
              <div className="text-sm text-gray-600">Max Players</div>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Active Players */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Active Players ({activePlayers.length})
            </h2>
            <div className="space-y-3">
              {activePlayers.length > 0 ? (
                activePlayers
                  .sort((a, b) => new Date(b.checked_in_at || 0).getTime() - new Date(a.checked_in_at || 0).getTime())
                  .map((player) => (
                    <PlayerCard key={player.id} player={player} />
                  ))
              ) : (
                <p className="text-gray-500 text-center py-8">
                  No active players
                </p>
              )}
            </div>
          </div>

          {/* Eliminated Players */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Eliminated Players ({eliminatedPlayers.length})
            </h2>
            <div className="space-y-3">
              {eliminatedPlayers.length > 0 ? (
                eliminatedPlayers
                  .sort((a, b) => (b.elimination_position || 999) - (a.elimination_position || 999))
                  .map((player) => (
                    <PlayerCard key={player.id} player={player} />
                  ))
              ) : (
                <p className="text-gray-500 text-center py-8">
                  No eliminations yet
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Real-time indicator */}
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm">
          🔴 Live
        </div>

        {/* Check In Modal */}
        {checkInToken && (
          <CheckInModal
            isOpen={showCheckInModal}
            onClose={() => setShowCheckInModal(false)}
            token={checkInToken}
            onSuccess={() => {
              setShowCheckInModal(false);
            }}
          />
        )}
      </div>
    </div>
  );
}