// components/TournamentFeed/FeedItem.tsx

"use client";

import React from "react";
import Image from "next/image";
import { FeedItem as FeedItemType } from "@/lib/realtime/hooks/useTournamentFeed";
import { Skull, UserCheck, Megaphone, X, Star } from "lucide-react";
import PlayerAvatar from "@/components/ui/PlayerAvatar";
import { ReactionBar } from "./ReactionBar";
import { SuitCounts, ReactionType } from "@/types";

interface FeedItemProps {
  item: FeedItemType;
  totalPlayers?: number;
  onDelete?: (itemId: number) => void;
  startPoints?: number;
  onReact?: (itemId: string, reactionType: ReactionType, count: number) => void;
  reactionBalance?: SuitCounts | null;
  canReact?: boolean;
  tournamentId?: number;
}

// Format relative time (e.g., "2m ago", "1h ago")
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Calculate placement points (same formula as integrate route)
function calculatePlacementPoints(placement: number): number {
  if (placement === 1) return 10;
  if (placement === 2) return 7;
  if (placement >= 3 && placement <= 8) return 9 - placement;
  return 0;
}

// Knockout Item
function KnockoutItem({
  item,
  totalPlayers,
  startPoints = 0,
  onReact,
  reactionBalance,
  canReact = false,
  tournamentId,
}: FeedItemProps) {
  function getOrdinalSuffix(n: number): string {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }
  // Calculate placement dynamically
  const placement =
    item.ko_position && totalPlayers
      ? totalPlayers - item.ko_position + 1
      : null;

  // Calculate points earned (only for 8th place or better)
  const placementPoints =
    placement && placement <= 8 ? calculatePlacementPoints(placement) : 0;
  const totalPoints = placementPoints > 0 ? startPoints + placementPoints : 0;

  const hitmanDisplay =
    item.hitman_name && item.hitman_name !== "unknown"
      ? item.hitman_name
      : null;

  const isBubble = placement === 9;
  const isFirstBlood = item.ko_position === 1;

  return (
    <div className="flex gap-3 p-3 hover:bg-gray-800/30 transition-colors">
      {isBubble ? (
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden">
          <Image
            src="/images/sad-bubble.png"
            alt="Bubble"
            width={128}
            height={128}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
          <Skull className="h-4 w-4 text-red-400" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-sm">
          {isFirstBlood ? (
            <>
              <span className="font-medium text-cyan-400">
                {hitmanDisplay ? hitmanDisplay : "Somebody"}
              </span>
              <span className="text-gray-400"> drew first blood! </span>
              <span className="font-medium text-red-400">
                {item.eliminated_player_name}
              </span>
              <span className="text-gray-400"> eliminated</span>
            </>
          ) : (
            <>
              <span className="font-medium text-red-400">
                {item.eliminated_player_name}
              </span>
              {isBubble ? (
                <span className="text-gray-400"> burst the bubble!</span>
              ) : (
                <span className="text-gray-400"> was eliminated</span>
              )}
              {hitmanDisplay && !isBubble && (
                <>
                  <span className="text-gray-400"> by </span>
                  <span className="font-medium text-cyan-400">
                    {hitmanDisplay}
                  </span>
                </>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-500">
            {formatRelativeTime(item.created_at)}
          </span>
          {placement !== null && (
            <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
              {placement}
              {getOrdinalSuffix(placement)} place
            </span>
          )}
          {totalPoints > 0 && (
            <span className="text-xs text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Star
                size={10}
                className="fill-current"
              />
              {totalPoints} point{totalPoints !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {onReact && (
          <ReactionBar
            itemId={String(item.id)}
            totals={
              item.reactions?.totals || {
                heart: 0,
                diamond: 0,
                club: 0,
                spade: 0,
              }
            }
            mine={item.reactions?.mine}
            balance={reactionBalance ?? null}
            canReact={canReact}
            onReact={onReact}
            tournamentId={tournamentId}
          />
        )}
      </div>
    </div>
  );
}

// Message Item
function MessageItem({
  item,
  onDelete,
  onReact,
  reactionBalance,
  canReact = false,
  tournamentId,
}: FeedItemProps) {
  return (
    <div className="flex gap-3 p-3 hover:bg-gray-800/30 transition-colors group">
      {/* Avatar/Icon */}
      {item.author_photo_url ? (
        <PlayerAvatar
          photoUrl={item.author_photo_url}
          name={item.author_name || "User"}
          uid={item.author_uid}
          size="sm"
          showFallback={false}
        />
      ) : (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
          <span className="text-sm font-medium text-cyan-400">
            {item.author_name?.charAt(0).toUpperCase() || "?"}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-cyan-300 text-sm">
            {item.author_name || "Anonymous"}
          </span>
          <span className="text-xs text-gray-500">
            {formatRelativeTime(item.created_at)}
          </span>
        </div>
        <p className="text-gray-300 text-sm mt-0.5 break-words whitespace-pre-wrap">
          {item.message_text}
        </p>
        {onReact && (
          <ReactionBar
            itemId={String(item.id)}
            totals={
              item.reactions?.totals || {
                heart: 0,
                diamond: 0,
                club: 0,
                spade: 0,
              }
            }
            mine={item.reactions?.mine}
            balance={reactionBalance ?? null}
            canReact={canReact}
            onReact={onReact}
            tournamentId={tournamentId}
          />
        )}
      </div>

      {/* Delete Button */}
      {onDelete && typeof item.id === "number" && (
        <button
          onClick={() => onDelete(item.id as number)}
          className="flex-shrink-0 p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
          title="Delete message"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// Check-in Item
function CheckInItem({ item }: FeedItemProps) {
  const playerName = item.author_name || "A player";

  return (
    <div className="flex gap-3 p-3 hover:bg-gray-800/30 transition-colors">
      {/* Avatar - spans both lines */}
      {item.author_photo_url ? (
        <PlayerAvatar
          photoUrl={item.author_photo_url}
          name={playerName}
          uid={item.author_uid}
          size="sm"
          showFallback={false}
          className="flex-shrink-0"
        />
      ) : (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
          <span className="text-sm font-medium text-green-400">
            {playerName.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-sm">
          <UserCheck className="h-4 w-4 text-green-400 flex-shrink-0" />
          <span className="font-medium text-green-300">{playerName}</span>
          <span className="text-gray-400">checked in</span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {formatRelativeTime(item.created_at)}
        </div>
      </div>
    </div>
  );
}

// System Message Item
function SystemItem({ item }: FeedItemProps) {
  return (
    <div className="p-3 bg-orange-500/10 border-l-2 border-orange-500/50 transition-colors text-center">
      <div className="text-sm text-orange-200">{item.message_text}</div>
      <div className="text-xs text-orange-400/60 mt-1">
        {formatRelativeTime(item.created_at)}
      </div>
    </div>
  );
}

// TD Message Item
function TDMessageItem({ item, onDelete }: FeedItemProps) {
  return (
    <div className="flex gap-3 p-3 hover:bg-gray-800/30 transition-colors bg-cyan-500/5 group">
      {/* Icon */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
        <Megaphone className="h-4 w-4 text-cyan-400" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-cyan-300 text-sm">
            Tournament Director
          </span>
          <span className="text-xs text-gray-500">
            {formatRelativeTime(item.created_at)}
          </span>
        </div>
        <p className="text-gray-200 text-xl mt-0.5 break-words whitespace-pre-wrap">
          {item.message_text}
        </p>
      </div>

      {/* Delete Button */}
      {onDelete && typeof item.id === "number" && (
        <button
          onClick={() => onDelete(item.id as number)}
          className="flex-shrink-0 p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
          title="Delete message"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// Main FeedItem Component (polymorphic)
export function FeedItem({
  item,
  totalPlayers,
  onDelete,
  startPoints,
  onReact,
  reactionBalance,
  canReact,
  tournamentId,
}: FeedItemProps) {
  switch (item.item_type) {
    case "knockout":
      return (
        <KnockoutItem
          item={item}
          totalPlayers={totalPlayers}
          startPoints={startPoints}
          onReact={onReact}
          reactionBalance={reactionBalance}
          canReact={canReact}
          tournamentId={tournamentId}
        />
      );
    case "message":
      return (
        <MessageItem
          item={item}
          onDelete={onDelete}
          onReact={onReact}
          reactionBalance={reactionBalance}
          canReact={canReact}
          tournamentId={tournamentId}
        />
      );
    case "checkin":
      return <CheckInItem item={item} />;
    case "system":
      return <SystemItem item={item} />;
    case "td_message":
      return (
        <TDMessageItem
          item={item}
          onDelete={onDelete}
        />
      );
    default:
      return null;
  }
}
