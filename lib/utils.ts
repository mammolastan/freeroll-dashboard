// lib/utils.ts

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Prisma } from "@prisma/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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

// Helper function to create consistent dates
export function createGameDate(
  month: number,
  day: number,
  year: number
): string {
  // Create date at 5AM UTC to ensure correct date in ET
  return new Date(Date.UTC(year, month, day, 5, 0, 0)).toISOString();
}

// Helper function to ensure dates are in ET timezone
export function getETDate(date: Date): Date {
  return new Date(
    date.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
}

// Function to get start and end of month in ET
export function getMonthDateRange(date: Date) {
  const etDate = getETDate(date);

  // Set to beginning of month at 00:00:00.000 ET
  const startOfMonth = new Date(
    Date.UTC(
      etDate.getFullYear(),
      etDate.getMonth(),
      1,
      4, // 4 AM UTC = previous day 11 PM ET
      0,
      0,
      0
    )
  );

  // Set to end of month at 23:59:59.999 ET
  const endOfMonth = new Date(
    Date.UTC(
      etDate.getFullYear(),
      etDate.getMonth() + 1,
      0, // Last day of month
      28, // 28 (next day 4 AM UTC = 11 PM ET)
      59,
      59,
      999
    )
  );

  return { startOfMonth, endOfMonth };
}

// Function to get start and end of quarter in ET
export function getQuarterDateRange(quarter: number, year: number) {
  const startMonth = (quarter - 1) * 3;
  const startOfQuarter = new Date(year, startMonth, 1);
  const endOfQuarter = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
  return { startOfQuarter, endOfQuarter };
}

// Main date condition function
export function getDateCondition(
  startDate: Date | null,
  endDate: Date | null,
  mainTableAlias?: string
): Prisma.Sql {
  if (!startDate) {
    return Prisma.empty;
  }

  const columnref = mainTableAlias
    ? `${mainTableAlias}.game_date`
    : "game_date";

  if (endDate) {
    return Prisma.sql`${Prisma.raw(`${columnref}`)} >= DATE(${startDate}) 
      AND ${Prisma.raw(`${columnref}`)} <= DATE(${endDate})`;
  }

  return Prisma.sql`${Prisma.raw(`${columnref}`)} >= DATE(${startDate})`;
}

// Helper for getting current ET date
export function getCurrentETDate(): Date {
  return getETDate(new Date());
}

// Helper for formatting dates consistently
export function formatETDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatGameDateET(
  isoDateString: string,
  length: string = "long"
): string {
  // Parse the ISO string and adjust for ET timezone
  const date = new Date(isoDateString);
  const etDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);

  if (length == "short") {
    // Return only the time string in ET, e.g., "9:41"
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/New_York",
    }).format(etDate);
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(etDate);
}

export type DateFormatOptions = "full" | "monthYear";

// Helper function to format a date in ET timezone
export function formatGameDate(
  isoString: string,
  format: DateFormatOptions = "full"
): string {
  // Parse the ISO string and create a Date object
  // Add a 'T05:00:00Z' to ensure we're in the correct day in ET
  // This assumes games are played in ET and we want to show ET dates
  const dateString = isoString.split("T")[0] + "T05:00:00Z";
  const date = new Date(dateString);

  const options: Intl.DateTimeFormatOptions = {
    timeZone: "America/New_York",
    ...(format === "full"
      ? {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      : {
          month: "long",
          year: "numeric",
        }),
  };

  return new Intl.DateTimeFormat("en-US", options).format(date);
}

// Helper function to format a date range
export function formatDateRangeText(
  startDate: Date | null,
  endDate: Date | null,
  selectedRange: string,
  earliestGameDate: string | null,
  isCustomRange: boolean = false
): string {
  // Handle custom date range first
  if (isCustomRange && startDate && endDate) {
    return `Stats from ${formatGameDate(
      startDate.toISOString()
    )} to ${formatGameDate(endDate.toISOString())}`;
  }

  // For all-time stats
  if (selectedRange === "all-time" || !startDate) {
    if (!earliestGameDate) {
      return "No stats available";
    }
    return `Stats from ${formatGameDate(earliestGameDate)} - Current`;
  }

  // For current month
  if (selectedRange === "current-month") {
    return `Stats for ${formatGameDate(startDate.toISOString(), "monthYear")}`;
  }

  // For quarterly stats
  if (selectedRange.includes("Q")) {
    const quarterNum = parseInt(selectedRange.charAt(1));
    const year = parseInt(selectedRange.split("-")[1]);
    return `Stats for Q${quarterNum} ${year}`;
  }

  // Default case for date range
  if (endDate) {
    return `Stats from ${formatGameDate(
      startDate.toISOString()
    )} to ${formatGameDate(endDate.toISOString())}`;
  }

  return `Stats from ${formatGameDate(startDate.toISOString())}`;
}

// Helper function to format time strings to 12-hour format with AM/PM
export function formatTime(timeString?: string | any): string | null {
  if (!timeString) return null;

  try {
    // Convert to string if it's an object or buffer
    let timeStr = typeof timeString === 'string' ? timeString : String(timeString);

    // Handle different time formats
    // If it's a full timestamp, extract just the time part
    if (timeStr.includes('T')) {
      const date = new Date(timeStr);
      const hours = date.getUTCHours();
      const minutes = date.getUTCMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHour = hours % 12 || 12;
      return `${displayHour}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }

    // Standard HH:MM:SS or HH:MM format
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      const hour = parseInt(parts[0], 10);
      const minute = parseInt(parts[1], 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
    }

    return null;
  } catch (error) {
    console.error('Error formatting time:', timeString, error);
    return null;
  }
}

// In TypeScript:
// - The colon after a parameter (e.g., isoString: string) specifies the type of that parameter.
//   Example: isoString: string  // isoString must be a string
// - The colon after the parameter list (e.g., ): string) specifies the return type of the function.
//   Example: function formatGameDate(isoString: string): string { ... }
//   // This function returns a string
