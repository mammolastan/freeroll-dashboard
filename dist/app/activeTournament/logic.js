import { prisma } from "@/lib/prisma";
export async function getCheckedInPlayers(tournamentDraftId) {
    try {
        const players = await prisma.$queryRaw `
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
    }
    catch (error) {
        console.error("Error fetching checked-in players:", error);
        return [];
    }
}
