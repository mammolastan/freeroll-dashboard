// app/api/auth/reset-password/route.ts

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Find all non-expired, unused reset tokens
    const resetTokens = await prisma.passwordReset.findMany({
      where: {
        expires_at: { gt: new Date() },
        used_at: null,
      },
      include: {
        player: true,
      },
    });

    // Find the matching token by comparing hashes
    let matchedReset = null;
    for (const reset of resetTokens) {
      const isMatch = await bcrypt.compare(token, reset.token_hash);
      if (isMatch) {
        matchedReset = reset;
        break;
      }
    }

    if (!matchedReset) {
      return NextResponse.json(
        { error: "Invalid or expired reset link. Please request a new one." },
        { status: 400 }
      );
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update password and mark token as used
    await prisma.$transaction([
      prisma.player.update({
        where: { uid: matchedReset.player_uid },
        data: { password_hash: passwordHash },
      }),
      prisma.passwordReset.update({
        where: { id: matchedReset.id },
        data: { used_at: new Date() },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
