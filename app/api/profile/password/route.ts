// app/api/profile/password/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    // Validation
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Get the player
    const player = await prisma.players_v2.findUnique({
      where: { uid: session.user.uid },
    });

    if (!player || !player.password_hash) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      player.password_hash
    );

    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    // Hash and update the new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await prisma.players_v2.update({
      where: { uid: session.user.uid },
      data: { password_hash: newPasswordHash },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Password change error:", error);
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    );
  }
}
