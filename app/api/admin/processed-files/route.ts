import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}
