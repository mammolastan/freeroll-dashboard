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

// Helper function to calculate dynamic placement based on elimination_position
function calculatePlacement(player: Player, totalPlayers: number): number | null {
  if (player.elimination_position === null) return null;
  return totalPlayers - player.elimination_position + 1;
}

function PlayerCard({ player, totalPlayers }: { player: Player; totalPlayers: number }) {
  console.log('Rendering PlayerCard for:', player);
  const dynamicPlacement = calculatePlacement(player, totalPlayers);

  return (
    <div className={`p-4 border rounded-lg backdrop-blur-sm transition-all duration-300 ${player.is_active
      ? 'bg-gray-900/80 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
      : 'bg-gray-900/60 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
      }`}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className={`font-semibold ${player.is_active ? 'text-cyan-300' : 'text-gray-400'}`}>
            {player.nickname ? (
              <span>{player.nickname}</span>
            ) : player.name}
          </h3>
          {player.is_new_player ? (
            <span className="text-xs bg-purple-500/30 text-purple-300 px-2 py-1 rounded-full border border-purple-500/50">
              New Player
            </span>
          ) : ''}
        </div>

        <div className="text-right">
          {player.is_active ? (
            ''
          ) : (
            <div className="text-red-400">
              <div className="font-medium">Eliminated</div>
              {player.elimination_position && (
                <div className="text-sm text-gray-500">
                  KO order: {player.elimination_position}
                </div>
              )}
              {dynamicPlacement !== null && (
                <div className="text-sm text-gray-500">
                  Final Placement: {dynamicPlacement}
                </div>
              )}
              {player.hitman && (
                <div className="text-sm text-gray-500">
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
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.2)] border border-cyan-500/30 p-6 mb-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-3xl font-bold text-cyan-300 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">{tournament.title}</h1>
          <p className="text-gray-400 mt-1">{formatGameDate(typeof tournament.date === 'string' ? tournament.date : tournament.date.toISOString())}</p>
          {tournament.venue && (
            <p className="text-cyan-400 flex items-center gap-2">
              <span className="text-cyan-500">📍</span> {tournament.venue}
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-cyan-500 mx-auto shadow-[0_0_20px_rgba(6,182,212,0.5)]"></div>
          <p className="mt-4 text-cyan-300">Loading tournament data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!gameData || !computedStats) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">No tournament data available</p>
        </div>
      </div>
    );
  }

  const activePlayers = gameData.players.filter(p => p.is_active);
  const eliminatedPlayers = gameData.players.filter(p => !p.is_active);

  return (
    <div className="min-h-screen bg-black py-8">
      <div className="max-w-6xl mx-auto px-4">
        <TournamentHeader
          tournament={gameData.tournament}
          stats={computedStats}
        />

        {/* Check In Button */}
        <div className="mb-6 flex justify-center gap-4">
          <button
            onClick={handleCheckInClick}
            disabled={gettingToken}
            className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-900 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] border border-cyan-500/50"
          >
            <UserPlus size={20} />
            {gettingToken ? 'Getting Ready...' : 'Check In'}
          </button>

          {/* Share Button */}
          <button
            onClick={() => setShowQRCode(true)}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.5)] border border-purple-500/50 disabled:opacity-50"
          >
            <QrCode className="h-4 w-4" /> Share

          </button>
          {showQRCode && gameData && (
            <QRCodeModal
              checkInUrl={checkInUrl}
              showQRCode={showQRCode}
              setShowQRCode={setShowQRCode}
              currentDraft={{
                tournament_date: formatGameDate(typeof gameData.tournament.date === 'string' ? gameData.tournament.date : gameData.tournament.date.toISOString()),
                venue: gameData.tournament.venue || ''
              }}
            />
          )}

        </div>



        {/* Game Timer */}
        <div className="mb-6">
          <GameTimer tournamentId={parseInt(token as string)} playersRemaining={computedStats.playersRemaining} isAdmin={false} />
        </div>

        {/* Players summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="text-center p-4 bg-gray-900/80 border border-cyan-500/30 rounded-lg shadow-[0_0_10px_rgba(6,182,212,0.2)]">
            <div className="text-3xl font-bold text-cyan-400">{computedStats.totalPlayers}</div>
            <div className="text-sm text-gray-400 mt-1">Total Players</div>
          </div>
          <div className="text-center p-4 bg-gray-900/80 border border-green-500/30 rounded-lg shadow-[0_0_10px_rgba(34,197,94,0.2)]">
            <div className="text-3xl font-bold text-green-400">{computedStats.playersRemaining}</div>
            <div className="text-sm text-gray-400 mt-1">Remaining</div>
          </div>
          <div className="text-center p-4 bg-gray-900/80 border border-red-500/30 rounded-lg shadow-[0_0_10px_rgba(239,68,68,0.2)]">
            <div className="text-3xl font-bold text-red-400">{computedStats.eliminatedPlayers}</div>
            <div className="text-sm text-gray-400 mt-1">Eliminated</div>
          </div>
          {gameData.tournament.max_players && (
            <div className="text-center p-4 bg-gray-900/80 border border-purple-500/30 rounded-lg shadow-[0_0_10px_rgba(168,85,247,0.2)]">
              <div className="text-3xl font-bold text-purple-400">{gameData.tournament.max_players}</div>
              <div className="text-sm text-gray-400 mt-1">Max Players</div>
            </div>
          )}
        </div>

        {/* Active Players */}
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-2xl font-bold text-cyan-300 mb-4 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]">
              Active Players ({activePlayers.length})
            </h2>
            <div className="space-y-3">
              {activePlayers.length > 0 ? (
                activePlayers
                  .sort((a, b) => new Date(b.checked_in_at || 0).getTime() - new Date(a.checked_in_at || 0).getTime())
                  .map((player) => (
                    <PlayerCard key={player.id} player={player} totalPlayers={gameData.players.length} />
                  ))
              ) : (
                <p className="text-gray-500 text-center py-8 bg-gray-900/40 rounded-lg border border-gray-700">
                  No active players
                </p>
              )}
            </div>
          </div>

          {/* Eliminated Players */}
          <div>
            <h2 className="text-2xl font-bold text-red-400 mb-4 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]">
              Eliminated Players ({eliminatedPlayers.length})
            </h2>
            <div className="space-y-3">
              {eliminatedPlayers.length > 0 ? (
                eliminatedPlayers
                  .sort((a, b) => (b.elimination_position || 999) - (a.elimination_position || 999))
                  .map((player) => (
                    <PlayerCard key={player.id} player={player} totalPlayers={gameData.players.length} />
                  ))
              ) : (
                <p className="text-gray-500 text-center py-8 bg-gray-900/40 rounded-lg border border-gray-700">
                  No eliminations yet
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Real-time indicator */}
        <div className="fixed bottom-4 right-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-[0_0_20px_rgba(34,197,94,0.5)] border border-green-400/50 animate-pulse">
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