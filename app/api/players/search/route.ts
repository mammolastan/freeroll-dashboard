import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerIP } from "@/lib/utils";

// Move prisma client outside route handler
const prisma = new PrismaClient();

// Add export config to mark as dynamic
export const dynamic = "force-dynamic";

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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json([]);
    }
    const serverIP = await getServerIP();
    console.log("Server IP:", serverIP);

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
