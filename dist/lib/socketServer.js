// lib/socketServer.ts
import { prisma } from "./prisma";
async function getCheckedInPlayers(tournamentDraftId) {
  try {
    const players = await prisma.$queryRaw`
      SELECT 
        id,
        player_name as name,
        player_nickname as nickname,
        player_uid as uid,
        is_new_player,
        checked_in_at,
        created_at
      FROM tournament_draft_players 
      WHERE tournament_draft_id = ${tournamentDraftId}
      ORDER BY created_at ASC
    `;
    return players;
  } catch (error) {
    console.error("Error fetching checked-in players:", error);
    return [];
  }
}
export function emitPlayerJoined(tournamentDraftId, newPlayer) {
  // Simple approach: make an HTTP request to localhost to trigger the update
  try {
    console.log(
      `Triggering player update for tournament ${tournamentDraftId}:`,
      newPlayer
    );
    // Make a simple HTTP request to the server to trigger an update
    fetch(`http://localhost:3000/api/trigger-player-update`, {
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
