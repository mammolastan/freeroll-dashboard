import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

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
