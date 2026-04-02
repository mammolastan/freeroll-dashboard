// app/api/competition-periods/reorder/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST - Batch update display_order for multiple periods
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { updates } = body;

    // Validate input
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: "Updates must be a non-empty array of {id, display_order}" },
        { status: 400 }
      );
    }

    // Validate each update has required fields
    for (const update of updates) {
      if (typeof update.id !== "number" || typeof update.display_order !== "number") {
        return NextResponse.json(
          { error: "Each update must have numeric id and display_order" },
          { status: 400 }
        );
      }
    }

    // Perform batch update using a transaction
    await prisma.$transaction(
      updates.map((update: { id: number; display_order: number }) =>
        prisma.competition_periods.update({
          where: { id: update.id },
          data: {
            display_order: update.display_order,
            modified: new Date(),
          },
        })
      )
    );

    return NextResponse.json({ success: true, updated: updates.length });
  } catch (error) {
    console.error("Error reordering competition periods:", error);
    return NextResponse.json(
      { error: "Failed to reorder competition periods" },
      { status: 500 }
    );
  }
}
