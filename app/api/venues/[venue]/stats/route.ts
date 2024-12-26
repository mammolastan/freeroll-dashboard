// app/api/venues/[venue]/stats/route.ts
import { NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

function serializeResults(results: any[]) {
  return results.map((record) => {
    const serialized = { ...record };
    for (let key in serialized) {
      if (typeof serialized[key] === "bigint") {
        serialized[key] = Number(serialized[key]);
      }
    }
    return serialized;
  });
}

export async function GET(
  request: Request,
  { params }: { params: { venue: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const venue = decodeURIComponent(params.venue);
    const isCurrentMonth = searchParams.get("currentMonth") !== "false";

    const currentDate = new Date();
    const targetDate = isCurrentMonth
      ? currentDate
      : new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);

    const month = targetDate.toLocaleString("default", {
      month: "long",
      timeZone: "UTC",
    });
    const year = targetDate.getUTCFullYear();

    const topPlayers = await prisma.$queryRaw`
      SELECT 
        Name,
        UID,
        COUNT(*) as gamesPlayed,
        SUM(Total_Points) as totalPoints,
        SUM(Knockouts) as knockouts
      FROM poker_tournaments
      WHERE Venue = ${venue}
      AND TRIM(Season) IN (${`${month} ${year}`}, ${`${month}  ${year}`})
      GROUP BY Name, UID
      ORDER BY totalPoints DESC
      LIMIT 10
    `;

    return NextResponse.json({
      topPlayers: serializeResults(topPlayers as any[]),
      month,
      year,
    });
  } catch (error) {
    console.error("Venue stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch venue stats" },
      { status: 500 }
    );
  }
}
