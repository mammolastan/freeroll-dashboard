// components/TournamentFeed/FeedItem.tsx

"use client";

import React from "react";
import Image from "next/image";
import { FeedItem as FeedItemType } from "@/lib/realtime/hooks/useTournamentFeed";
import { Skull, UserCheck, Info, Megaphone, X } from "lucide-react";
import PlayerAvatar from "@/components/ui/PlayerAvatar";

interface FeedItemProps {
  item: FeedItemType;
  totalPlayers?: number;
  onDelete?: (itemId: number) => void;
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

// Knockout Item
function KnockoutItem({ item, totalPlayers }: FeedItemProps) {
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

  const hitmanDisplay =
    item.hitman_name && item.hitman_name !== "unknown"
      ? item.hitman_name
      : null;

  const isBubble = placement === 9;

  return (
    <div className="flex gap-3 p-3 hover:bg-gray-800/30 transition-colors">
      {/* Icon */}
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
              <span className="font-medium text-cyan-400">{hitmanDisplay}</span>
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
        </div>
      </div>
    </div>
  );
}

// Message Item
function MessageItem({ item, onDelete }: FeedItemProps) {
  return (
    <div className="flex gap-3 p-3 hover:bg-gray-800/30 transition-colors group">
      {/* Avatar/Icon */}
      {item.author_photo_url ? (
        <PlayerAvatar
          photoUrl={item.author_photo_url}
          name={item.author_name || "User"}
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
      </div>

      {/* Delete Button */}
      {onDelete && (
        <button
          onClick={() => onDelete(item.id)}
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
  return (
    <div className="flex gap-3 p-3 hover:bg-gray-800/30 transition-colors">
      {/* Icon */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
        <UserCheck className="h-4 w-4 text-green-400" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-400">
          {item.message_text || "A player checked in"}
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
    <div className="flex gap-3 p-3 hover:bg-gray-800/30 transition-colors">
      {/* Icon */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
        <Info className="h-4 w-4 text-purple-400" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-purple-300">{item.message_text}</div>
        <div className="text-xs text-gray-500 mt-1">
          {formatRelativeTime(item.created_at)}
        </div>
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
        <p className="text-gray-200 text-sm mt-0.5 break-words whitespace-pre-wrap">
          {item.message_text}
        </p>
      </div>

      {/* Delete Button */}
      {onDelete && (
        <button
          onClick={() => onDelete(item.id)}
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
export function FeedItem({ item, totalPlayers, onDelete }: FeedItemProps) {
  switch (item.item_type) {
    case "knockout":
      return (
        <KnockoutItem
          item={item}
          totalPlayers={totalPlayers}
        />
      );
    case "message":
      return (
        <MessageItem
          item={item}
          onDelete={onDelete}
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
