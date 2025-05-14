// app/api/admin/reprocess-game/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { fileId, filename, gameUid } = await request.json();

    // Validate input
    if (!fileId || !filename) {
      return NextResponse.json(
        { error: "Missing required fields (fileId, filename)" },
        { status: 400 }
      );
    }

    let deletionDetails = "";

    try {
      // Start a transaction to ensure both operations succeed or fail together
      await prisma.$transaction(async (tx) => {
        // First, delete all tournament records for this game
        if (gameUid) {
          // Delete by game_uid if available
          const deletedTournaments = await tx.pokerTournament.deleteMany({
            where: {
              OR: [{ uid: gameUid }, { fileName: filename }],
            },
          });
          deletionDetails += `Deleted ${deletedTournaments.count} tournament records. `;
        } else {
          // Fallback to filename if no game_uid
          const deletedTournaments = await tx.pokerTournament.deleteMany({
            where: {
              fileName: filename,
            },
          });
          deletionDetails += `Deleted ${deletedTournaments.count} tournament records (by filename). `;
        }

        // Then, delete the processed file record
        const deletedFile = await tx.processedFile.delete({
          where: {
            id: parseInt(fileId),
          },
        });
        deletionDetails += `Deleted processed file record.`;
      });

      return NextResponse.json({
        success: true,
        message: `Successfully reprocessed ${filename}`,
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
          { error: "File record not found in database" },
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
  } finally {
    await prisma.$disconnect();
  }
}
