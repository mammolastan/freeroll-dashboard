// app/api/auth/forgot-password/route.ts

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find player by email
    const player = await prisma.player.findFirst({
      where: { email: normalizedEmail },
    });

    // Always return success to prevent email enumeration
    // But only send email if user exists
    if (player) {
      // Generate a secure random token
      const resetToken = crypto.randomBytes(32).toString("hex");

      // Hash the token for storage (don't store plain token in DB)
      const tokenHash = await bcrypt.hash(resetToken, 10);

      // Set expiration to 1 hour from now
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      // Delete any existing reset tokens for this user
      await prisma.passwordReset.deleteMany({
        where: { player_uid: player.uid },
      });

      // Create new reset token
      await prisma.passwordReset.create({
        data: {
          player_uid: player.uid,
          token_hash: tokenHash,
          expires_at: expiresAt,
        },
      });

      // Send the email with the plain token (user will use this)
      try {
        await sendPasswordResetEmail(normalizedEmail, resetToken);
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
        // Don't reveal email sending failure to prevent enumeration
      }
    }

    // Always return success message
    return NextResponse.json({
      message:
        "If an account exists with that email, you will receive a password reset link.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
