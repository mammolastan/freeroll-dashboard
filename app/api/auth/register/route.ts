import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { getDisplayName, parseName } from "@/lib/playerUtils";

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, existingPlayerUid } = await request.json();

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already registered
    const existingUser = await prisma.players_v2.findFirst({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    let player;

    if (existingPlayerUid) {
      // Claiming an existing player record
      const existingPlayer = await prisma.players_v2.findUnique({
        where: { uid: existingPlayerUid },
      });

      if (!existingPlayer) {
        return NextResponse.json(
          { error: "Player not found" },
          { status: 404 }
        );
      }

      if (existingPlayer.email) {
        return NextResponse.json(
          { error: "This player already has an account" },
          { status: 409 }
        );
      }

      // Update existing player with auth info
      player = await prisma.players_v2.update({
        where: { uid: existingPlayerUid },
        data: {
          email: normalizedEmail,
          password_hash,
        },
      });
    } else {
      // Creating a brand new player
      if (!name || name.trim().length < 2) {
        return NextResponse.json(
          { error: "Name is required for new players" },
          { status: 400 }
        );
      }

      const { first_name, last_name } = parseName(name);

      player = await prisma.players_v2.create({
        data: {
          uid: uuidv4(),
          first_name,
          last_name,
          email: normalizedEmail,
          password_hash,
        },
      });
    }

    return NextResponse.json({
      success: true,
      player: {
        uid: player.uid,
        name: getDisplayName(player),
        email: player.email,
        nickname: player.nickname,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
