// lib/realtime/hooks/useTournamentFeed.ts

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { socket } from '@/lib/socketClient';
import { useSession } from 'next-auth/react';

// Feed item type matching API response
export interface FeedItem {
  id: number | string; // string for synthetic knockout IDs like "ko-123"
  tournament_draft_id: number;
  item_type: 'knockout' | 'message' | 'checkin' | 'system' | 'td_message';
  author_uid: string | null;
  author_name: string | null;
  author_photo_url: string | null;
  message_text: string | null;
  eliminated_player_name: string | null;
  hitman_name: string | null;
  ko_position: number | null;
  created_at: string;
}

interface FeedResponse {
  items: FeedItem[];
  hasMore: boolean;
  nextCursor: string | null;
}

interface FeedItemPayload {
  tournament_id: number;
  item: FeedItem;
}

interface UseTournamentFeedOptions {
  /** Number of items to fetch per page (default: 50) */
  limit?: number;
  /** Auto-scroll to new items (default: true) */
  autoScroll?: boolean;
}

interface UseTournamentFeedReturn {
  /** Array of feed items, newest first */
  items: FeedItem[];
  /** Whether the initial load is in progress */
  loading: boolean;
  /** Whether more items are being loaded */
  loadingMore: boolean;
  /** Error message if any */
  error: string | null;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Load more items (for infinite scroll) */
  loadMore: () => Promise<void>;
  /** Post a new message to the feed */
  postMessage: (message: string) => Promise<{ success: boolean; error?: string }>;
  /** Whether a message is being posted */
  posting: boolean;
  /** Whether the user is authenticated (can post) */
  canPost: boolean;
  /** Refresh the feed (reload from scratch) */
  refresh: () => Promise<void>;
  /** Delete a feed item (admin only) */
  deleteItem: (itemId: number) => Promise<{ success: boolean; error?: string }>;
}

export function useTournamentFeed(
  tournamentId: string | number,
  options: UseTournamentFeedOptions = {}
): UseTournamentFeedReturn {
  const { limit = 50 } = options;
  
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  
  // Track if we've already fetched to avoid double-fetch in strict mode
  const hasFetched = useRef(false);
  
  // Get session for auth status
  const { data: session, status: sessionStatus } = useSession();
  const canPost = sessionStatus === 'authenticated' && !!session?.user;

  const tournamentIdNum = typeof tournamentId === 'string' 
    ? parseInt(tournamentId) 
    : tournamentId;

  // Fetch initial feed items
  const fetchFeed = useCallback(async (cursor?: string) => {
    if (!tournamentIdNum || isNaN(tournamentIdNum)) return;

    try {
      const url = new URL(`/api/tournament-drafts/${tournamentIdNum}/feed`, window.location.origin);
      url.searchParams.set('limit', limit.toString());
      if (cursor) {
        url.searchParams.set('before', cursor);
      }

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch feed');
      }

      const data: FeedResponse = await response.json();
      return data;
    } catch (err) {
      console.error('Error fetching feed:', err);
      throw err;
    }
  }, [tournamentIdNum, limit]);

  // Initial load
  useEffect(() => {
    if (!tournamentIdNum || isNaN(tournamentIdNum)) {
      setLoading(false);
      return;
    }

    // Prevent double-fetch in React strict mode
    if (hasFetched.current) return;
    hasFetched.current = true;

    const loadInitialFeed = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchFeed();
        if (data) {
          setItems(data.items);
          setHasMore(data.hasMore);
          setNextCursor(data.nextCursor);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load feed');
      } finally {
        setLoading(false);
      }
    };

    loadInitialFeed();
  }, [tournamentIdNum, fetchFeed]);

  // Socket.IO real-time updates
  useEffect(() => {
    if (!tournamentIdNum || isNaN(tournamentIdNum)) return;

    // Join the tournament room (if not already joined by other hooks)
    if (socket.connected) {
      socket.emit('joinRoom', tournamentIdNum.toString());
    }

    socket.on('connect', () => {
      console.log('[Feed] Socket connected, joining room:', tournamentIdNum);
      socket.emit('joinRoom', tournamentIdNum.toString());
    });

    // Listen for new feed items
    const handleNewFeedItem = (payload: FeedItemPayload) => {
      console.log('[Feed] Received new feed item:', payload);

      if (payload.tournament_id === tournamentIdNum) {
        setItems(prevItems => {
          // Check if item already exists (prevent duplicates)
          // Handle both number and string IDs (knockouts use synthetic string IDs like "ko-123")
          const newId = payload.item.id;
          const exists = prevItems.some(item => String(item.id) === String(newId));
          if (exists) {
            return prevItems;
          }
          // Add new item at the beginning (newest first)
          return [payload.item, ...prevItems];
        });
      }
    };

    socket.on('feed:new_item', handleNewFeedItem);

    return () => {
      socket.off('connect');
      socket.off('feed:new_item', handleNewFeedItem);
    };
  }, [tournamentIdNum]);

  // Refresh feed when page becomes visible again (e.g., user switches back to tab)
  // This handles cases where WebSocket events were missed while tab was hidden
  useEffect(() => {
    if (!tournamentIdNum || isNaN(tournamentIdNum)) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[Feed] Page became visible, refreshing feed...');
        // Reset the fetch guard and reload
        hasFetched.current = false;
        setLoading(true);
        setError(null);

        try {
          const data = await fetchFeed();
          if (data) {
            setItems(data.items);
            setHasMore(data.hasMore);
            setNextCursor(data.nextCursor);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load feed');
        } finally {
          setLoading(false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [tournamentIdNum, fetchFeed]);

  // Load more items (pagination)
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !nextCursor) return;

    setLoadingMore(true);

    try {
      const data = await fetchFeed(nextCursor);
      if (data) {
        // Deduplicate items (TD messages are always returned and may already exist)
        // Handle both number and string IDs (knockouts use synthetic string IDs like "ko-123")
        setItems(prev => {
          const existingIds = new Set(prev.map(item => String(item.id)));
          const newItems = data.items.filter(item => !existingIds.has(String(item.id)));
          return [...prev, ...newItems];
        });
        setHasMore(data.hasMore);
        setNextCursor(data.nextCursor);
      }
    } catch (err) {
      console.error('Error loading more feed items:', err);
      // Don't set error for pagination failures, just log it
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, nextCursor, fetchFeed]);

  // Post a new message
  const postMessage = useCallback(async (message: string): Promise<{ success: boolean; error?: string }> => {
    if (!tournamentIdNum || isNaN(tournamentIdNum)) {
      return { success: false, error: 'Invalid tournament' };
    }

    if (!canPost) {
      return { success: false, error: 'Please log in to post messages' };
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return { success: false, error: 'Message cannot be empty' };
    }

    if (trimmedMessage.length > 500) {
      return { success: false, error: 'Message cannot exceed 500 characters' };
    }

    setPosting(true);

    try {
      const response = await fetch(`/api/tournament-drafts/${tournamentIdNum}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmedMessage }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to post message' };
      }

      // Note: The new item will be added via Socket.IO broadcast
      // But we can also add it optimistically here for immediate feedback
      if (data.item) {
        setItems(prevItems => {
          // Handle both number and string IDs
          const exists = prevItems.some(item => String(item.id) === String(data.item.id));
          if (exists) return prevItems;
          return [data.item, ...prevItems];
        });
      }

      return { success: true };
    } catch (err) {
      console.error('Error posting message:', err);
      return { success: false, error: 'Failed to post message. Please try again.' };
    } finally {
      setPosting(false);
    }
  }, [tournamentIdNum, canPost]);

  // Refresh the feed
  const refresh = useCallback(async () => {
    hasFetched.current = false;
    setItems([]);
    setNextCursor(null);
    setHasMore(false);
    setLoading(true);
    setError(null);

    try {
      const data = await fetchFeed();
      if (data) {
        setItems(data.items);
        setHasMore(data.hasMore);
        setNextCursor(data.nextCursor);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
    } finally {
      setLoading(false);
    }
  }, [fetchFeed]);

  // Delete a feed item
  const deleteItem = useCallback(async (itemId: number): Promise<{ success: boolean; error?: string }> => {
    if (!tournamentIdNum || isNaN(tournamentIdNum)) {
      return { success: false, error: 'Invalid tournament' };
    }

    try {
      const response = await fetch(`/api/tournament-drafts/${tournamentIdNum}/feed/${itemId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to delete item' };
      }

      // Remove item from state (handle both number and string IDs)
      setItems(prevItems => prevItems.filter(item => String(item.id) !== String(itemId)));

      return { success: true };
    } catch (err) {
      console.error('Error deleting feed item:', err);
      return { success: false, error: 'Failed to delete item. Please try again.' };
    }
  }, [tournamentIdNum]);

  return {
    items,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    postMessage,
    posting,
    canPost,
    refresh,
    deleteItem,
  };
}