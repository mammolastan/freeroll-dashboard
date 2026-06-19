import { useState, useRef, useEffect, useCallback } from "react";

interface UseAutoRefreshOptions {
  enabled: boolean;
  intervalMs?: number;
  onRefresh: () => Promise<void>;
}

interface UseAutoRefreshReturn {
  skipNextAutoRefresh: boolean;
  temporarilyDisableAutoRefresh: () => void;
}

/**
 * Hook to manage auto-refresh behavior with smart polling.
 * - Polls at regular intervals when tab is active
 * - Refreshes when tab becomes visible
 * - Allows temporarily disabling auto-refresh after user actions
 */
export function useAutoRefresh({
  enabled,
  intervalMs = 15000,
  onRefresh,
}: UseAutoRefreshOptions): UseAutoRefreshReturn {
  const [skipNextAutoRefresh, setSkipNextAutoRefresh] = useState(false);
  const skipAutoRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to temporarily disable auto-refresh after updates
  const temporarilyDisableAutoRefresh = useCallback(() => {
    setSkipNextAutoRefresh(true);

    // Clear any existing timeout
    if (skipAutoRefreshTimeoutRef.current) {
      clearTimeout(skipAutoRefreshTimeoutRef.current);
    }

    // Re-enable auto-refresh after 5 seconds (enough time for updates to complete)
    skipAutoRefreshTimeoutRef.current = setTimeout(() => {
      setSkipNextAutoRefresh(false);
    }, 5000);
  }, []);

  // Smart polling functionality
  useEffect(() => {
    if (!enabled) return;

    // Refresh when tab becomes active
    const handleVisibilityChange = async () => {
      if (!document.hidden && !skipNextAutoRefresh) {
        await onRefresh();
      }
    };

    // Poll at regular intervals when tab is active
    const interval = setInterval(async () => {
      if (!document.hidden && !skipNextAutoRefresh) {
        await onRefresh();
      }
    }, intervalMs);

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, intervalMs, onRefresh, skipNextAutoRefresh]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (skipAutoRefreshTimeoutRef.current) {
        clearTimeout(skipAutoRefreshTimeoutRef.current);
      }
    };
  }, []);

  return {
    skipNextAutoRefresh,
    temporarilyDisableAutoRefresh,
  };
}
