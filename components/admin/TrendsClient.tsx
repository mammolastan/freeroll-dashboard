"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface PlayersByMonthRow {
  month: string;
  avgPlayers: number;
  totalGames: number;
}

interface VenuesByMonthRow {
  month: string;
  venue_name: string;
  avg_players: number;
}

interface NewPlayersByMonthRow {
  month: string;
  new_players: number;
}

interface DaysByMonthRow {
  month: string;
  day_name: string;
  avg_players: number;
}

interface NewPlayersByVenueRow {
  venue_name: string;
  new_player_count: number;
}

interface TrendsClientProps {
  playersByMonth: PlayersByMonthRow[];
  venuesByMonth: VenuesByMonthRow[];
  newPlayersByMonth: NewPlayersByMonthRow[];
  daysByMonth: DaysByMonthRow[];
  newPlayersByVenue: NewPlayersByVenueRow[];
}

const VENUE_COLORS = [
  "#06b6d4",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ef4444",
  "#ec4899",
  "#3b82f6",
  "#84cc16",
];

const DAY_COLORS: Record<string, string> = {
  Sunday: "#ef4444",
  Monday: "#f59e0b",
  Tuesday: "#10b981",
  Wednesday: "#06b6d4",
  Thursday: "#8b5cf6",
  Friday: "#ec4899",
  Saturday: "#3b82f6",
};

const DAY_ORDER = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatMonth(m: string) {
  const [y, mo] = m.split("-");
  const d = new Date(Number(y), Number(mo) - 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export default function TrendsClient({
  playersByMonth,
  venuesByMonth,
  newPlayersByMonth,
  daysByMonth,
  newPlayersByVenue,
}: TrendsClientProps) {
  const [selectedVenues, setSelectedVenues] = useState<Set<string>>(new Set());
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());

  // Pivot venue data: one object per month with { month, [venueName]: avg_players, ... }
  const venueList = [...new Set(venuesByMonth.map((r) => r.venue_name))];
  const venueDataMap = new Map<string, Record<string, number | string>>();

  for (const row of venuesByMonth) {
    const existing = venueDataMap.get(row.month) ?? { month: row.month };
    existing[row.venue_name] = row.avg_players;
    venueDataMap.set(row.month, existing);
  }
  const venueChartData = Array.from(venueDataMap.values());

  // Pivot day data: one object per month with { month, [dayName]: avg_players, ... }
  const dayList = DAY_ORDER.filter((d) => daysByMonth.some((r) => r.day_name === d));
  const dayDataMap = new Map<string, Record<string, number | string>>();

  for (const row of daysByMonth) {
    const existing = dayDataMap.get(row.month) ?? { month: row.month };
    existing[row.day_name] = row.avg_players;
    dayDataMap.set(row.month, existing);
  }
  const dayChartData = Array.from(dayDataMap.values());

  const showingAllVenues = selectedVenues.size === 0;
  const showingAllDays = selectedDays.size === 0;

  const handleVenueClick = (venue: string) => {
    if (showingAllVenues) {
      setSelectedVenues(new Set([venue]));
    } else if (selectedVenues.has(venue)) {
      const next = new Set(selectedVenues);
      next.delete(venue);
      setSelectedVenues(next);
    } else {
      setSelectedVenues(new Set(selectedVenues).add(venue));
    }
  };

  const handleDayClick = (day: string) => {
    if (showingAllDays) {
      setSelectedDays(new Set([day]));
    } else if (selectedDays.has(day)) {
      const next = new Set(selectedDays);
      next.delete(day);
      setSelectedDays(next);
    } else {
      setSelectedDays(new Set(selectedDays).add(day));
    }
  };

  return (
    <div className="max-w-4xl">
      <h2 className="text-xl font-bold text-white mb-1">Trends</h2>
      <p className="text-white/40 text-sm mb-8">
        Player activity and growth over the last 12 months.
      </p>

      {/* Section 1: Avg Players per Game */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Average Players per Game
        </h2>
        {playersByMonth.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={playersByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonth}
                stroke="rgba(255,255,255,0.4)"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.4)"
                tick={{ fontSize: 12 }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                labelFormatter={formatMonth}
                itemStyle={{ color: "#06b6d4" }}
              />
              <Line
                type="monotone"
                dataKey="avgPlayers"
                name="Avg Players"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={{ fill: "#06b6d4", strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: "#06b6d4" }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-white/30 text-sm text-center py-8">
            Not enough data yet.
          </p>
        )}
      </div>

      {/* Section 2: Players by Venue over Time */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">
          Players by Venue
        </h2>
        <p className="text-white/40 text-sm mb-4">
          Average players per game at each venue.
        </p>
        {venueChartData.length > 0 && venueList.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={venueChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  stroke="rgba(255,255,255,0.4)"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.4)"
                  tick={{ fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                  labelFormatter={formatMonth}
                />
                {venueList.map((venue, index) => {
                  const isSelected = showingAllVenues || selectedVenues.has(venue);
                  return (
                    <Line
                      key={venue}
                      type="monotone"
                      dataKey={venue}
                      name={venue}
                      stroke={VENUE_COLORS[index % VENUE_COLORS.length]}
                      strokeWidth={isSelected ? 2 : 1}
                      strokeOpacity={isSelected ? 1 : 0.15}
                      dot={isSelected ? { fill: VENUE_COLORS[index % VENUE_COLORS.length], strokeWidth: 0, r: 3 } : false}
                      activeDot={isSelected ? { r: 5 } : false}
                      connectNulls
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
            {/* Custom clickable legend */}
            <div className="flex flex-wrap gap-3 justify-center pt-3">
              {venueList.map((venue, index) => {
                const isSelected = showingAllVenues || selectedVenues.has(venue);
                return (
                  <button
                    key={venue}
                    onClick={() => handleVenueClick(venue)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all ${
                      isSelected
                        ? "opacity-100"
                        : "opacity-40 hover:opacity-60"
                    } ${!showingAllVenues && selectedVenues.has(venue) ? "bg-white/10 ring-1 ring-white/20" : ""}`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: VENUE_COLORS[index % VENUE_COLORS.length] }}
                    />
                    <span className="text-white/80">{venue}</span>
                  </button>
                );
              })}
              {!showingAllVenues && (
                <button
                  onClick={() => setSelectedVenues(new Set())}
                  className="text-xs text-white/40 hover:text-white/60 px-2 py-1"
                >
                  Show all
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="text-white/30 text-sm text-center py-8">
            Not enough data yet.
          </p>
        )}
      </div>

      {/* Section 3: Players by Day over Time */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">
          Players by Day
        </h2>
        <p className="text-white/40 text-sm mb-4">
          Average players per game on each weekday.
        </p>
        {dayChartData.length > 0 && dayList.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dayChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  stroke="rgba(255,255,255,0.4)"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.4)"
                  tick={{ fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                  labelFormatter={formatMonth}
                />
                {dayList.map((day) => {
                  const isSelected = showingAllDays || selectedDays.has(day);
                  return (
                    <Line
                      key={day}
                      type="monotone"
                      dataKey={day}
                      name={day}
                      stroke={DAY_COLORS[day]}
                      strokeWidth={isSelected ? 2 : 1}
                      strokeOpacity={isSelected ? 1 : 0.15}
                      dot={isSelected ? { fill: DAY_COLORS[day], strokeWidth: 0, r: 3 } : false}
                      activeDot={isSelected ? { r: 5 } : false}
                      connectNulls
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
            {/* Custom clickable legend */}
            <div className="flex flex-wrap gap-3 justify-center pt-3">
              {dayList.map((day) => {
                const isSelected = showingAllDays || selectedDays.has(day);
                return (
                  <button
                    key={day}
                    onClick={() => handleDayClick(day)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all ${
                      isSelected
                        ? "opacity-100"
                        : "opacity-40 hover:opacity-60"
                    } ${!showingAllDays && selectedDays.has(day) ? "bg-white/10 ring-1 ring-white/20" : ""}`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: DAY_COLORS[day] }}
                    />
                    <span className="text-white/80">{day}</span>
                  </button>
                );
              })}
              {!showingAllDays && (
                <button
                  onClick={() => setSelectedDays(new Set())}
                  className="text-xs text-white/40 hover:text-white/60 px-2 py-1"
                >
                  Show all
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="text-white/30 text-sm text-center py-8">
            Not enough data yet.
          </p>
        )}
      </div>

      {/* Section 4: New Players by First Venue */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">
          New Players by Venue
        </h2>
        <p className="text-white/40 text-sm mb-4">
          Where new players played their first game.
        </p>
        {newPlayersByVenue.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(260, newPlayersByVenue.length * 32)}>
            <BarChart data={newPlayersByVenue} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} />
              <XAxis
                type="number"
                stroke="rgba(255,255,255,0.4)"
                tick={{ fontSize: 12 }}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="venue_name"
                stroke="rgba(255,255,255,0.4)"
                tick={{ fontSize: 11 }}
                width={140}
              />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                itemStyle={{ color: "#10b981" }}
              />
              <Bar
                dataKey="new_player_count"
                name="New Players"
                fill="#10b981"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-white/30 text-sm text-center py-8">
            Not enough data yet.
          </p>
        )}
      </div>

      {/* Section 5: New Players per Month */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          New Players per Month
        </h2>
        {newPlayersByMonth.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={newPlayersByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonth}
                stroke="rgba(255,255,255,0.4)"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.4)"
                tick={{ fontSize: 12 }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                labelFormatter={formatMonth}
                itemStyle={{ color: "#06b6d4" }}
              />
              <Bar
                dataKey="new_players"
                name="New Players"
                fill="#06b6d4"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-white/30 text-sm text-center py-8">
            Not enough data yet.
          </p>
        )}
      </div>
    </div>
  );
}
