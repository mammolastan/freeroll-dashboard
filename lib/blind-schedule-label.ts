/**
 * Human-readable blind schedule title for timer UI (not the DB id).
 */

export type BlindScheduleListEntry = { id: number; name: string };

export type DraftBlindScheduleFields = {
  blind_schedule?: string | null;
  custom_blind_levels?: string | null;
};

export function getBlindScheduleDisplayName(
  draft: DraftBlindScheduleFields | null | undefined,
  schedules: BlindScheduleListEntry[],
): string | undefined {
  if (!draft) return undefined;
  if (draft.custom_blind_levels) return "Custom";
  const id = draft.blind_schedule;
  if (id == null || String(id).trim() === "") return undefined;
  const row = schedules.find((s) => String(s.id) === String(id));
  if (row) return row.name;
  if (schedules.length === 0) return undefined;
  return `Schedule #${id}`;
}
