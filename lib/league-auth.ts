import { prisma } from '@/lib/prisma';

export type LeagueRole = 'owner' | 'admin' | null;

export async function getLeagueRole(
  playerUid: string,
  leagueId: number
): Promise<LeagueRole> {
  const row = await prisma.league_roles.findUnique({
    where: {
      unique_member: { league_id: leagueId, player_uid: playerUid },
    },
    select: { role: true },
  });
  if (!row) return null;
  return row.role as LeagueRole;
}

export function canAccessAdmin(role: LeagueRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canManageRoles(role: LeagueRole): boolean {
  return role === 'owner';
}
