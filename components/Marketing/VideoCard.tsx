// components/Marketing/VideoCard.tsx

import { Play } from "lucide-react";
import { VideoItem } from "./videosData";

interface VideoCardProps {
  video: VideoItem;
  onClick: () => void;
}

export default function VideoCard({ video, onClick }: VideoCardProps) {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <button
        onClick={onClick}
        className="relative w-full aspect-video bg-slate-900 group cursor-pointer"
      >
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback if thumbnail doesn't exist
            e.currentTarget.style.display = "none";
          }}
        />
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-cyan-500/90 group-hover:bg-cyan-400 transition-colors flex items-center justify-center">
            <Play className="w-8 h-8 text-white ml-1" fill="white" />
          </div>
        </div>
      </button>
      <div className="p-4">
        <button
          onClick={onClick}
          className="text-lg font-semibold text-cyan-400 hover:text-cyan-300 transition-colors text-left"
        >
          {video.title}
        </button>
        <p className="text-slate-400 text-sm mt-1">{video.description}</p>
      </div>
    </div>
  );
}
