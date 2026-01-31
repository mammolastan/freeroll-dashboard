// app/admin/tournament-entry/screens/Screen5_TDMessages/TDMessagesScreen.tsx

"use client";

import React, { useState, useRef } from "react";
import {
  Megaphone,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Shuffle,
  Target,
} from "lucide-react";
import { TournamentFeed } from "@/components/TournamentFeed/TournamentFeed";
import { ScreenTabs } from "../../components/ScreenTabs";
import { ScreenNumber } from "../../hooks/useScreenRouter";

interface TournamentDraft {
  id: number;
  tournament_date: string;
  director_name: string;
  venue: string;
  start_points: number;
  status: "in_progress" | "finalized" | "integrated";
  created_at: string;
  updated_at: string;
  player_count: number;
  blind_schedule?: string;
}

interface TDMessagesScreenProps {
  currentDraft: TournamentDraft | null;
  currentScreen: ScreenNumber;
  onScreenChange: (screen: ScreenNumber) => void;
}

export function TDMessagesScreen({
  currentDraft,
  currentScreen,
  onScreenChange,
}: TDMessagesScreenProps) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Special hand generator state
  const [specialHand, setSpecialHand] = useState<{
    hand: string;
    playerName: string;
  } | null>(null);
  const [isGeneratingHand, setIsGeneratingHand] = useState(false);
  const [handError, setHandError] = useState<string | null>(null);

  // Bounty randomizer state
  const [bountyPlayer, setBountyPlayer] = useState<string | null>(null);
  const [isGeneratingBounty, setIsGeneratingBounty] = useState(false);
  const [bountyError, setBountyError] = useState<string | null>(null);

  const handleSpecialsClick = () => {
    const specialsText = "Special hand: \nDrink specials: ";
    const cursorPosition = "Special hand: ".length;
    setMessage(specialsText);

    // Focus and set cursor position after state update
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentDraft || !message.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/tournament-drafts/${currentDraft.id}/td-message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: message.trim() }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        setFeedback({ type: "success", text: "Message sent!" });
        setMessage("");
        setTimeout(() => setFeedback(null), 3000);
      } else {
        setFeedback({
          type: "error",
          text: data.error || "Failed to send message",
        });
      }
    } catch (error) {
      console.error("Error sending TD message:", error);
      setFeedback({
        type: "error",
        text: "Failed to send message. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateSpecialHand = async () => {
    setIsGeneratingHand(true);
    setHandError(null);

    try {
      const response = await fetch("/api/random-favorite-hand");
      const data = await response.json();

      if (response.ok) {
        setSpecialHand({ hand: data.hand, playerName: data.playerName });
      } else {
        setHandError(data.error || "Failed to generate special hand");
      }
    } catch (error) {
      console.error("Error generating special hand:", error);
      setHandError("Failed to generate special hand");
    } finally {
      setIsGeneratingHand(false);
    }
  };

  const handleGenerateBounty = async () => {
    if (!currentDraft) return;
    setIsGeneratingBounty(true);
    setBountyError(null);

    try {
      const response = await fetch(
        `/api/tournament-drafts/${currentDraft.id}/random-bounty`,
      );
      const data = await response.json();

      if (response.ok) {
        setBountyPlayer(data.playerName);
      } else {
        setBountyError(data.error || "Failed to generate bounty");
      }
    } catch (error) {
      console.error("Error generating bounty:", error);
      setBountyError("Failed to generate bounty");
    } finally {
      setIsGeneratingBounty(false);
    }
  };

  const charCount = message.length;
  const maxChars = 500;
  const isOverLimit = charCount > maxChars;

  if (!currentDraft) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-cyan-300 mb-4">
            No Active Tournament
          </h1>
          <p className="text-gray-400 text-lg">
            Please create or select a tournament on Screen 1 (Full Admin)
          </p>
          <div className="mt-8 text-sm text-gray-500">
            Press 1 to go to Full Admin
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      {/* Screen Navigation Tabs */}
      <ScreenTabs
        currentScreen={currentScreen}
        onScreenChange={onScreenChange}
      />

      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-4xl font-bold text-cyan-300 mb-1 drop-shadow-[0_0_20px_rgba(6,182,212,0.5)]">
          Feed Management
        </h1>
        <p className="text-lg text-gray-400">
          {currentDraft.venue} -{" "}
          {new Date(currentDraft.tournament_date).toLocaleDateString()}
        </p>
      </div>

      {/* Two Column Layout */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Send TD Message */}
        <div>
          <div className="bg-gray-900/80 border-2 border-cyan-500/30 rounded-xl p-6 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
                <Megaphone className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-cyan-300">
                  Send TD Message
                </h2>
                <p className="text-gray-400 text-xs">
                  Appears in the &quot;From the TD&quot; tab
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-2">
                <button
                  type="button"
                  onClick={handleSpecialsClick}
                  disabled={isSubmitting}
                  className="px-3 py-1 text-xs font-medium bg-amber-600/80 text-white rounded-md hover:bg-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-amber-500"
                >
                  Specials
                </button>
              </div>
              <div className="mb-3">
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter your message to players..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-gray-800 border-2 border-cyan-500/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-500 resize-none"
                  disabled={isSubmitting}
                />
                <div className="flex justify-between items-center mt-1">
                  <span
                    className={`text-xs ${isOverLimit ? "text-red-400" : "text-gray-500"}`}
                  >
                    {charCount} / {maxChars}
                  </span>
                  {isOverLimit && (
                    <span className="text-xs text-red-400">Too long</span>
                  )}
                </div>
              </div>

              {feedback && (
                <div
                  className={`mb-3 p-2 rounded-lg flex items-center gap-2 text-sm ${
                    feedback.type === "success"
                      ? "bg-green-500/20 border border-green-500/40 text-green-400"
                      : "bg-red-500/20 border border-red-500/40 text-red-400"
                  }`}
                >
                  {feedback.type === "success" ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <span>{feedback.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !message.trim() || isOverLimit}
                className="w-full px-4 py-3 text-base font-bold bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed border-2 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Send to Feed
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Tips */}
          <div className="mt-4 bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">
              Admin Tips
            </h3>
            <ul className="space-y-1 text-gray-400 text-xs">
              <li>• Hover over messages to reveal the delete button</li>
              <li>• Only user messages and TD messages can be deleted</li>
              <li>• Knockouts and check-ins cannot be removed</li>
            </ul>
          </div>

          {/* Special Hand Generator */}
          <div className="mt-4 bg-gray-900/80 border-2 border-purple-500/30 rounded-xl p-6 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-purple-300">
                  Special Hand Generator
                </h2>
                <p className="text-gray-400 text-xs">
                  Random hand from player favorites
                </p>
              </div>
            </div>

            <button
              onClick={handleGenerateSpecialHand}
              disabled={isGeneratingHand}
              className="w-full px-4 py-3 text-base font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed border-2 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)] flex items-center justify-center gap-2"
            >
              {isGeneratingHand ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Shuffle className="h-5 w-5" />
                  Generate Special Hand
                </>
              )}
            </button>

            {handError && (
              <div className="mt-3 p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>{handError}</span>
              </div>
            )}

            {specialHand && !handError && (
              <div className="mt-4 p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-200 mb-1">
                    {specialHand.hand}
                  </div>
                  <div className="text-sm text-gray-400">
                    {specialHand.playerName}&apos;s favorite
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const text = `Special hand: ${specialHand.hand}`;
                      setMessage(text);
                      setTimeout(() => {
                        if (textareaRef.current) {
                          textareaRef.current.focus();
                          textareaRef.current.setSelectionRange(
                            text.length,
                            text.length,
                          );
                        }
                      }, 0);
                    }}
                    className="mt-3 px-3 py-1 text-xs font-medium bg-amber-600/80 text-white rounded-md hover:bg-amber-500 transition-all border border-amber-500"
                  >
                    Post this as special hand
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bounty Randomizer */}
          <div className="mt-4 bg-gray-900/80 border-2 border-rose-500/30 rounded-xl p-6 shadow-[0_0_30px_rgba(244,63,94,0.2)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
                <Target className="h-5 w-5 text-rose-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-rose-300">
                  Bounty Randomizer
                </h2>
                <p className="text-gray-400 text-xs">
                  Random player from checked-in players
                </p>
              </div>
            </div>

            <button
              onClick={handleGenerateBounty}
              disabled={isGeneratingBounty}
              className="w-full px-4 py-3 text-base font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed border-2 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)] flex items-center justify-center gap-2"
            >
              {isGeneratingBounty ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Selecting...
                </>
              ) : (
                <>
                  <Shuffle className="h-5 w-5" />
                  Pick Random Bounty
                </>
              )}
            </button>

            {bountyError && (
              <div className="mt-3 p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>{bountyError}</span>
              </div>
            )}

            {bountyPlayer && !bountyError && (
              <div className="mt-4 p-4 rounded-lg bg-rose-500/10 border border-rose-500/30">
                <div className="text-center">
                  <div className="text-2xl font-bold text-rose-200 mb-1">
                    {bountyPlayer}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const text = `Bounty: ${bountyPlayer}. Knock out this player before break and receive 10K chips`;
                      setMessage(text);
                      setTimeout(() => {
                        if (textareaRef.current) {
                          textareaRef.current.focus();
                          textareaRef.current.setSelectionRange(
                            text.length,
                            text.length,
                          );
                        }
                      }, 0);
                    }}
                    className="mt-3 px-3 py-1 text-xs font-medium bg-amber-600/80 text-white rounded-md hover:bg-amber-500 transition-all border border-amber-500"
                  >
                    Post this as bounty
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Feed with Admin Controls */}
        <div>
          <TournamentFeed
            tournamentId={currentDraft.id}
            maxHeight="calc(100vh - 220px)"
            showInput={false}
            isAdmin={true}
            totalPlayers={currentDraft.player_count}
            startPoints={currentDraft.start_points}
          />
        </div>
      </div>
    </div>
  );
}
