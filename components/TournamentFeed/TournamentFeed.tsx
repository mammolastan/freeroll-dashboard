// components/TournamentFeed/TournamentFeed.tsx

"use client";

import React, {
  useRef,
  useEffect,
  useLayoutEffect,
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
  Users,
} from "lucide-react";
import { Player } from "@/lib/realtime/types";
import PlayerAvatar from "@/components/ui/PlayerAvatar";

type FeedTab = "all" | "td" | "chat" | "players" | "eliminated" | "allPlayers";

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
  /** Player list for the "Players" tab - tab only shows when provided */
  players?: Player[];
}

function PlayersGrid({
  players,
  variant = "active",
  totalPlayers,
}: {
  players: Player[];
  variant?: "active" | "eliminated";
  totalPlayers?: number;
}) {
  const isEliminated = variant === "eliminated";
  const emptyLabel = isEliminated
    ? "No eliminated players"
    : "No remaining players";
  const gridBorder = isEliminated ? "border-red-500/20" : "border-cyan-500/20";
  const gridBg = isEliminated ? "bg-gray-800/40" : "bg-gray-800/60";
  const textColor = isEliminated ? "text-red-300" : "text-cyan-200";

  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <Users className="h-10 w-10 text-gray-600 mb-3" />
        <p className="text-gray-500 text-sm">{emptyLabel}</p>
      </div>
    );
  }

  // For eliminated players, maintain sort order (most recent KO first)
  // For active players, split by photo status for visual grouping
  if (isEliminated) {
    return (
      <div className="p-3">
        <div className="flex flex-wrap gap-1.5">
          {players.map((player) => {
            const hasPhoto = player.photo_url && player.photo_url.trim() !== "";
            // Calculate placement: use stored value, or compute from ko_position
            // placement = totalPlayers - ko_position + 1
            const placement =
              player.placement ||
              (totalPlayers && player.elimination_position
                ? totalPlayers - player.elimination_position + 1
                : null);
            return (
              <div
                key={player.id}
                className={`flex items-center gap-1.5 px-2 py-1 ${gridBg} rounded border ${gridBorder} opacity-75`}
              >
                {placement && (
                  <span className="text-xs text-gray-500 font-medium min-w-[1.25rem] text-center">
                    {placement}
                  </span>
                )}
                {hasPhoto && (
                  <PlayerAvatar
                    photoUrl={player.photo_url}
                    name={player.nickname || player.name}
                    uid={player.uid}
                    size="sm"
                    showFallback={false}
                  />
                )}
                <span className={`text-xs ${textColor}`}>
                  {player.nickname || player.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Active players: group by photo status for visual appeal
  const withPhoto = players.filter(
    (p) => p.photo_url && p.photo_url.trim() !== "",
  );
  const withoutPhoto = players.filter(
    (p) => !p.photo_url || p.photo_url.trim() === "",
  );

  return (
    <div className="p-3 space-y-3">
      {withPhoto.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {withPhoto.map((player) => (
            <div
              key={player.id}
              className={`flex items-center gap-2 px-2 py-1.5 ${gridBg} rounded border ${gridBorder}`}
            >
              <PlayerAvatar
                photoUrl={player.photo_url}
                name={player.nickname || player.name}
                uid={player.uid}
                size="sm"
                showFallback={false}
              />
              <span className={`text-xs ${textColor} truncate`}>
                {player.nickname || player.name}
              </span>
            </div>
          ))}
        </div>
      )}
      {withoutPhoto.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {withoutPhoto.map((player) => (
            <span
              key={player.id}
              className={`text-xs ${textColor} px-2 py-1 ${gridBg} rounded border ${gridBorder}`}
            >
              {player.nickname || player.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function TournamentFeed({
  tournamentId,
  maxHeight = "400px",
  showInput = true,
  isAdmin = false,
  totalPlayers,
  startPoints = 0,
  players,
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

  // Refs for the unified sliding indicator
  const headerContainerRef = useRef<HTMLDivElement>(null);
  const totalPlayersRef = useRef<HTMLButtonElement>(null);
  const remainingRef = useRef<HTMLButtonElement>(null);
  const eliminatedRef = useRef<HTMLButtonElement>(null);
  const feedTabRef = useRef<HTMLButtonElement>(null);
  const chatTabRef = useRef<HTMLButtonElement>(null);
  const tdTabRef = useRef<HTMLButtonElement>(null);

  // State for unified sliding indicator position
  const [indicatorStyle, setIndicatorStyle] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
    color: "cyan" | "green" | "red";
  } | null>(null);

  // Measure and update the unified sliding indicator position
  useLayoutEffect(() => {
    const headerContainer = headerContainerRef.current;
    if (!headerContainer) return;

    // Determine which ref to measure based on active tab
    let targetRef: React.RefObject<HTMLButtonElement | null>;
    let color: "cyan" | "green" | "red";

    if (activeTab === "allPlayers") {
      targetRef = totalPlayersRef;
      color = "cyan";
    } else if (activeTab === "players") {
      targetRef = remainingRef;
      color = "green";
    } else if (activeTab === "eliminated") {
      targetRef = eliminatedRef;
      color = "red";
    } else if (activeTab === "all") {
      targetRef = feedTabRef;
      color = "cyan";
    } else if (activeTab === "chat") {
      targetRef = chatTabRef;
      color = "cyan";
    } else if (activeTab === "td") {
      targetRef = tdTabRef;
      color = "cyan";
    } else {
      setIndicatorStyle(null);
      return;
    }

    const targetButton = targetRef.current;
    if (!targetButton) return;

    // Get positions relative to the header container
    const containerRect = headerContainer.getBoundingClientRect();
    const buttonRect = targetButton.getBoundingClientRect();

    setIndicatorStyle({
      top: buttonRect.top - containerRect.top,
      left: buttonRect.left - containerRect.left,
      width: buttonRect.width,
      height: buttonRect.height,
      color,
    });
  }, [activeTab, players]);

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

  // Active (remaining) players for the Players tab
  const activePlayers = useMemo(() => {
    if (!players) return [];
    return players.filter((p) => p.is_active);
  }, [players]);

  // Eliminated players for the Eliminated tab
  const eliminatedPlayers = useMemo(() => {
    if (!players) return [];
    return players
      .filter((p) => !p.is_active)
      .sort(
        (a, b) => (b.elimination_position || 0) - (a.elimination_position || 0),
      );
  }, [players]);

  // Determine if tournament is over and who won
  const winner = useMemo(() => {
    if (!players || players.length < 2) return null;

    // Tournament is over when exactly one player remains active
    const remainingPlayers = players.filter((p) => p.is_active);
    if (remainingPlayers.length !== 1) return null;

    // Use nickname if available, otherwise use name
    const winnerPlayer = remainingPlayers[0];
    return winnerPlayer.nickname || winnerPlayer.name;
  }, [players]);

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
    <div className="@container bg-gray-900/80 backdrop-blur-sm rounded-lg border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
      {/* Combined Header - Player Stats + Tabs (hidden on large screens) */}
      <div className="@[900px]:hidden sticky top-0 z-20 bg-gray-900/95 backdrop-blur-sm border-b border-cyan-500/20">
        <div
          ref={headerContainerRef}
          className="relative"
        >
          {/* Unified Sliding indicator */}
          {indicatorStyle && (
            <div
              className={`absolute rounded border pointer-events-none ${
                indicatorStyle.color === "cyan"
                  ? "bg-cyan-500/20 border-cyan-500/40"
                  : indicatorStyle.color === "green"
                    ? "bg-green-500/20 border-green-500/40"
                    : "bg-red-500/20 border-red-500/40"
              }`}
              style={{
                top: indicatorStyle.top,
                left: indicatorStyle.left,
                width: indicatorStyle.width,
                height: indicatorStyle.height,
                transition: "all 400ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          )}

          {/* Player Stats Row */}
          {players && (
            <div className="flex items-center justify-between px-3 py-2">
              {/* Total Players - clickable */}
              <button
                ref={totalPlayersRef}
                onClick={() => setActiveTab("allPlayers")}
                className="flex flex-col items-center px-3 py-1 rounded transition-colors hover:bg-gray-800/50 relative z-10"
              >
                <span
                  className={`text-lg font-bold transition-colors duration-300 ${activeTab === "allPlayers" ? "text-cyan-300" : "text-cyan-400"}`}
                >
                  {totalPlayers || players.length}
                </span>
                <span
                  className={`text-xs transition-colors duration-300 ${activeTab === "allPlayers" ? "text-cyan-300" : "text-gray-400"}`}
                >
                  Total Players
                </span>
              </button>
              {/* Remaining - clickable */}
              <button
                ref={remainingRef}
                onClick={() => setActiveTab("players")}
                className="flex flex-col items-center px-3 py-1 rounded transition-colors hover:bg-gray-800/50 relative z-10"
              >
                <span
                  className={`text-lg font-bold transition-colors duration-300 ${activeTab === "players" ? "text-green-300" : "text-green-400"}`}
                >
                  {activePlayers.length}
                </span>
                <span
                  className={`text-xs transition-colors duration-300 ${activeTab === "players" ? "text-green-300" : "text-gray-400"}`}
                >
                  Remaining
                </span>
              </button>
              {/* Eliminated - clickable */}
              <button
                ref={eliminatedRef}
                onClick={() => setActiveTab("eliminated")}
                className="flex flex-col items-center px-3 py-1 rounded transition-colors hover:bg-gray-800/50 relative z-10"
              >
                <span
                  className={`text-lg font-bold transition-colors duration-300 ${activeTab === "eliminated" ? "text-red-300" : "text-red-400"}`}
                >
                  {eliminatedPlayers.length}
                </span>
                <span
                  className={`text-xs transition-colors duration-300 ${activeTab === "eliminated" ? "text-red-300" : "text-gray-400"}`}
                >
                  Eliminated
                </span>
              </button>
            </div>
          )}

          {/* Feed Tabs Row */}
          <div className="flex items-center justify-between px-2 py-2">
            <div className="flex gap-1 min-w-0 flex-1">
              <button
                ref={feedTabRef}
                onClick={() => setActiveTab("all")}
                className={`px-2 py-1.5 text-xs font-medium transition-colors duration-300 shrink-0 relative z-10 border border-transparent rounded ${
                  activeTab === "all"
                    ? "text-cyan-300"
                    : "text-gray-400 hover:text-gray-300 hover:border-gray-600"
                }`}
              >
                Feed
              </button>
              <button
                ref={chatTabRef}
                onClick={() => setActiveTab("chat")}
                className={`px-2 py-1.5 text-xs font-medium transition-colors duration-300 flex items-center gap-1 shrink-0 relative z-10 border border-transparent rounded ${
                  activeTab === "chat"
                    ? "text-cyan-300"
                    : "text-gray-400 hover:text-gray-300 hover:border-gray-600"
                }`}
              >
                <MessageCircle className="h-4 w-4" />
                {chatMessageCount > 0 && (
                  <span
                    className={`text-xs px-1 py-0.5 rounded-full transition-colors duration-300 ${
                      activeTab === "chat" ? "bg-cyan-500/30" : "bg-gray-700"
                    }`}
                  >
                    {chatMessageCount}
                  </span>
                )}
              </button>
              <button
                ref={tdTabRef}
                onClick={() => setActiveTab("td")}
                className={`px-2 py-1.5 text-xs font-medium transition-colors duration-300 flex items-center gap-1 shrink-0 relative z-10 border border-transparent rounded ${
                  activeTab === "td"
                    ? "text-cyan-300"
                    : "text-gray-400 hover:text-gray-300 hover:border-gray-600"
                }`}
              >
                <Megaphone className="h-4 w-4" />
                {tdMessageCount > 0 && (
                  <span
                    className={`text-xs px-1 py-0.5 rounded-full transition-colors duration-300 ${
                      activeTab === "td" ? "bg-cyan-500/30" : "bg-gray-700"
                    }`}
                  >
                    {tdMessageCount}
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
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
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
        className="@[900px]:hidden overflow-y-auto scrollbar-styled"
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

        {/* Players Tab Content */}
        {activeTab === "players" && (
          <div style={{ minHeight: maxHeight }}>
            <div className="px-3 py-2 border-b border-cyan-500/20 bg-cyan-500/10">
              <span className="text-sm font-medium text-cyan-300">
                Active Players
              </span>
            </div>
            <PlayersGrid
              players={activePlayers}
              variant="active"
            />
          </div>
        )}

        {/* Eliminated Tab Content */}
        {activeTab === "eliminated" && (
          <div style={{ minHeight: maxHeight }}>
            <div className="px-3 py-2 border-b border-red-500/20 bg-red-500/10">
              <span className="text-sm font-medium text-red-300">
                Eliminated Players
              </span>
            </div>
            <PlayersGrid
              players={eliminatedPlayers}
              variant="eliminated"
              totalPlayers={totalPlayers || players?.length}
            />
          </div>
        )}

        {/* All Players Tab Content */}
        {activeTab === "allPlayers" && (
          <div style={{ minHeight: maxHeight }}>
            {/* Remaining Players Section */}
            <div className="px-3 py-2 border-b border-green-500/20 bg-green-500/10">
              <span className="text-sm font-medium text-green-300">
                Remaining ({activePlayers.length})
              </span>
            </div>
            <PlayersGrid
              players={activePlayers}
              variant="active"
            />

            {/* Eliminated Players Section */}
            <div className="px-3 py-2 border-b border-red-500/20 bg-red-500/10 mt-2">
              <span className="text-sm font-medium text-red-300">
                Eliminated ({eliminatedPlayers.length})
              </span>
            </div>
            <PlayersGrid
              players={eliminatedPlayers}
              variant="eliminated"
              totalPlayers={totalPlayers || players?.length}
            />
          </div>
        )}

        {/* TD Tab Content */}
        {activeTab === "td" && (
          <div style={{ minHeight: maxHeight }}>
            <div className="px-3 py-2 border-b border-amber-500/20 bg-amber-500/10">
              <span className="text-sm font-medium text-amber-300">
                TD Messages
              </span>
            </div>
            {!loading && !error && filteredItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Megaphone className="h-10 w-10 text-gray-600 mb-3" />
                <p className="text-gray-500 text-sm">No TD messages yet</p>
                <p className="text-gray-600 text-xs mt-1">
                  Messages from the Tournament Director will appear here
                </p>
              </div>
            )}
            {!loading && !error && filteredItems.length > 0 && (
              <div className="divide-y divide-gray-800/50">
                {filteredItems.map((item) => (
                  <FeedItem
                    key={item.id}
                    item={item}
                    onDelete={
                      isAdmin ? (itemId) => deleteItem(itemId) : undefined
                    }
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
          </div>
        )}

        {/* Empty State for non-TD/non-player tabs */}
        {activeTab !== "players" &&
          activeTab !== "eliminated" &&
          activeTab !== "allPlayers" &&
          activeTab !== "td" &&
          !loading &&
          !error &&
          filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              {activeTab === "chat" ? (
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
        {activeTab !== "players" &&
          activeTab !== "eliminated" &&
          activeTab !== "allPlayers" &&
          activeTab !== "td" &&
          !loading &&
          !error &&
          filteredItems.length > 0 && (
            <div className="divide-y divide-gray-800/50">
              {filteredItems.map((item) => (
                <FeedItem
                  key={item.id}
                  item={item}
                  onDelete={
                    isAdmin ? (itemId) => deleteItem(itemId) : undefined
                  }
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
        {activeTab !== "players" &&
          activeTab !== "eliminated" &&
          activeTab !== "allPlayers" &&
          activeTab !== "td" &&
          loadingMore && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 text-cyan-500 animate-spin" />
            </div>
          )}

        {/* End of Feed */}
        {activeTab !== "players" &&
          activeTab !== "eliminated" &&
          activeTab !== "allPlayers" &&
          activeTab !== "td" &&
          !loading &&
          !loadingMore &&
          !hasMore &&
          filteredItems.length > 0 && (
            <div className="text-center py-4 text-gray-600 text-xs">
              — End of feed —
            </div>
          )}
      </div>

      {/* Desktop Feed Content - three column layout (1300px+) */}
      <div
        className="hidden @[900px]:flex"
        style={{ maxHeight }}
      >
        {/* Left Column - Checkins/Knockouts */}
        <div className="flex-1 overflow-y-auto scrollbar-styled border-r border-cyan-500/20 flex flex-col">
          {/* Column Header */}
          <div className="px-3 py-2 border-b border-cyan-500/20 bg-cyan-500/10">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-medium text-cyan-300">
                Checkins / Knockouts
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-styled">
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
          </div>
        </div>

        {/* Middle Column - TD Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-styled border-r border-cyan-500/20 flex flex-col bg-gray-900/40">
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
          <div className="flex-1 overflow-y-auto scrollbar-styled">
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
                    onReact={handleReact}
                    reactionBalance={reactionBalance}
                    canReact={canPost}
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

          <div className="flex-1 overflow-y-auto scrollbar-styled">
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
          </div>
        </div>
      </div>
    </div>
  );
}
