// lib/tournament/koUtils.ts
import { PrismaClient } from "@prisma/client";

type PrismaTransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Fully recalculate ko_position for ALL knocked out players based on knockedout_at order.
 * This ensures ko_position always matches the knockedout_at timestamp order.
 * Oldest knockedout_at = position 1, second oldest = position 2, etc.
 * Works with both regular prisma client and transaction client.
 */
export async function recalculateKoPositions(
  draftId: number,
  db: PrismaClient | PrismaTransactionClient
): Promise<void> {
  // Get ALL knocked out players ordered by knockedout_at, then id (for tie-breaking)
  const knockedOutPlayers = await db.$queryRaw<{ id: number }[]>`
    SELECT id FROM tournament_draft_players
    WHERE tournament_draft_id = ${draftId}
      AND knockedout_at IS NOT NULL
    ORDER BY knockedout_at ASC, id ASC
  `;

  // Update each player's ko_position based on their order in the sorted list
  for (let i = 0; i < knockedOutPlayers.length; i++) {
    const newKoPosition = i + 1;
    await db.$executeRaw`
      UPDATE tournament_draft_players
      SET ko_position = ${newKoPosition}
      WHERE id = ${knockedOutPlayers[i].id}
    `;
  }
}

/**
 * Detect type of KO state change between old and new positions.
 */
export function detectKoStateChange(
  oldPosition: number | null | undefined,
  newPosition: number | null | undefined
): "knocked_out" | "undo_ko" | "no_change" {
  const wasKO = oldPosition !== null && oldPosition !== undefined;
  const isNowKO =
    newPosition !== null &&
    newPosition !== undefined &&
    typeof newPosition === "number";

  if (!wasKO && isNowKO) return "knocked_out";
  if (wasKO && !isNowKO) return "undo_ko";
  return "no_change";
}

/**
 * Fields to clear when undoing a knockout (includes hitman claim fields).
 */
export const KO_UNDO_CLEAR_FIELDS = {
  ko_position: null,
  hitman_uid: null,
  knockedout_at: null,
  status: "active",
  hitman_claim_uid: null,
  hitman_claim_name: null,
  hitman_claim_status: "none",
  hitman_claimed_at: null,
  hitman_claim_reviewed_at: null,
  hitman_claim_reviewed_by: null,
} as const;
