// app/api/admin/players/update-nickname/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { uid, nickname } = await request.json();

    const updatedPlayer = await prisma.player.update({
      where: { uid },
      data: { nickname },
    });

    return NextResponse.json(updatedPlayer);
  } catch (error) {
    console.error("Error updating nickname:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
