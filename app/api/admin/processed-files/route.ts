import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Set revalidation period to 6 hours (in seconds)
export const revalidate = 21600; // 6 * 60 * 60 = 21600 seconds

export async function GET() {
  try {
    const processedFiles = await prisma.processedFile.findMany({
      take: 10,
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
