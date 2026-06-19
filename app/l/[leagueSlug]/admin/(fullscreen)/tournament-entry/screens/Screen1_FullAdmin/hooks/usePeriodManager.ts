import { useState, useEffect, useCallback } from "react";

export interface CompetitionPeriod {
  id: number;
  name: string;
  period_type: string;
  start_date: string;
  end_date: string;
}

interface NewPeriod {
  name: string;
  period_type: "monthly" | "quarterly";
  start_date: string;
  end_date: string;
}

interface UsePeriodManagerOptions {
  leagueId: number;
  currentDraftId: number | null;
  currentDraftPeriodIds: string | null;
  currentView: "welcome" | "entry";
  showCreateModal: boolean;
  tournamentDate: string;
  onNewTournamentPeriodIdsChange: (periodIds: number[]) => void;
  onDraftUpdated?: (draft: unknown) => void;
}

interface UsePeriodManagerReturn {
  // State
  availablePeriods: CompetitionPeriod[];
  periodsLoading: boolean;
  editingPeriods: boolean;
  setEditingPeriods: (editing: boolean) => void;
  draftPeriodIds: number[];
  setDraftPeriodIds: (ids: number[]) => void;
  savingPeriods: boolean;
  showNewPeriodModal: boolean;
  setShowNewPeriodModal: (show: boolean) => void;
  newPeriod: NewPeriod;
  setNewPeriod: (period: NewPeriod) => void;
  savingNewPeriod: boolean;
  // Functions
  savePeriods: () => Promise<void>;
  createNewPeriod: () => Promise<void>;
  prefillCurrentMonth: () => void;
  prefillCurrentQuarter: () => void;
}

/**
 * Hook to manage competition periods for tournament drafts.
 */
export function usePeriodManager({
  leagueId,
  currentDraftId,
  currentDraftPeriodIds,
  currentView,
  showCreateModal,
  tournamentDate,
  onNewTournamentPeriodIdsChange,
  onDraftUpdated,
}: UsePeriodManagerOptions): UsePeriodManagerReturn {
  const [availablePeriods, setAvailablePeriods] = useState<CompetitionPeriod[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState(false);
  const [editingPeriods, setEditingPeriods] = useState(false);
  const [draftPeriodIds, setDraftPeriodIds] = useState<number[]>([]);
  const [savingPeriods, setSavingPeriods] = useState(false);

  const [showNewPeriodModal, setShowNewPeriodModal] = useState(false);
  const [newPeriod, setNewPeriod] = useState<NewPeriod>({
    name: "",
    period_type: "monthly",
    start_date: "",
    end_date: "",
  });
  const [savingNewPeriod, setSavingNewPeriod] = useState(false);

  // Helper to get current month date range
  const getCurrentMonthRange = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];

    return {
      name: `${monthNames[month]} ${year}`,
      start_date: startDate.toISOString().split("T")[0],
      end_date: endDate.toISOString().split("T")[0],
    };
  }, []);

  // Helper to get current quarter date range
  const getCurrentQuarterRange = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const quarter = Math.floor(now.getMonth() / 3);
    const startMonth = quarter * 3;
    const startDate = new Date(year, startMonth, 1);
    const endDate = new Date(year, startMonth + 3, 0);

    return {
      name: `Q${quarter + 1} ${year}`,
      start_date: startDate.toISOString().split("T")[0],
      end_date: endDate.toISOString().split("T")[0],
    };
  }, []);

  // Pre-populate new period with current month
  const prefillCurrentMonth = useCallback(() => {
    const monthRange = getCurrentMonthRange();
    setNewPeriod({
      name: monthRange.name,
      period_type: "monthly",
      start_date: monthRange.start_date,
      end_date: monthRange.end_date,
    });
  }, [getCurrentMonthRange]);

  // Pre-populate new period with current quarter
  const prefillCurrentQuarter = useCallback(() => {
    const quarterRange = getCurrentQuarterRange();
    setNewPeriod({
      name: quarterRange.name,
      period_type: "quarterly",
      start_date: quarterRange.start_date,
      end_date: quarterRange.end_date,
    });
  }, [getCurrentQuarterRange]);

  // Save period changes for the current draft
  const savePeriods = useCallback(async () => {
    if (!currentDraftId) return;

    setSavingPeriods(true);
    try {
      const response = await fetch(
        `/api/tournament-drafts/${currentDraftId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ period_ids: draftPeriodIds }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update periods");
      }

      const updatedDraft = await response.json();
      onDraftUpdated?.(updatedDraft);
      setEditingPeriods(false);
    } catch (error) {
      console.error("Error saving periods:", error);
      alert("Failed to save period changes");
    } finally {
      setSavingPeriods(false);
    }
  }, [currentDraftId, draftPeriodIds, onDraftUpdated]);

  // Create a new competition period
  const createNewPeriod = useCallback(async () => {
    if (!newPeriod.name || !newPeriod.start_date || !newPeriod.end_date) {
      alert("Please fill in all fields");
      return;
    }

    setSavingNewPeriod(true);
    try {
      const response = await fetch("/api/competition-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          league_id: leagueId,
          name: newPeriod.name,
          period_type: newPeriod.period_type,
          start_date: newPeriod.start_date,
          end_date: newPeriod.end_date,
          is_active: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create period");
      }

      const createdPeriod = await response.json();

      // Add to available periods
      setAvailablePeriods((prev) => [createdPeriod, ...prev]);

      // Notify parent to update newTournament period_ids
      // We need to pass the current period_ids, so we use a callback approach
      onNewTournamentPeriodIdsChange([createdPeriod.id]);

      // Reset and close modal
      setNewPeriod({
        name: "",
        period_type: "monthly",
        start_date: "",
        end_date: "",
      });
      setShowNewPeriodModal(false);
    } catch (error) {
      console.error("Error creating period:", error);
      alert(
        `Failed to create period: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setSavingNewPeriod(false);
    }
  }, [leagueId, newPeriod, onNewTournamentPeriodIdsChange]);

  // Fetch competition periods and auto-select matching ones when date changes
  useEffect(() => {
    const fetchPeriods = async () => {
      if (!tournamentDate) {
        setAvailablePeriods([]);
        return;
      }

      setPeriodsLoading(true);
      try {
        const response = await fetch(
          `/api/competition-periods?league_id=${leagueId}`
        );
        if (!response.ok) throw new Error("Failed to fetch periods");

        const data = await response.json();
        setAvailablePeriods(data.periods || []);

        // Auto-select periods that match the tournament date
        const tournamentDateObj = new Date(tournamentDate);
        const matchingPeriodIds = (data.periods || [])
          .filter((period: CompetitionPeriod) => {
            const startDate = new Date(period.start_date);
            const endDate = new Date(period.end_date);
            return tournamentDateObj >= startDate && tournamentDateObj <= endDate;
          })
          .map((period: CompetitionPeriod) => period.id);

        onNewTournamentPeriodIdsChange(matchingPeriodIds);
      } catch (error) {
        console.error("Error fetching competition periods:", error);
        setAvailablePeriods([]);
      } finally {
        setPeriodsLoading(false);
      }
    };

    if (showCreateModal && tournamentDate) {
      fetchPeriods();
    }
  }, [showCreateModal, tournamentDate, leagueId, onNewTournamentPeriodIdsChange]);

  // Load periods when viewing a tournament draft (entry view)
  useEffect(() => {
    const loadPeriodsForDraft = async () => {
      if (!currentDraftId || currentView !== "entry") {
        return;
      }

      setPeriodsLoading(true);
      try {
        const response = await fetch(
          `/api/competition-periods?league_id=${leagueId}`
        );
        if (!response.ok) throw new Error("Failed to fetch periods");

        const data = await response.json();
        setAvailablePeriods(data.periods || []);

        // Parse existing period_ids from the draft
        if (currentDraftPeriodIds) {
          try {
            const ids = JSON.parse(currentDraftPeriodIds);
            setDraftPeriodIds(Array.isArray(ids) ? ids : []);
          } catch {
            setDraftPeriodIds([]);
          }
        } else {
          setDraftPeriodIds([]);
        }
      } catch (error) {
        console.error("Error loading periods for draft:", error);
        setAvailablePeriods([]);
      } finally {
        setPeriodsLoading(false);
      }
    };

    loadPeriodsForDraft();
  }, [currentDraftId, currentDraftPeriodIds, currentView, leagueId]);

  return {
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
  };
}
