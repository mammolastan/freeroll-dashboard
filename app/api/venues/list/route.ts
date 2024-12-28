// app/api/venues/list/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export const dynamic = "force-dynamic";

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

function getMonthYearString(date: Date) {
  return {
    month: date.toLocaleString("default", { month: "long", timeZone: "UTC" }),
    year: date.getUTCFullYear(),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
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

    const venues = await prisma.$queryRaw`
      SELECT DISTINCT 
        Venue as name,
        COUNT(DISTINCT File_name) as totalGames
      FROM poker_tournaments
      WHERE TRIM(Season) IN (${`${month} ${year}`}, ${`${month}  ${year}`})
      GROUP BY Venue
      ORDER BY totalGames DESC
    `;

    return NextResponse.json({
      venues: serializeResults(venues as any[]),
      month,
      year,
    });
  } catch (error) {
    console.error("Venue list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch venues" },
      { status: 500 }
    );
  }
}
