"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useLeague } from "@/lib/LeagueContext";

/**
 * Hook to read league params from URL and provide helpers for API calls.
 *
 * Priority order:
 * 1. LeagueContext (from [leagueSlug] path segment)
 * 2. `?league=slug` query param
 * 3. `?league_id=N` query param
 *
 * Usage:
 *   const { appendLeagueParam, leagueQueryString, isReady } = useLeagueParam();
 *
 *   // Option 1: Append to URL string
 *   fetch(appendLeagueParam('/api/rankings/quarterly'))
 *   fetch(appendLeagueParam(`/api/venues/list?currentMonth=${isCurrentMonth}`))
 *
 *   // Option 2: Use query string directly
 *   fetch(`/api/rankings/quarterly?${leagueQueryString}`)
 */

export function useLeagueParam() {
  const { leagueSlug: contextSlug } = useLeague(); // from [leagueSlug] path segment

  const [isReady, setIsReady] = useState(false);
  const paramsRef = useRef<{ leagueSlug: string | null; leagueId: string | null }>({
    leagueSlug: null,
    leagueId: null,
  });

  // Read params on mount (client-side only)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    paramsRef.current = {
      leagueSlug: contextSlug ?? searchParams.get("league"), // context wins
      leagueId: contextSlug ? null : searchParams.get("league_id"), // ignore league_id if context present
    };
    setIsReady(true);
  }, [contextSlug]); // re-run if context changes

  // Stable function that reads from ref - won't change between renders
  const appendLeagueParam = useCallback((url: string): string => {
    const activeSlug = contextSlug ?? paramsRef.current.leagueSlug;
    const activeId = contextSlug ? null : paramsRef.current.leagueId;

    let leagueQueryString = "";
    if (activeSlug) leagueQueryString = `league=${encodeURIComponent(activeSlug)}`;
    else if (activeId) leagueQueryString = `league_id=${encodeURIComponent(activeId)}`;

    if (!leagueQueryString) return url;

    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}${leagueQueryString}`;
  }, [contextSlug]);

  // Build the query string portion for league params
  const activeSlug = contextSlug ?? paramsRef.current.leagueSlug;
  const activeId = contextSlug ? null : paramsRef.current.leagueId;

  let leagueQueryString = "";
  if (activeSlug) {
    leagueQueryString = `league=${encodeURIComponent(activeSlug)}`;
  } else if (activeId) {
    leagueQueryString = `league_id=${encodeURIComponent(activeId)}`;
  }

  return {
    leagueSlug: activeSlug,
    leagueId: activeId,
    leagueQueryString,
    appendLeagueParam,
    hasLeagueParam: Boolean(activeSlug || activeId),
    isReady,
  };
}

/**
 * Non-hook version for use outside of React components.
 * Reads from window.location.search directly.
 */
export function getLeagueParamFromURL(): {
  leagueQueryString: string;
  appendLeagueParam: (url: string) => string;
} {
  if (typeof window === "undefined") {
    return {
      leagueQueryString: "",
      appendLeagueParam: (url: string) => url,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const leagueSlug = params.get("league");
  const leagueId = params.get("league_id");

  let leagueQueryString = "";
  if (leagueSlug) leagueQueryString = `league=${encodeURIComponent(leagueSlug)}`;
  else if (leagueId) leagueQueryString = `league_id=${encodeURIComponent(leagueId)}`;

  const appendLeagueParam = (url: string): string => {
    if (!leagueQueryString) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}${leagueQueryString}`;
  };

  return { leagueQueryString, appendLeagueParam };
}
