// app/admin/tournament-entry/screens/Screen1_FullAdmin/FullAdminScreen.tsx

"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useSession } from "next-auth/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Users,
  Trophy,
  Calendar,
  MapPin,
  User,
  Plus,
  ArrowLeft,
  Check,
  X,
  ChevronDown,
  Download,
  QrCode,
  History,
  Play,
  Pause,
  Clock,
} from "lucide-react";
import { formatGameDate, formatTime } from "@/lib/utils";
import { QRCodeModal } from "../../QRCodeModal";
import { GameTimer } from "@/components/Timer/GameTimer";
import { socket } from "@/lib/socketClient";
import { PlayerSearchDropdown } from "@/components/PlayerSearchDropdown";
import { PlayerRow } from "../../components/PlayerRow";
import { TournamentValidationStatus } from "../../components/TournamentValidationStatus";
import {
  validateTournamentForIntegration,
  exportTournamentAsText,
} from "@/lib/tournamentValidation";
import { BlindLevel } from "@/lib/blindLevels";
import { getBlindScheduleDisplayName } from "@/lib/blind-schedule-label";
import { ScreenTabs } from "../../components/ScreenTabs";
import { ScreenNumber } from "../../hooks/useScreenRouter";
import { BlindScheduleEditModal } from "./BlindScheduleEditModal";
import { useTDActionHistory } from "@/hooks/useTDActionHistory";
import { ActionHistoryDrawer } from "@/components/td/ActionHistoryDrawer";
import MoveKnockoutModal from "../../components/MoveKnockoutModal";
import { useOptimisticUpdates } from "./hooks/useOptimisticUpdates";
import { useSortedPlayerList } from "./hooks/useSortedPlayerList";
import { usePeriodManager } from "./hooks/usePeriodManager";
import { useHitmanManager } from "./hooks/useHitmanManager";
import { calculateKoPositions } from "../../utils/koPositionUtils";

interface TournamentDraft {
  id: number;
  tournament_date: string;
  tournament_time?: string;
  director_name: string;
  title?: string | null;
  venue: string | null;
  venue_id: number | null;
  start_points: number;
  status: "in_progress" | "finalized" | "integrated";
  created_at: string;
  updated_at: string;
  player_count: number;
  remaining_players?: number;
  blind_schedule?: string;
  custom_blind_levels?: string | null;
  period_ids?: string | null;
  allow_chat?: boolean | null;
  allow_self_checkin?: boolean | null;
  game_uid?: string | null;
  // Timer fields
  timer_current_level?: number | null;
  timer_remaining_seconds?: number | null;
  timer_is_running?: boolean | null;
  timer_is_paused?: boolean | null;
  timer_last_updated?: string | null;
  // Blind levels JSON from blind_schedules table
  blind_levels_json?: string | null;
}

interface VenueOption {
  id: number;
  name: string;
}

interface PlayerSearchResult {
  Name: string;
  UID: string;
  nickname: string | null;
  TotalGames?: number;
  TotalPoints?: number;
}

interface Player {
  id: number;
  player_name: string;
  player_uid: string | null;
  is_new_player: boolean;
  hitman_name: string | null;
  ko_position: number | null;
  placement: number | null;
  added_by?: "admin" | "self_checkin";
  checked_in_at?: string;
  player_nickname?: string | null;
  knockedout_at?: string | null;
}


interface FullAdminScreenProps {
  currentView: "welcome" | "entry";
  setCurrentView: (view: "welcome" | "entry") => void;
  currentDraft: TournamentDraft | null;
  players: Player[];
  onDraftChange: (draft: TournamentDraft | null) => void;
  onDataChange: () => void;
  currentScreen: ScreenNumber;
  onScreenChange: (screen: ScreenNumber) => void;
  // Hitman claims props (managed by parent)
  pendingClaimsCount?: number;
  onOpenClaimsDrawer?: () => void;
}

export function FullAdminScreen({
  currentView,
  setCurrentView,
  currentDraft: currentDraftProp,
  players,
  onDraftChange,
  onDataChange,
  currentScreen,
  onScreenChange,
  pendingClaimsCount: pendingClaimsCountProp = 0,
  onOpenClaimsDrawer,
}: FullAdminScreenProps) {
  // Authentication is now handled by middleware - if we reach this page, user is an admin
  const { data: session } = useSession();
  const leagueId = session?.user?.leagueId ?? 1;

  // Tournament management
  const [tournaments, setTournaments] = useState<TournamentDraft[]>([]);
  const [currentDraft, setCurrentDraft] = useState<TournamentDraft | null>(
    currentDraftProp,
  );
  const [loadingTournaments, setLoadingTournaments] = useState(false);
  const [showIntegrationPreview, setShowIntegrationPreview] = useState(false);
  const [displayCount, setDisplayCount] = useState(8);
  const [showLoadMore, setShowLoadMore] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  // Calculate players remaining from the shared players prop (consistent with other screens)
  const playersRemaining = players.filter(p => p.ko_position === null).length;

  // Action History state
  const [showActionHistory, setShowActionHistory] = useState(false);

  // Poll for tournament data every 30 seconds when there are in_progress tournaments
  // (Timer state in DB only updates every ~30 seconds from Socket.IO server)
  useEffect(() => {
    const hasInProgressTournament = tournaments.some(t => t.status === "in_progress");
    if (!hasInProgressTournament) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch("/api/tournament-drafts");
        if (response.ok) {
          setTournaments(await response.json());
        }
      } catch (error) {
        console.error("Error polling tournaments:", error);
      }
    }, 30000);

    return () => clearInterval(pollInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournaments.length]);

  // Format seconds as MM:SS
  const formatTimerDisplay = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get current blind level info from JSON
  const getCurrentBlinds = (tournament: TournamentDraft): { smallBlind: number; bigBlind: number } | null => {
    if (!tournament.blind_levels_json || !tournament.timer_current_level) return null;
    try {
      const levels = JSON.parse(tournament.blind_levels_json) as Array<{ level: number; smallBlind: number; bigBlind: number; isbreak?: boolean }>;
      const currentLevel = levels.find(l => l.level === tournament.timer_current_level);
      if (currentLevel && !currentLevel.isbreak) {
        return { smallBlind: currentLevel.smallBlind, bigBlind: currentLevel.bigBlind };
      }
      return null;
    } catch {
      return null;
    }
  };

  // Handle timer pause/resume from card
  const handleCardTimerToggle = (tournamentId: number, isPaused: boolean) => {
    if (isPaused) {
      socket.emit("timer:resume", { tournamentId });
    } else {
      socket.emit("timer:pause", { tournamentId });
    }
    // Refresh tournaments after a short delay to get updated state
    setTimeout(() => {
      loadTournaments();
    }, 500);
  };

  // Refs for functions that are defined later but needed in early hooks
  const clearHitmanSearchValuesRef = useRef<() => void>(() => {});

  // Derive game_uid: use actual game_uid if set, otherwise use draft-{id} pattern
  const actionLogGameUid =
    currentDraft?.game_uid ||
    (currentDraft ? `draft-${currentDraft.id}` : null);
  const {
    actions: actionHistory,
    canUndo,
    triggerUndo,
    isUndoing,
  } = useTDActionHistory(actionLogGameUid, {
    onUndoSuccess: (description) => {
      setToast({ message: description, type: "success" });
      // Clear local UI state that might be stale after undo
      clearHitmanSearchValuesRef.current();
      clearOptimisticUpdates();
      onDataChange(); // Refresh player data after undo
    },
    onUndoError: (reason) => {
      setToast({ message: `Undo failed: ${reason}`, type: "warning" });
    },
  });

  // New tournament modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGameOptions, setShowGameOptions] = useState(false);

  // League game defaults (fetched from config)
  const [leagueGameDefaults, setLeagueGameDefaults] = useState({
    allowChat: true,
    allowSelfCheckIn: true,
  });

  const [newTournament, setNewTournament] = useState({
    tournament_date: "",
    tournament_time: "",
    director_name: "",
    tournament_director_uid: null as string | null,
    title: "",
    venue_id: null as number | null,
    start_points: 0,
    period_ids: [] as number[],
    allow_chat: true, // Will be set from league defaults on load
    allow_self_checkin: true, // Will be set from league defaults on load
  });

  // League admins for TD dropdown
  interface LeagueAdmin {
    id: number;
    playerUid: string;
    role: "owner" | "admin";
    firstName: string | null;
    lastName: string | null;
    nickname: string | null;
  }
  const [leagueAdmins, setLeagueAdmins] = useState<LeagueAdmin[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [showTDDropdown, setShowTDDropdown] = useState(false);
  const [showEntryTDDropdown, setShowEntryTDDropdown] = useState(false);

  // Player management (using props from parent)
  const [newPlayerName, setNewPlayerName] = useState("");
  const [playerSearchResults, setPlayerSearchResults] = useState<
    PlayerSearchResult[]
  >([]);
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isIntegrating, setIsIntegrating] = useState(false);

  // Optimistic updates for immediate visual feedback
  const { displayPlayers, setOptimisticUpdate, clearOptimisticUpdates } =
    useOptimisticUpdates({ players });

  // Blind schedule edit modal
  const [showBlindEditModal, setShowBlindEditModal] = useState(false);
  // Track current timer level for locking past blind levels in edit modal
  const [currentTimerLevel, setCurrentTimerLevel] = useState(1);

  // League blind schedules from API
  interface LeagueSchedule {
    id: number;
    name: string;
    description: string;
    levels: BlindLevel[];
    isSystem: boolean;
  }
  const [leagueSchedules, setLeagueSchedules] = useState<LeagueSchedule[]>([]);

  // Refs
  const globalUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<{ [key: number]: Partial<Player> }>({});
  const hasPendingChanges = Object.keys(pendingUpdatesRef.current).length > 0;

  const loadPlayersRef = useRef<(id: number) => Promise<void>>(async () => {});
  const onDataChangeRef = useRef<() => void>(() => {});

  // Move knockout modal state
  const [moveKnockoutModal, setMoveKnockoutModal] = useState<{
    playerId: number;
    playerName: string;
  } | null>(null);

  // Venue management
  const [venues, setVenues] = useState<VenueOption[]>([]);

  // Toast notification state for auto-calculations
  const [toast, setToast] = useState<{
    message: string;
    type: "info" | "success" | "warning";
    undoAction?: () => void;
  } | null>(null);

  // Calculate ko_positions based on knockedout_at timestamps
  const koPositionsMap = useMemo(
    () => calculateKoPositions(displayPlayers),
    [displayPlayers],
  );

  // Sorted player list hook
  const { sortBy, sortOrder, sortedPlayers, handleSort, resetToDefaultSort } =
    useSortedPlayerList({ players: displayPlayers, koPositionsMap });

  // Fetch league game defaults on mount
  useEffect(() => {
    async function fetchLeagueConfig() {
      try {
        const res = await fetch("/api/config");
        if (res.ok) {
          const data = await res.json();
          if (data.gameDefaults) {
            const defaults = {
              allowChat: data.gameDefaults.allowChat ?? true,
              allowSelfCheckIn: data.gameDefaults.allowSelfCheckIn ?? true,
            };
            setLeagueGameDefaults(defaults);
            // Update newTournament with league defaults
            setNewTournament((prev) => ({
              ...prev,
              allow_chat: defaults.allowChat,
              allow_self_checkin: defaults.allowSelfCheckIn,
            }));
          }
        }
      } catch (err) {
        console.error("Failed to fetch league config:", err);
      }
    }
    fetchLeagueConfig();
  }, []);

  // Sync currentDraft with parent prop
  useEffect(() => {
    if (currentDraftProp?.id !== currentDraft?.id) {
      setCurrentDraft(currentDraftProp);
    }
  }, [currentDraftProp, currentDraft]);

  // Wrapper to update local state and notify parent
  const updateCurrentDraft = useCallback(
    (draft: TournamentDraft | null) => {
      setCurrentDraft(draft);
      onDraftChange(draft);
    },
    [onDraftChange],
  );

  // Competition periods manager
  const periodManager = usePeriodManager({
    leagueId,
    currentDraftId: currentDraft?.id ?? null,
    currentDraftPeriodIds: currentDraft?.period_ids ?? null,
    currentView,
    showCreateModal,
    tournamentDate: newTournament.tournament_date,
    onNewTournamentPeriodIdsChange: useCallback((periodIds: number[]) => {
      setNewTournament((prev) => ({
        ...prev,
        period_ids: [...prev.period_ids, ...periodIds],
      }));
    }, []),
    onDraftUpdated: useCallback(
      (draft: unknown) => {
        updateCurrentDraft(draft as TournamentDraft);
      },
      [updateCurrentDraft],
    ),
  });

  const {
    availablePeriods,
    periodsLoading,
    editingPeriods,
    setEditingPeriods,
    draftPeriodIds,
    setDraftPeriodIds,
    savingPeriods,
    showNewPeriodModal,
    setShowNewPeriodModal,
    newPeriod,
    setNewPeriod,
    savingNewPeriod,
    savePeriods,
    createNewPeriod,
    prefillCurrentMonth,
    prefillCurrentQuarter,
  } = periodManager;

  // Socket.IO connection for real-time updates
  useEffect(() => {
    if (currentDraft) {
      socket.emit("joinRoom", currentDraft.id.toString());
      // Request timer sync to get current level
      socket.emit("timer:requestSync", { tournamentId: currentDraft.id });
    }

    // Listen for timer updates to track current level
    const handleTimerUpdate = (state: {
      tournamentId: number;
      currentLevel: number;
    }) => {
      if (currentDraft && state.tournamentId === currentDraft.id) {
        setCurrentTimerLevel(state.currentLevel);
      }
    };
    const handleTimerSync = (state: {
      tournamentId: number;
      currentLevel: number;
    }) => {
      if (currentDraft && state.tournamentId === currentDraft.id) {
        setCurrentTimerLevel(state.currentLevel);
      }
    };

    socket.on("timer:update", handleTimerUpdate);
    socket.on("timer:sync", handleTimerSync);

    return () => {
      if (currentDraft) {
        socket.off("updatePlayers");
        socket.off("tournament:updated");
      }
      socket.off("timer:update", handleTimerUpdate);
      socket.off("timer:sync", handleTimerSync);
    };
  }, [currentDraft]);

  const loadBlindSchedules = useCallback(() => {
    fetch("/api/blind-schedules")
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setLeagueSchedules(data as LeagueSchedule[]);
        } else {
          console.error("Failed to fetch blind schedules:", data);
          setLeagueSchedules([]);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch blind schedules:", err);
        setLeagueSchedules([]);
      });
  }, []);

  useEffect(() => {
    loadBlindSchedules();
  }, [loadBlindSchedules]);

  const [showVenueDropdown, setShowVenueDropdown] = useState(false);
  const [loadingVenues, setLoadingVenues] = useState(false);

  // checkin
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [checkInUrl, setCheckInUrl] = useState<string>("");
  const [showQRCode, setShowQRCode] = useState(false);
  const [generatingQR, setGeneratingQR] = useState(false);

  // Load tournaments list
  const loadTournaments = useCallback(async () => {
    setLoadingTournaments(true);
    try {
      const response = await fetch("/api/tournament-drafts");
      if (!response.ok) throw new Error("Failed to load tournaments");

      const data = await response.json();
      setTournaments(data);
      resetDisplayCount();
    } catch (error) {
      console.error("Error loading tournaments:", error);
      alert("Failed to load tournaments");
    } finally {
      setLoadingTournaments(false);
    }
  }, []);

  const createTournament = async () => {
    if (!newTournament.tournament_date || !newTournament.venue_id) {
      alert("Date and venue are required");
      return;
    }

    try {
      const response = await fetch("/api/tournament-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTournament),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create tournament");
      }

      const tournament = await response.json();
      updateCurrentDraft(tournament);
      setCurrentView("entry");
      setShowCreateModal(false);
      setNewTournament({
        tournament_date: getTodayDateString(),
        tournament_time: "",
        director_name: "",
        tournament_director_uid: null,
        title: "",
        venue_id: null,
        start_points: 0,
        period_ids: [],
        allow_chat: leagueGameDefaults.allowChat,
        allow_self_checkin: leagueGameDefaults.allowSelfCheckIn,
      });
      setShowGameOptions(false);

      // Refresh tournaments list
      loadTournaments();
    } catch (error) {
      console.error("Error creating tournament:", error);
      alert(
        `Failed to create tournament: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  // Select existing tournament
  const selectTournament = async (tournament: TournamentDraft) => {
    clearTournamentState();
    updateCurrentDraft(tournament);
    setCurrentView("entry");
    // Players will be loaded by parent via onDraftChange
  };

  const deleteTournament = async (
    tournamentId: number,
    tournamentName: string,
  ) => {
    if (
      !confirm(
        `Are you sure you want to delete the tournament "${tournamentName}"?\n\nThis will permanently delete the tournament and all its players. This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/tournament-drafts/${tournamentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Remove tournament from local state
        setTournaments(tournaments.filter((t) => t.id !== tournamentId));
        alert("Tournament deleted successfully");
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete tournament");
      }
    } catch (error) {
      console.error("Error deleting tournament:", error);
      alert(
        `Failed to delete tournament: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  // Load more tournaments handler
  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + 8);
  };

  // Reset display count when tournaments change
  const resetDisplayCount = () => {
    setDisplayCount(8);
  };

  // Format today's date for input field (YYYY-MM-DD)
  const getTodayDateString = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  // Load venues from API (active venues only for create modal; league from session)
  const loadVenues = async () => {
    setLoadingVenues(true);
    try {
      const fullResponse = await fetch(
        `/api/venues/current-league?activeOnly=true`,
      );
      if (fullResponse.ok) {
        const data = await fullResponse.json();
        setVenues(data.venues || []);
      } else {
        setVenues([]);
      }
    } catch (error) {
      console.error("Error loading venues:", error);
      setVenues([]);
    } finally {
      setLoadingVenues(false);
    }
  };

  // Handle venue selection
  const handleVenueSelect = (venueId: number) => {
    setNewTournament({
      ...newTournament,
      venue_id: venueId,
    });
    setShowVenueDropdown(false);
  };

  // Get selected venue name for display
  const getSelectedVenueName = (): string => {
    if (!newTournament.venue_id) return "";
    const venue = venues.find((v) => v.id === newTournament.venue_id);
    return venue?.name || "";
  };

  // Update tournament director (both name and UID)
  const updateTournamentDirector = async (admin: {
    playerUid: string;
    displayName: string;
  }) => {
    if (!currentDraft || currentDraft.status === "integrated") return;

    try {
      const updateData = {
        tournament_name: "",
        tournament_date: currentDraft.tournament_date,
        tournament_time: currentDraft.tournament_time,
        director_name: admin.displayName,
        tournament_director_uid: admin.playerUid,
        title: currentDraft.title,
        venue_id: currentDraft.venue_id,
        start_points: currentDraft.start_points,
        allow_chat: currentDraft.allow_chat,
        allow_self_checkin: currentDraft.allow_self_checkin,
      };

      const response = await fetch(
        `/api/tournament-drafts/${currentDraft.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData),
        },
      );

      if (response.ok) {
        updateCurrentDraft({
          ...currentDraft,
          director_name: admin.displayName,
        });
      } else {
        const errorText = await response.text();
        console.error("Failed to update tournament director:", errorText);
      }
    } catch (error) {
      console.error("Error updating tournament director:", error);
    }
  };

  // Debounce ref for tournament metadata field updates (separate from player updates)
  const tournamentFieldTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingTournamentFieldsRef = useRef<Record<string, string | number | boolean | null>>({});
  const currentDraftForFieldsRef = useRef(currentDraft);
  currentDraftForFieldsRef.current = currentDraft;

  // Update tournament field with debounced API call
  const updateTournamentField = (
    field: string,
    value: string | number | boolean | null,
  ) => {
    if (!currentDraft || currentDraft.status === "integrated") return;

    // Immediately update local state for responsive UI
    updateCurrentDraft({ ...currentDraft, [field]: value });

    // Track pending update
    pendingTournamentFieldsRef.current[field] = value;

    // Clear existing timeout
    if (tournamentFieldTimeoutRef.current) {
      clearTimeout(tournamentFieldTimeoutRef.current);
    }

    // Debounce API call (500ms after last keystroke)
    tournamentFieldTimeoutRef.current = setTimeout(async () => {
      const draft = currentDraftForFieldsRef.current;
      if (!draft) return;

      const pending = pendingTournamentFieldsRef.current;

      // Build update data with all pending changes
      // Format tournament_date as YYYY-MM-DD (strip any ISO timestamp suffix)
      const rawDate = (pending.tournament_date ?? draft.tournament_date) as string;
      const formattedDate = rawDate ? rawDate.split("T")[0] : "";
      const updateData = {
        tournament_name: "",
        tournament_date: formattedDate,
        tournament_time: pending.tournament_time ?? draft.tournament_time,
        director_name: pending.director_name ?? draft.director_name,
        title: pending.title ?? draft.title,
        venue_id: pending.venue_id ?? draft.venue_id,
        start_points: pending.start_points ?? draft.start_points,
        allow_chat: pending.allow_chat ?? draft.allow_chat,
        allow_self_checkin: pending.allow_self_checkin ?? draft.allow_self_checkin,
      };

      // Clear pending updates
      pendingTournamentFieldsRef.current = {};

      try {
        const response = await fetch(
          `/api/tournament-drafts/${draft.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updateData),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Failed to update tournament field:", errorText);
        }
      } catch (error) {
        console.error("Error updating tournament:", error);
      }
    }, 500);
  };

  // Format date for input field (convert from ISO to YYYY-MM-DD)
  const formatDateForInput = (isoDate: string) => {
    if (!isoDate) return "";
    return isoDate.split("T")[0];
  };

  const clearTournamentState = () => {
    // Clear tournament data
    updateCurrentDraft(null);
    // Players will be cleared by parent via onDraftChange

    // Clear player input/search states
    setNewPlayerName("");
    setPlayerSearchResults([]);
    setShowPlayerDropdown(false);
    setIsSearching(false);

    // Clear hitman search states
    clearHitmanSearchValuesRef.current();

    // Clear integration/UI states
    setShowIntegrationPreview(false);
    setIsIntegrating(false);
    setIsReverting(false);

    // Clear check-in related states
    setLastUpdated(new Date());
    setCheckInUrl("");
    setShowQRCode(false);
    setGeneratingQR(false);
  };

  // Player search effect
  useEffect(() => {
    if (newPlayerName.length < 2) {
      setPlayerSearchResults([]);
      setShowPlayerDropdown(false);
      return;
    }

    const searchTimer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/players/search?q=${encodeURIComponent(newPlayerName)}&name=true`,
        );
        const data = await response.json();
        setPlayerSearchResults(data);
        setShowPlayerDropdown(true);
      } catch (error) {
        console.error("Failed to search players:", error);
        setPlayerSearchResults([]);
        setShowPlayerDropdown(true);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(searchTimer);
  }, [newPlayerName]);

  // Add player
  const addPlayer = async (playerData: {
    name: string;
    nickname?: string;
    uid?: string;
    isNew?: boolean;
  }) => {
    if (!currentDraft) return;

    try {
      const response = await fetch(
        `/api/tournament-drafts/${currentDraft.id}/players`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Screen": "FullAdmin",
          },
          body: JSON.stringify({
            player_name: playerData.name,
            player_nickname: playerData.nickname || null,
            player_uid: playerData.uid || null,
            is_new_player: playerData.isNew || false,
          }),
        },
      );

      if (response.ok) {
        // Trigger parent to reload player data
        onDataChangeRef.current();
        setNewPlayerName("");
        setShowPlayerDropdown(false);

        // Focus back to the input field
        setTimeout(() => {
          const inputField = document.getElementById(
            "player-search-input",
          ) as HTMLInputElement;
          if (inputField) {
            inputField.focus();
          }
        }, 100);
      }
    } catch (error) {
      console.error("Error adding player:", error);
    }
  };

  //  updatePlayer with debounce and batching
  const updatePlayer = useCallback(
    async (playerId: number, field: string, value: string | number | null) => {
      try {
        const player = players.find((p) => p.id === playerId);
        if (!player) {
          console.error("Player not found:", playerId);
          return;
        }

        // Track only the fields that are changing (not the entire player object)
        const fieldsToUpdate: Record<string, string | number | null> = {
          [field]: value,
        };

        // Auto-assign KO position when hitman is selected (IMPROVED VERSION)
        if (field === "hitman_name" && value) {
          // Only auto-assign if player doesn't already have a KO position
          if (player.ko_position === null) {
            const usedKoPositions = players
              .filter((p) => p.ko_position !== null && p.id !== playerId)
              .map((p) => p.ko_position!);

            const maxKoPosition =
              usedKoPositions.length > 0 ? Math.max(...usedKoPositions) : 0;
            const nextKoPosition = maxKoPosition + 1;
            fieldsToUpdate.ko_position = nextKoPosition;

            // Show toast notification with undo option
            setToast({
              message: `Auto-assigned KO position ${nextKoPosition} to ${player.player_name}`,
              type: "info",
              undoAction: () => {
                // Undo the auto-assignment
                updatePlayer(playerId, "ko_position", null);
                setToast(null);
              },
            });

            // Auto-hide toast after 5 seconds
            setTimeout(() => {
              setToast(null);
            }, 5000);
          }
        }

        // DO NOT auto-clear KO position when hitman is removed
        // This was causing unwanted data loss - users can manually clear if needed

        // OPTIMISTIC UPDATE: Immediately update local state for instant visual feedback
        if (field === "hitman_name") {
          setOptimisticUpdate(playerId, {
            hitman_name: value as string | null,
            // Set a temporary knockedout_at for visual styling (will be replaced by real server value)
            knockedout_at: value ? new Date().toISOString() : null,
            // Include ko_position if we're auto-assigning it
            ...(fieldsToUpdate.ko_position !== undefined
              ? { ko_position: fieldsToUpdate.ko_position as number | null }
              : {}),
          });
        }

        // KNOCKOUTS & KNOCKOUT CLEARS: Save immediately (no debouncing) for reliable cross-screen updates
        // A knockout is when we're setting hitman_name AND auto-assigning ko_position
        const isKnockout =
          field === "hitman_name" &&
          value &&
          fieldsToUpdate.ko_position !== undefined;
        // A knockout clear is when we're setting ko_position to null
        const isKnockoutClear = field === "ko_position" && value === null;

        if (isKnockout || isKnockoutClear) {
          // For knockout clears, also clear hitman_name and add optimistic update
          if (isKnockoutClear) {
            fieldsToUpdate.hitman_name = null;
            setOptimisticUpdate(playerId, {
              hitman_name: null,
              ko_position: null,
              knockedout_at: null,
            });
            // Clear any pending updates for this player since we're saving immediately
            delete pendingUpdatesRef.current[playerId];
          }

          // Save immediately - don't use debounce
          try {
            const response = await fetch(
              `/api/tournament-drafts/${currentDraft?.id}/players/batch`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  "X-Admin-Screen": "FullAdmin",
                },
                body: JSON.stringify({
                  players: [{ id: playerId, ...fieldsToUpdate }],
                }),
              },
            );

            if (!response.ok) {
              let errorMessage = isKnockoutClear
                ? "Failed to clear knockout"
                : "Failed to save knockout";
              try {
                const errorData = await response.json();
                errorMessage =
                  errorData.userMessage || errorData.error || errorMessage;
              } catch {
                errorMessage = "Server error - Unable to save.";
              }
              alert(`⚠️ Error\n\n${errorMessage}`);
              if (currentDraft) {
                await loadPlayersRef.current(currentDraft.id);
              }
              onDataChangeRef.current();
              return;
            }

            // Success - socket will broadcast the update to other screens
            await response.json();
          } catch (error) {
            console.error("Knockout save error:", error);
            alert(
              `⚠️ Network Error\n\nUnable to save. Please check your connection.`,
            );
            if (currentDraft) {
              await loadPlayersRef.current(currentDraft.id);
            }
            onDataChangeRef.current();
          }
          return; // Don't add to pending updates - already saved
        }

        // NON-KNOCKOUT UPDATES: Use debounced batching for efficiency
        // Store only changed fields, merging with any existing pending updates
        pendingUpdatesRef.current[playerId] = {
          ...pendingUpdatesRef.current[playerId],
          ...fieldsToUpdate,
        };

        // Clear existing global timeout
        if (globalUpdateTimeoutRef.current) {
          clearTimeout(globalUpdateTimeoutRef.current);
        }

        // Set new global timeout to batch ALL pending updates
        globalUpdateTimeoutRef.current = setTimeout(async () => {
          const playersToUpdate = { ...pendingUpdatesRef.current };
          if (Object.keys(playersToUpdate).length === 0) return;

          try {
            // Convert pending updates to array format for batch API
            const updateArray = Object.entries(playersToUpdate).map(
              ([playerIdStr, updatedData]) => ({
                id: parseInt(playerIdStr),
                ...updatedData,
              }),
            );

            // Send single batch request
            const response = await fetch(
              `/api/tournament-drafts/${currentDraft?.id}/players/batch`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  "X-Admin-Screen": "FullAdmin",
                },
                body: JSON.stringify({
                  players: updateArray,
                }),
              },
            );

            // ERROR HANDLING
            if (!response.ok) {
              let errorMessage = "Failed to save changes";

              try {
                const errorData = await response.json();
                errorMessage =
                  errorData.userMessage || errorData.error || errorMessage;
              } catch {
                errorMessage =
                  "Server error - Unable to save changes. Please refresh the page and try again.";
              }

              alert(
                `⚠️ Error Saving Changes\n\n${errorMessage}\n\nPlease try again. If the problem persists, contact support.`,
              );

              if (currentDraft) {
                await loadPlayersRef.current(currentDraft.id); // Use ref
              }
              onDataChangeRef.current();

              console.error("Save failed:", response.status, errorMessage);
              return;
            }

            // ✅ SUCCESS PATH
            await response.json();

            // Don't call onDataChange here - Socket.IO will handle real-time updates
            // Calling it causes a flicker due to race condition between HTTP fetch and socket update
          } catch (error) {
            console.error("Batch update error:", error);
            alert(
              `⚠️ Network Error\n\nUnable to save changes. Please check your connection and try again.\n\nIf the problem persists, contact support.`,
            );

            if (currentDraft) {
              await loadPlayersRef.current(currentDraft.id);
            }
            onDataChangeRef.current();
          } finally {
            // Clean up
            pendingUpdatesRef.current = {};
            globalUpdateTimeoutRef.current = null;
          }
        }, 1500);
      } catch (error) {
        console.error("Error in updatePlayer:", error);
      }
    },
    [players, currentDraft],
  );

  // Hitman manager hook
  const {
    hitmanSearchValues,
    hitmanDropdownVisible,
    hitmanHighlightedIndex,
    getHitmanCandidates,
    selectHitman,
    clearPlayerKnockout,
    handleCrosshairClick,
    handleHitmanSearchChange,
    handleHitmanFocus,
    handleHitmanBlur,
    handleHitmanKeyDown,
    clearHitmanSearchValues,
  } = useHitmanManager({
    players,
    displayPlayers,
    updatePlayer,
  });

  // Update ref for undo functionality
  clearHitmanSearchValuesRef.current = clearHitmanSearchValues;

  // Keep a ref to currentDraft for cleanup (closures in cleanup effects can be stale)
  const currentDraftRef = useRef(currentDraft);
  currentDraftRef.current = currentDraft;

  // cleanup on component unmount - flush pending updates instead of discarding
  useEffect(() => {
    return () => {
      // Clear pending timeout
      if (globalUpdateTimeoutRef.current) {
        clearTimeout(globalUpdateTimeoutRef.current);
        globalUpdateTimeoutRef.current = null;
      }

      // Flush any pending updates before unmount (fire-and-forget)
      const pendingUpdates = pendingUpdatesRef.current;
      const draftId = currentDraftRef.current?.id;

      if (draftId && Object.keys(pendingUpdates).length > 0) {
        const updateArray = Object.entries(pendingUpdates).map(
          ([playerIdStr, updatedData]) => ({
            id: parseInt(playerIdStr),
            ...(updatedData as Record<string, unknown>),
          }),
        );

        // Use sendBeacon for reliable delivery during unmount
        // Falls back to fetch if sendBeacon unavailable or fails
        const payload = JSON.stringify({ players: updateArray });
        const url = `/api/tournament-drafts/${draftId}/players/batch`;

        const sent = navigator.sendBeacon?.(
          url,
          new Blob([payload], { type: "application/json" }),
        );

        if (!sent) {
          // Fallback: fire-and-forget fetch (less reliable but better than nothing)
          fetch(url, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "X-Admin-Screen": "FullAdmin",
            },
            body: payload,
            keepalive: true, // Allows request to outlive the page
          }).catch(() => {
            // Silently ignore errors on unmount
          });
        }
      }

      pendingUpdatesRef.current = {};
    };
  }, []);

  // Auto-calculate KO positions to fix duplicates and gaps
  const autoCalculateKOPositions = async () => {
    if (!currentDraft) return;

    // Get all players with KO positions (knocked out players)
    const playersWithKO = players.filter((p) => p.ko_position !== null);

    if (playersWithKO.length === 0) {
      alert("No players with KO positions found to fix.");
      return;
    }

    // Confirm the action
    if (
      !confirm(
        `This will automatically reassign KO positions for ${playersWithKO.length} players to fix duplicates and gaps. Continue?`,
      )
    ) {
      return;
    }

    try {
      // Sort players by current KO position, then alphabetically by name for consistency
      // This ensures a deterministic order when there are duplicates
      const sortedPlayers = [...playersWithKO].sort((a, b) => {
        if (a.ko_position === b.ko_position) {
          // If KO positions are the same, sort alphabetically
          return a.player_name.localeCompare(b.player_name);
        }
        return (a.ko_position || 0) - (b.ko_position || 0);
      });

      // Reassign KO positions sequentially starting from 1
      const updatePromises = sortedPlayers.map((player, index) => {
        const newKOPosition = index + 1;

        // Only update if the position actually changed
        if (player.ko_position !== newKOPosition) {
          return updatePlayer(player.id, "ko_position", newKOPosition);
        }
        return Promise.resolve();
      });

      // Wait for all updates to complete
      await Promise.all(updatePromises);

      alert(
        `Successfully reassigned KO positions for ${sortedPlayers.length} players.\nPositions are now sequential from 1 to ${sortedPlayers.length}.`,
      );

      // Refresh the player data to ensure consistency
      if (currentDraft) {
        await loadPlayersRef.current(currentDraft.id);
      }
    } catch (error) {
      console.error("Error auto-calculating KO positions:", error);
      alert("Failed to auto-calculate KO positions. Please try again.");
    }
  };

  // Remove player
  const removePlayer = async (playerId: number) => {
    try {
      const response = await fetch(
        `/api/tournament-drafts/${currentDraft?.id}/players/${playerId}`,
        {
          method: "DELETE",
          headers: {
            "X-Admin-Screen": "FullAdmin",
          },
        },
      );

      if (response.ok) {
        // Trigger parent to reload player data
        onDataChangeRef.current();
      }
    } catch (error) {
      console.error("Error removing player:", error);
    }
  };

  // Handle moving a knockout to a new position
  const handleMoveKnockout = async (
    playerId: number,
    afterPlayerId: number | null,
  ) => {
    try {
      const player = players.find((p) => p.id === playerId);
      if (!player || !player.knockedout_at) {
        console.error("Player not found or not knocked out:", playerId);
        return;
      }

      // Call API to move knockout - the server handles all timestamp calculations
      // including shifting other players if they share the same timestamp
      const response = await fetch(
        `/api/tournament-drafts/${currentDraft?.id}/players/${playerId}/move-knockout`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Screen": "FullAdmin",
          },
          body: JSON.stringify({ afterPlayerId }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to move knockout");
      }

      // Close modal and refresh data
      setMoveKnockoutModal(null);
      onDataChange();
    } catch (error) {
      console.error("Error moving knockout:", error);
      alert(
        `Error moving knockout: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  // Export tournament
  const exportTournament = () => {
    if (!currentDraft || players.length === 0) return;
    exportTournamentAsText(currentDraft, players);
  };

  // Integrate tournament
  const integrateToMainSystem = async () => {
    if (!currentDraft) return;

    // Validate before attempting integration
    const validation = validateTournamentForIntegration(players);
    if (!validation.canIntegrate) {
      alert(`Cannot integrate tournament:\n\n${validation.errors.join("\n")}`);
      return;
    }

    if (
      !confirm(
        `Ready to integrate tournament with ${players.length} players?\n\nThis will calculate final placements based on KO positions and cannot be undone.`,
      )
    ) {
      return;
    }

    setIsIntegrating(true);

    try {
      const response = await fetch(
        `/api/tournament-drafts/${currentDraft.id}/integrate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (response.ok) {
        const result = await response.json();
        alert(
          `Tournament integrated successfully!\n\nPlayers: ${result.playersIntegrated}\n\nPlacements calculated based on KO positions.`,
        );

        // Refresh tournament data
        loadTournaments();
        setCurrentView("welcome");
      } else {
        const errorData = await response.json();
        alert(`Integration failed: ${errorData.details || errorData.error}`);
      }
    } catch (error) {
      console.error("Integration error:", error);
      alert("Integration failed due to network error");
    } finally {
      setIsIntegrating(false);
    }
  };

  // Reload players from parent
  const loadPlayersForTournament = async () => {
    // Trigger parent to reload player data
    onDataChangeRef.current();
    setLastUpdated(new Date()); // Track when data was last refreshed
  };

  // Generate QR code function
  const generateCheckInQR = async () => {
    if (!currentDraft) return;

    setGeneratingQR(true);
    const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const newCheckInUrl = `${baseURL}/gameview/${currentDraft.id}`;
    setCheckInUrl(newCheckInUrl);
    setShowQRCode(true);
    setGeneratingQR(false);
  };

  // 3. Keep refs updated
  useEffect(() => {
    loadPlayersRef.current = loadPlayersForTournament;
  });

  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  });

  // Refresh player data when entering entry view with a draft
  // This ensures we get fresh data after navigating back from another screen
  // (especially important when sendBeacon saved data during unmount)
  // Small delay avoids race condition with parent's initial data load
  useEffect(() => {
    if (currentDraft && currentView === "entry") {
      const timeoutId = setTimeout(() => {
        onDataChange();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
    // Using currentDraft?.id instead of currentDraft to avoid re-running when draft object changes but ID stays same
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDraft?.id, currentView, onDataChange]);

  //render player indicators
  const renderPlayerIndicator = (player: Player) => {
    if (player.added_by === "self_checkin") {
      return (
        <span
          className="inline-block w-2 h-2 bg-blue-500 rounded-full ml-2"
          title={`Self checked-in at ${player.checked_in_at ? new Date(player.checked_in_at).toLocaleTimeString() : "unknown time"}`}
        ></span>
      );
    }
    return null;
  };
  // Validation function for tournament integration readiness

  const revertIntegration = async () => {
    if (!currentDraft || currentDraft.status !== "integrated") {
      alert("Cannot revert: Tournament is not integrated");
      return;
    }

    const confirmMessage = `⚠️ REVERT INTEGRATION ⚠️

                    This will:
                    • Delete all entries from the main database for this tournament
                    • Remove any new players that were created (if they don't appear in other tournaments)
                    • Restore the tournament to draft status for editing
                    • Allow you to make changes and re-integrate

                    This action affects the main tournament database. Are you sure you want to proceed?

                    Tournament: ${currentDraft.venue} - ${currentDraft.tournament_date}
                    Players: ${players.length}`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setIsReverting(true);

    try {
      const response = await fetch(
        `/api/tournament-drafts/${currentDraft.id}/revert`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (response.ok) {
        const result = await response.json();

        alert(`Integration reverted successfully!

                    Deleted ${result.entriesDeleted} main database entries
                    Removed ${result.newPlayersRemoved} new players
                    Tournament restored to draft status

                    You can now edit the tournament and re-integrate when ready.`);

        // Refresh tournament data
        await loadTournaments();

        // Reload the current tournament to get updated status
        const updatedDraft = tournaments.find((t) => t.id === currentDraft.id);
        if (updatedDraft) {
          updateCurrentDraft({ ...updatedDraft, status: "in_progress" });
        }

        // Stay on the current tournament page but refresh
        setCurrentView("entry");
      } else {
        const errorData = await response.json();
        alert(`Revert failed: ${errorData.details || errorData.error}`);
      }
    } catch (error) {
      console.error("Revert error:", error);
      alert("Revert failed due to network error");
    } finally {
      setIsReverting(false);
    }
  };

  // Load tournaments and venues on mount
  useEffect(() => {
    loadTournaments();
    loadVenues();
  }, [loadTournaments]);

  // manage load more button visibility
  useEffect(() => {
    setShowLoadMore(tournaments.length > displayCount);
  }, [tournaments.length, displayCount]);

  // Fetch league admins for TD dropdown
  const loadLeagueAdmins = useCallback(async () => {
    const leagueSlug = session?.user?.leagueSlug;
    if (!leagueSlug) return;

    setLoadingAdmins(true);
    try {
      const res = await fetch(`/api/${leagueSlug}/admins`);
      if (res.ok) {
        const data = await res.json();
        setLeagueAdmins(data.admins || []);
      }
    } catch (err) {
      console.error("Failed to fetch league admins:", err);
    } finally {
      setLoadingAdmins(false);
    }
  }, [session?.user?.leagueSlug]);

  // Show create modal - load admins and set defaults
  useEffect(() => {
    if (showCreateModal) {
      loadLeagueAdmins();
      // Set default TD to current user
      const currentUserUid = session?.user?.uid;
      const currentUserName = session?.user?.nickname || session?.user?.name || "";
      setNewTournament((prev) => ({
        ...prev,
        tournament_date: getTodayDateString(),
        tournament_director_uid: currentUserUid || null,
        director_name: currentUserName,
      }));
    }
  }, [showCreateModal, loadLeagueAdmins, session?.user?.uid, session?.user?.nickname, session?.user?.name]);

  // Load admins when entering entry view (for TD dropdown on existing tournament)
  useEffect(() => {
    if (currentView === "entry" && currentDraft) {
      loadLeagueAdmins();
    }
  }, [currentView, currentDraft, loadLeagueAdmins]);

  // Welcome Screen
  if (currentView === "welcome") {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="">
                <div className="">
                  <span style={{ margin: "auto" }}>
                    Tournament Entry System
                  </span>
                </div>
              </CardTitle>
            </CardHeader>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 mx-auto"
            >
              <Plus size={16} />
              Create New Tournament
            </button>
            <CardContent>
              <div className="mb-6"></div>

              {loadingTournaments ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-600">Loading tournaments...</p>
                </div>
              ) : tournaments.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No tournament drafts found.</p>
                  <p className="text-gray-500 text-sm">
                    Click &quot;Create New Tournament&quot; to get started.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {tournaments.slice(0, displayCount).map((tournament) => (
                    <div
                      key={tournament.id}
                      className="p-4 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      <div className="text-black text-sm">{tournament.id}</div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div
                          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1 cursor-pointer"
                          onClick={() => selectTournament(tournament)}
                        >
                          <div className="flex flex-col">
                            {tournament.title && (
                              <div className="text-base font-bold text-blue-700 mb-1">
                                {tournament.title}
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                              <Calendar className="w-4 h-4 text-blue-600" />
                              {formatGameDate(tournament.tournament_date || "")}
                              {formatTime(tournament.tournament_time) && (
                                <span className="text-sm">
                                  {formatTime(tournament.tournament_time)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <MapPin className="w-4 h-4" />
                              {tournament.venue}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {tournament.status === "in_progress" &&
                              tournament.remaining_players !== undefined
                                ? `${tournament.remaining_players}/${tournament.player_count}`
                                : `${tournament.player_count} players`}
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              {tournament.director_name || "No director"}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
                          {/* Timer display for in_progress tournaments */}
                          {tournament.status === "in_progress" && tournament.timer_remaining_seconds != null && (() => {
                            const remainingTime = tournament.timer_remaining_seconds;
                            const isRunning = tournament.timer_is_running && !tournament.timer_is_paused;
                            const currentBlinds = getCurrentBlinds(tournament);
                            const timeColor = remainingTime < 60
                              ? "text-red-600"
                              : remainingTime < 300
                                ? "text-yellow-600"
                                : "text-green-600";
                            return (
                              <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-1.5 w-full sm:w-auto">
                                <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                                <span className={`font-mono font-bold text-lg ${timeColor}`}>
                                  {formatTimerDisplay(remainingTime)}
                                </span>
                                {tournament.timer_current_level && (
                                  <span className="text-xs text-gray-400">
                                    L{tournament.timer_current_level}
                                  </span>
                                )}
                                {currentBlinds && (
                                  <span className="text-xs text-cyan-300 font-mono">
                                    {currentBlinds.smallBlind}/{currentBlinds.bigBlind}
                                  </span>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCardTimerToggle(tournament.id, !!tournament.timer_is_paused);
                                  }}
                                  className={`p-1 rounded ${
                                    isRunning
                                      ? "bg-yellow-600 hover:bg-yellow-500"
                                      : "bg-green-600 hover:bg-green-500"
                                  } text-white transition-colors ml-auto sm:ml-0`}
                                  title={isRunning ? "Pause timer" : "Resume timer"}
                                >
                                  {isRunning ? <Pause size={14} /> : <Play size={14} />}
                                </button>
                              </div>
                            );
                          })()}

                          <div
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              tournament.status === "in_progress"
                                ? "bg-yellow-100 text-yellow-800"
                                : tournament.status === "integrated"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {tournament.status === "in_progress"
                              ? "In Progress"
                              : tournament.status === "integrated"
                                ? "Integrated"
                                : "Finalized"}
                          </div>

                          {/* Delete Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent selecting the tournament when clicking delete
                              const tournamentName = `${new Date(tournament.tournament_date).toLocaleDateString()} - ${tournament.venue}`;
                              deleteTournament(tournament.id, tournamentName);
                            }}
                            className="flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs transition-colors"
                            title="Delete Tournament"
                          >
                            <X size={14} />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Load More Button */}
                  {showLoadMore && (
                    <div className="flex justify-center mt-6">
                      <button
                        onClick={handleLoadMore}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus size={16} />
                        Load More Tournaments (
                        {tournaments.length - displayCount} remaining)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Create Tournament Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 overflow-y-auto py-4">
              <Card className="w-full max-w-96 mx-4 my-auto max-h-[calc(100vh-2rem)] overflow-y-auto">
                <CardHeader>
                  <CardTitle>Create New Tournament</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Time
                      </label>
                      <select
                        value={newTournament.tournament_time}
                        onChange={(e) =>
                          setNewTournament({
                            ...newTournament,
                            tournament_time: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border rounded text-black"
                      >
                        <option value="">Select time...</option>
                        {/* Generate times from 1:00 PM (13:00) to 9:00 PM (21:00) in 30-minute increments */}
                        {Array.from({ length: 17 }, (_, i) => {
                          const totalMinutes = 13 * 60 + i * 30; // Start at 1:00 PM (13:00)
                          const hour = Math.floor(totalMinutes / 60);
                          const minute = totalMinutes % 60;

                          // Stop at 9:00 PM (21:00)
                          if (hour > 21) return null;

                          const time24 = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
                          const hour12 = hour > 12 ? hour - 12 : hour;
                          const displayTime = `${hour12}:${minute.toString().padStart(2, "0")} PM`;

                          return (
                            <option
                              key={time24}
                              value={time24}
                            >
                              {displayTime}
                            </option>
                          );
                        }).filter(Boolean)}
                      </select>
                    </div>

                    {/* Competition Periods Selector */}
                    {availablePeriods.length > 0 && (
                      <div className="col-span-2">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-900">
                            Competition Periods
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowNewPeriodModal(true)}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                            title="Add new competition period"
                          >
                            <Plus size={12} />
                            New
                          </button>
                        </div>
                        {periodsLoading ? (
                          <div className="text-sm text-gray-500">
                            Loading periods...
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {/* Monthly Periods */}
                            {availablePeriods.filter(
                              (p) => p.period_type === "monthly",
                            ).length > 0 && (
                              <div>
                                <div className="text-xs font-medium text-gray-600 mb-1">
                                  Monthly
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {availablePeriods
                                    .filter((p) => p.period_type === "monthly")
                                    .slice(0, 6)
                                    .map((period) => (
                                      <label
                                        key={period.id}
                                        className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer text-sm ${
                                          newTournament.period_ids.includes(
                                            period.id,
                                          )
                                            ? "bg-blue-100 border-blue-500 text-blue-800"
                                            : "bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100"
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={newTournament.period_ids.includes(
                                            period.id,
                                          )}
                                          onChange={(e) => {
                                            const newIds = e.target.checked
                                              ? [
                                                  ...newTournament.period_ids,
                                                  period.id,
                                                ]
                                              : newTournament.period_ids.filter(
                                                  (id) => id !== period.id,
                                                );
                                            setNewTournament((prev) => ({
                                              ...prev,
                                              period_ids: newIds,
                                            }));
                                          }}
                                          className="sr-only"
                                        />
                                        {newTournament.period_ids.includes(
                                          period.id,
                                        ) && (
                                          <Check
                                            size={12}
                                            className="text-blue-600"
                                          />
                                        )}
                                        {period.name}
                                      </label>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Quarterly Periods */}
                            {availablePeriods.filter(
                              (p) => p.period_type === "quarterly",
                            ).length > 0 && (
                              <div>
                                <div className="text-xs font-medium text-gray-600 mb-1">
                                  Quarterly
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {availablePeriods
                                    .filter(
                                      (p) => p.period_type === "quarterly",
                                    )
                                    .slice(0, 4)
                                    .map((period) => (
                                      <label
                                        key={period.id}
                                        className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer text-sm ${
                                          newTournament.period_ids.includes(
                                            period.id,
                                          )
                                            ? "bg-green-100 border-green-500 text-green-800"
                                            : "bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100"
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={newTournament.period_ids.includes(
                                            period.id,
                                          )}
                                          onChange={(e) => {
                                            const newIds = e.target.checked
                                              ? [
                                                  ...newTournament.period_ids,
                                                  period.id,
                                                ]
                                              : newTournament.period_ids.filter(
                                                  (id) => id !== period.id,
                                                );
                                            setNewTournament((prev) => ({
                                              ...prev,
                                              period_ids: newIds,
                                            }));
                                          }}
                                          className="sr-only"
                                        />
                                        {newTournament.period_ids.includes(
                                          period.id,
                                        ) && (
                                          <Check
                                            size={12}
                                            className="text-green-600"
                                          />
                                        )}
                                        {period.name}
                                      </label>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Warning if no periods match */}
                            {newTournament.tournament_date &&
                              newTournament.period_ids.length === 0 && (
                                <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                  No active periods cover this date. The game
                                  will not appear in rankings until a period is
                                  created.
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Venue *
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setShowVenueDropdown(!showVenueDropdown)
                          }
                          className="w-full px-3 py-2 border rounded text-black text-left bg-white flex items-center justify-between"
                        >
                          <span
                            className={
                              newTournament.venue_id
                                ? "text-black"
                                : "text-gray-500"
                            }
                          >
                            {getSelectedVenueName() || "Select venue..."}
                          </span>
                          <ChevronDown size={16} />
                        </button>

                        {showVenueDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto">
                            {loadingVenues ? (
                              <div className="px-3 py-2 text-gray-500">
                                Loading venues...
                              </div>
                            ) : venues.length === 0 ? (
                              <div className="px-3 py-2 text-gray-500">
                                No venues available. Add venues in the admin
                                settings.
                              </div>
                            ) : (
                              venues.map((venue) => (
                                <button
                                  key={venue.id}
                                  type="button"
                                  onClick={() => handleVenueSelect(venue.id)}
                                  className={`w-full px-3 py-2 text-left hover:bg-gray-100 text-black ${
                                    newTournament.venue_id === venue.id
                                      ? "bg-blue-50"
                                      : ""
                                  }`}
                                >
                                  {venue.name}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Tournament Director
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowTDDropdown(!showTDDropdown)}
                          className="w-full px-3 py-2 border rounded text-black text-left bg-white flex items-center justify-between"
                        >
                          <span
                            className={
                              newTournament.tournament_director_uid
                                ? "text-black"
                                : "text-gray-500"
                            }
                          >
                            {newTournament.director_name || "Select director..."}
                          </span>
                          <ChevronDown size={16} />
                        </button>

                        {showTDDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto">
                            {loadingAdmins ? (
                              <div className="px-3 py-2 text-gray-500">
                                Loading...
                              </div>
                            ) : leagueAdmins.length === 0 ? (
                              <div className="px-3 py-2 text-gray-500">
                                No admins found
                              </div>
                            ) : (
                              leagueAdmins.map((admin) => {
                                const displayName = admin.nickname
                                  ? admin.nickname
                                  : `${admin.firstName || ""} ${admin.lastName || ""}`.trim() || admin.playerUid;
                                return (
                                  <button
                                    key={admin.playerUid}
                                    type="button"
                                    onClick={() => {
                                      setNewTournament({
                                        ...newTournament,
                                        tournament_director_uid: admin.playerUid,
                                        director_name: displayName,
                                      });
                                      setShowTDDropdown(false);
                                    }}
                                    className={`w-full px-3 py-2 text-left hover:bg-gray-100 text-black ${
                                      newTournament.tournament_director_uid === admin.playerUid
                                        ? "bg-blue-50"
                                        : ""
                                    }`}
                                  >
                                    {displayName}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Title
                        <span className="ml-1 text-xs text-gray-500 font-normal">
                          (optional)
                        </span>
                      </label>
                      <textarea
                        rows={1}
                        value={newTournament.title}
                        onChange={(e) =>
                          setNewTournament({
                            ...newTournament,
                            title: e.target.value,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.preventDefault();
                        }}
                        className="w-full px-3 py-2 border rounded text-black resize-none overflow-hidden"
                        placeholder="Custom display title"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Date *
                      </label>
                      <input
                        type="date"
                        value={newTournament.tournament_date}
                        onChange={(e) =>
                          setNewTournament({
                            ...newTournament,
                            tournament_date: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border rounded text-black"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Start Points
                      </label>
                      <input
                        type="number"
                        value={newTournament.start_points}
                        onChange={(e) =>
                          setNewTournament({
                            ...newTournament,
                            start_points: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 border rounded text-black"
                        placeholder="Starting points"
                      />
                    </div>

                    {/* Game Options Collapsible */}
                    <div className="border-t pt-4">
                      <button
                        type="button"
                        onClick={() => setShowGameOptions(!showGameOptions)}
                        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${showGameOptions ? "rotate-180" : ""}`}
                        />
                        Game Options
                      </button>
                      {showGameOptions && (
                        <div className="mt-3 space-y-3 pl-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="block text-sm font-medium text-gray-900">
                                Allow Chat
                              </label>
                              <p className="text-xs text-gray-500">
                                {newTournament.allow_chat
                                  ? "Chat enabled"
                                  : "Chat disabled"}
                              </p>
                            </div>
                            <select
                              value={newTournament.allow_chat ? "on" : "off"}
                              onChange={(e) => {
                                setNewTournament({
                                  ...newTournament,
                                  allow_chat: e.target.value === "on",
                                });
                              }}
                              className="px-3 py-1.5 border rounded text-black text-sm"
                            >
                              <option value="on">On</option>
                              <option value="off">Off</option>
                            </select>
                          </div>
                          {/* Allow Self Check-In */}
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="block text-sm font-medium text-gray-900">
                                Allow Self Check-In
                              </label>
                              <p className="text-xs text-gray-500">
                                {newTournament.allow_self_checkin
                                  ? "Self check-in enabled"
                                  : "Self check-in disabled"}
                              </p>
                            </div>
                            <select
                              value={
                                newTournament.allow_self_checkin ? "on" : "off"
                              }
                              onChange={(e) => {
                                setNewTournament({
                                  ...newTournament,
                                  allow_self_checkin: e.target.value === "on",
                                });
                              }}
                              className="px-3 py-1.5 border rounded text-black text-sm"
                            >
                              <option value="on">On</option>
                              <option value="off">Off</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-4">
                      <button
                        onClick={createTournament}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Create Tournament
                      </button>
                      <button
                        onClick={() => {
                          setShowCreateModal(false);
                          setShowVenueDropdown(false);
                        }}
                        className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* New Competition Period Modal */}
          {showNewPeriodModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-[60] overflow-y-auto py-4">
              <Card className="w-full max-w-96 mx-4 my-auto max-h-[calc(100vh-2rem)] overflow-y-auto">
                <CardHeader>
                  <CardTitle className="text-lg">
                    Add Competition Period
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Quick fill buttons */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={prefillCurrentMonth}
                        className="flex-1 px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-sm transition-colors"
                      >
                        New Month
                      </button>
                      <button
                        type="button"
                        onClick={prefillCurrentQuarter}
                        className="flex-1 px-3 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded text-sm transition-colors"
                      >
                        New Quarter
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Period Name *
                      </label>
                      <textarea
                        rows={1}
                        value={newPeriod.name}
                        onChange={(e) =>
                          setNewPeriod({ ...newPeriod, name: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.preventDefault();
                        }}
                        className="w-full px-3 py-2 border rounded text-black resize-none overflow-hidden"
                        placeholder="e.g., January 2026 or Q1 2026"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Period Type *
                      </label>
                      <select
                        value={newPeriod.period_type}
                        onChange={(e) =>
                          setNewPeriod({
                            ...newPeriod,
                            period_type: e.target.value as
                              | "monthly"
                              | "quarterly",
                          })
                        }
                        className="w-full px-3 py-2 border rounded text-black"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          Start Date *
                        </label>
                        <input
                          type="date"
                          value={newPeriod.start_date}
                          onChange={(e) =>
                            setNewPeriod({
                              ...newPeriod,
                              start_date: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border rounded text-black"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          End Date *
                        </label>
                        <input
                          type="date"
                          value={newPeriod.end_date}
                          onChange={(e) =>
                            setNewPeriod({
                              ...newPeriod,
                              end_date: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border rounded text-black"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <button
                        onClick={createNewPeriod}
                        disabled={savingNewPeriod}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        {savingNewPeriod ? "Creating..." : "Create Period"}
                      </button>
                      <button
                        onClick={() => {
                          setShowNewPeriodModal(false);
                          setNewPeriod({
                            name: "",
                            period_type: "monthly",
                            start_date: "",
                            end_date: "",
                          });
                        }}
                        className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Tournament Entry Interface
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Toast Notification for Auto-Calculations */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 max-w-md animate-slide-in">
          <div
            className={`p-4 rounded-lg shadow-lg border ${
              toast.type === "info"
                ? "bg-blue-50 border-blue-200"
                : toast.type === "success"
                  ? "bg-green-50 border-green-200"
                  : "bg-yellow-50 border-yellow-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${
                    toast.type === "info"
                      ? "text-blue-800"
                      : toast.type === "success"
                        ? "text-green-800"
                        : "text-yellow-800"
                  }`}
                >
                  {toast.message}
                </p>
              </div>
              <div className="flex gap-2">
                {toast.undoAction && (
                  <button
                    onClick={toast.undoAction}
                    className="text-xs px-2 py-1 bg-white rounded border hover:bg-gray-50"
                  >
                    Undo
                  </button>
                )}
                <button
                  onClick={() => setToast(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {hasPendingChanges && (
        <div className="text-yellow-600 fixed text-sm">Saving changes...</div>
      )}
      {/* Screen Navigation Tabs */}
      <ScreenTabs
        currentScreen={currentScreen}
        onScreenChange={onScreenChange}
      />

      <div className="max-w-6xl mx-auto">
        {/* Tournament Status */}
        {currentDraft && (
          <div className="mb-6">
            {/* // Action Buttons */}
            <div className="flex flex-row gap-2">
              <button
                onClick={() => {
                  clearTournamentState();
                  setCurrentView("welcome");
                }}
                className="flex items-center gap-2 px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
              >
                <ArrowLeft size={16} />
                Back to Tournaments
              </button>

              <button
                onClick={exportTournament}
                className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                <Download size={16} />
                Export
              </button>

              {/* QR Code */}
              {currentDraft?.status === "in_progress" && (
                <button
                  onClick={generateCheckInQR}
                  disabled={generatingQR}
                  className="flex items-center gap-2  px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <QrCode className="h-4 w-4" />
                  {generatingQR ? "Generating..." : "QR"}
                </button>
              )}
            </div>

            {/* Tournament Info Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between my-5 gap-3">
              <div>
                {currentDraft?.title && (
                  <h2 className="text-2xl font-bold text-cyan-700 mb-1">
                    {currentDraft.title}
                  </h2>
                )}
                <h2 className="text-xl font-bold text-gray-900">
                  {currentDraft?.venue} <br />{" "}
                  {formatGameDate(currentDraft?.tournament_date || "")}
                  {formatTime(currentDraft?.tournament_time) && (
                    <>
                      <br />
                      <span className="text-sm">
                        {formatTime(currentDraft?.tournament_time)}
                      </span>
                    </>
                  )}
                </h2>
                <p className="text-gray-600">
                  Director: {currentDraft?.director_name} | Players:{" "}
                  {players.length}
                </p>

                {/* Competition Periods Display/Edit */}
                <div className="mt-2">
                  {!editingPeriods ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-gray-500">Periods:</span>
                      {periodsLoading ? (
                        <span className="text-xs text-gray-400">
                          Loading...
                        </span>
                      ) : draftPeriodIds.length > 0 ? (
                        <>
                          {availablePeriods
                            .filter((p) => draftPeriodIds.includes(p.id))
                            .map((period) => (
                              <span
                                key={period.id}
                                className={`text-xs px-2 py-0.5 rounded ${
                                  period.period_type === "monthly"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-green-100 text-green-800"
                                }`}
                              >
                                {period.name}
                              </span>
                            ))}
                        </>
                      ) : (
                        <span className="text-xs text-amber-600">
                          None assigned
                        </span>
                      )}
                      {currentDraft?.status === "in_progress" && (
                        <button
                          onClick={() => setEditingPeriods(true)}
                          className="text-xs text-blue-600 hover:text-blue-800 underline ml-2"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-3 rounded-lg border">
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        Select Competition Periods
                      </div>
                      <div className="space-y-2">
                        {/* Monthly Periods */}
                        {availablePeriods.filter(
                          (p) => p.period_type === "monthly",
                        ).length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">
                              Monthly
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {availablePeriods
                                .filter((p) => p.period_type === "monthly")
                                .map((period) => (
                                  <label
                                    key={period.id}
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded border cursor-pointer text-xs ${
                                      draftPeriodIds.includes(period.id)
                                        ? "bg-blue-100 border-blue-500 text-blue-800"
                                        : "bg-white border-gray-300 text-gray-700 hover:bg-gray-100"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={draftPeriodIds.includes(
                                        period.id,
                                      )}
                                      onChange={(e) => {
                                        const newIds = e.target.checked
                                          ? [...draftPeriodIds, period.id]
                                          : draftPeriodIds.filter(
                                              (id) => id !== period.id,
                                            );
                                        setDraftPeriodIds(newIds);
                                      }}
                                      className="sr-only"
                                    />
                                    {draftPeriodIds.includes(period.id) && (
                                      <Check
                                        size={10}
                                        className="text-blue-600"
                                      />
                                    )}
                                    {period.name}
                                  </label>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Quarterly Periods */}
                        {availablePeriods.filter(
                          (p) => p.period_type === "quarterly",
                        ).length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">
                              Quarterly
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {availablePeriods
                                .filter((p) => p.period_type === "quarterly")
                                .map((period) => (
                                  <label
                                    key={period.id}
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded border cursor-pointer text-xs ${
                                      draftPeriodIds.includes(period.id)
                                        ? "bg-green-100 border-green-500 text-green-800"
                                        : "bg-white border-gray-300 text-gray-700 hover:bg-gray-100"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={draftPeriodIds.includes(
                                        period.id,
                                      )}
                                      onChange={(e) => {
                                        const newIds = e.target.checked
                                          ? [...draftPeriodIds, period.id]
                                          : draftPeriodIds.filter(
                                              (id) => id !== period.id,
                                            );
                                        setDraftPeriodIds(newIds);
                                      }}
                                      className="sr-only"
                                    />
                                    {draftPeriodIds.includes(period.id) && (
                                      <Check
                                        size={10}
                                        className="text-green-600"
                                      />
                                    )}
                                    {period.name}
                                  </label>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={savePeriods}
                          disabled={savingPeriods}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs disabled:opacity-50"
                        >
                          {savingPeriods ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => {
                            // Reset to original
                            if (currentDraft?.period_ids) {
                              try {
                                const ids = JSON.parse(currentDraft.period_ids);
                                setDraftPeriodIds(
                                  Array.isArray(ids) ? ids : [],
                                );
                              } catch {
                                setDraftPeriodIds([]);
                              }
                            } else {
                              setDraftPeriodIds([]);
                            }
                            setEditingPeriods(false);
                          }}
                          className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Buttons and info */}
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-500">
                  <div>Last updated: {lastUpdated.toLocaleTimeString()}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    Auto-refreshing
                  </div>
                </div>
              </div>
            </div>

            {/* Status Banner */}
            {currentDraft && (
              <>
                <div
                  className={`p-3 flex flex-col sm:flex-row sm:justify-between gap-3 sm:gap-11 rounded-lg mb-4 ${
                    currentDraft.status === "integrated"
                      ? "bg-green-50 border border-green-200"
                      : "bg-blue-50 border border-blue-200"
                  }`}
                >
                  <div>
                    <span
                      className={`font-medium ${
                        currentDraft.status === "integrated"
                          ? "text-green-900"
                          : "text-blue-900"
                      }`}
                    >
                      Status:{" "}
                      {currentDraft.status.charAt(0).toUpperCase() +
                        currentDraft.status.slice(1)}
                    </span>
                  </div>
                  <div>
                    <span
                      className={`text-sm ${
                        currentDraft.status === "integrated"
                          ? "text-green-700"
                          : "text-blue-700"
                      }`}
                    >
                      {currentDraft.status === "integrated"
                        ? "✅ Tournament completed and integrated"
                        : "🔄 Tournament in progress - players can check in"}
                    </span>
                    {currentDraft.status === "integrated" && (
                      <div className="mt-3 space-y-2">
                        <div className="text-sm text-blue-700">
                          ✅ This tournament has been integrated into the main
                          system.
                        </div>
                        <div className="flex items-center gap-3 pt-2 border-t border-blue-200">
                          <button
                            onClick={revertIntegration}
                            disabled={isReverting}
                            className="flex items-center gap-2 px-3 py-1 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white rounded text-sm transition-colors"
                          >
                            {isReverting ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Reverting...
                              </>
                            ) : (
                              <>
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
                                  />
                                </svg>
                                Revert to Draft
                              </>
                            )}
                          </button>
                          <span className="text-xs text-orange-700">
                            ⚠️ This will delete main database entries and
                            restore draft status
                          </span>
                        </div>
                      </div>
                    )}
                    {currentDraft.status === "in_progress" && (
                      <div className="mt-2 text-sm text-blue-700">
                        📝 Draft mode - You can add/edit players and then
                        integrate when ready.
                      </div>
                    )}
                  </div>
                  {/* Integration Preview */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setShowIntegrationPreview(!showIntegrationPreview)
                      }
                      disabled={
                        players.length === 0 ||
                        currentDraft?.status === "integrated"
                      }
                      className={`px-3 py-1 text-sm flex items-center gap-2 ${
                        players.length > 0 &&
                        currentDraft?.status !== "integrated"
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : "bg-gray-400 text-gray-200 cursor-not-allowed"
                      }`}
                    >
                      <Trophy className="h-4 w-4" />
                      {currentDraft?.status === "integrated"
                        ? "Already Integrated"
                        : showIntegrationPreview
                          ? "Hide Integration Preview"
                          : "Preview Integration"}
                    </button>
                  </div>
                </div>
                {showIntegrationPreview &&
                  players.length > 0 &&
                  currentDraft &&
                  currentDraft.status !== "integrated" && (
                    <TournamentValidationStatus
                      players={players}
                      isIntegrated={false}
                      isIntegrating={isIntegrating}
                      onIntegrate={integrateToMainSystem}
                      onAutoCalculateKOPositions={autoCalculateKOPositions}
                      pendingClaimsCount={pendingClaimsCountProp}
                      onOpenClaimsDrawer={onOpenClaimsDrawer}
                    />
                  )}
              </>
            )}
          </div>
        )}
        {showQRCode && (
          <QRCodeModal
            checkInUrl={checkInUrl}
            showQRCode={showQRCode}
            setShowQRCode={setShowQRCode}
            currentDraft={currentDraft}
          />
        )}

        {/* Move Knockout Modal */}
        {moveKnockoutModal && (
          <MoveKnockoutModal
            playerId={moveKnockoutModal.playerId}
            playerName={moveKnockoutModal.playerName}
            knockedOutPlayers={players.filter((p) => p.knockedout_at)}
            totalPlayers={players.length}
            onMove={handleMoveKnockout}
            onClose={() => setMoveKnockoutModal(null)}
          />
        )}

        {/* Tournament Metadata */}
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 mb-6">
          {/* Date & Time - grouped on small screens */}
          <div className="grid grid-cols-2 lg:contents gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Date
              </label>
              <input
                type="date"
                value={formatDateForInput(currentDraft?.tournament_date || "")}
                onChange={(e) => {
                  // Only update if a valid date is selected (not empty/cleared)
                  const dateValue = e.target.value;
                  if (dateValue && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                    updateTournamentField("tournament_date", dateValue);
                  }
                }}
                className="w-full px-3 py-2 border rounded text-black"
                disabled={currentDraft?.status === "integrated"}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Time
              </label>
              <input
                type="time"
                value={currentDraft?.tournament_time || ""}
                onChange={(e) =>
                  updateTournamentField("tournament_time", e.target.value)
                }
                className="w-full px-3 py-2 border rounded text-black"
                disabled={currentDraft?.status === "integrated"}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Venue
            </label>
            <div className="w-full px-3 py-2 border rounded text-black bg-gray-50">
              {currentDraft?.venue || "No venue set"}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Game Title
            </label>
            <textarea
              rows={1}
              value={
                currentDraft?.title ||
                `${currentDraft?.venue || "Tournament"} - ${
                  currentDraft?.tournament_date
                    ? new Date(currentDraft.tournament_date).toLocaleDateString(
                        "en-US",
                        {
                          month: "2-digit",
                          day: "2-digit",
                          year: "numeric",
                        },
                      )
                    : ""
                }`
              }
              onChange={(e) => updateTournamentField("title", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              className="w-full px-3 py-2 border rounded text-black resize-none overflow-hidden"
              placeholder="Custom game title"
              disabled={currentDraft?.status === "integrated"}
            />
          </div>
          {/* Director & Start Points - grouped on small screens */}
          <div className="grid grid-cols-2 lg:contents gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Director
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEntryTDDropdown(!showEntryTDDropdown)}
                  disabled={currentDraft?.status === "integrated"}
                  className={`w-full px-3 py-2 border rounded text-black text-left bg-white flex items-center justify-between ${
                    currentDraft?.status === "integrated" ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  <span className={currentDraft?.director_name ? "text-black" : "text-gray-500"}>
                    {currentDraft?.director_name || "Select director..."}
                  </span>
                  <ChevronDown size={16} />
                </button>

                {showEntryTDDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto">
                    {loadingAdmins ? (
                      <div className="px-3 py-2 text-gray-500">Loading...</div>
                    ) : leagueAdmins.length === 0 ? (
                      <div className="px-3 py-2 text-gray-500">No admins found</div>
                    ) : (
                      leagueAdmins.map((admin) => {
                        const displayName = admin.nickname
                          ? admin.nickname
                          : `${admin.firstName || ""} ${admin.lastName || ""}`.trim() || admin.playerUid;
                        return (
                          <button
                            key={admin.playerUid}
                            type="button"
                            onClick={() => {
                              updateTournamentDirector({
                                playerUid: admin.playerUid,
                                displayName,
                              });
                              setShowEntryTDDropdown(false);
                            }}
                            className={`w-full px-3 py-2 text-left hover:bg-gray-100 text-black ${
                              currentDraft?.director_name === displayName ? "bg-blue-50" : ""
                            }`}
                          >
                            {displayName}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Start Points
              </label>
              <input
                type="number"
                value={currentDraft?.start_points || 0}
                onChange={(e) =>
                  updateTournamentField(
                    "start_points",
                    parseInt(e.target.value) || 0,
                  )
                }
                className="w-full px-3 py-2 border rounded text-black"
                disabled={currentDraft?.status === "integrated"}
              />
            </div>
          </div>
        </div>

        {/* Game Options */}
        <div className="mb-6 p-4 bg-gray-50 rounded border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-900">
                  Chat
                </label>
              </div>
              <select
                value={
                  (currentDraft?.allow_chat ?? leagueGameDefaults.allowChat)
                    ? "on"
                    : "off"
                }
                onChange={(e) => {
                  updateTournamentField("allow_chat", e.target.value === "on");
                }}
                className="px-3 py-1.5 border rounded text-black text-sm"
                disabled={currentDraft?.status === "integrated"}
              >
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-900">
                  Self Check-In
                </label>
              </div>
              <select
                value={
                  (currentDraft?.allow_self_checkin ??
                  leagueGameDefaults.allowSelfCheckIn)
                    ? "on"
                    : "off"
                }
                onChange={(e) => {
                  updateTournamentField(
                    "allow_self_checkin",
                    e.target.value === "on",
                  );
                }}
                className="px-3 py-1.5 border rounded text-black text-sm"
                disabled={currentDraft?.status === "integrated"}
              >
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </div>
          </div>
        </div>

        {/* Blind Schedule Selector & Game Timer */}
        {currentDraft && (
          <div className="mb-6">
            {/* Blind Schedule Selector */}
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-lg">Blind Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 sm:flex-wrap">
                  <label className="text-sm font-medium text-gray-700">
                    Schedule Type:
                  </label>
                  <select
                    value={currentDraft.blind_schedule || ""}
                    onChange={async (e) => {
                      const newSchedule = e.target.value;
                      try {
                        const response = await fetch(
                          `/api/tournament-drafts/${currentDraft.id}`,
                          {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              blind_schedule: newSchedule,
                            }),
                          },
                        );

                        if (response.ok) {
                          updateCurrentDraft({
                            ...currentDraft,
                            blind_schedule: newSchedule,
                            custom_blind_levels: null,
                          });
                          // Change schedule without resetting timer - finds matching blind level
                          socket.emit("timer:changeSchedule", {
                            tournamentId: currentDraft.id,
                            scheduleId: newSchedule,
                          });
                        } else {
                          console.error("Failed to update blind schedule");
                        }
                      } catch (error) {
                        console.error("Error updating blind schedule:", error);
                      }
                    }}
                    className="w-full sm:w-auto px-3 py-2 border border-gray-300 text-black rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={currentDraft.status === "integrated"}
                  >
                    {leagueSchedules.length === 0 && (
                      <option value="">Loading schedules...</option>
                    )}
                    {leagueSchedules.filter((s) => !s.isSystem).length > 0 && (
                      <optgroup label="League Schedules">
                        {leagueSchedules
                          .filter((s) => !s.isSystem)
                          .map((s) => (
                            <option
                              key={s.id}
                              value={String(s.id)}
                            >
                              {s.name}
                              {s.description ? ` - ${s.description}` : ""}
                            </option>
                          ))}
                      </optgroup>
                    )}
                    <optgroup label="System Schedules">
                      {leagueSchedules
                        .filter((s) => s.isSystem)
                        .map((s) => (
                          <option
                            key={s.id}
                            value={String(s.id)}
                          >
                            {s.name}
                            {s.description ? ` - ${s.description}` : ""}
                          </option>
                        ))}
                    </optgroup>
                  </select>
                  <button
                    onClick={() => setShowBlindEditModal(true)}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
                    disabled={currentDraft.status === "integrated"}
                  >
                    Edit Blind Schedule
                  </button>
                  {currentDraft.custom_blind_levels && (
                    <span className="text-sm text-blue-600 font-medium">
                      (Customized)
                    </span>
                  )}
                  {currentDraft.status === "integrated" && (
                    <span className="text-sm text-gray-500">
                      Cannot change schedule for integrated tournaments
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Blind Schedule Edit Modal */}
            <BlindScheduleEditModal
              isOpen={showBlindEditModal}
              onClose={() => setShowBlindEditModal(false)}
              tournamentId={currentDraft.id}
              currentScheduleId={currentDraft.blind_schedule || "1"}
              currentScheduleName={
                leagueSchedules.find(
                  (s) =>
                    String(s.id) === String(currentDraft.blind_schedule ?? ""),
                )?.name ?? "Custom"
              }
              customLevels={
                currentDraft.custom_blind_levels
                  ? (JSON.parse(
                      currentDraft.custom_blind_levels,
                    ) as BlindLevel[])
                  : (leagueSchedules.find(
                      (s) =>
                        String(s.id) ===
                        String(currentDraft.blind_schedule ?? ""),
                    )?.levels ?? null)
              }
              isCustomized={Boolean(currentDraft.custom_blind_levels)}
              currentTimerLevel={currentTimerLevel}
              onSave={async (levels: BlindLevel[]) => {
                const customLevelsJson = JSON.stringify(levels);
                try {
                  const response = await fetch(
                    `/api/tournament-drafts/${currentDraft.id}`,
                    {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        custom_blind_levels: customLevelsJson,
                      }),
                    },
                  );

                  if (response.ok) {
                    updateCurrentDraft({
                      ...currentDraft,
                      custom_blind_levels: customLevelsJson,
                    });
                    // Update timer blind levels without resetting time/level
                    socket.emit("timer:updateLevels", {
                      tournamentId: currentDraft.id,
                      levels: levels,
                    });
                  } else {
                    throw new Error("Failed to save custom blind levels");
                  }
                } catch (error) {
                  console.error("Error saving blind schedule:", error);
                  throw error;
                }
              }}
              onSavedToLeague={loadBlindSchedules}
            />

            {/* Game Timer */}
            <GameTimer
              tournamentId={currentDraft.id}
              playersRemaining={playersRemaining}
              isAdmin={true}
              blindScheduleName={getBlindScheduleDisplayName(
                currentDraft,
                leagueSchedules,
              )}
            />
          </div>
        )}

        {/* Add Player Section */}
        {currentDraft?.status !== "integrated" && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Add Playerz
            </label>
            <div className="relative">
              <textarea
                rows={1}
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                onFocus={() => {
                  if (newPlayerName.length >= 2) {
                    setShowPlayerDropdown(true);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                className="w-full px-3 py-2 pr-8 border rounded text-black resize-none overflow-hidden"
                placeholder="Start typing player name..."
                id="player-search-input"
              />

              {/* Close button - only show when dropdown is open */}
              {showPlayerDropdown && (
                <button
                  type="button"
                  onClick={() => setShowPlayerDropdown(false)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <X size={16} />
                </button>
              )}

              {showPlayerDropdown && (
                <PlayerSearchDropdown
                  searchResults={playerSearchResults}
                  isSearching={isSearching}
                  checkedInPlayers={players
                    .filter((p) => p.player_name)
                    .map((p) => ({
                      player_uid: p.player_uid,
                      player_name: p.player_name,
                    }))}
                  onSelectPlayer={(player) =>
                    addPlayer({
                      name: player.Name,
                      nickname: player.nickname ?? undefined,
                      uid: player.UID,
                    })
                  }
                  onAddNewPlayer={(name) => addPlayer({ name, isNew: true })}
                  showAddNewOption={true}
                  newPlayerName={newPlayerName}
                />
              )}
            </div>
          </div>
        )}

        {/* Tournament Summary */}
        {displayPlayers.length > 0 && (
          <div className="mb-6 p-4 bg-gray-50 rounded">
            <h4 className="font-semibold text-black mb-2">
              Tournament Summary
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-black">Total Players:</span>
                <span className="ml-2 text-black font-medium">
                  {displayPlayers.length}
                </span>
              </div>
              <div>
                <span className="text-black">Players Remaining:</span>
                <span className="ml-2 text-black font-medium">
                  {displayPlayers.length -
                    displayPlayers.filter((p) => p.hitman_name !== null).length}
                </span>
              </div>
              <div>
                <span className="text-black">New Players:</span>
                <span className="ml-2 font-medium text-black ">
                  {displayPlayers.filter((p) => p.is_new_player).length}
                </span>
              </div>
              <div>
                <span className="text-black">With Hitmen:</span>
                <span className="ml-2 font-medium text-black ">
                  {displayPlayers.filter((p) => p.hitman_name !== null).length}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Players List */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <h3
                className="text-lg font-semibold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                onClick={resetToDefaultSort}
                title={
                  sortBy === "insertion"
                    ? `Click to sort ${sortOrder === "desc" ? "oldest first" : "newest first"}`
                    : "Click to sort by insertion order (newest first)"
                }
              >
                Players ({sortedPlayers.length})
              </h3>
              {sortBy === "insertion" && (
                <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded flex items-center gap-1">
                  Insertion Order
                  <span className="text-xs">
                    {sortOrder === "desc" ? "↓" : "↑"}
                  </span>
                </span>
              )}
            </div>
          </div>

          {sortedPlayers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No players added yet. Start typing a name above to add players.
            </div>
          ) : (
            <div className="space-y-2">
              {/* Column Headers */}
              <div className="grid grid-cols-1 md:grid-cols-[3fr,1fr,2fr,1fr,1fr] gap-2 p-3 border-b-2 border-gray-300 bg-gray-50 font-semibold text-gray-700">
                <div
                  className={`flex items-center gap-1 cursor-pointer hover:text-blue-600 ${sortBy === "name" ? "bg-blue-100 text-blue-700 px-2 py-1 rounded -ml-2" : ""}`}
                  onClick={() => handleSort("name")}
                >
                  Player Name
                  {sortBy === "name" && (
                    <span className="text-xs">
                      {sortOrder === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </div>
                <div
                  className={`flex items-center gap-1 cursor-pointer hover:text-blue-600 ${sortBy === "checked_in_at" ? "bg-blue-100 text-blue-700 px-2 py-1 rounded" : ""}`}
                  onClick={() => handleSort("checked_in_at")}
                >
                  Time
                  {sortBy === "checked_in_at" && (
                    <span className="text-xs">
                      {sortOrder === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </div>
                <div>Hitman</div>
                <div
                  className={`flex items-center gap-1 cursor-pointer hover:text-blue-600 ${sortBy === "ko_position" ? "bg-blue-100 text-blue-700 px-2 py-1 rounded" : ""}`}
                  onClick={() => handleSort("ko_position")}
                >
                  KO #
                  {sortBy === "ko_position" && (
                    <span className="text-xs">
                      {sortOrder === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </div>
                <div className="text-center">Actions</div>
              </div>

              {/* Player Rows */}
              {sortedPlayers.map((player) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  isIntegrated={currentDraft?.status === "integrated"}
                  hitmanSearchValue={
                    hitmanSearchValues[player.id] ?? player.hitman_name ?? ""
                  }
                  hitmanDropdownVisible={
                    hitmanDropdownVisible[player.id] ?? false
                  }
                  hitmanHighlightedIndex={
                    hitmanHighlightedIndex[player.id] ?? -1
                  }
                  hitmanCandidates={getHitmanCandidates(
                    player.id,
                    hitmanSearchValues[player.id] || "",
                  )}
                  calculatedKoPosition={koPositionsMap.get(player.id) ?? null}
                  totalPlayers={players.length}
                  onHitmanSearchChange={(value) =>
                    handleHitmanSearchChange(player.id, value)
                  }
                  onHitmanFocus={() => handleHitmanFocus(player.id)}
                  onHitmanBlur={() => handleHitmanBlur(player.id)}
                  onHitmanKeyDown={(e) => handleHitmanKeyDown(player.id, e)}
                  onHitmanSelect={(hitmanName) =>
                    selectHitman(player.id, hitmanName)
                  }
                  onCrosshairClick={() => handleCrosshairClick(player.id)}
                  onMoveKnockout={() =>
                    setMoveKnockoutModal({
                      playerId: player.id,
                      playerName: player.player_name,
                    })
                  }
                  onRemove={() => {
                    if (
                      confirm(`Remove ${player.player_name} from tournament?`)
                    ) {
                      removePlayer(player.id);
                    }
                  }}
                  renderPlayerIndicator={renderPlayerIndicator}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Action History Button */}
      {currentDraft?.status === "in_progress" && (
        <button
          onClick={() => setShowActionHistory(true)}
          className="fixed bottom-0 right-0 z-40 flex flex-col items-center justify-center w-16 h-16 bg-gray-800 hover:bg-gray-700 text-white rounded-tl-xl shadow-lg transition-all border-t border-l border-gray-600"
          title="View action history (Ctrl+Z to undo)"
        >
          <History className="h-5 w-5" />
          {actionHistory.filter((a) => a.status === "applied").length > 0 && (
            <span className="text-xs text-cyan-400 font-medium">
              {actionHistory.filter((a) => a.status === "applied").length}
            </span>
          )}
        </button>
      )}

      {/* Action History Drawer */}
      <ActionHistoryDrawer
        isOpen={showActionHistory}
        onClose={() => setShowActionHistory(false)}
        actions={actionHistory}
        canUndo={canUndo}
        onUndo={triggerUndo}
        isUndoing={isUndoing}
        gameName={currentDraft?.title || currentDraft?.venue || "Tournament"}
      />
    </div>
  );
}
