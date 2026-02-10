// /app/gameview/[token]/page.tsx

"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { useRealtimeGameData } from "@/lib/realtime/hooks/useRealtimeGameData";
import { GameTimer } from "@/components/Timer/GameTimer";
import { PlayerCheckInModal } from "@/components/PlayerCheckIn/PlayerCheckInModal";
import { QrCode, UserPlus } from "lucide-react";
import { QRCodeModal } from "@/app/admin/tournament-entry/QRCodeModal";
import { formatGameDate, formatTime, formatCutoffTime } from "@/lib/utils";
import { TournamentFeed } from "@/components/TournamentFeed";

interface TournamentHeaderData {
  title: string;
  date: string | Date;
  time?: string | null;
  venue?: string | null;
  td?: string | null;
}

function TournamentHeader({
  tournament,
}: {
  tournament: TournamentHeaderData;
}) {
  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.2)] border border-cyan-500/30 p-6 mb-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-3xl font-bold text-cyan-300 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
            {tournament.title}
          </h1>
          <p className="text-gray-400 mt-1">
            {formatGameDate(
              typeof tournament.date === "string"
                ? tournament.date
                : tournament.date.toISOString(),
            )}
            {formatTime(tournament.time) && (
              <span className="ml-2 text-cyan-300 font-semibold">
                @ {formatTime(tournament.time)}
              </span>
            )}
          </p>
          {tournament.venue && (
            <p className="text-cyan-400 flex items-center gap-2">
              <span className="text-cyan-500">📍</span> {tournament.venue}{" "}
              {tournament.td && (
                <span className="text-cyan-300">| TD: {tournament.td}</span>
              )}
            </p>
          )}
          {formatCutoffTime(tournament.time) && (
            <p className="text-yellow-400 text-sm mt-1">
              Cutoff Time: {formatCutoffTime(tournament.time)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GameViewPage() {
  const { token } = useParams();
  const { gameData, computedStats, loading, error } = useRealtimeGameData(
    token as string,
  );
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInToken, setCheckInToken] = useState<string | null>(null);
  const [gettingToken, setGettingToken] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [checkInUrl, setCheckInUrl] = useState<string>(`/gameview/${token}`);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const data = await response.json();
        setCheckInToken(data.token);
        setShowCheckInModal(true);
      } else {
        console.error("Failed to get check-in token");
        // Could add error handling here
      }
    } catch (error) {
      console.error("Error getting check-in token:", error);
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

  return (
    <div className="min-h-screen bg-black py-8">
      <div className="max-w-6xl mx-auto">
        <TournamentHeader tournament={gameData.tournament} />

        {/* Check In Button */}
        <div className="mb-6 flex justify-center gap-4">
          <button
            onClick={handleCheckInClick}
            disabled={gettingToken}
            className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-900 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] border border-cyan-500/50"
          >
            <UserPlus size={20} />
            {gettingToken ? "Getting Ready..." : "Check In"}
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
                tournament_date: formatGameDate(
                  typeof gameData.tournament.date === "string"
                    ? gameData.tournament.date
                    : gameData.tournament.date.toISOString(),
                ),
                venue: gameData.tournament.venue || "",
              }}
            />
          )}
        </div>

        {/* Game Timer */}
        <div className="mb-6">
          <GameTimer
            tournamentId={parseInt(token as string)}
            playersRemaining={computedStats.playersRemaining}
            isAdmin={false}
          />
        </div>

        {/* Tournament Feed */}

        <div className="mb-8">
          <TournamentFeed
            tournamentId={parseInt(token as string)}
            maxHeight="750px"
            totalPlayers={gameData.players.length}
            startPoints={gameData.tournament.start_points}
            players={gameData.players}
          />
        </div>

        {/* Real-time indicator */}
        <div className="fixed bottom-4 right-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-[0_0_20px_rgba(34,197,94,0.5)] border border-green-400/50 animate-pulse">
          🔴 Live
        </div>

        {/* Check In Modal */}
        {checkInToken && (
          <PlayerCheckInModal
            isOpen={showCheckInModal}
            onClose={() => setShowCheckInModal(false)}
            checkInToken={checkInToken}
            onSuccess={() => {
              setShowCheckInModal(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
