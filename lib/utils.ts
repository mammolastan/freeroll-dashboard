// lib/utils.ts

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Prisma } from "@prisma/client";
import {
  getLeagueNow,
  formatLeagueDate,
  getLeagueMonthRange,
  getLeagueQuarterRange,
} from '@/lib/league-time';

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

/** @deprecated Use getLeagueMonthRange(timezone) from lib/league-time */
export function getMonthDateRange(date: Date) {
  const { startOfMonth, endOfMonth } = getLeagueMonthRange('America/New_York', date);
  return { startOfMonth, endOfMonth };
}

/** @deprecated Use getLeagueQuarterRange(timezone, quarter, year) from lib/league-time */
export function getQuarterDateRange(quarter: number, year: number) {
  const { startOfQuarter, endOfQuarter } = getLeagueQuarterRange('America/New_York', quarter, year);
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

/** @deprecated Use getLeagueNow(timezone) from lib/league-time */
export function getCurrentETDate(): Date {
  return getLeagueNow('America/New_York');
}

/** @deprecated Use formatLeagueDate(iso, timezone) from lib/league-time */
export function formatETDate(date: Date): string {
  return formatLeagueDate(date.toISOString(), 'America/New_York', 'full');
}

/** @deprecated Use formatLeagueDate(iso, timezone, 'short'|'full') from lib/league-time */
export function formatGameDateET(
  isoDateString: string,
  length: string = "long"
): string {
  return formatLeagueDate(isoDateString, 'America/New_York', length === 'short' ? 'short' : 'full');
}

export type DateFormatOptions = "full" | "monthYear";

/** @deprecated Use formatLeagueDate(iso, timezone, format) from lib/league-time */
export function formatGameDate(
  isoString: string,
  format: DateFormatOptions = "full"
): string {
  return formatLeagueDate(isoString, 'America/New_York', format);
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
export function formatTime(timeString?: string | null | unknown): string | null {
  if (!timeString) return null;

  try {
    // Convert to string if it's an object or buffer
    const timeStr = typeof timeString === 'string' ? timeString : String(timeString);

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

export function formatCutoffTime(timeString?: string | null | unknown): string | null {
  if (!timeString) return null;

  try {
    const timeStr = typeof timeString === 'string' ? timeString : String(timeString);

    let hours: number;
    let minutes: number;

    if (timeStr.includes('T')) {
      const date = new Date(timeStr);
      hours = date.getUTCHours();
      minutes = date.getUTCMinutes();
    } else {
      const parts = timeStr.split(':');
      if (parts.length < 2) return null;
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10);
    }

    // Add 100 minutes
    const totalMinutes = hours * 60 + minutes + 100;
    const cutoffHours = Math.floor(totalMinutes / 60) % 24;
    const cutoffMinutes = totalMinutes % 60;

    const ampm = cutoffHours >= 12 ? 'PM' : 'AM';
    const displayHour = cutoffHours % 12 || 12;
    return `${displayHour}:${cutoffMinutes.toString().padStart(2, '0')} ${ampm}`;
  } catch (error) {
    console.error('Error calculating cutoff time:', timeString, error);
    return null;
  }
}

// In TypeScript:
// - The colon after a parameter (e.g., isoString: string) specifies the type of that parameter.
//   Example: isoString: string  // isoString must be a string
// - The colon after the parameter list (e.g., ): string) specifies the return type of the function.
//   Example: function formatGameDate(isoString: string): string { ... }
//   // This function returns a string
