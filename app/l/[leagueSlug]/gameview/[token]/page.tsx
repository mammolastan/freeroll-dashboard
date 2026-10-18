// app/l/[leagueSlug]/gameview/[token]/page.tsx

"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useRealtimeGameData } from "@/lib/realtime/hooks/useRealtimeGameData";
import { GameTimer } from "@/components/Timer/GameTimer";
import { PlayerCheckInModal } from "@/components/PlayerCheckIn/PlayerCheckInModal";
import { QrCode, UserPlus, Check } from "lucide-react";
import { QRCodeModal } from "@/app/l/[leagueSlug]/admin/(fullscreen)/tournament-entry/QRCodeModal";
import { formatTime } from "@/lib/utils";
import { formatLeagueDate } from "@/lib/league-time";
import { TournamentFeed } from "@/components/TournamentFeed";

interface TournamentHeaderData {
  title: string;
  date: string | Date;
  time?: string | null;
  venue?: string | null;
  td?: string | null;
  timezone: string;
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
            {formatLeagueDate(
              typeof tournament.date === "string"
                ? tournament.date
                : tournament.date.toISOString(),
              tournament.timezone
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
        </div>
      </div>
    </div>
  );
}

export default function GameViewPage() {
  const params = useParams();
  const token = params.token as string;
  const leagueSlug = params.leagueSlug as string | undefined;
  const { data: session } = useSession();
  const { gameData, computedStats, loading, error, connectionStatus, reconnectAttempt, manualReconnect } = useRealtimeGameData(
    token as string,
  );
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInToken, setCheckInToken] = useState<string | null>(null);
  const [checkInLeagueSlug, setCheckInLeagueSlug] = useState<string | null>(null);
  const [gettingToken, setGettingToken] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [checkInUrl, setCheckInUrl] = useState<string>("");
  const [checkInToast, setCheckInToast] = useState<string | null>(null);

  // Check if the logged-in user is already checked in
  const isUserCheckedIn = session?.user?.uid && gameData?.players
    ? gameData.players.some(p => p.uid === session.user.uid)
    : false;

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const basePath = leagueSlug ? `/l/${leagueSlug}/gameview/${token}` : `/gameview/${token}`;
      setCheckInUrl(`${window.location.origin}${basePath}`);
    }
  }, [token, leagueSlug]);

  // Auto-clear check-in toast after 4 seconds
  React.useEffect(() => {
    if (!checkInToast) return;
    const timer = setTimeout(() => setCheckInToast(null), 4000);
    return () => clearTimeout(timer);
  }, [checkInToast]);

const handleCheckInClick = async () => {
    // If user is signed in AND not already checked in, check them in directly without the modal
    if (session?.user?.uid && session?.user?.name && !isUserCheckedIn) {
      setGettingToken(true);
      try {
        // First get the check-in token if we don't have it
        let tokenToUse = checkInToken;
        if (!tokenToUse) {
          const tokenResponse = await fetch(`/api/tournaments/${token}/checkin-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });

          if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json().catch(() => ({}));
            if (tokenResponse.status === 403) {
              alert(errorData.error || "Self check-in is not enabled for this tournament.");
            } else if (tokenResponse.status === 404) {
              alert("Tournament not found or check-in is not available.");
            } else {
              alert("Failed to start check-in. Please try again.");
            }
            return;
          }

          const tokenData = await tokenResponse.json();
          tokenToUse = tokenData.token;
          setCheckInToken(tokenData.token);
          setCheckInLeagueSlug(tokenData.league_slug || null);
        }

        // Now perform the direct check-in
        const response = await fetch(`/api/checkin/${tokenToUse}/players`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selected_player_uid: session.user.uid,
            entered_name: session.user.name,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to check in");
        }

        const displayName = session.user.nickname || session.user.name;
        setCheckInToast(displayName);
      } catch (error) {
        console.error("Error checking in:", error);
        alert(error instanceof Error ? error.message : "Error checking in. Please try again.");
      } finally {
        setGettingToken(false);
      }
      return;
    }

    // Already checked in (or not signed in) — open the modal so they can
    // either check in as themselves via the guest flow, or check in someone else
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
        setCheckInLeagueSlug(data.league_slug || null);
        setShowCheckInModal(true);
      } else {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 403) {
          alert(errorData.error || "Self check-in is not enabled for this tournament.");
        } else if (response.status === 404) {
          alert("Tournament not found or check-in is not available.");
        } else {
          alert("Failed to start check-in. Please try again.");
        }
        console.error("Failed to get check-in token:", errorData);
      }
    } catch (error) {
      console.error("Error getting check-in token:", error);
      alert("Failed to connect. Please check your internet connection and try again.");
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

  // Only show fatal error if we have no data AND there's an error
  if (error && !gameData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
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
    <div className="min-h-screen bg-black py-8 relative">
      {/* Check-in success toast */}
      {checkInToast && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-green-600/95 text-white px-8 py-4 rounded-xl shadow-[0_0_30px_rgba(34,197,94,0.5)] border border-green-400/50 flex items-center gap-3 text-xl font-medium animate-in fade-in zoom-in-95 duration-300">
            <span className="text-2xl">✅</span>
            <span>{checkInToast} checked in</span>
          </div>
        </div>
      )}

      {/* Disconnected overlay */}
      {(connectionStatus === 'disconnected' || connectionStatus === 'reconnecting') && (
        <div
          className="fixed inset-0 bg-yellow-500/20 z-40 pointer-events-none"
          style={{ backdropFilter: 'saturate(0.8)' }}
        />
      )}
      <div className="max-w-6xl mx-auto">
        <TournamentHeader tournament={gameData.tournament} />

        {/* Check In Button */}
        <div className="mb-6 flex justify-center gap-4">
          {gameData.tournament.allow_self_checkin ? (
            isUserCheckedIn ? (
              <div className="flex flex-col items-center gap-2">
                <button
                  disabled
                  className="bg-green-600/80 border-green-500/50 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 border cursor-default"
                >
                  <Check size={20} />
                  Checked In
                </button>
                <button
                  onClick={handleCheckInClick}
                  disabled={gettingToken}
                  className="text-cyan-400 hover:text-cyan-300 text-sm underline underline-offset-2 transition-colors"
                >
                  {gettingToken ? "Getting Ready..." : "Check in someone else"}
                </button>
              </div>
            ) : (
              <button
                onClick={handleCheckInClick}
                disabled={gettingToken}
                className="bg-transparent hover:bg-cyan-600/20 border-cyan-500 text-cyan-400 hover:text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] disabled:bg-gray-700 disabled:text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all border-2"
              >
                <UserPlus size={20} />
                {gettingToken ? "Checking In..." : "Check In"}
              </button>
            )
          ) : (
            <button
              disabled
              className="bg-gray-700 cursor-not-allowed border-gray-600 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 border"
            >
              <UserPlus size={20} />
              Check-in with TD
            </button>
          )}

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
                tournament_date: formatLeagueDate(
                  typeof gameData.tournament.date === "string"
                    ? gameData.tournament.date
                    : gameData.tournament.date.toISOString(),
                  gameData.tournament.timezone
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
            allowChat={gameData.tournament.allow_chat}
          />
        </div>

        {/* Real-time connection indicator */}
        {connectionStatus === 'connected' && (
          <div className="fixed bottom-4 right-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-[0_0_20px_rgba(34,197,94,0.5)] border border-green-400/50 animate-pulse">
            🔴 Live
          </div>
        )}
        {(connectionStatus === 'disconnected' || connectionStatus === 'reconnecting') && (
          <button
            onClick={manualReconnect}
            className="fixed bottom-4 right-4 z-50 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-[0_0_20px_rgba(234,179,8,0.5)] border border-yellow-400/50 animate-pulse hover:from-yellow-400 hover:to-orange-400 cursor-pointer"
          >
            {reconnectAttempt > 0 ? `Reconnecting (${reconnectAttempt})... Tap to retry` : 'Reconnecting... Tap to retry'}
          </button>
        )}
        {connectionStatus === 'connecting' && (
          <div className="fixed bottom-4 right-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-[0_0_20px_rgba(59,130,246,0.5)] border border-blue-400/50 animate-pulse">
            Connecting...
          </div>
        )}

        {/* Check In Modal */}
        {checkInToken && (
          <PlayerCheckInModal
            isOpen={showCheckInModal}
            onClose={() => setShowCheckInModal(false)}
            checkInToken={checkInToken}
            leagueSlug={checkInLeagueSlug}
            onSuccess={(playerName) => {
              setShowCheckInModal(false);
              setCheckInToast(playerName);
            }}
          />
        )}
      </div>
    </div>
  );
}
