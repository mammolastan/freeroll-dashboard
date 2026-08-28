// app/api/[leagueSlug]/admin/players/[uid]/route.ts
import { prisma } from "@/lib/prisma";
import { getLeagueIdBySlug } from "@/lib/league-utils";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLeagueRole, canAccessAdmin } from "@/lib/league-auth";

type PlayerDetailRow = {
  id: number;
  uid: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  email: string | null;
  email_verified_at: Date | null;
  last_login_at: Date | null;
  photo_url: string | null;
  favorite_hand: string | null;
  favorite_pro: string | null;
  isAdmin: boolean;
  league_role: "owner" | "admin" | null;
  created: Date;
  modified: Date;
  game_count: bigint;
  total_points: number | null;
  knockout_count: bigint;
  last_game_date: Date | null;
  first_game_date: Date | null;
  best_placement: number | null;
};

// GET /api/[leagueSlug]/admin/players/[uid]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leagueSlug: string; uid: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leagueSlug, uid } = await params;
  const leagueId = await getLeagueIdBySlug(leagueSlug);
  if (!leagueId) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const role = await getLeagueRole(session.user.uid, leagueId);
  if (!canAccessAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const players = await prisma.$queryRaw<PlayerDetailRow[]>`
    SELECT
      p.id,
      p.uid,
      p.first_name,
      p.last_name,
      p.nickname,
      p.email,
      p.email_verified_at,
      p.last_login_at,
      p.photo_url,
      p.favorite_hand,
      p.favorite_pro,
      p.isAdmin,
      lr.role as league_role,
      p.created,
      p.modified,
      COUNT(DISTINCT a.game_id) as game_count,
      COALESCE(SUM(a.points + COALESCE(g.bonus_points, 0)), 0) as total_points,
      (SELECT COUNT(*) FROM knockouts k WHERE k.hitman = p.id) as knockout_count,
      MAX(g.date) as last_game_date,
      MIN(g.date) as first_game_date,
      MIN(a.placement) as best_placement
    FROM players_v2 p
    LEFT JOIN league_roles lr ON lr.league_id = p.league_id AND lr.player_uid COLLATE utf8mb4_unicode_ci = p.uid COLLATE utf8mb4_unicode_ci
    LEFT JOIN appearances a ON p.id = a.player_id
    LEFT JOIN games g ON g.id = a.game_id
    WHERE p.uid = ${uid}
      AND p.league_id = ${leagueId}
    GROUP BY p.id
  `;

  if (players.length === 0) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const p = players[0];

  return NextResponse.json({
    player: {
      id: p.id,
      uid: p.uid,
      firstName: p.first_name,
      lastName: p.last_name,
      nickname: p.nickname,
      email: p.email,
      emailVerified: !!p.email_verified_at,
      emailVerifiedAt: p.email_verified_at,
      lastLoginAt: p.last_login_at,
      photoUrl: p.photo_url,
      favoriteHand: p.favorite_hand,
      favoritePro: p.favorite_pro,
      isAdmin: Boolean(
        p.league_role === "owner" || p.league_role === "admin"
      ),
      isClaimed: !!p.email,
      hasPhoto: !!p.photo_url,
      created: p.created,
      modified: p.modified,
      gameCount: Number(p.game_count),
      totalPoints: Number(p.total_points || 0),
      knockoutCount: Number(p.knockout_count),
      lastGameDate: p.last_game_date
        ? p.last_game_date.toISOString().split("T")[0]
        : null,
      firstGameDate: p.first_game_date
        ? p.first_game_date.toISOString().split("T")[0]
        : null,
      bestPlacement: p.best_placement,
    },
  });
}

// PUT /api/[leagueSlug]/admin/players/[uid]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ leagueSlug: string; uid: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leagueSlug, uid } = await params;
  const leagueId = await getLeagueIdBySlug(leagueSlug);
  if (!leagueId) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const role = await getLeagueRole(session.user.uid, leagueId);
  if (!canAccessAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify player belongs to this league
  const existing = await prisma.players_v2.findFirst({
    where: { uid, league_id: leagueId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const body = await req.json();
  const {
    firstName,
    lastName,
    nickname,
    email,
    favoriteHand,
    favoritePro,
    isAdmin,
  } = body;

  // Check for duplicate email if email is being changed
  if (email !== undefined && email?.trim() !== existing.email) {
    if (email?.trim()) {
      const existingEmail = await prisma.players_v2.findFirst({
        where: {
          email: email.trim(),
          NOT: { uid },
        },
      });
      if (existingEmail) {
        return NextResponse.json(
          { error: "A player with this email already exists" },
          { status: 409 }
        );
      }
    }
  }

  try {
    const player = await prisma.$transaction(async (tx) => {
      const updated = await tx.players_v2.update({
        where: { id: existing.id },
        data: {
          ...(firstName !== undefined && {
            first_name: firstName?.trim() || null,
          }),
          ...(lastName !== undefined && { last_name: lastName?.trim() || null }),
          ...(nickname !== undefined && { nickname: nickname?.trim() || null }),
          ...(email !== undefined && { email: email?.trim() || null }),
          ...(favoriteHand !== undefined && {
            favorite_hand: favoriteHand?.trim() || null,
          }),
          ...(favoritePro !== undefined && {
            favorite_pro: favoritePro?.trim() || null,
          }),
        },
      });

      // Manage league_roles based on isAdmin flag
      if (isAdmin !== undefined) {
        if (Boolean(isAdmin)) {
          const existingRole = await tx.league_roles.findUnique({
            where: {
              unique_member: { league_id: leagueId, player_uid: uid },
            },
          });
          if (!existingRole) {
            await tx.league_roles.create({
              data: {
                league_id: leagueId,
                player_uid: uid,
                role: "admin",
              },
            });
          }
        } else {
          await tx.league_roles.deleteMany({
            where: {
              league_id: leagueId,
              player_uid: uid,
              role: "admin",
            },
          });
        }
      }

      return updated;
    });

    // Check current role status for response
    const currentRole = await prisma.league_roles.findUnique({
      where: {
        unique_member: { league_id: leagueId, player_uid: uid },
      },
    });

    return NextResponse.json({
      player: {
        id: player.id,
        uid: player.uid,
        firstName: player.first_name,
        lastName: player.last_name,
        nickname: player.nickname,
        email: player.email,
        favoriteHand: player.favorite_hand,
        favoritePro: player.favorite_pro,
        isAdmin: Boolean(currentRole?.role === "owner" || currentRole?.role === "admin"),
        isClaimed: !!player.email,
        hasPhoto: !!player.photo_url,
      },
    });
  } catch (error) {
    console.error("Error updating player:", error);
    return NextResponse.json(
      { error: "Failed to update player" },
      { status: 500 }
    );
  }
}

// DELETE /api/[leagueSlug]/admin/players/[uid]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ leagueSlug: string; uid: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leagueSlug, uid } = await params;
  const leagueId = await getLeagueIdBySlug(leagueSlug);
  if (!leagueId) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const role = await getLeagueRole(session.user.uid, leagueId);
  if (!canAccessAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify player belongs to this league
  const existing = await prisma.players_v2.findFirst({
    where: { uid, league_id: leagueId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  // Safety check: don't allow deleting players with game history
  const appearanceCount = await prisma.appearances.count({
    where: { player_id: existing.id },
  });
  if (appearanceCount > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete: This player has ${appearanceCount} game appearance(s). Players with game history cannot be deleted.`,
      },
      { status: 409 }
    );
  }

  // Check for knockouts (as hitman or victim)
  const knockoutCount = await prisma.knockouts.count({
    where: {
      OR: [{ hitman: existing.id }, { victim: existing.id }],
    },
  });
  if (knockoutCount > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete: This player has ${knockoutCount} knockout record(s). Players with knockout history cannot be deleted.`,
      },
      { status: 409 }
    );
  }

  try {
    // Delete related records first
    await prisma.playerBadge.deleteMany({ where: { player_uid: uid } });
    await prisma.bonus_points.deleteMany({ where: { player_uid: uid } });
    await prisma.passwordReset.deleteMany({ where: { player_uid: uid } });

    // Delete the player
    await prisma.players_v2.delete({ where: { id: existing.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting player:", error);
    return NextResponse.json(
      { error: "Failed to delete player" },
      { status: 500 }
    );
  }
}
