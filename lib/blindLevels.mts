interface BlindLevel {
  level: number;
  duration: number; // in minutes
  smallBlind: number;
  bigBlind: number;
  ante?: number;
  isbreak?: boolean;
}

interface BlindSchedule {
  id: string;
  name: string;
  description: string;
  levels: BlindLevel[];
}

// Standard Speed - 20 minute levels
const STANDARD_SPEED_LEVELS: BlindLevel[] = [
  { level: 1, duration: 20, smallBlind: 100, bigBlind: 200, isbreak: false },
  { level: 2, duration: 20, smallBlind: 200, bigBlind: 400, isbreak: false },
  { level: 3, duration: 20, smallBlind: 300, bigBlind: 600, isbreak: false },
  { level: 4, duration: 20, smallBlind: 400, bigBlind: 800, isbreak: false },
  { level: 5, duration: 20, smallBlind: 500, bigBlind: 1000, isbreak: false },
  { level: 6, duration: 15, smallBlind: 0, bigBlind: 0, isbreak: true }, // 10 minute break
  { level: 7, duration: 20, smallBlind: 1000, bigBlind: 2000, isbreak: false },
  { level: 8, duration: 20, smallBlind: 2000, bigBlind: 4000, isbreak: false },
  { level: 9, duration: 20, smallBlind: 3000, bigBlind: 6000, isbreak: false },
  { level: 10, duration: 20, smallBlind: 4000, bigBlind: 8000, isbreak: false },
  { level: 11, duration: 5, smallBlind: 0, bigBlind: 0, isbreak: true }, // 5 minute break (color up 1,000s)
  {
    level: 12,
    duration: 20,
    smallBlind: 5000,
    bigBlind: 10000,
    isbreak: false,
  },
  {
    level: 13,
    duration: 20,
    smallBlind: 10000,
    bigBlind: 20000,
    isbreak: false,
  },
  {
    level: 14,
    duration: 20,
    smallBlind: 15000,
    bigBlind: 30000,
    isbreak: false,
  },
  {
    level: 15,
    duration: 20,
    smallBlind: 20000,
    bigBlind: 40000,
    isbreak: false,
  },
  {
    level: 16,
    duration: 20,
    smallBlind: 25000,
    bigBlind: 50000,
    isbreak: false,
  },
  {
    level: 17,
    duration: 20,
    smallBlind: 50000,
    bigBlind: 100000,
    isbreak: false,
  },
];

// Turbo Speed - 10 minute levels (same blind structure)
const TURBO_SPEED_LEVELS: BlindLevel[] = STANDARD_SPEED_LEVELS.map((level) => ({
  ...level,
  duration: level.isbreak ? level.duration : 15,
}));

// Blind schedule definitions
const BLIND_SCHEDULES: Record<string, BlindSchedule> = {
  standard: {
    id: "standard",
    name: "Standard Speed",
    description: "20-minute levels",
    levels: STANDARD_SPEED_LEVELS,
  },
  turbo: {
    id: "turbo",
    name: "Turbo Speed",
    description: "10-minute levels",
    levels: TURBO_SPEED_LEVELS,
  },
};

// Helper function to get blind schedule
function getBlindSchedule(scheduleId: string): BlindLevel[] {
  const schedule = BLIND_SCHEDULES[scheduleId];
  return schedule ? schedule.levels : BLIND_SCHEDULES.standard.levels;
}

export type { BlindLevel, BlindSchedule };
export { BLIND_SCHEDULES, getBlindSchedule };
