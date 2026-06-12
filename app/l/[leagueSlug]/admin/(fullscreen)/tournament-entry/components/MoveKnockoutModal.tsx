"use client";

import { useState, useCallback, useMemo } from "react";
import { X, GripVertical } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { toOrdinal } from "@/lib/formatUtils";

interface KnockedOutPlayer {
  id: number;
  player_name: string;
  player_nickname?: string | null;
  knockedout_at?: string | Date | null;
}

interface MoveKnockoutModalProps {
  playerId: number;
  playerName: string;
  knockedOutPlayers: KnockedOutPlayer[];
  totalPlayers: number;
  onMove: (playerId: number, afterPlayerId: number | null) => Promise<void>;
  onClose: () => void;
}

// The draggable row for the player being moved (shown in-place in the list)
function DraggablePlayerRow({
  playerName,
  position,
  placement,
  isLatest,
  isDragging,
}: {
  playerName: string;
  position: number;
  placement: number;
  isLatest: boolean;
  isDragging: boolean;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: "player-to-move",
  });

  const positionLabel = isLatest ? `Latest (${toOrdinal(placement)})` : `#${position} (${toOrdinal(placement)})`;

  // Show placeholder when dragging
  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        className="px-4 py-2.5 border-b border-gray-100 bg-blue-50 border-2 border-dashed border-blue-300"
      >
        <div className="flex items-center gap-2 opacity-40">
          <GripVertical size={16} className="text-gray-400" />
          <span className="font-medium text-gray-400 mr-2">
            {positionLabel}
          </span>
          <span className="text-gray-400">{playerName}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="
        px-4 py-2.5 border-b border-gray-100
        bg-blue-600 text-white
        cursor-grab active:cursor-grabbing touch-none select-none
        transition-colors
      "
    >
      <div className="flex items-center gap-2">
        <GripVertical size={16} className="text-blue-200" />
        <span className="font-medium text-blue-200 mr-2">
          {positionLabel}
        </span>
        <span>{playerName}</span>
      </div>
    </div>
  );
}

// The pill shown during drag (follows cursor)
function DragOverlayPill({ playerName }: { playerName: string }) {
  return (
    <div
      className="
        inline-flex items-center gap-2 px-4 py-2.5 rounded-lg
        bg-blue-600 text-white font-medium
        cursor-grabbing shadow-2xl
        ring-2 ring-blue-400 ring-offset-2
      "
    >
      <GripVertical size={16} className="text-blue-200" />
      <span>{playerName}</span>
    </div>
  );
}

// Drop zone between list items - always present for consistent layout
// Only shows visual indicator when pill is hovering over it
function DropZone({
  id,
  isActive,
  isAdjacentToSelected,
}: {
  id: string;
  isActive: boolean;
  isAdjacentToSelected?: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });

  // Don't allow dropping in adjacent zones (would be same position)
  const canDrop = isActive && !isAdjacentToSelected;

  // Always render with consistent minimal height to prevent layout shift
  return (
    <div
      ref={canDrop ? setNodeRef : undefined}
      className={`
        relative h-1 transition-all duration-100
        ${isOver && canDrop ? "h-5 -my-2 mx-2" : "mx-3"}
      `}
    >
      {/* Only show indicator when hovering and can drop */}
      {isOver && canDrop && (
        <>
          {/* The indicator line */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-blue-500 rounded-full" />
          {/* Circle indicators on ends */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-blue-500 rounded-full -ml-0.5" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-blue-500 rounded-full -mr-0.5" />
        </>
      )}
    </div>
  );
}

// Static player row (not draggable)
function KnockoutListItem({
  player,
  position,
  placement,
  isLatest,
}: {
  player: KnockedOutPlayer;
  position: number;
  placement: number;
  isLatest: boolean;
}) {
  const displayName = player.player_nickname || player.player_name;
  const positionLabel = isLatest ? `Latest (${toOrdinal(placement)})` : `#${position} (${toOrdinal(placement)})`;

  return (
    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-gray-700">
      <span className="font-medium text-gray-500 mr-2">
        {positionLabel}
      </span>
      <span>{displayName}</span>
    </div>
  );
}

export default function MoveKnockoutModal({
  playerId,
  playerName,
  knockedOutPlayers,
  totalPlayers,
  onMove,
  onClose,
}: MoveKnockoutModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Pending move state for confirmation
  const [pendingMove, setPendingMove] = useState<{
    afterPlayerId: number | null;
    newPosition: number;
  } | null>(null);

  // Sort ALL knocked out players by knockout time (latest first), including the one being moved
  const allKnockedOut = useMemo(() => {
    return knockedOutPlayers
      .filter((p) => p.knockedout_at)
      .sort((a, b) => {
        const timeA = new Date(a.knockedout_at!).getTime();
        const timeB = new Date(b.knockedout_at!).getTime();
        if (timeA !== timeB) return timeB - timeA; // DESC - latest first
        // Tie-breaker: higher id = later knockout (matches DB: ORDER BY knockedout_at ASC, id ASC)
        return b.id - a.id;
      });
  }, [knockedOutPlayers]);

  // Find the index of the player being moved in the sorted list
  const selectedPlayerIndex = useMemo(() => {
    return allKnockedOut.findIndex((p) => p.id === playerId);
  }, [allKnockedOut, playerId]);

  // Configure sensors for both mouse and touch
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5,
      },
    })
  );

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setIsDragging(false);

      const { over } = event;
      if (!over) return;

      const dropId = over.id as string;
      let afterPlayerId: number | null = null;
      let newPosition: number;

      // In a "latest first" display:
      // - Top of list = latest knockout (highest KO#)
      // - Bottom of list = first knockout (KO #1)
      //
      // Drop zones appear AFTER each row visually. Dropping in the zone after row X
      // means the user wants to take position X (pushing X and everyone above up by 1).
      // To achieve this, we knock out AFTER the player BELOW X in the list.

      if (dropId === "drop-first") {
        // Dropped at the very top = become the new latest (highest KO#)
        // We need to knock out AFTER the current latest player
        const currentLatest = allKnockedOut.find(p => p.id !== playerId);
        if (currentLatest) {
          afterPlayerId = currentLatest.id;
          // New position will be the total count (we become the new highest)
          newPosition = allKnockedOut.length;
        } else {
          afterPlayerId = null;
          newPosition = 1;
        }
      } else if (dropId.startsWith("drop-after-")) {
        // Get the player whose row this drop zone is below
        const rowPlayerId = parseInt(dropId.replace("drop-after-", ""), 10);
        const rowPlayerIndex = allKnockedOut.findIndex(p => p.id === rowPlayerId);

        // The user wants this position (the row they're dropping under)
        // Calculate from sorted order (latest first = highest position)
        newPosition = allKnockedOut.length - rowPlayerIndex;

        // Find the player BELOW this row (they knocked out earlier)
        // We'll set our knockedout_at to be just after theirs
        let belowIndex = rowPlayerIndex + 1;

        // Skip the player being moved if they're next
        while (belowIndex < allKnockedOut.length && allKnockedOut[belowIndex].id === playerId) {
          belowIndex++;
        }

        if (belowIndex < allKnockedOut.length) {
          afterPlayerId = allKnockedOut[belowIndex].id;
        } else {
          // No one below = become first knockout (#1)
          afterPlayerId = null;
          newPosition = 1;
        }
      } else {
        return;
      }

      // Set pending move for confirmation
      setPendingMove({ afterPlayerId, newPosition });
    },
    [allKnockedOut, playerId]
  );

  const handleDragCancel = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleConfirmMove = async () => {
    if (!pendingMove || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onMove(playerId, pendingMove.afterPlayerId);
    } catch (error) {
      console.error("Failed to move knockout:", error);
      setIsSubmitting(false);
      setPendingMove(null);
    }
  };

  const handleCancelMove = () => {
    setPendingMove(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 overflow-y-auto py-4">
      <div className="bg-white rounded-lg max-w-md w-full mx-4 my-auto shadow-xl max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Move Knockout Position
          </h3>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto">
          {pendingMove ? (
            /* Confirmation View */
            <div className="text-center py-6">
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-blue-600 text-white font-medium mb-4">
                  <span>{playerName}</span>
                </div>
                <p className="text-lg text-gray-700">
                  Move to{" "}
                  <span className="font-semibold text-blue-600">
                    KO #{pendingMove.newPosition} ({toOrdinal(totalPlayers - pendingMove.newPosition + 1)})
                  </span>
                  ?
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCancelMove}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmMove}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Moving..." : "Confirm"}
                </button>
              </div>
            </div>
          ) : (
            /* Drag View */
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              {/* Instructions */}
              <p className="text-sm text-gray-500 mb-4">
                Drag the highlighted player to a new position:
              </p>

              {/* Knockout order list with drop zones */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Knockout Order (Latest First)
                </div>

                {/* Drop zone before first item (to become earliest/first knockout) */}
                <DropZone
                  id="drop-first"
                  isActive={isDragging}
                  isAdjacentToSelected={selectedPlayerIndex === allKnockedOut.length - 1}
                />

                {/* List of all knocked out players */}
                {allKnockedOut.map((player, index) => {
                  // Calculate position from sorted order (latest first = highest position)
                  const position = allKnockedOut.length - index;
                  // Placement = totalPlayers - koPosition + 1 (e.g., 15 players, KO #5 = 11th place)
                  const placement = totalPlayers - position + 1;
                  const isLatest = index === 0;
                  const isSelected = player.id === playerId;

                  // Check if this drop zone is adjacent to selected player (can't drop there)
                  const isDropZoneAdjacentToSelected =
                    index === selectedPlayerIndex || index === selectedPlayerIndex - 1;

                  return (
                    <div key={player.id}>
                      {isSelected ? (
                        <DraggablePlayerRow
                          playerName={player.player_nickname || player.player_name}
                          position={position}
                          placement={placement}
                          isLatest={isLatest}
                          isDragging={isDragging}
                        />
                      ) : (
                        <KnockoutListItem
                          player={player}
                          position={position}
                          placement={placement}
                          isLatest={isLatest}
                        />
                      )}
                      {/* Drop zone after this player */}
                      <DropZone
                        id={`drop-after-${player.id}`}
                        isActive={isDragging}
                        isAdjacentToSelected={isDropZoneAdjacentToSelected}
                      />
                    </div>
                  );
                })}

                {allKnockedOut.length === 0 && (
                  <div className="px-4 py-6 text-center text-gray-400 text-sm">
                    No knocked out players
                  </div>
                )}
              </div>

              {/* Drag overlay - follows cursor during drag */}
              <DragOverlay dropAnimation={null}>
                {isDragging ? <DragOverlayPill playerName={playerName} /> : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        {/* Footer - only show cancel when not in confirmation mode */}
        {!pendingMove && (
          <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
