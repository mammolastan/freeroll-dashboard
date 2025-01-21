// lib/utils.ts

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { PrismaClient, Prisma } from "@prisma/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString();
};

export const calculateQuarter = (dateString: string) => {
  const date = new Date(dateString);
  return Math.floor((date.getMonth() + 3) / 3);
};

// For client-side components
export async function getClientIP() {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error("Error fetching client IP:", error);
    return null;
  }
}

// For server-side components and API routes
export async function getServerIP() {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error("Error fetching server IP:", error);
    return null;
  }
}

export function getDateCondition(
  startDate: Date | null,
  endDate: Date | null,
  tableAlias?: string
) {
  if (!startDate) {
    return Prisma.empty;
  }

  const seasonColumn = tableAlias
    ? `${tableAlias}.Season`
    : "poker_tournaments.Season";

  // Generate array of valid month-year combinations
  const validMonths: string[] = [];
  let currentDate = new Date(startDate); // Create a new Date object to avoid modifying the original
  const endDateTime = endDate ? endDate.getTime() : startDate.getTime();

  while (currentDate.getTime() <= endDateTime) {
    const month = currentDate.toLocaleString("default", {
      month: "long",
      timeZone: "UTC",
    });
    const year = currentDate.getUTCFullYear();

    // Add both single and double space versions
    validMonths.push(`${month} ${year}`);
    validMonths.push(`${month}  ${year}`);

    // Move to next month
    currentDate = new Date(
      currentDate.setUTCMonth(currentDate.getUTCMonth() + 1)
    );
  }

  // Safety check - if somehow we still got no months, fall back to a simpler date range
  if (validMonths.length === 0) {
    console.warn("No valid months generated for date range:", {
      startDate,
      endDate,
    });
    const startMonth = startDate.toLocaleString("default", {
      month: "long",
      timeZone: "UTC",
    });
    const startYear = startDate.getUTCFullYear();
    validMonths.push(
      `${startMonth} ${startYear}`,
      `${startMonth}  ${startYear}`
    );
  }

  // Create the IN clause with all valid month-year combinations
  const query = Prisma.sql`TRIM(${Prisma.raw(seasonColumn)}) IN (${Prisma.join(
    validMonths
  )})`;

  return query;
}

// Helper function to create consistent dates
export function createGameDate(
  month: number,
  day: number,
  year: number
): string {
  // Create date at 5AM UTC to ensure correct date in ET
  return new Date(Date.UTC(year, month, day, 5, 0, 0)).toISOString();
}
