// app/api/socket-trigger/route.ts
import { NextRequest, NextResponse } from "next/server";

// This is a simple way to trigger Socket.IO events from API routes
// by making HTTP requests that the server can handle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, data } = body;
    
    if (event === 'playerJoined') {
      // This is a marker for the Socket.IO server to pick up
      console.log(`[SOCKET-TRIGGER] ${event}:`, data);
      
      // The actual Socket.IO emission will happen in the main server
      // This is just a trigger mechanism
      
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: 'Unknown event' }, { status: 400 });
  } catch (error) {
    console.error("Error in socket-trigger:", error);
    return NextResponse.json(
      { error: "Failed to trigger socket event" },
      { status: 500 }
    );
  }
}