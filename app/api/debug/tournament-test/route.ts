// app/api/debug/tournament-test/route.ts
// Create this temporary route to test database connectivity

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    console.log("Testing database connection...");

    // Test 1: Check if tables exist
    const tables = await prisma.$queryRaw`
      SHOW TABLES LIKE 'tournament_drafts'
    `;
    console.log("Tables found:", tables);

    // Test 2: Try to insert a simple record
    const testInsert = await prisma.$executeRaw`
      INSERT INTO tournament_drafts 
      (tournament_name, tournament_date, director_name, venue, start_points, created_by, status)
      VALUES ('Debug Test', '2024-01-01', 'Debug', 'Debug Venue', 3, 'admin', 'in_progress')
    `;
    console.log("Insert result:", testInsert);

    // Test 3: Try to select the record
    const testSelect = await prisma.$queryRaw`
      SELECT * FROM tournament_drafts WHERE tournament_name = 'Debug Test'
    `;
    console.log("Select result:", testSelect);

    // Test 4: Clean up
    await prisma.$executeRaw`
      DELETE FROM tournament_drafts WHERE tournament_name = 'Debug Test'
    `;

    return NextResponse.json({
      success: true,
      message: "Database connection and basic operations working",
      tablesFound: (tables as any[]).length > 0,
      insertWorked: testInsert > 0,
      selectWorked: (testSelect as any[]).length > 0,
    });
  } catch (error) {
    console.error("Database test error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("Received POST data:", body);

    // Test the same insert that's failing in the main route
    const result = await prisma.$executeRaw`
      INSERT INTO tournament_drafts 
      (tournament_name, tournament_date, director_name, venue, start_points, created_by, status)
      VALUES (${body.tournament_name || "Test"}, ${body.tournament_date}, ${
      body.director_name || "Test"
    }, ${body.venue}, ${body.start_points || 0}, 'admin', 'in_progress')
    `;

    const newRecord = await prisma.$queryRaw`
      SELECT * FROM tournament_drafts WHERE id = LAST_INSERT_ID()
    `;

    // Clean up
    await prisma.$executeRaw`
      DELETE FROM tournament_drafts WHERE id = LAST_INSERT_ID()
    `;

    return NextResponse.json({
      success: true,
      insertResult: result,
      recordCreated: newRecord,
    });
  } catch (error) {
    console.error("POST test error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
