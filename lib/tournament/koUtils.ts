// lib/tournament/koUtils.ts
import { PrismaClient } from "@prisma/client";

type PrismaTransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Assign ko_position to knocked out players who don't have one yet.
 * Preserves existing ko_positions - only assigns the next available position
 * to players with knockedout_at but no ko_position.
 * Works with both regular prisma client and transaction client.
 */
export async function recalculateKoPositions(
  draftId: number,
  db: PrismaClient | PrismaTransactionClient
): Promise<void> {
  // Find the current max ko_position to determine the next position
  const maxResult = await db.$queryRaw<{ max_ko: number | null }[]>`
    SELECT MAX(ko_position) as max_ko FROM tournament_draft_players
    WHERE tournament_draft_id = ${draftId}
  `;

  const currentMaxKo = maxResult[0]?.max_ko ?? 0;

  // Only get players who are knocked out but don't have a ko_position yet
  const playersNeedingKoPosition = await db.$queryRaw<{ id: number }[]>`
    SELECT id FROM tournament_draft_players
    WHERE tournament_draft_id = ${draftId}
      AND knockedout_at IS NOT NULL
      AND ko_position IS NULL
    ORDER BY knockedout_at ASC, id ASC
  `;

  for (let i = 0; i < playersNeedingKoPosition.length; i++) {
    await db.$executeRaw`
      UPDATE tournament_draft_players
      SET ko_position = ${currentMaxKo + i + 1}
      WHERE id = ${playersNeedingKoPosition[i].id}
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
