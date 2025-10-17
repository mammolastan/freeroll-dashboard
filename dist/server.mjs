// server.mts
var _a;
console.log("Server.mts is running");
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { BLIND_SCHEDULES, getBlindSchedule, } from "./lib/blindLevels.mjs";
// Initialize Prisma Client
const globalForPrisma = globalThis;
const prisma = (_a = globalForPrisma.prisma) !== null && _a !== void 0 ? _a : new PrismaClient();
if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = prisma;
// Default blind structure (for backward compatibility)
const DEFAULT_BLIND_LEVELS = BLIND_SCHEDULES.standard.levels;
// Store timer states for each tournament
const timerStates = new Map();
// Timer helper functions
async function getOrCreateTimerState(tournamentId) {
    if (!timerStates.has(tournamentId)) {
        console.log(`Initializing timer state for tournament ${tournamentId}`);
        // First try to load existing timer state from database
        const existingState = await loadTimerStateFromDB(tournamentId);
        if (existingState) {
            console.log(`Loaded existing timer state from database for tournament ${tournamentId}`);
            timerStates.set(tournamentId, existingState);
            return existingState;
        }
        // No existing state found, create new timer state
        console.log(`Creating new timer state for tournament ${tournamentId}`);
        // Fetch tournament's blind schedule from database
        let blindLevels = DEFAULT_BLIND_LEVELS;
        try {
            const tournament = await prisma.tournamentDraft.findUnique({
                where: { id: tournamentId },
                select: { blind_schedule: true },
            });
            console.log(`Tournament ${tournamentId} blind_schedule:`, tournament === null || tournament === void 0 ? void 0 : tournament.blind_schedule);
            if (tournament === null || tournament === void 0 ? void 0 : tournament.blind_schedule) {
                blindLevels = getBlindSchedule(tournament.blind_schedule);
                console.log(`Using ${tournament.blind_schedule} schedule with ${blindLevels.length} levels`);
            }
            else {
                console.log(`Using default schedule with ${blindLevels.length} levels`);
            }
        }
        catch (error) {
            console.error("Error fetching tournament blind schedule:", error);
            // Fall back to default schedule
        }
        const currentLevel = 1;
        const currentBlindLevel = blindLevels[0];
        console.log(`Creating timer state: level ${currentLevel}, time ${currentBlindLevel.duration * 60}s`);
        const newTimerState = {
            tournamentId,
            currentLevel,
            timeRemaining: currentBlindLevel.duration * 60, // convert to seconds
            isRunning: false,
            isPaused: false,
            blindLevels,
            lastUpdate: Date.now(),
        };
        timerStates.set(tournamentId, newTimerState);
        // Save initial state to database
        await saveTimerStateToDB(tournamentId, newTimerState);
    }
    return timerStates.get(tournamentId);
}
async function updateTimer(tournamentId) {
    const timer = await getOrCreateTimerState(tournamentId);
    let stateChanged = false;
    if (timer.isRunning && !timer.isPaused) {
        const now = Date.now();
        const elapsed = Math.floor((now - timer.lastUpdate) / 1000);
        // Only update if at least 1 second has actually elapsed
        if (elapsed > 0) {
            const newTimeRemaining = Math.max(0, timer.timeRemaining - elapsed);
            if (newTimeRemaining !== timer.timeRemaining) {
                timer.timeRemaining = newTimeRemaining;
                stateChanged = true;
            }
            // CRITICAL FIX: Only update lastUpdate when we actually deduct time
            // This prevents drift from processing overhead
            timer.lastUpdate = timer.lastUpdate + elapsed * 1000;
            // Auto-advance to next level if time expires
            if (timer.timeRemaining === 0 &&
                timer.currentLevel < timer.blindLevels.length) {
                const currentLevel = timer.blindLevels[timer.currentLevel - 1];
                timer.currentLevel++;
                const nextLevel = timer.blindLevels[timer.currentLevel - 1];
                if (nextLevel) {
                    timer.timeRemaining = nextLevel.duration * 60;
                    // If current level is a break, pause the timer after advancing to next level
                    if (currentLevel === null || currentLevel === void 0 ? void 0 : currentLevel.isbreak) {
                        timer.isPaused = true;
                        console.log(`Break ended for tournament ${tournamentId}, pausing at level ${timer.currentLevel}`);
                    }
                }
                stateChanged = true;
            }
        }
    }
    // Save to database if significant state change occurred
    if (stateChanged) {
        await saveTimerStateToDB(tournamentId, timer);
    }
    return timer;
}
async function startTimer(tournamentId) {
    const timer = await getOrCreateTimerState(tournamentId);
    timer.isRunning = true;
    timer.isPaused = false;
    timer.lastUpdate = Date.now();
    // Save state change to database
    await saveTimerStateToDB(tournamentId, timer);
    return timer;
}
async function pauseTimer(tournamentId) {
    const timer = await updateTimer(tournamentId);
    timer.isPaused = true;
    // Save state change to database
    await saveTimerStateToDB(tournamentId, timer);
    return timer;
}
async function resumeTimer(tournamentId) {
    const timer = await getOrCreateTimerState(tournamentId);
    timer.isPaused = false;
    timer.lastUpdate = Date.now();
    // Save state change to database
    await saveTimerStateToDB(tournamentId, timer);
    return timer;
}
async function resetTimer(tournamentId) {
    const timer = await getOrCreateTimerState(tournamentId);
    // Reload blind schedule from database in case it changed
    let blindLevels = DEFAULT_BLIND_LEVELS;
    try {
        const tournament = await prisma.tournamentDraft.findUnique({
            where: { id: tournamentId },
            select: { blind_schedule: true },
        });
        if (tournament === null || tournament === void 0 ? void 0 : tournament.blind_schedule) {
            blindLevels = getBlindSchedule(tournament.blind_schedule);
            console.log(`Reset timer: using ${tournament.blind_schedule} schedule with ${blindLevels.length} levels`);
        }
    }
    catch (error) {
        console.error("Error fetching tournament blind schedule during reset:", error);
    }
    timer.blindLevels = blindLevels;
    timer.currentLevel = 1;
    timer.timeRemaining = timer.blindLevels[0].duration * 60;
    timer.isRunning = false;
    timer.isPaused = false;
    timer.lastUpdate = Date.now();
    // Save state change to database
    await saveTimerStateToDB(tournamentId, timer);
    return timer;
}
// Server startup recovery function
async function recoverActiveTimers() {
    try {
        console.log("Recovering active timers from database...");
        // Find all tournaments with active timer states
        const activeTimers = await prisma.tournamentDraft.findMany({
            where: {
                OR: [{ timer_is_running: true }, { timer_is_paused: true }],
            },
            select: {
                id: true,
                timer_current_level: true,
                timer_remaining_seconds: true,
                timer_is_running: true,
                timer_is_paused: true,
                timer_last_updated: true,
                blind_schedule: true,
            },
        });
        console.log(`Found ${activeTimers.length} active timers to recover`);
        for (const tournament of activeTimers) {
            try {
                // Load the timer state using our existing function
                const recoveredTimer = await loadTimerStateFromDB(tournament.id);
                if (recoveredTimer) {
                    timerStates.set(tournament.id, recoveredTimer);
                    console.log(`Recovered timer for tournament ${tournament.id}: level ${recoveredTimer.currentLevel}, time ${recoveredTimer.timeRemaining}s, running: ${recoveredTimer.isRunning}, paused: ${recoveredTimer.isPaused}`);
                }
            }
            catch (error) {
                console.error(`Failed to recover timer for tournament ${tournament.id}:`, error);
            }
        }
        console.log("Timer recovery completed");
    }
    catch (error) {
        console.error("Error during timer recovery:", error);
    }
}
// Database persistence functions
async function saveTimerStateToDB(tournamentId, timerState) {
    try {
        await prisma.tournamentDraft.update({
            where: { id: tournamentId },
            data: {
                timer_current_level: timerState.currentLevel,
                timer_remaining_seconds: timerState.timeRemaining,
                timer_is_running: timerState.isRunning,
                timer_is_paused: timerState.isPaused,
                timer_last_updated: new Date(),
            },
        });
        console.log(`Timer state saved to DB for tournament ${tournamentId}`);
    }
    catch (error) {
        console.error("Error saving timer state to database:", error);
    }
}
async function loadTimerStateFromDB(tournamentId) {
    try {
        const tournament = await prisma.tournamentDraft.findUnique({
            where: { id: tournamentId },
            select: {
                blind_schedule: true,
                timer_current_level: true,
                timer_remaining_seconds: true,
                timer_is_running: true,
                timer_is_paused: true,
                timer_last_updated: true,
            },
        });
        if (!tournament)
            return null;
        // Only load timer state if the timer is actually active (running or paused)
        // If both are false, the timer is stopped and should not be recovered
        if (!tournament.timer_is_running && !tournament.timer_is_paused) {
            console.log(`Timer for tournament ${tournamentId} is stopped, not loading state`);
            return null;
        }
        // If timer data exists and was recently updated
        if (tournament.timer_last_updated && tournament.timer_current_level) {
            console.log(`Loading timer state from DB for tournament ${tournamentId}`);
            let adjustedTimeRemaining = tournament.timer_remaining_seconds || 0;
            // If timer was running, calculate elapsed time since last update
            if (tournament.timer_is_running && !tournament.timer_is_paused) {
                const now = new Date();
                const elapsedSeconds = Math.floor((now.getTime() - tournament.timer_last_updated.getTime()) / 1000);
                adjustedTimeRemaining = Math.max(0, adjustedTimeRemaining - elapsedSeconds);
                console.log(`Timer was running, adjusted time: ${adjustedTimeRemaining}s (elapsed: ${elapsedSeconds}s)`);
            }
            // Get blind levels for the schedule
            const blindLevels = getBlindSchedule(tournament.blind_schedule || "standard");
            return {
                tournamentId,
                currentLevel: tournament.timer_current_level,
                timeRemaining: adjustedTimeRemaining,
                isRunning: tournament.timer_is_running || false,
                isPaused: tournament.timer_is_paused || false,
                blindLevels,
                lastUpdate: Date.now(),
            };
        }
        return null;
    }
    catch (error) {
        console.error("Error loading timer state from database:", error);
        return null;
    }
}
async function getTournamentData(tournamentDraftId) {
    try {
        const tournament = await prisma.$queryRaw `
      SELECT
        id,
        tournament_date,
        director_name,
        venue,
        status
      FROM tournament_drafts
      WHERE id = ${tournamentDraftId}
      LIMIT 1
    `;
        if (tournament.length === 0)
            return null;
        const data = tournament[0];
        return {
            id: data.id,
            title: data.venue,
            date: data.tournament_date,
            venue: data.venue,
            status: data.status,
            max_players: null,
        };
    }
    catch (error) {
        console.error("Error fetching tournament data:", error);
        return null;
    }
}
async function getCheckedInPlayers(tournamentDraftId) {
    try {
        const players = await prisma.$queryRaw `
      SELECT
        tdp.*,
        COALESCE(tdp.player_nickname, p.nickname) as resolved_nickname
      FROM tournament_draft_players tdp
      LEFT JOIN players p ON tdp.player_uid = p.UID
      WHERE tdp.tournament_draft_id = ${tournamentDraftId}
      ORDER BY tdp.created_at ASC
    `;
        return players.map((p) => ({
            id: p.id,
            name: p.player_name,
            nickname: p.resolved_nickname,
            uid: p.player_uid,
            is_new_player: p.is_new_player,
            checked_in_at: p.checked_in_at,
            created_at: p.created_at,
            is_active: p.ko_position === null, // Active if no ko_position
            eliminated_at: null,
            eliminated_by_player_id: null,
            elimination_position: p.ko_position,
            placement: p.placement,
            hitman: p.hitman_name
                ? {
                    id: null,
                    name: p.hitman_name,
                    nickname: null,
                }
                : undefined,
        }));
    }
    catch (error) {
        console.error("Error fetching checked-in players:", error);
        return [];
    }
}
const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
app.prepare().then(async () => {
    try {
        const httpServer = createServer(handle);
        const io = new Server(httpServer);
        // Make Socket.IO instance available globally for API routes
        global.socketIoInstance = io;
        // Recover active timers from database on startup
        await recoverActiveTimers();
        // Timer update interval - broadcast timer updates every second
        setInterval(async () => {
            for (const [tournamentId, timer] of Array.from(timerStates.entries())) {
                if (timer.isRunning && !timer.isPaused) {
                    const updatedTimer = await updateTimer(tournamentId);
                    // Validate timer state before sending
                    if (updatedTimer &&
                        typeof updatedTimer.timeRemaining === "number" &&
                        updatedTimer.blindLevels) {
                        // Explicitly create serializable object with tournamentId
                        const timerPayload = {
                            tournamentId: updatedTimer.tournamentId,
                            currentLevel: updatedTimer.currentLevel,
                            timeRemaining: updatedTimer.timeRemaining,
                            isRunning: updatedTimer.isRunning,
                            isPaused: updatedTimer.isPaused,
                            blindLevels: updatedTimer.blindLevels,
                            lastUpdate: updatedTimer.lastUpdate,
                        };
                        io.to(tournamentId.toString()).emit("timer:update", timerPayload);
                    }
                    else {
                        console.error(`Invalid timer update for tournament ${tournamentId}:`, updatedTimer);
                    }
                }
            }
        }, 1000);
        // Periodic database sync - save all timer states every 30 seconds
        setInterval(async () => {
            for (const [tournamentId, timer] of Array.from(timerStates.entries())) {
                try {
                    await saveTimerStateToDB(tournamentId, timer);
                    console.log(`Periodic sync completed for tournament ${tournamentId}`);
                }
                catch (error) {
                    console.error(`Periodic sync failed for tournament ${tournamentId}:`, error);
                }
            }
        }, 30000); // 30 seconds
        io.on("connection", (socket) => {
            console.log(`User connected: ${socket.id}`);
            socket.on("joinRoom", async (room) => {
                console.log(`[JOIN_ROOM] Socket ${socket.id} attempting to join room: ${room}`);
                try {
                    socket.join(room);
                    console.log(`Socket ${socket.id} joined room: ${room}`);
                    // Fetch tournament and player data
                    const tournamentDraftId = parseInt(room);
                    if (!isNaN(tournamentDraftId)) {
                        const [tournament, players] = await Promise.all([
                            getTournamentData(tournamentDraftId),
                            getCheckedInPlayers(tournamentDraftId),
                        ]);
                        console.log("Tournament:", JSON.stringify(tournament, null, 2));
                        console.log("Players:", JSON.stringify(players, null, 2));
                        // Send both tournament and player data
                        socket.emit("updatePlayers", players);
                        if (tournament) {
                            socket.emit("tournament:updated", { data: { tournament } });
                        }
                        // Send current timer state
                        const timerState = await updateTimer(tournamentDraftId);
                        // Validate timer state before sending
                        if (timerState &&
                            typeof timerState.timeRemaining === "number" &&
                            timerState.blindLevels) {
                            const timerPayload = {
                                tournamentId: timerState.tournamentId,
                                currentLevel: timerState.currentLevel,
                                timeRemaining: timerState.timeRemaining,
                                isRunning: timerState.isRunning,
                                isPaused: timerState.isPaused,
                                blindLevels: timerState.blindLevels,
                                lastUpdate: timerState.lastUpdate,
                            };
                            socket.emit("timer:sync", timerPayload);
                        }
                        else {
                            console.error(`Invalid timer sync state for tournament ${tournamentDraftId}:`, timerState);
                        }
                    }
                }
                catch (err) {
                    console.error("Failed to fetch tournament/player data:", err);
                }
            });
            socket.on("playerJoined", async ({ tournamentDraftId, newPlayer }) => {
                try {
                    console.log(`Player joined tournament ${tournamentDraftId}:`, newPlayer);
                    // Fetch updated players list
                    const players = await getCheckedInPlayers(tournamentDraftId);
                    // Broadcast to all clients in this room
                    io.to(tournamentDraftId.toString()).emit("updatePlayers", players);
                }
                catch (err) {
                    console.error("Failed to handle playerJoined event:", err);
                }
            });
            socket.on("message", ({ room, message, sender }) => {
                socket.to(room).emit("message", { sender, message });
            });
            // Timer event handlers
            socket.on("timer:start", async ({ tournamentId }) => {
                console.log(`Timer start requested for tournament ${tournamentId}`);
                const timerState = await startTimer(tournamentId);
                console.log(`Emitting timer update:`, {
                    level: timerState.currentLevel,
                    time: timerState.timeRemaining,
                    isRunning: timerState.isRunning,
                });
                // Validate timer state before sending
                if (timerState &&
                    typeof timerState.timeRemaining === "number" &&
                    timerState.blindLevels) {
                    const timerPayload = {
                        tournamentId: timerState.tournamentId,
                        currentLevel: timerState.currentLevel,
                        timeRemaining: timerState.timeRemaining,
                        isRunning: timerState.isRunning,
                        isPaused: timerState.isPaused,
                        blindLevels: timerState.blindLevels,
                        lastUpdate: timerState.lastUpdate,
                    };
                    io.to(tournamentId.toString()).emit("timer:update", timerPayload);
                    console.log(`Timer started for tournament ${tournamentId}`);
                }
                else {
                    console.error(`Invalid timer state for tournament ${tournamentId}:`, timerState);
                }
            });
            socket.on("timer:pause", async ({ tournamentId }) => {
                const timerState = await pauseTimer(tournamentId);
                const timerPayload = {
                    tournamentId: timerState.tournamentId,
                    currentLevel: timerState.currentLevel,
                    timeRemaining: timerState.timeRemaining,
                    isRunning: timerState.isRunning,
                    isPaused: timerState.isPaused,
                    blindLevels: timerState.blindLevels,
                    lastUpdate: timerState.lastUpdate,
                };
                io.to(tournamentId.toString()).emit("timer:update", timerPayload);
                console.log(`Timer paused for tournament ${tournamentId}`);
            });
            socket.on("timer:resume", async ({ tournamentId }) => {
                const timerState = await resumeTimer(tournamentId);
                const timerPayload = {
                    tournamentId: timerState.tournamentId,
                    currentLevel: timerState.currentLevel,
                    timeRemaining: timerState.timeRemaining,
                    isRunning: timerState.isRunning,
                    isPaused: timerState.isPaused,
                    blindLevels: timerState.blindLevels,
                    lastUpdate: timerState.lastUpdate,
                };
                io.to(tournamentId.toString()).emit("timer:update", timerPayload);
                console.log(`Timer resumed for tournament ${tournamentId}`);
            });
            socket.on("timer:reset", async ({ tournamentId }) => {
                const timerState = await resetTimer(tournamentId);
                const timerPayload = {
                    tournamentId: timerState.tournamentId,
                    currentLevel: timerState.currentLevel,
                    timeRemaining: timerState.timeRemaining,
                    isRunning: timerState.isRunning,
                    isPaused: timerState.isPaused,
                    blindLevels: timerState.blindLevels,
                    lastUpdate: timerState.lastUpdate,
                };
                io.to(tournamentId.toString()).emit("timer:update", timerPayload);
                console.log(`Timer reset for tournament ${tournamentId}`);
            });
            socket.on("timer:requestSync", async ({ tournamentId }) => {
                console.log(`Timer sync requested for tournament ${tournamentId}`);
                const timerState = await getOrCreateTimerState(tournamentId);
                console.log(`Sending timer sync:`, {
                    level: timerState.currentLevel,
                    time: timerState.timeRemaining,
                });
                // Validate timer state before sending
                if (timerState &&
                    typeof timerState.timeRemaining === "number" &&
                    timerState.blindLevels) {
                    const timerPayload = {
                        tournamentId: timerState.tournamentId,
                        currentLevel: timerState.currentLevel,
                        timeRemaining: timerState.timeRemaining,
                        isRunning: timerState.isRunning,
                        isPaused: timerState.isPaused,
                        blindLevels: timerState.blindLevels,
                        lastUpdate: timerState.lastUpdate,
                    };
                    socket.emit("timer:sync", timerPayload);
                }
                else {
                    console.error(`Invalid timer sync state for tournament ${tournamentId}:`, timerState);
                }
            });
            socket.on("timer:nextLevel", async ({ tournamentId }) => {
                const timer = await getOrCreateTimerState(tournamentId);
                if (timer.currentLevel < timer.blindLevels.length) {
                    timer.currentLevel++;
                    const nextLevel = timer.blindLevels[timer.currentLevel - 1];
                    if (nextLevel) {
                        timer.timeRemaining = nextLevel.duration * 60;
                    }
                    timer.lastUpdate = Date.now();
                    // Save state change to database
                    await saveTimerStateToDB(tournamentId, timer);
                    const timerPayload = {
                        tournamentId: timer.tournamentId,
                        currentLevel: timer.currentLevel,
                        timeRemaining: timer.timeRemaining,
                        isRunning: timer.isRunning,
                        isPaused: timer.isPaused,
                        blindLevels: timer.blindLevels,
                        lastUpdate: timer.lastUpdate,
                    };
                    io.to(tournamentId.toString()).emit("timer:update", timerPayload);
                    console.log(`Timer advanced to level ${timer.currentLevel} for tournament ${tournamentId}`);
                }
            });
            socket.on("timer:prevLevel", async ({ tournamentId }) => {
                const timer = await getOrCreateTimerState(tournamentId);
                if (timer.currentLevel > 1) {
                    timer.currentLevel--;
                    const prevLevel = timer.blindLevels[timer.currentLevel - 1];
                    if (prevLevel) {
                        timer.timeRemaining = prevLevel.duration * 60;
                    }
                    timer.lastUpdate = Date.now();
                    // Save state change to database
                    await saveTimerStateToDB(tournamentId, timer);
                    const timerPayload = {
                        tournamentId: timer.tournamentId,
                        currentLevel: timer.currentLevel,
                        timeRemaining: timer.timeRemaining,
                        isRunning: timer.isRunning,
                        isPaused: timer.isPaused,
                        blindLevels: timer.blindLevels,
                        lastUpdate: timer.lastUpdate,
                    };
                    io.to(tournamentId.toString()).emit("timer:update", timerPayload);
                    console.log(`Timer moved back to level ${timer.currentLevel} for tournament ${tournamentId}`);
                }
            });
            socket.on("timer:setTime", async ({ tournamentId, timeInSeconds }) => {
                const timer = await getOrCreateTimerState(tournamentId);
                timer.timeRemaining = Math.max(0, timeInSeconds);
                timer.lastUpdate = Date.now();
                // Save state change to database
                await saveTimerStateToDB(tournamentId, timer);
                const timerPayload = {
                    tournamentId: timer.tournamentId,
                    currentLevel: timer.currentLevel,
                    timeRemaining: timer.timeRemaining,
                    isRunning: timer.isRunning,
                    isPaused: timer.isPaused,
                    blindLevels: timer.blindLevels,
                    lastUpdate: timer.lastUpdate,
                };
                io.to(tournamentId.toString()).emit("timer:update", timerPayload);
                console.log(`Timer set to ${timeInSeconds} seconds for tournament ${tournamentId}`);
            });
            socket.on("timer:setSchedule", async ({ tournamentId, scheduleId }) => {
                if (!timerStates.has(tournamentId)) {
                    return; // Timer not initialized yet
                }
                const timer = timerStates.get(tournamentId);
                // Only allow schedule changes when timer is stopped
                if (timer.isRunning && !timer.isPaused) {
                    socket.emit("timer:error", {
                        message: "Cannot change schedule while timer is running",
                    });
                    return;
                }
                try {
                    // Update the timer with new blind levels
                    const newBlindLevels = getBlindSchedule(scheduleId);
                    timer.blindLevels = newBlindLevels;
                    timer.currentLevel = 1;
                    timer.timeRemaining = newBlindLevels[0].duration * 60;
                    timer.lastUpdate = Date.now();
                    const timerPayload = {
                        tournamentId: timer.tournamentId,
                        currentLevel: timer.currentLevel,
                        timeRemaining: timer.timeRemaining,
                        isRunning: timer.isRunning,
                        isPaused: timer.isPaused,
                        blindLevels: timer.blindLevels,
                        lastUpdate: timer.lastUpdate,
                    };
                    io.to(tournamentId.toString()).emit("timer:update", timerPayload);
                    console.log(`Timer schedule changed to ${scheduleId} for tournament ${tournamentId}`);
                }
                catch (error) {
                    console.error("Error changing timer schedule:", error);
                    socket.emit("timer:error", { message: "Failed to change schedule" });
                }
            });
            socket.on("disconnect", () => {
                console.log(`User disconnected: ${socket.id}`);
            });
        });
        httpServer.listen(port, () => {
            console.log(`Server listening at http://${hostname}:${port}`);
        });
    }
    catch (err) {
        console.error("Top-level server error:", err);
    }
});
