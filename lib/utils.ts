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
// Helper function to create the date filtering condition
export function getDateCondition(
  startDate: Date | null,
  endDate: Date | null,
  tableAlias?: string
) {
  if (!startDate) {
    return Prisma.empty; // This is a special Prisma SQL template that resolves to an empty string
  }

  const seasonColumn = tableAlias
    ? `${tableAlias}.Season`
    : "poker_tournaments.Season";

  // Adjust month to account for 0-based indexing
  const adjustedStartMonth = startDate.getMonth() + 1;
  const adjustedEndMonth = endDate ? endDate.getMonth() + 1 : null;

  // Special handling for current month
  if (
    endDate &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getFullYear() === endDate.getFullYear()
  ) {
    const month = startDate.toLocaleString("default", {
      month: "long",
      timeZone: "UTC",
    });
    const year = startDate.getUTCFullYear();

    return Prisma.sql`
  TRIM(${Prisma.raw(
    seasonColumn
  )}) IN (${`${month} ${year}`}, ${`${month}  ${year}`})
`;
  }

  // Create a standardized version of the date string for comparison
  const dateExpr = Prisma.sql`STR_TO_DATE(
    CONCAT(
      SUBSTRING_INDEX(REPLACE(REPLACE(${Prisma.raw(
        seasonColumn
      )}, '  ', ' '), '   ', ' '), ' ', 1),
      ' ',
      SUBSTRING_INDEX(REPLACE(REPLACE(${Prisma.raw(
        seasonColumn
      )}, '  ', ' '), '   ', ' '), ' ', -1)
    ),
    '%M %Y'
  )`;

  if (endDate) {
    return Prisma.sql`${dateExpr} >= ${startDate} AND ${dateExpr} <= ${endDate}`;
  }

  return Prisma.sql`${dateExpr} >= ${startDate}`;
}
