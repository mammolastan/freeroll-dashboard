import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic"; // This ensures the route always runs dynamically

export async function GET() {
  try {
    const processedFiles = await prisma.processedFile.findMany({
      take: 15,
      orderBy: {
        processed_at: "desc",
      },
    });

    return NextResponse.json(processedFiles);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}
