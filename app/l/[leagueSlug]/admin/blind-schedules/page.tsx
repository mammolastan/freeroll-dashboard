"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Plus, Pencil, Trash2, Shield } from "lucide-react";
import { BlindLevel } from "@/lib/blindLevels";
import { BlindScheduleAdminModal } from "./BlindScheduleAdminModal";

interface ScheduleRow {
  id: number;
  name: string;
  description: string;
  levels: BlindLevel[];
  isSystem: boolean;
  league_id: number | null;
}

export default function BlindSchedulesPage() {
  const params = useParams();
  const leagueSlug = params.leagueSlug as string;

  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleRow | null>(null);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/${leagueSlug}/blind-schedules`);
      if (res.ok) {
        const data = await res.json();
        setSchedules(data);
      }
    } finally {
      setLoading(false);
    }
  }, [leagueSlug]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  const handleDelete = async (schedule: ScheduleRow) => {
    if (!confirm(`Delete "${schedule.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/${leagueSlug}/blind-schedules/${schedule.id}`, {
      method: "DELETE",
    });
    if (res.ok) fetchSchedules();
  };

  const handleSave = async (name: string, description: string, levels: BlindLevel[], scheduleId?: number) => {
    const url = scheduleId
      ? `/api/${leagueSlug}/blind-schedules/${scheduleId}`
      : `/api/${leagueSlug}/blind-schedules`;
    const method = scheduleId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, levels }),
    });
    if (!res.ok) throw new Error("Failed to save");
    fetchSchedules();
  };

  const systemSchedules = schedules.filter((s) => s.isSystem);
  const leagueSchedules = schedules.filter((s) => !s.isSystem);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-white">Blind Schedules</h2>
        <button
          onClick={() => { setEditingSchedule(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> New Schedule
        </button>
      </div>
      <p className="text-white/40 text-sm mb-8">
        Define reusable blind structures for your league&apos;s tournaments.
      </p>

      {loading ? (
        <p className="text-white/30 text-sm">Loading...</p>
      ) : (
        <>
          {/* System Schedules */}
          <div className="mb-8">
            <h3 className="text-xs text-white/40 uppercase tracking-widest mb-3">System Schedules</h3>
            <div className="space-y-2">
              {systemSchedules.map((s) => (
                <div key={s.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-5 py-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{s.name}</span>
                      <span className="flex items-center gap-1 text-xs text-white/40 border border-white/10 rounded px-1.5 py-0.5">
                        <Shield size={10} /> System
                      </span>
                    </div>
                    <p className="text-white/40 text-sm mt-0.5">{s.description} · {s.levels.length} levels</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* League Schedules */}
          <div>
            <h3 className="text-xs text-white/40 uppercase tracking-widest mb-3">League Schedules</h3>
            {leagueSchedules.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                <p className="text-white/30 text-sm">No custom schedules yet. Click &quot;New Schedule&quot; to create one.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {leagueSchedules.map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-5 py-4">
                    <div>
                      <span className="text-white font-medium">{s.name}</span>
                      <p className="text-white/40 text-sm mt-0.5">{s.description} · {s.levels.length} levels</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setEditingSchedule(s); setModalOpen(true); }}
                        className="p-2 text-white/40 hover:text-cyan-400 transition-colors"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        className="p-2 text-white/40 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {modalOpen && (
        <BlindScheduleAdminModal
          isOpen={modalOpen}
          onClose={() => { setModalOpen(false); setEditingSchedule(null); }}
          editingSchedule={editingSchedule}
          systemSchedules={systemSchedules}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
