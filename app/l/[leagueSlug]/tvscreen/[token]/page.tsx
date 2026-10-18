// app/l/[leagueSlug]/tvscreen/[token]/page.tsx

"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useRealtimeGameData } from "@/lib/realtime/hooks/useRealtimeGameData";
import { TVScreenTimer } from "./TVScreenTimer";
import { TVFeed } from "./TVFeed";
import { formatTime } from "@/lib/utils";
import { formatLeagueDate } from "@/lib/league-time";
import { TVScreenSettings } from "@/types/league-config";
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

// Default TV screen settings
const DEFAULT_TV_SETTINGS: TVScreenSettings = {
  slideRotationSeconds: 15,
  featuredModules: {
    otherActiveGames: true,
    recentBadges: true,
  },
};

export default function TVScreenPage() {
  const { token, leagueSlug } = useParams();
  const { gameData, computedStats, loading, error, connectionStatus } = useRealtimeGameData(
    token as string
  );

  const [currentTime, setCurrentTime] = useState<string>("");
  const [weather, setWeather] = useState<HourlyWeather[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [tvScreenSettings, setTvScreenSettings] = useState<TVScreenSettings>(DEFAULT_TV_SETTINGS);
  const [showConnectionBanner, setShowConnectionBanner] = useState<boolean>(false);

  // Track browser online/offline status for immediate feedback
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Delay showing the connection banner by 30 seconds after connection is lost
  useEffect(() => {
    const isDisconnected = !isOnline || connectionStatus === 'disconnected' || connectionStatus === 'reconnecting' || connectionStatus === 'connecting';

    if (isDisconnected) {
      // Start 30-second timer to show the banner
      const timer = setTimeout(() => {
        setShowConnectionBanner(true);
      }, 30000);

      return () => clearTimeout(timer);
    } else {
      // Connection restored - hide banner immediately and reset timer
      setShowConnectionBanner(false);
    }
  }, [isOnline, connectionStatus]);

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

  // Fetch TV screen settings (league config + game overrides)
  useEffect(() => {
    const fetchSettings = async () => {
      if (!gameData?.tournament?.id || !leagueSlug) return;

      try {
        // Fetch league config for base TV settings
        const configRes = await fetch(`/api/${leagueSlug}/config`);
        let leagueSettings = DEFAULT_TV_SETTINGS;

        if (configRes.ok) {
          const configData = await configRes.json();
          if (configData.tvScreenSettings) {
            const fetchedSettings = configData.tvScreenSettings;
            // Handle backwards compatibility: use old settings if new one doesn't exist
            const slideRotation = fetchedSettings.slideRotationSeconds
              ?? fetchedSettings.tdChatRotationSeconds
              ?? fetchedSettings.featuredRotationSeconds
              ?? DEFAULT_TV_SETTINGS.slideRotationSeconds;

            leagueSettings = {
              ...DEFAULT_TV_SETTINGS,
              ...fetchedSettings,
              slideRotationSeconds: slideRotation,
              featuredModules: {
                ...DEFAULT_TV_SETTINGS.featuredModules,
                ...fetchedSettings?.featuredModules,
              },
            };
          }
        }

        // Fetch game-level overrides
        const featuredRes = await fetch(
          `/api/tournament-drafts/${gameData.tournament.id}/featured-settings`
        );

        if (featuredRes.ok) {
          const featuredData = await featuredRes.json();
          // Use effective settings which already merge league + game overrides
          setTvScreenSettings({
            ...leagueSettings,
            featuredModules: {
              ...leagueSettings.featuredModules,
              ...featuredData.effectiveSettings,
            },
          });
        } else {
          setTvScreenSettings(leagueSettings);
        }
      } catch (err) {
        console.error("Failed to fetch TV screen settings:", err);
      }
    };

    fetchSettings();
  }, [gameData?.tournament?.id, leagueSlug]);

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
            {formatLeagueDate(
              typeof gameData.tournament.date === "string"
                ? gameData.tournament.date
                : gameData.tournament.date.toISOString(),
              gameData.tournament.timezone
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
        </div>
      </div>

      {/* Timer Row: Timer (75%) + Stats (25%) */}
      <div className="tvscreen-timer-row">
        <div className="tvscreen-timer-wrapper">
          {gameData.tournament.game_started ? (
            <TVScreenTimer tournamentId={parseInt(token as string)} />
          ) : (
            <div className="tvscreen-timer">
              <div className="tvscreen-timer-prestart">
                <div className="tvscreen-timer-prestart-message">
                  Poker starts soon
                </div>
                <div className="tvscreen-timer-prestart-submessage">
                  Check-in with TD or in app
                </div>
              </div>
            </div>
          )}
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

      {/* Feed - Takes remaining space */}
      <div className="tvscreen-feed-wrapper">
        <TVFeed
          tournamentId={parseInt(token as string)}
          maxHeight="100%"
          totalPlayers={gameData.players.length}
          startPoints={gameData.tournament.start_points}
          players={gameData.players}
          allowChat={gameData.tournament.allow_chat}
          defaultTDMessage={gameData.tournament.defaultTDMessage}
          leagueSlug={leagueSlug as string}
          gameId={gameData.tournament.id}
          tvScreenSettings={tvScreenSettings}
        />
      </div>

      {/* Connection status indicator - warning banner only shows after 30 seconds of disconnection */}
      {showConnectionBanner ? (
        <div className="tvscreen-connection-banner">
          <span className="tvscreen-connection-banner-icon">
            {!isOnline ? '📡' : connectionStatus === 'disconnected' ? '⚠️' : '🔄'}
          </span>
          <span className="tvscreen-connection-banner-text">
            {!isOnline && 'Offline - Timer may be out of sync'}
            {isOnline && connectionStatus === 'disconnected' && 'Disconnected - Timer may be out of sync'}
            {isOnline && connectionStatus === 'reconnecting' && 'Reconnecting...'}
            {isOnline && connectionStatus === 'connecting' && 'Connecting...'}
          </span>
        </div>
      ) : connectionStatus === 'connected' && isOnline ? (
        <div className="tvscreen-connection-indicator tvscreen-connection-indicator--connected">
          🟢 Live
        </div>
      ) : null}

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
