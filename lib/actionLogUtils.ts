// lib/actionLogUtils.ts

import { prisma } from "./prisma";
import { TDActionType, TDActionLogEntry } from "./tdActions";

/**
 * Gets the next sequence number for a game (SELECT MAX + 1, or 1)
 */
export async function getNextSequenceNum(game_uid: string): Promise<number> {
  const result = await prisma.$queryRaw<[{ max_seq: number | null }]>`
    SELECT MAX(sequence_num) as max_seq
    FROM tournament_draft_action_log
    WHERE game_uid = ${game_uid}
  `;
  return (result[0].max_seq ?? 0) + 1;
}

/**
 * Gets the most recent 'applied' action for a game (used for undo eligibility)
 */
export async function getLastAppliedAction(game_uid: string) {
  return prisma.tournament_draft_action_log.findFirst({
    where: { game_uid, status: "applied" },
    orderBy: { sequence_num: "desc" },
  });
}

/**
 * Gets the last N actions for a game (for the history drawer)
 */
export async function getActionHistory(
  game_uid: string,
  limit = 25
): Promise<TDActionLogEntry[]> {
  const actions = await prisma.tournament_draft_action_log.findMany({
    where: { game_uid },
    orderBy: { sequence_num: "desc" },
    take: limit,
  });

  // Parse JSON strings back to objects
  return actions.map((action) => ({
    id: action.id,
    game_uid: action.game_uid,
    sequence_num: action.sequence_num,
    action_type: action.action_type as TDActionType,
    description: action.description,
    actor_uid: action.actor_uid,
    payload: JSON.parse(action.payload) as Record<string, unknown>,
    reverse_payload: JSON.parse(action.reverse_payload) as Record<string, unknown>,
    status: action.status as "applied" | "undone",
    performed_at: action.performed_at.toISOString(),
    undone_at: action.undone_at?.toISOString() ?? null,
    undone_by: action.undone_by,
  }));
}

/**
 * Writes a new action log entry
 */
export async function writeActionLog(entry: {
  game_uid: string;
  sequence_num: number;
  action_type: TDActionType;
  description: string;
  actor_uid: string;
  payload: Record<string, unknown>;
  reverse_payload: Record<string, unknown>;
}) {
  return prisma.tournament_draft_action_log.create({
    data: {
      game_uid: entry.game_uid,
      sequence_num: entry.sequence_num,
      action_type: entry.action_type,
      description: entry.description,
      actor_uid: entry.actor_uid,
      payload: JSON.stringify(entry.payload),
      reverse_payload: JSON.stringify(entry.reverse_payload),
      status: "applied",
    },
  });
}

/**
 * Marks an action as undone
 */
export async function markActionUndone(
  actionId: number,
  undone_by: string
) {
  return prisma.tournament_draft_action_log.update({
    where: { id: actionId },
    data: {
      status: "undone",
      undone_at: new Date(),
      undone_by,
    },
  });
}

/**
 * Gets the game_uid for a tournament draft by its ID.
 * If the tournament hasn't been integrated yet (game_uid is null),
 * returns a temporary identifier based on the draft ID.
 */
export async function getGameUidForDraft(draftId: number): Promise<string | null> {
  const draft = await prisma.tournamentDraft.findUnique({
    where: { id: draftId },
    select: { game_uid: true },
  });

  if (!draft) return null;

  // Use actual game_uid if available, otherwise use draft-based identifier
  return draft.game_uid ?? `draft-${draftId}`;
}
