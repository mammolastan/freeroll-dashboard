// components/TournamentFeed/TournamentFeed.tsx

"use client";

import React, {
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import { useTournamentFeed } from "@/lib/realtime/hooks/useTournamentFeed";
import { FeedItem } from "./FeedItem";
import { FeedInput } from "./FeedInput";
import { ReactionBalance } from "./ReactionBalance";
import { ReactionType } from "@/types";
import {
  MessageSquare,
  Loader2,
  AlertCircle,
  RefreshCw,
  Megaphone,
  MessageCircle,
  Trophy,
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
  /** Starting points for the tournament (used to calculate total points earned) */
  startPoints?: number;
}

export function TournamentFeed({
  tournamentId,
  maxHeight = "400px",
  showInput = true,
  isAdmin = false,
  totalPlayers,
  startPoints = 0,
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
    addReaction,
    reactionBalance,
  } = useTournamentFeed(tournamentId);

  const handleReact = useCallback(
    (itemId: string, reactionType: ReactionType, count: number) => {
      addReaction(itemId, reactionType, count);
    },
    [addReaction],
  );

  const [activeTab, setActiveTab] = useState<FeedTab>("all");
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const isAtTopRef = useRef(true);

  // Filter items based on active tab (for mobile view)
  const filteredItems = useMemo(() => {
    if (activeTab === "td") {
      return items.filter((item) => item.item_type === "td_message");
    }
    if (activeTab === "chat") {
      return items.filter((item) => item.item_type === "message");
    }
    return items;
  }, [items, activeTab]);

  // TD messages for the right column on large screens
  const tdMessages = useMemo(() => {
    return items.filter((item) => item.item_type === "td_message");
  }, [items]);

  // Checkins and knockouts for the left column on large screens
  const checkinKnockoutItems = useMemo(() => {
    return items.filter(
      (item) =>
        item.item_type === "checkin" ||
        item.item_type === "knockout" ||
        item.item_type === "system",
    );
  }, [items]);

  // Chat messages for the middle column on large screens
  const chatItems = useMemo(() => {
    return items.filter((item) => item.item_type === "message");
  }, [items]);

  // Count TD messages for the tab badge
  const tdMessageCount = useMemo(() => {
    return items.filter((item) => item.item_type === "td_message").length;
  }, [items]);

  // Count chat messages for the tab badge
  const chatMessageCount = useMemo(() => {
    return items.filter((item) => item.item_type === "message").length;
  }, [items]);

  // Determine if tournament is over and who won
  const winner = useMemo(() => {
    if (!totalPlayers || totalPlayers < 2) return null;

    const knockouts = items.filter((item) => item.item_type === "knockout");
    // Tournament is over when all but one player is knocked out
    if (knockouts.length !== totalPlayers - 1) return null;

    // Find the final knockout (highest ko_position)
    const finalKnockout = knockouts.reduce((latest, current) => {
      if (!latest) return current;
      return (current.ko_position || 0) > (latest.ko_position || 0)
        ? current
        : latest;
    }, knockouts[0]);

    // The winner is the hitman of the final knockout
    return finalKnockout?.hitman_name || null;
  }, [items, totalPlayers]);

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
    <div className="@container bg-gray-900/80 backdrop-blur-sm rounded-lg border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)] overflow-hidden">
      {/* Mobile Tabs - hidden on large screens (1300px+) */}
      <div className="@[1000px]:hidden flex items-center justify-between px-4 py-2 border-b border-cyan-500/20 bg-gray-900/50">
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

      {/* Message Input + Reaction Balance */}
      {showInput && (
        <div className="border-b border-cyan-500/20">
          <FeedInput
            onSubmit={postMessage}
            posting={posting}
            canPost={canPost}
          />
          {canPost && reactionBalance && (
            <div className="border-t border-gray-800/50">
              <ReactionBalance balance={reactionBalance} />
            </div>
          )}
        </div>
      )}

      {/* Mobile Feed Content - single column with tabs */}
      <div
        ref={feedContainerRef}
        onScroll={() => {
          handleScroll();
          handleLoadMore();
        }}
        className="@[1000px]:hidden overflow-y-auto"
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

        {/* Victory Announcement */}
        {winner && activeTab === "all" && (
          <div className="p-4 bg-gradient-to-r from-yellow-500/20 via-amber-500/20 to-yellow-500/20 border-b border-yellow-500/30">
            <div className="flex items-center justify-center gap-3">
              <Trophy className="h-6 w-6 text-yellow-400" />
              <div className="text-center">
                <span className="text-yellow-300 font-bold text-lg">
                  {winner}
                </span>
                <span className="text-yellow-200/80 text-lg">
                  {" "}
                  wins the tournament!
                </span>
              </div>
              <Trophy className="h-6 w-6 text-yellow-400" />
            </div>
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
                startPoints={startPoints}
                onReact={handleReact}
                reactionBalance={reactionBalance}
                canReact={canPost}
                tournamentId={tournamentId}
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

      {/* Desktop Feed Content - three column layout (1300px+) */}
      <div
        className="hidden @[1000px]:flex"
        style={{ maxHeight }}
      >
        {/* Left Column - Checkins/Knockouts */}
        <div className="flex-1 overflow-y-auto border-r border-cyan-500/20 flex flex-col">
          {/* Column Header */}
          <div className="px-3 py-2 border-b border-cyan-500/20 bg-cyan-500/10">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-medium text-cyan-300">
                Checkins / Knockouts
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
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

            {/* Victory Announcement */}
            {winner && !loading && !error && (
              <div className="p-4 bg-gradient-to-r from-yellow-500/20 via-amber-500/20 to-yellow-500/20 border-b border-yellow-500/30">
                <div className="flex items-center justify-center gap-3">
                  <Trophy className="h-6 w-6 text-yellow-400" />
                  <div className="text-center">
                    <span className="text-yellow-300 font-bold text-lg">
                      {winner}
                    </span>
                    <span className="text-yellow-200/80 text-lg">
                      {" "}
                      wins the tournament!
                    </span>
                  </div>
                  <Trophy className="h-6 w-6 text-yellow-400" />
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && checkinKnockoutItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Trophy className="h-10 w-10 text-gray-600 mb-3" />
                <p className="text-gray-500 text-sm">No activity yet</p>
                <p className="text-gray-600 text-xs mt-1">
                  Checkins and knockouts will appear here
                </p>
              </div>
            )}

            {/* Feed Items */}
            {!loading && !error && checkinKnockoutItems.length > 0 && (
              <div className="divide-y divide-gray-800/50">
                {checkinKnockoutItems.map((item) => (
                  <FeedItem
                    key={item.id}
                    item={item}
                    onDelete={
                      isAdmin ? (itemId) => deleteItem(itemId) : undefined
                    }
                    totalPlayers={totalPlayers}
                    startPoints={startPoints}
                    tournamentId={tournamentId}
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
          </div>
        </div>

        {/* Middle Column - TD Messages */}
        <div className="flex-1 overflow-y-auto border-r border-cyan-500/20 flex flex-col bg-gray-900/40">
          {/* TD Column Header */}
          <div className="px-3 py-2 border-b border-cyan-500/20 bg-amber-500/10">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-300">
                TD Messages
              </span>
              {tdMessageCount > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                  {tdMessageCount}
                </span>
              )}
            </div>
          </div>

          {/* TD Messages Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 text-cyan-500 animate-spin" />
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && tdMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Megaphone className="h-8 w-8 text-gray-600 mb-2" />
                <p className="text-gray-500 text-xs">No TD messages yet</p>
              </div>
            )}

            {/* TD Feed Items */}
            {!loading && !error && tdMessages.length > 0 && (
              <div className="divide-y divide-gray-800/50">
                {tdMessages.map((item) => (
                  <FeedItem
                    key={item.id}
                    item={item}
                    onDelete={
                      isAdmin ? (itemId) => deleteItem(itemId) : undefined
                    }
                    totalPlayers={totalPlayers}
                    startPoints={startPoints}
                    tournamentId={tournamentId}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Chat Messages */}
        <div className="flex-1 flex-shrink-0 flex flex-col">
          {/* Column Header */}
          <div className="px-3 py-2 border-b border-cyan-500/20 bg-purple-500/10">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-300">Chat</span>
              {chatMessageCount > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                  {chatMessageCount}
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && chatItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <MessageCircle className="h-10 w-10 text-gray-600 mb-3" />
                <p className="text-gray-500 text-sm">No chat messages yet</p>
                <p className="text-gray-600 text-xs mt-1">
                  Player messages will appear here
                </p>
              </div>
            )}

            {/* Feed Items */}
            {!loading && !error && chatItems.length > 0 && (
              <div className="divide-y divide-gray-800/50">
                {chatItems.map((item) => (
                  <FeedItem
                    key={item.id}
                    item={item}
                    onDelete={
                      isAdmin ? (itemId) => deleteItem(itemId) : undefined
                    }
                    totalPlayers={totalPlayers}
                    startPoints={startPoints}
                    tournamentId={tournamentId}
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
          </div>
        </div>
      </div>
    </div>
  );
}
