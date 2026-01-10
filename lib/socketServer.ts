// lib/socketServer.ts

interface PlayerData {
  id: number;
  player_name: string;
  player_uid: string | null;
  player_nickname?: string | null;
  [key: string]: unknown;
}

export function emitPlayerJoined(tournamentDraftId: number, newPlayer: PlayerData) {
  // Simple approach: make an HTTP request to localhost to trigger the update
  try {
    console.log(
      `Triggering player update for tournament ${tournamentDraftId}:`,
      newPlayer
    );

    // Make a simple HTTP request to the server to trigger an update
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    fetch(`${baseUrl}/api/trigger-player-update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentDraftId }),
    }).catch((err) => {
      console.error("Failed to trigger player update:", err);
    });
  } catch (error) {
    console.error("Error in emitPlayerJoined:", error);
  }
}
