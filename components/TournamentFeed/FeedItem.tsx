// components/TournamentFeed/FeedItem.tsx

"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { FeedItem as FeedItemType } from "@/lib/realtime/hooks/useTournamentFeed";
import { Skull, UserCheck, Megaphone, X, Star, Camera } from "lucide-react";
import PlayerAvatar from "@/components/ui/PlayerAvatar";
import { ReactionBar } from "./ReactionBar";
import { SuitCounts, ReactionType } from "@/types";
import Image from "next/image";

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

// VS Card Avatar component for knockout display
function KnockoutAvatar({
  photoUrl,
  name,
  uid,
  isEliminated,
}: {
  photoUrl?: string | null;
  name: string;
  uid?: string | null;
  isEliminated: boolean;
}) {
  const initial = name.charAt(0).toUpperCase();

  if (photoUrl) {
    return (
      <PlayerAvatar
        photoUrl={photoUrl}
        name={name}
        uid={uid}
        size="sm"
        showFallback={false}
        className={`rounded-full`}
      />
    );
  }

  // Fallback when no photo
  return (
    <div
      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
        ${isEliminated ? "bg-red-500/30" : "bg-cyan-500/30"}`}
    >
      <span
        className={`text-sm font-bold ${isEliminated ? "text-red-300" : "text-cyan-300"}`}
      >
        {initial}
      </span>
    </div>
  );
}

// Knockout Item - VS Card Style
function KnockoutItem({ item, totalPlayers, startPoints = 0 }: FeedItemProps) {
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

  // Determine the left icon based on knockout type
  const LeftIcon = () => {
    if (isFirstBlood) {
      return <span className="text-red-500 text-3xl">🩸</span>;
    }
    if (isBubble) {
      return (
        <Image
          src="/images/sad-bubble.png"
          alt="Bubble"
          width={32}
          height={32}
          className="!h-12 !w-12"
        />
      );
    }
    return <Skull className="h-8 w-8 text-red-400/80" />;
  };

  return (
    <div className="flex hover:bg-gray-800/30 transition-colors">
      {/* Full-height flush-left icon column with diagonal stripes */}
      <div
        className="flex-shrink-0 w-12 flex items-center justify-center"
        style={{
          background: `repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 4px,
            rgba(75, 85, 99, 0.3) 4px,
            rgba(75, 85, 99, 0.3) 5px
          )`,
        }}
      >
        <LeftIcon />
      </div>

      {/* Content column */}
      <div className="flex-1 flex flex-col gap-1 p-3">
        {/* VS Card Layout */}
        <div className="flex items-center gap-1 flex-wrap">
          {/* First Blood: Show hitman first */}
          {isFirstBlood ? (
            <>
              {/* Hitman Avatar */}
              <KnockoutAvatar
                photoUrl={item.hitman_photo_url}
                name={hitmanDisplay || "Unknown"}
                uid={item.hitman_uid}
                isEliminated={false}
              />

              {/* Hitman Name */}
              <span className="text-sm font-medium text-cyan-400">
                {hitmanDisplay || "Unknown"}
              </span>

              {/* Action text */}
              <span className="text-sm">
                <span className="text-gray-500 text-xs">drew 1st blood. </span>
                <span className="text-red-400 font-medium">
                  {item.eliminated_player_name}
                </span>
                <span className="text-gray-500 text-xs"> eliminated.</span>
              </span>
            </>
          ) : isBubble ? (
            <>
              {/* Eliminated Player Avatar */}
              <KnockoutAvatar
                photoUrl={item.eliminated_player_photo_url}
                name={item.eliminated_player_name || "Unknown"}
                uid={item.eliminated_player_uid}
                isEliminated={true}
              />

              {/* Eliminated Player Name */}
              <span className="text-sm font-medium text-red-400">
                {item.eliminated_player_name}
              </span>

              {/* Action text */}
              <span className="text-gray-500 text-xs">burst the bubble!</span>
            </>
          ) : (
            <>
              {/* Regular knockout: Eliminated Player Avatar */}
              <KnockoutAvatar
                photoUrl={item.eliminated_player_photo_url}
                name={item.eliminated_player_name || "Unknown"}
                uid={item.eliminated_player_uid}
                isEliminated={true}
              />

              {/* Eliminated Player Name */}
              <span className="text-sm font-medium text-red-400">
                {item.eliminated_player_name}
              </span>

              {/* Hitman / Action text */}
              <span className="text-sm">
                <span className="text-gray-500 text-xs">KO&apos;d by </span>
                <span className="text-cyan-400 font-medium">
                  {hitmanDisplay || "unknown"}
                </span>
              </span>
            </>
          )}
        </div>

        {/* Meta info row */}
        <div className="flex items-center gap-2">
          {totalPoints > 0 && (
            <span className="text-xs text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Star
                size={10}
                className="fill-current"
              />
              {totalPoints} point{totalPoints !== 1 ? "s" : ""}
            </span>
          )}
          <span className="text-xs text-gray-500">
            {formatRelativeTime(item.created_at)}
          </span>
          {isFirstBlood && (
            <span className="text-xs text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded">
              First Blood
            </span>
          )}
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

// Photo Modal Component (renders via portal)
function PhotoModal({
  photoUrl,
  caption,
  isOpen,
  onClose,
}: {
  photoUrl: string;
  caption?: string | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  // Handle escape key and body scroll
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] p-4 animate-fadeIn"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 bg-white/20 hover:bg-white/30 text-white rounded-full p-2 transition-all backdrop-blur-sm"
        aria-label="Close"
      >
        <X size={24} />
      </button>

      {/* Image */}
      <div onClick={(e) => e.stopPropagation()} className="relative">
        <Image
          src={photoUrl}
          alt="Tournament photo"
          width={1200}
          height={800}
          className="max-w-full max-h-[85vh] object-contain rounded-lg"
          unoptimized
        />
      </div>

      {/* Caption */}
      {caption && (
        <div className="absolute bottom-4 left-4 right-4 text-center">
          <p className="text-white/90 text-lg bg-black/60 px-4 py-2 rounded-lg inline-block backdrop-blur-sm">
            {caption}
          </p>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}

// Photo Item
function PhotoItem({ item, onDelete }: FeedItemProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!item.photo_url) return null;

  return (
    <>
      <div className="flex gap-3 p-3 hover:bg-gray-800/30 transition-colors bg-amber-500/5 group">
        {/* Icon */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
          <Camera className="h-4 w-4 text-amber-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-medium text-amber-300 text-sm">
              Tournament Photo
            </span>
            <span className="text-xs text-gray-500">
              {formatRelativeTime(item.created_at)}
            </span>
          </div>

          {/* Photo thumbnail - click to enlarge */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="block relative overflow-hidden rounded-lg border border-amber-500/30 hover:border-amber-500/60 transition-colors cursor-pointer"
          >
            <Image
              src={item.photo_url}
              alt="Tournament photo"
              width={300}
              height={200}
              className="object-cover max-h-48 w-auto"
              unoptimized
            />
          </button>

          {/* Caption */}
          {item.message_text && (
            <p className="text-gray-300 text-sm mt-2 break-words whitespace-pre-wrap">
              {item.message_text}
            </p>
          )}
        </div>

        {/* Delete Button */}
        {onDelete && typeof item.id === "number" && (
          <button
            onClick={() => onDelete(item.id as number)}
            className="flex-shrink-0 p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
            title="Delete photo"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Fullscreen Modal (rendered via portal) */}
      <PhotoModal
        photoUrl={item.photo_url}
        caption={item.message_text}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
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
    case "photo":
      return (
        <PhotoItem
          item={item}
          onDelete={onDelete}
        />
      );
    default:
      return null;
  }
}
