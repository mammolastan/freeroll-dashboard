// components/TournamentFeed/TournamentFeed.tsx

"use client";

import React, { useRef, useEffect } from "react";
import {
  useTournamentFeed,
  FeedItem as FeedItemType,
} from "@/lib/realtime/hooks/useTournamentFeed";
import { FeedItem } from "./FeedItem";
import { FeedInput } from "./FeedInput";
import { MessageSquare, Loader2, AlertCircle, RefreshCw } from "lucide-react";

interface TournamentFeedProps {
  tournamentId: number;
  /** Maximum height for the feed container (default: 400px) */
  maxHeight?: string;
  /** Show the message input (default: true) */
  showInput?: boolean;
  /** Title for the feed section */
  title?: string;
}

export function TournamentFeed({
  tournamentId,
  maxHeight = "400px",
  showInput = true,
  title = "Feed",
}: TournamentFeedProps) {
  const {
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
  } = useTournamentFeed(tournamentId);

  const feedContainerRef = useRef<HTMLDivElement>(null);
  const isAtTopRef = useRef(true);

  // Track scroll position to auto-scroll for new items
  const handleScroll = () => {
    if (feedContainerRef.current) {
      isAtTopRef.current = feedContainerRef.current.scrollTop < 50;
    }
  };

  // Auto-scroll to top when new items arrive (if user is near top)
  useEffect(() => {
    if (isAtTopRef.current && feedContainerRef.current) {
      feedContainerRef.current.scrollTop = 0;
    }
  }, [items.length]);

  // Infinite scroll - load more when reaching bottom
  const handleLoadMore = () => {
    if (feedContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        feedContainerRef.current;
      if (
        scrollHeight - scrollTop - clientHeight < 100 &&
        hasMore &&
        !loadingMore
      ) {
        loadMore();
      }
    }
  };

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-lg border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/20 bg-gray-900/50">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-cyan-400" />
          <h3 className="font-semibold text-cyan-300">{title}</h3>
          {items.length > 0 && (
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-1.5 text-gray-400 hover:text-cyan-400 hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
          title="Refresh feed"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Message Input */}
      {showInput && (
        <div className="border-b border-cyan-500/20">
          <FeedInput
            onSubmit={postMessage}
            posting={posting}
            canPost={canPost}
          />
        </div>
      )}

      {/* Feed Content */}
      <div
        ref={feedContainerRef}
        onScroll={() => {
          handleScroll();
          handleLoadMore();
        }}
        className="overflow-y-auto"
        style={{ maxHeight }}
      >
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mb-2" />
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={refresh}
              className="mt-3 text-xs text-cyan-400 hover:text-cyan-300 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <MessageSquare className="h-10 w-10 text-gray-600 mb-3" />
            <p className="text-gray-500 text-sm">No activity yet</p>
            <p className="text-gray-600 text-xs mt-1">
              Knockouts and messages will appear here
            </p>
          </div>
        )}

        {/* Feed Items */}
        {!loading && !error && items.length > 0 && (
          <div className="divide-y divide-gray-800/50">
            {items.map((item) => (
              <FeedItem
                key={item.id}
                item={item}
              />
            ))}
          </div>
        )}

        {/* Load More Indicator */}
        {loadingMore && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 text-cyan-500 animate-spin" />
          </div>
        )}

        {/* End of Feed */}
        {!loading && !loadingMore && !hasMore && items.length > 0 && (
          <div className="text-center py-4 text-gray-600 text-xs">
            — End of feed —
          </div>
        )}
      </div>
    </div>
  );
}
