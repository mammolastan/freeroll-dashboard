// app/api/badges/all/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    console.log("Fetching badges...");

    // Simple query without any where conditions first
    const badges = await prisma.badge.findMany({
      orderBy: {
        rarity: "desc",
      },
    });

    console.log("Found badges:", badges.length);

    // Transform the data to match what the frontend expects
    const transformedBadges = badges.map((badge) => {
      return {
        badge_id: badge.badge_id,
        name: badge.short_description, // Use short_description as name
        short_description: badge.short_description,
        long_description: badge.long_description,
        icon: badge.icon || "default.svg",
        rarity: badge.rarity.toString(), // Convert number to string for consistency
        category: badge.category,
        tier: badge.tier,
        criteria: badge.criteria,
        quote: badge.quote,
        created_at: badge.created_at.toISOString(),
        updated_at: badge.updated_at.toISOString(),
        rarityNum: badge.rarity, // Keep numeric version for sorting
      };
    });

    return NextResponse.json(transformedBadges);
  } catch (error) {
    console.error("Error fetching all badges:", error);

    // More detailed error info
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    return NextResponse.json(
      {
        error: "Failed to fetch badges",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
