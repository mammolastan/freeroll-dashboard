// app/api/admin/reprocess-game/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

export async function POST(request: Request) {
  const adminCheck = await requireAdmin();
  if (adminCheck.error) return adminCheck.error;

  try {
    const { fileId, filename, gameUid } = await request.json();

    // Validate input
    if (!gameUid) {
      return NextResponse.json(
        { error: "Missing required field (gameUid)" },
        { status: 400 }
      );
    }

    let deletionDetails = "";

    try {
      // Delete the game record (cascades to appearances and knockouts)
      const game = await prisma.games.findUnique({
        where: { uid: gameUid },
      });

      if (game) {
        await prisma.games.delete({
          where: { uid: gameUid },
        });
        deletionDetails = `Deleted game and cascaded to appearances/knockouts.`;
      } else {
        return NextResponse.json(
          { error: `No game found with uid ${gameUid}` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Successfully reprocessed ${filename || gameUid}`,
        details: deletionDetails,
      });
    } catch (transactionError) {
      console.error("Transaction error:", transactionError);

      // If it's a record not found error, provide more specific feedback
      if (
        transactionError instanceof Error &&
        transactionError.message.includes("not found")
      ) {
        return NextResponse.json(
          { error: "Game not found in database" },
          { status: 404 }
        );
      }

      throw transactionError;
    }
  } catch (error) {
    console.error("Reprocess game error:", error);
    return NextResponse.json(
      {
        error: "Failed to reprocess game",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
