// app/rankings/monthly/page.tsx

import React from "react";
import MonthlyRankings from "@/components/Rankings/MonthlyRankings";

export const metadata = {
  title: "Monthly Rankings",
};

export default function MonthlyRankingsPage() {
  return (
    <>
      <MonthlyRankings />
    </>
  );
}
