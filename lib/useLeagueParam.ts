"use client";

import { useEffect, useState, useCallback, useRef } from "react";

/**
 * Hook to read league params from URL and provide helpers for API calls.
 *
 * Reads either `?league=slug` or `?league_id=N` from the current URL
 * and provides utilities to forward these to API calls.
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
  const [isReady, setIsReady] = useState(false);
  const paramsRef = useRef<{ leagueSlug: string | null; leagueId: string | null }>({
    leagueSlug: null,
    leagueId: null,
  });

  // Read params on mount (client-side only)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    paramsRef.current = {
      leagueSlug: searchParams.get("league"),
      leagueId: searchParams.get("league_id"),
    };
    setIsReady(true);
  }, []);

  // Stable function that reads from ref - won't change between renders
  const appendLeagueParam = useCallback((url: string): string => {
    const { leagueSlug, leagueId } = paramsRef.current;

    let leagueQueryString = "";
    if (leagueSlug) leagueQueryString = `league=${encodeURIComponent(leagueSlug)}`;
    else if (leagueId) leagueQueryString = `league_id=${encodeURIComponent(leagueId)}`;

    if (!leagueQueryString) return url;

    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}${leagueQueryString}`;
  }, []);

  // Build the query string portion for league params
  let leagueQueryString = "";
  if (paramsRef.current.leagueSlug) {
    leagueQueryString = `league=${encodeURIComponent(paramsRef.current.leagueSlug)}`;
  } else if (paramsRef.current.leagueId) {
    leagueQueryString = `league_id=${encodeURIComponent(paramsRef.current.leagueId)}`;
  }

  return {
    leagueSlug: paramsRef.current.leagueSlug,
    leagueId: paramsRef.current.leagueId,
    leagueQueryString,
    appendLeagueParam,
    hasLeagueParam: Boolean(paramsRef.current.leagueSlug || paramsRef.current.leagueId),
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
