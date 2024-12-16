import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Helper function to safely serialize BigInt
function serializeResults(results: any[]) {
  return results.map((record) => {
    const serialized = { ...record };
    for (let key in serialized) {
      if (typeof serialized[key] === "bigint") {
        serialized[key] = serialized[key].toString();
      }
    }
    return serialized;
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json([]);
    }

    const players = await prisma.$queryRaw`
      SELECT 
        Name,
        UID,
        COUNT(DISTINCT File_name) as TotalGames,
        SUM(Total_Points) as TotalPoints,
        CAST(AVG(Player_Score) AS DECIMAL(10,2)) as AvgScore
      FROM poker_tournaments
      WHERE Name LIKE ${`%${query}%`}
      GROUP BY Name, UID
      ORDER BY Name
      LIMIT 10
    `;

    // Serialize the results before sending
    const serializedPlayers = serializeResults(players as any[]);

    return NextResponse.json(serializedPlayers);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to search players" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
