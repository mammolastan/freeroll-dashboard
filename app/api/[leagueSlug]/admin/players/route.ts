// app/api/[leagueSlug]/admin/players/route.ts
import { prisma } from "@/lib/prisma";
import { getLeagueIdBySlug } from "@/lib/league-utils";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLeagueRole, canAccessAdmin } from "@/lib/league-auth";

type PlayerRow = {
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
  total_points: bigint;
  last_game_date: Date | null;
};

// GET /api/[leagueSlug]/admin/players
// GET /api/[leagueSlug]/admin/players?q=searchterm
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leagueSlug: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leagueSlug } = await params;
  const leagueId = await getLeagueIdBySlug(leagueSlug);
  if (!leagueId) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const role = await getLeagueRole(session.user.uid, leagueId);
  if (!canAccessAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchQuery = req.nextUrl.searchParams.get("q");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");
  const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0");
  const sortByParam = req.nextUrl.searchParams.get("sortBy");
  const sortDirParam = req.nextUrl.searchParams.get("sortDir");
  const claimedParam = req.nextUrl.searchParams.get("claimed");
  const photoParam = req.nextUrl.searchParams.get("photo");

  const sortBy =
    sortByParam === "games" ||
    sortByParam === "created" ||
    sortByParam === "claimed" ||
    sortByParam === "photo"
      ? sortByParam
      : "recent";
  const sortDir = sortDirParam === "asc" ? "ASC" : "DESC";

  const claimedFilterSql =
    claimedParam === "claimed"
      ? Prisma.sql`AND p.email IS NOT NULL AND p.email <> ''`
      : claimedParam === "unclaimed"
        ? Prisma.sql`AND (p.email IS NULL OR p.email = '')`
        : Prisma.empty;

  const photoFilterSql =
    photoParam === "with"
      ? Prisma.sql`AND p.photo_url IS NOT NULL AND p.photo_url <> ''`
      : photoParam === "without"
        ? Prisma.sql`AND (p.photo_url IS NULL OR p.photo_url = '')`
        : Prisma.empty;

  const orderBySql =
    sortBy === "games"
      ? Prisma.sql`ORDER BY COUNT(DISTINCT a.game_id) ${Prisma.raw(sortDir)}, MAX(g.date) DESC, p.first_name ASC`
      : sortBy === "created"
        ? Prisma.sql`ORDER BY p.created ${Prisma.raw(sortDir)}, p.first_name ASC`
        : sortBy === "claimed"
          ? Prisma.sql`ORDER BY CASE WHEN p.email IS NOT NULL AND p.email <> '' THEN 1 ELSE 0 END ${Prisma.raw(sortDir)}, p.first_name ASC`
          : sortBy === "photo"
            ? Prisma.sql`ORDER BY CASE WHEN p.photo_url IS NOT NULL AND p.photo_url <> '' THEN 1 ELSE 0 END ${Prisma.raw(sortDir)}, p.first_name ASC`
            : Prisma.sql`
              ORDER BY
                CASE WHEN MAX(g.date) IS NULL THEN 1 ELSE 0 END,
                MAX(g.date) DESC,
                p.first_name ASC
            `;

  let players: PlayerRow[];
  let countResult: [{ count: bigint }];

  if (searchQuery && searchQuery.length >= 2) {
    const searchTerm = `%${searchQuery}%`;

    players = await prisma.$queryRaw<PlayerRow[]>`
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
        MAX(g.date) as last_game_date
      FROM players_v2 p
      LEFT JOIN league_roles lr ON lr.league_id = p.league_id AND lr.player_uid COLLATE utf8mb4_unicode_ci = p.uid COLLATE utf8mb4_unicode_ci
      LEFT JOIN appearances a ON p.id = a.player_id
      LEFT JOIN games g ON g.id = a.game_id
      WHERE p.league_id = ${leagueId}
        ${claimedFilterSql}
        ${photoFilterSql}
        AND (
          CONCAT(p.first_name, ' ', p.last_name) LIKE ${searchTerm}
          OR p.first_name LIKE ${searchTerm}
          OR p.last_name LIKE ${searchTerm}
          OR p.nickname LIKE ${searchTerm}
          OR p.email LIKE ${searchTerm}
          OR p.uid = ${searchQuery}
        )
      GROUP BY p.id
      ${orderBySql}
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    countResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM players_v2 p
      WHERE p.league_id = ${leagueId}
        ${claimedFilterSql}
        ${photoFilterSql}
        AND (
          CONCAT(p.first_name, ' ', p.last_name) LIKE ${searchTerm}
          OR p.first_name LIKE ${searchTerm}
          OR p.last_name LIKE ${searchTerm}
          OR p.nickname LIKE ${searchTerm}
          OR p.email LIKE ${searchTerm}
          OR p.uid = ${searchQuery}
        )
    `;
  } else {
    players = await prisma.$queryRaw<PlayerRow[]>`
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
        MAX(g.date) as last_game_date
      FROM players_v2 p
      LEFT JOIN league_roles lr ON lr.league_id = p.league_id AND lr.player_uid COLLATE utf8mb4_unicode_ci = p.uid COLLATE utf8mb4_unicode_ci
      LEFT JOIN appearances a ON p.id = a.player_id
      LEFT JOIN games g ON g.id = a.game_id
      WHERE p.league_id = ${leagueId}
      ${claimedFilterSql}
      ${photoFilterSql}
      GROUP BY p.id
      ${orderBySql}
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    countResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM players_v2 p
      WHERE p.league_id = ${leagueId}
      ${claimedFilterSql}
      ${photoFilterSql}
    `;
  }

  const mappedPlayers = players.map((p) => ({
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
    lastGameDate: p.last_game_date
      ? p.last_game_date.toISOString().split("T")[0]
      : null,
  }));

  return NextResponse.json({
    players: mappedPlayers,
    total: Number(countResult[0].count),
    limit,
    offset,
  });
}

// POST /api/[leagueSlug]/admin/players
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueSlug: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leagueSlug } = await params;
  const leagueId = await getLeagueIdBySlug(leagueSlug);
  if (!leagueId) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const role = await getLeagueRole(session.user.uid, leagueId);
  if (!canAccessAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  if (!firstName?.trim() && !lastName?.trim() && !nickname?.trim()) {
    return NextResponse.json(
      { error: "At least a first name, last name, or nickname is required" },
      { status: 400 }
    );
  }

  // Check for duplicate email if provided
  if (email?.trim()) {
    const existingEmail = await prisma.players_v2.findFirst({
      where: { email: email.trim() },
    });
    if (existingEmail) {
      return NextResponse.json(
        { error: "A player with this email already exists" },
        { status: 409 }
      );
    }
  }

  try {
    const player = await prisma.$transaction(async (tx) => {
      const created = await tx.players_v2.create({
        data: {
          uid: uuidv4(),
          league_id: leagueId,
          first_name: firstName?.trim() || null,
          last_name: lastName?.trim() || null,
          nickname: nickname?.trim() || null,
          email: email?.trim() || null,
          favorite_hand: favoriteHand?.trim() || null,
          favorite_pro: favoritePro?.trim() || null,
        },
      });

      if (Boolean(isAdmin)) {
        await tx.league_roles.create({
          data: {
            league_id: leagueId,
            player_uid: created.uid,
            role: "admin",
          },
        });
      }

      return created;
    });

    return NextResponse.json(
      {
        player: {
          id: player.id,
          uid: player.uid,
          firstName: player.first_name,
          lastName: player.last_name,
          nickname: player.nickname,
          email: player.email,
          favoriteHand: player.favorite_hand,
          favoritePro: player.favorite_pro,
          isClaimed: !!player.email,
          hasPhoto: !!player.photo_url,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating player:", error);
    return NextResponse.json(
      { error: "Failed to create player" },
      { status: 500 }
    );
  }
}
