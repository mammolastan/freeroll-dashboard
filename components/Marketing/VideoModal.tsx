// components/Marketing/VideoModal.tsx
"use client";

import { useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { VideoItem } from "./videosData";
import YouTubeEmbed from "./YouTubeEmbed";
import InstagramEmbed from "./InstagramEmbed";

interface VideoModalProps {
  video: VideoItem;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
}

export default function VideoModal({
  video,
  onClose,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}: VideoModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && hasPrevious) {
        onPrevious();
      } else if (e.key === "ArrowRight" && hasNext) {
        onNext();
      }
    },
    [onClose, onPrevious, onNext, hasPrevious, hasNext]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80" />

      {/* Modal content */}
      <div
        className="relative z-10 w-full max-w-4xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors"
          aria-label="Close modal"
        >
          <X className="w-8 h-8" />
        </button>

        {/* Navigation arrows */}
        {hasPrevious && (
          <button
            onClick={onPrevious}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-14 text-white/70 hover:text-white transition-colors hidden md:block"
            aria-label="Previous video"
          >
            <ChevronLeft className="w-10 h-10" />
          </button>
        )}

        {hasNext && (
          <button
            onClick={onNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-14 text-white/70 hover:text-white transition-colors hidden md:block"
            aria-label="Next video"
          >
            <ChevronRight className="w-10 h-10" />
          </button>
        )}

        {/* Video container */}
        <div className="bg-slate-900 rounded-lg overflow-hidden">
          <div className="p-4">
            {video.type === "youtube" ? (
              <YouTubeEmbed
                embedId={video.embedId}
                title={video.title}
                autoplay
              />
            ) : (
              <InstagramEmbed embedId={video.embedId} title={video.title} />
            )}
          </div>

          {/* Title and description */}
          <div className="px-4 pb-4">
            <h3 className="text-xl font-semibold text-white mb-1">
              {video.title}
            </h3>
            <p className="text-slate-400">{video.description}</p>
          </div>

          {/* Mobile navigation */}
          <div className="flex justify-between px-4 pb-4 md:hidden">
            <button
              onClick={onPrevious}
              disabled={!hasPrevious}
              className="flex items-center gap-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              Previous
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext}
              className="flex items-center gap-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
