"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  MapPin,
  Users,
  Trophy,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Check,
  Loader2,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Venue {
  id: number;
  name: string;
}

interface Period {
  id: number;
  name: string;
  periodType: string;
  startDate?: string;
}

interface Game {
  id: number;
  uid: string;
  date: string;
  time: string | null;
  director: string | null;
  bonusPoints: number;
  venue: Venue;
  periods: Period[];
  playerCount: number;
}

interface Player {
  id: number;
  name: string;
  uid: string;
  placement: number | null;
  startPoints: number;
  hitman: string | null;
  totalPoints: number;
  playerScore: number | null;
}

interface ScoringRule {
  placement: number;
  points: number;
}

interface ScoringSystem {
  rules: ScoringRule[];
  defaultPoints: number;
}

// Helper function to calculate points for a given placement
function getPointsForPlacement(placement: number, scoringSystem: ScoringSystem): number {
  const rule = scoringSystem.rules.find((r) => r.placement === placement);
  return rule?.points ?? scoringSystem.defaultPoints;
}

interface TournamentsSectionProps {
  leagueSlug: string;
}

export function TournamentsSection({ leagueSlug }: TournamentsSectionProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchDate, setSearchDate] = useState("");
  const [expandedGameId, setExpandedGameId] = useState<number | null>(null);

  // Data for dropdowns
  const [venues, setVenues] = useState<Venue[]>([]);
  const [allPeriods, setAllPeriods] = useState<Period[]>([]);

  const fetchGames = useCallback(
    async (date?: string) => {
      setLoading(true);
      try {
        const url = date
          ? `/api/${leagueSlug}/admin/tournaments?date=${date}`
          : `/api/${leagueSlug}/admin/tournaments`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch games");
        const data = await res.json();
        setGames(data.games);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [leagueSlug]
  );

  const fetchVenues = useCallback(async () => {
    try {
      const res = await fetch(`/api/${leagueSlug}/venues?activeOnly=true`);
      if (res.ok) {
        const data = await res.json();
        setVenues(data.venues);
      }
    } catch {
      // Ignore venue fetch errors
    }
  }, [leagueSlug]);

  const fetchPeriods = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/competition-periods?league=${leagueSlug}`
      );
      if (res.ok) {
        const data = await res.json();
        const periods = data.periods.map(
          (p: { id: number; name: string; period_type: string; start_date: string }) => ({
            id: p.id,
            name: p.name,
            periodType: p.period_type,
            startDate: p.start_date,
          })
        );
        // Sort by start_date descending (most recent first)
        periods.sort((a: Period, b: Period) => {
          const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
          const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
          return dateB - dateA;
        });
        setAllPeriods(periods);
      }
    } catch {
      // Ignore period fetch errors
    }
  }, [leagueSlug]);

  useEffect(() => {
    fetchGames();
    fetchVenues();
    fetchPeriods();
  }, [fetchGames, fetchVenues, fetchPeriods]);

  const handleDateSearch = () => {
    if (searchDate) {
      fetchGames(searchDate);
    }
  };

  const handleClearSearch = () => {
    setSearchDate("");
    fetchGames();
  };

  const handleGameUpdated = (updatedGame: Game) => {
    setGames((prev) =>
      prev.map((g) => (g.id === updatedGame.id ? updatedGame : g))
    );
  };

  if (loading && games.length === 0) {
    return (
      <div>
        <div className="text-white/40">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div>
      {/* Date Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="date"
            value={searchDate}
            onChange={(e) => setSearchDate(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500"
          />
        </div>
        <button
          onClick={handleDateSearch}
          disabled={!searchDate}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-white/10 disabled:text-white/30 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Search className="w-4 h-4" />
          Search
        </button>
        {searchDate && (
          <button
            onClick={handleClearSearch}
            className="px-3 py-2 text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {searchDate && (
        <p className="text-white/40 text-sm mb-4">
          Showing games within 5 days of {searchDate}
        </p>
      )}

      {/* Games List */}
      <div className="space-y-2">
        {games.length === 0 ? (
          <div className="text-white/40 text-sm py-8 text-center">
            No games found
          </div>
        ) : (
          games.map((game) => (
            <GameRow
              key={game.id}
              game={game}
              isExpanded={expandedGameId === game.id}
              onToggle={() =>
                setExpandedGameId(expandedGameId === game.id ? null : game.id)
              }
              leagueSlug={leagueSlug}
              venues={venues}
              allPeriods={allPeriods}
              onGameUpdated={handleGameUpdated}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface GameRowProps {
  game: Game;
  isExpanded: boolean;
  onToggle: () => void;
  leagueSlug: string;
  venues: Venue[];
  allPeriods: Period[];
  onGameUpdated: (game: Game) => void;
}

function formatGameDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00"); // Add time to avoid timezone issues
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function GameRow({
  game,
  isExpanded,
  onToggle,
  leagueSlug,
  venues,
  allPeriods,
  onGameUpdated,
}: GameRowProps) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      {/* Collapsed Row */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="text-left">
            <div className="text-white font-medium">{formatGameDate(game.date)}</div>
            <div className="text-white/40 text-sm flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {game.venue.name}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-white/60 text-sm">
            <Users className="w-4 h-4" />
            {game.playerCount}
          </div>
          {game.bonusPoints > 0 && (
            <div className="flex items-center gap-1 text-amber-400 text-sm">
              <Trophy className="w-4 h-4" />+{game.bonusPoints}
            </div>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-white/40" />
          ) : (
            <ChevronDown className="w-5 h-5 text-white/40" />
          )}
        </div>
      </button>

      {/* Expanded Editor */}
      {isExpanded && (
        <GameEditor
          game={game}
          leagueSlug={leagueSlug}
          venues={venues}
          allPeriods={allPeriods}
          onGameUpdated={onGameUpdated}
        />
      )}
    </div>
  );
}

interface GameEditorProps {
  game: Game;
  leagueSlug: string;
  venues: Venue[];
  allPeriods: Period[];
  onGameUpdated: (game: Game) => void;
}

function GameEditor({
  game,
  leagueSlug,
  venues,
  allPeriods,
  onGameUpdated,
}: GameEditorProps) {
  const [venueId, setVenueId] = useState(game.venue.id);
  const [date, setDate] = useState(game.date);
  const [bonusPoints, setBonusPoints] = useState(game.bonusPoints.toString());
  const [selectedPeriodIds, setSelectedPeriodIds] = useState<number[]>(
    game.periods.map((p) => p.id)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showPlayersModal, setShowPlayersModal] = useState(false);

  const hasChanges =
    venueId !== game.venue.id ||
    date !== game.date ||
    bonusPoints !== game.bonusPoints.toString() ||
    JSON.stringify(selectedPeriodIds.sort()) !==
      JSON.stringify(game.periods.map((p) => p.id).sort());

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch(
        `/api/${leagueSlug}/admin/tournaments/${game.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            venueId,
            date,
            bonusPoints: parseInt(bonusPoints, 10) || 0,
            periodIds: selectedPeriodIds,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      const data = await res.json();
      onGameUpdated(data.game);
      setSaveMessage("Saved!");
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const togglePeriod = (periodId: number) => {
    setSelectedPeriodIds((prev) =>
      prev.includes(periodId)
        ? prev.filter((id) => id !== periodId)
        : [...prev, periodId]
    );
  };

  // Group periods by type
  const monthlyPeriods = allPeriods.filter((p) => p.periodType === "monthly");
  const quarterlyPeriods = allPeriods.filter(
    (p) => p.periodType === "quarterly"
  );

  return (
    <div className="px-4 pb-4 border-t border-white/10 pt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Venue */}
        <div>
          <label className="block text-white/60 text-xs uppercase tracking-widest mb-1">
            Venue
          </label>
          <select
            value={venueId}
            onChange={(e) => setVenueId(parseInt(e.target.value, 10))}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500"
          >
            {venues.map((v) => (
              <option key={v.id} value={v.id} className="bg-gray-900">
                {v.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="block text-white/60 text-xs uppercase tracking-widest mb-1">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Bonus Points */}
        <div>
          <label className="block text-white/60 text-xs uppercase tracking-widest mb-1">
            Bonus Points
          </label>
          <input
            type="number"
            value={bonusPoints}
            onChange={(e) => setBonusPoints(e.target.value)}
            min="0"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500"
          />
          <p className="text-white/30 text-xs mt-1">
            Applied to all players in this game
          </p>
        </div>
      </div>

      {/* Competition Periods */}
      <div className="mt-4">
        <label className="block text-white/60 text-xs uppercase tracking-widest mb-2">
          Competition Periods
        </label>

        {monthlyPeriods.length > 0 && (
          <div className="mb-3">
            <div className="text-white/40 text-xs mb-1">Monthly</div>
            <div className="flex flex-wrap gap-2">
              {monthlyPeriods.map((period) => (
                <button
                  key={period.id}
                  onClick={() => togglePeriod(period.id)}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    selectedPeriodIds.includes(period.id)
                      ? "bg-cyan-600 text-white"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  {period.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {quarterlyPeriods.length > 0 && (
          <div>
            <div className="text-white/40 text-xs mb-1">Quarterly</div>
            <div className="flex flex-wrap gap-2">
              {quarterlyPeriods.map((period) => (
                <button
                  key={period.id}
                  onClick={() => togglePeriod(period.id)}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    selectedPeriodIds.includes(period.id)
                      ? "bg-amber-600 text-white"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  {period.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-white/10 disabled:text-white/30 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          Save Changes
        </button>
        <button
          onClick={() => setShowPlayersModal(true)}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Users className="w-4 h-4" />
          Players
        </button>
        {saveMessage && (
          <span
            className={`text-sm ${
              saveMessage === "Saved!" ? "text-green-400" : "text-red-400"
            }`}
          >
            {saveMessage}
          </span>
        )}
      </div>

      {/* Game Info */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="text-white/30 text-xs">
          Game UID: {game.uid} | Players: {game.playerCount}
          {game.director && ` | Director: ${game.director}`}
        </div>
      </div>

      {/* Players Modal */}
      {showPlayersModal && (
        <PlayersModal
          gameUid={game.uid}
          onClose={() => setShowPlayersModal(false)}
        />
      )}
    </div>
  );
}

// PlayersModal component for editing player placements
interface PlayersModalProps {
  gameUid: string;
  onClose: () => void;
}

const DEFAULT_SCORING_SYSTEM: ScoringSystem = {
  rules: [
    { placement: 1, points: 10 },
    { placement: 2, points: 7 },
    { placement: 3, points: 6 },
    { placement: 4, points: 5 },
    { placement: 5, points: 4 },
    { placement: 6, points: 3 },
    { placement: 7, points: 2 },
    { placement: 8, points: 1 },
  ],
  defaultPoints: 0,
};

function PlayersModal({ gameUid, onClose }: PlayersModalProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [originalPlayers, setOriginalPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [scoringSystem, setScoringSystem] = useState<ScoringSystem>(DEFAULT_SCORING_SYSTEM);
  const [bonusPoints, setBonusPoints] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch players when modal opens
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const res = await fetch(`/api/games/${gameUid}/players`);
        if (!res.ok) throw new Error("Failed to fetch players");
        const data = await res.json();
        // Store scoring system and bonus points
        if (data.scoringSystem) {
          setScoringSystem(data.scoringSystem);
        }
        if (data.bonusPoints !== undefined) {
          setBonusPoints(data.bonusPoints);
        }
        // Sort by placement
        const sorted = [...data.players].sort(
          (a: Player, b: Player) => (a.placement || 999) - (b.placement || 999)
        );
        setPlayers(sorted);
        setOriginalPlayers(sorted);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load players");
      } finally {
        setLoading(false);
      }
    };
    fetchPlayers();
  }, [gameUid]);

  const hasChanges =
    JSON.stringify(players.map((p) => p.id)) !==
    JSON.stringify(originalPlayers.map((p) => p.id));

  // Recalculate points for all players based on their current position
  const recalculatePoints = (playerList: Player[]): Player[] => {
    return playerList.map((player, index) => {
      const placement = index + 1;
      const placementPoints = getPointsForPlacement(placement, scoringSystem);
      return {
        ...player,
        totalPoints: placementPoints + bonusPoints,
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPlayers((items) => {
        const oldIndex = items.findIndex((p) => p.id === active.id);
        const newIndex = items.findIndex((p) => p.id === over.id);
        const reordered = arrayMove(items, oldIndex, newIndex);
        // Recalculate points after reordering
        return recalculatePoints(reordered);
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`/api/games/${gameUid}/placements`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerOrder: players.map((p) => ({ playerId: p.id })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      const data = await res.json();
      // Update with server response (has recalculated points)
      const sorted = [...data.players].sort(
        (a: Player, b: Player) => (a.placement || 999) - (b.placement || 999)
      );
      setPlayers(sorted);
      setOriginalPlayers(sorted);
      setSaveMessage("Saved!");
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-white font-medium">Edit Player Placements</h3>
          <button
            onClick={onClose}
            className="p-1 text-white/40 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-red-400 text-center py-8">{error}</div>
          ) : players.length === 0 ? (
            <div className="text-white/40 text-center py-8">
              No players found
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={players.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {players.map((player, index) => (
                    <SortablePlayer
                      key={player.id}
                      player={player}
                      index={index}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
          <div className="text-white/40 text-xs">
            Drag to reorder placements
          </div>
          <div className="flex items-center gap-3">
            {saveMessage && (
              <span
                className={`text-sm ${
                  saveMessage === "Saved!" ? "text-green-400" : "text-red-400"
                }`}
              >
                {saveMessage}
              </span>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-white/60 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-white/10 disabled:text-white/30 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sortable player row component
interface SortablePlayerProps {
  player: Player;
  index: number;
}

function SortablePlayer({ player, index }: SortablePlayerProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const placement = index + 1;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
        isDragging ? "bg-white/20 opacity-80" : "bg-white/5 hover:bg-white/10"
      }`}
    >
      <button
        className="p-1 text-white/30 hover:text-white/60 cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="w-8 text-center">
        <span className="text-white/60 font-mono text-sm">{placement}</span>
      </div>
      <div className="flex-1">
        <span className="text-white">{player.name}</span>
      </div>
      <div className="text-right">
        <span className="text-cyan-400 text-sm">{player.totalPoints} pts</span>
      </div>
    </div>
  );
}
