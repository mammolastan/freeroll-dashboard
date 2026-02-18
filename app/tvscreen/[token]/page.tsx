// /app/tvscreen/[token]/page.tsx

"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useRealtimeGameData } from "@/lib/realtime/hooks/useRealtimeGameData";
import { TVScreenTimer } from "./TVScreenTimer";
import { TournamentFeed } from "@/components/TournamentFeed";
import { formatGameDate, formatTime, formatCutoffTime } from "@/lib/utils";
import "./tvscreen.css";

interface HourlyWeather {
  hour: string;
  temp: number;
  icon: string;
}

const getWeatherIcon = (code: number): string => {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 49) return "🌫️";
  if (code <= 69) return "🌧️";
  if (code <= 79) return "🌨️";
  if (code <= 99) return "⛈️";
  return "☁️";
};

export default function TVScreenPage() {
  const { token } = useParams();
  const { gameData, computedStats, loading, error } = useRealtimeGameData(
    token as string
  );

  const [currentTime, setCurrentTime] = useState<string>("");
  const [weather, setWeather] = useState<HourlyWeather[]>([]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      setCurrentTime(`${hours}:${minutes} ${ampm}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=33.749&longitude=-84.388&hourly=temperature_2m,weathercode&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_hours=4"
        );
        const data = await res.json();

        const now = new Date();
        const currentHour = now.getHours();

        const hourlyData: HourlyWeather[] = [];
        for (let i = 0; i < 3; i++) {
          const hourIndex = i;
          if (hourIndex < data.hourly.time.length) {
            const hour = (currentHour + i) % 24;
            const displayHour = hour % 12 || 12;
            const ampm = hour >= 12 ? "PM" : "AM";
            hourlyData.push({
              hour: `${displayHour}${ampm}`,
              temp: Math.round(data.hourly.temperature_2m[hourIndex]),
              icon: getWeatherIcon(data.hourly.weathercode[hourIndex]),
            });
          }
        }
        setWeather(hourlyData);
      } catch (err) {
        console.error("Failed to fetch weather:", err);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 15 * 60 * 1000); // Refresh every 15 min

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="tvscreen-loading">
        <div className="tvscreen-loading-content">
          <div className="tvscreen-spinner"></div>
          <p className="tvscreen-loading-text">Loading tournament data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tvscreen-error">
        <div className="tvscreen-error-content">
          <div className="tvscreen-error-icon">⚠️ Error</div>
          <p className="tvscreen-error-message">{error}</p>
        </div>
      </div>
    );
  }

  if (!gameData || !computedStats) {
    return (
      <div className="tvscreen-error">
        <div className="tvscreen-error-content">
          <p className="tvscreen-error-message">No tournament data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tvscreen-container">
      {/* Tournament Header - Compact */}
      <div className="tvscreen-header">
        <h1>{gameData.tournament.title}</h1>
        <div className="tvscreen-header-meta">
          <span>
            {formatGameDate(
              typeof gameData.tournament.date === "string"
                ? gameData.tournament.date
                : gameData.tournament.date.toISOString()
            )}
          </span>
          {formatTime(gameData.tournament.time) && (
            <span className="tvscreen-header-time">
              @ {formatTime(gameData.tournament.time)}
            </span>
          )}
          {gameData.tournament.venue && (
            <span className="tvscreen-header-venue">
              📍 {gameData.tournament.venue}
            </span>
          )}
          {formatCutoffTime(gameData.tournament.time) && (
            <span className="tvscreen-header-cutoff">
              ⏰ Cutoff: {formatCutoffTime(gameData.tournament.time)}
            </span>
          )}
        </div>
      </div>

      {/* Timer Row: Timer (75%) + Stats (25%) */}
      <div className="tvscreen-timer-row">
        <div className="tvscreen-timer-wrapper">
          <TVScreenTimer tournamentId={parseInt(token as string)} />
        </div>

        <div className="tvscreen-stats-wrapper">
          <div className="tvscreen-stat-card tvscreen-stat-card--total">
            <div className="tvscreen-stat-value tvscreen-stat-value--cyan">
              {computedStats.totalPlayers}
            </div>
            <div className="tvscreen-stat-label">Total</div>
          </div>
          <div className="tvscreen-stat-card tvscreen-stat-card--remaining">
            <div className="tvscreen-stat-value tvscreen-stat-value--green">
              {computedStats.playersRemaining}
            </div>
            <div className="tvscreen-stat-label">Remaining</div>
          </div>
          <div className="tvscreen-stat-card tvscreen-stat-card--eliminated">
            <div className="tvscreen-stat-value tvscreen-stat-value--red">
              {computedStats.eliminatedPlayers}
            </div>
            <div className="tvscreen-stat-label">Eliminated</div>
          </div>
        </div>
      </div>

      {/* Feed - Takes at least 50% of vertical space */}
      <div className="tvscreen-feed-wrapper">
        <TournamentFeed
          tournamentId={parseInt(token as string)}
          maxHeight="100%"
          showInput={false}
          isAdmin={false}
          totalPlayers={gameData.players.length}
          startPoints={gameData.tournament.start_points}
          players={gameData.players}
        />
      </div>

      {/* Live indicator */}
      <div className="tvscreen-live-indicator">🔴 Live</div>

      {/* Weather and clock */}
      <div className="tvscreen-top-bar">
        {weather.length > 0 && (
          <div className="tvscreen-weather">
            {weather.map((w, i) => (
              <div key={i} className="tvscreen-weather-hour">
                <span className="tvscreen-weather-icon">{w.icon}</span>
                <span className="tvscreen-weather-temp">{w.temp}°</span>
                <span className="tvscreen-weather-time">{w.hour}</span>
              </div>
            ))}
          </div>
        )}
        <div className="tvscreen-clock">{currentTime}</div>
      </div>
    </div>
  );
}
