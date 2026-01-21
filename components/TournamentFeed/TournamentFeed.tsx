// components/TournamentFeed/TournamentFeed.tsx

"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { useTournamentFeed } from "@/lib/realtime/hooks/useTournamentFeed";
import { FeedItem } from "./FeedItem";
import { FeedInput } from "./FeedInput";
import {
  MessageSquare,
  Loader2,
  AlertCircle,
  RefreshCw,
  Megaphone,
  MessageCircle,
} from "lucide-react";

type FeedTab = "all" | "td" | "chat";

interface TournamentFeedProps {
  tournamentId: number;
  /** Maximum height for the feed container (default: 400px) */
  maxHeight?: string;
  /** Show the message input (default: true) */
  showInput?: boolean;
  /** Admin mode - shows delete buttons on messages (default: false) */
  isAdmin?: boolean;
  totalPlayers?: number;
}

export function TournamentFeed({
  tournamentId,
  maxHeight = "400px",
  showInput = true,
  isAdmin = false,
  totalPlayers,
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
    deleteItem,
  } = useTournamentFeed(tournamentId);

  const [activeTab, setActiveTab] = useState<FeedTab>("all");
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const isAtTopRef = useRef(true);

  // Filter items based on active tab
  const filteredItems = useMemo(() => {
    if (activeTab === "td") {
      return items.filter((item) => item.item_type === "td_message");
    }
    if (activeTab === "chat") {
      return items.filter((item) => item.item_type === "message");
    }
    return items;
  }, [items, activeTab]);

  // Count TD messages for the tab badge
  const tdMessageCount = useMemo(() => {
    return items.filter((item) => item.item_type === "td_message").length;
  }, [items]);

  // Count chat messages for the tab badge
  const chatMessageCount = useMemo(() => {
    return items.filter((item) => item.item_type === "message").length;
  }, [items]);

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
      {/* Tabs */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-cyan-500/20 bg-gray-900/50">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "all"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-gray-400 hover:text-gray-300 border border-transparent hover:border-gray-600"
            }`}
          >
            Feed
          </button>
          <button
            onClick={() => setActiveTab("td")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "td"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-gray-400 hover:text-gray-300 border border-transparent hover:border-gray-600"
            }`}
          >
            <Megaphone className="h-5 w-5" />
            {tdMessageCount > 0 && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === "td" ? "bg-cyan-500/30" : "bg-gray-700"
                }`}
              >
                {tdMessageCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "chat"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-gray-400 hover:text-gray-300 border border-transparent hover:border-gray-600"
            }`}
          >
            <MessageCircle className="h-5 w-5" />
            {chatMessageCount > 0 && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === "chat" ? "bg-cyan-500/30" : "bg-gray-700"
                }`}
              >
                {chatMessageCount}
              </span>
            )}
          </button>
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
        {!loading && !error && filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            {activeTab === "td" ? (
              <>
                <Megaphone className="h-10 w-10 text-gray-600 mb-3" />
                <p className="text-gray-500 text-sm">No TD messages yet</p>
                <p className="text-gray-600 text-xs mt-1">
                  Messages from the Tournament Director will appear here
                </p>
              </>
            ) : activeTab === "chat" ? (
              <>
                <MessageCircle className="h-10 w-10 text-gray-600 mb-3" />
                <p className="text-gray-500 text-sm">No chat messages yet</p>
                <p className="text-gray-600 text-xs mt-1">
                  Player messages will appear here
                </p>
              </>
            ) : (
              <>
                <MessageSquare className="h-10 w-10 text-gray-600 mb-3" />
                <p className="text-gray-500 text-sm">No activity yet</p>
                <p className="text-gray-600 text-xs mt-1">
                  Knockouts and messages will appear here
                </p>
              </>
            )}
          </div>
        )}

        {/* Feed Items */}
        {!loading && !error && filteredItems.length > 0 && (
          <div className="divide-y divide-gray-800/50">
            {filteredItems.map((item) => (
              <FeedItem
                key={item.id}
                item={item}
                onDelete={isAdmin ? (itemId) => deleteItem(itemId) : undefined}
                totalPlayers={totalPlayers}
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
        {!loading && !loadingMore && !hasMore && filteredItems.length > 0 && (
          <div className="text-center py-4 text-gray-600 text-xs">
            — End of feed —
          </div>
        )}
      </div>
    </div>
  );
}
