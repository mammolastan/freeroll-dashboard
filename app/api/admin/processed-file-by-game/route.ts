// app/api/admin/processed-file-by-game/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get("fileName");
    const gameUid = searchParams.get("gameUid");

    if (!fileName) {
      return NextResponse.json(
        { error: "fileName parameter is required" },
        { status: 400 }
      );
    }

    // Try to find the processed file by game_uid first, then by filename
    let processedFile = null;

    if (gameUid && gameUid !== "undefined" && gameUid !== "") {
      processedFile = await prisma.processedFile.findFirst({
        where: {
          game_uid: gameUid,
        },
      });
    }

    // If not found by game_uid or no game_uid provided, search by filename
    if (!processedFile) {
      processedFile = await prisma.processedFile.findFirst({
        where: {
          filename: fileName,
        },
      });
    }

    if (!processedFile) {
      return NextResponse.json(
        { error: "Processed file record not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: processedFile.id.toString(),
      filename: processedFile.filename,
      game_uid: processedFile.game_uid,
      status: processedFile.status,
      processed_at: processedFile.processed_at.toISOString(),
    });
  } catch (error) {
    console.error("Find processed file error:", error);
    return NextResponse.json(
      { error: "Failed to find processed file" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
