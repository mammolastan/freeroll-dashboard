// components/ui/PlayerAvatar.tsx

"use client";

import { useState } from "react";
import Image from "next/image";
import { User } from "lucide-react";
import { PlayerAvatarModal } from "./PlayerAvatarModal";

interface PlayerAvatarProps {
  photoUrl?: string | null;
  name?: string;
  uid?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showFallback?: boolean;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
  xl: "w-24 h-24",
};

const pixelSizes = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

const iconSizes = {
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
};

export function PlayerAvatar({
  photoUrl,
  name,
  uid,
  size = "md",
  className = "",
  showFallback = true,
}: PlayerAvatarProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const sizeClass = sizeClasses[size];
  const pixelSize = pixelSizes[size];
  const iconSize = iconSizes[size];
  const hasPhoto = photoUrl && photoUrl.trim() !== "";

  // Strip query parameters from the photo URL for Next.js Image component
  // Query params are used for cache busting but cause issues with Next.js Image optimization
  const cleanPhotoUrl = photoUrl ? photoUrl.split("?")[0] : null;

  const handleClick = () => {
    if (hasPhoto) {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <div
        className={`${sizeClass}  overflow-hidden flex items-center justify-center shadow-sm ${hasPhoto ? "cursor-pointer hover:opacity-80 transition-opacity" : ""} ${className}`}
        onClick={handleClick}
        role={hasPhoto ? "button" : undefined}
        tabIndex={hasPhoto ? 0 : undefined}
        onKeyDown={(e) => {
          if (hasPhoto && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {cleanPhotoUrl ? (
          <Image
            src={cleanPhotoUrl}
            alt={name || "Player"}
            width={pixelSize}
            height={pixelSize}
            className="w-full h-full object-cover"
            unoptimized
            onError={(e) => {
              // Hide broken image and show fallback
              e.currentTarget.style.display = "none";
              e.currentTarget.nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}

        {/* Fallback icon - shown if no photo or if photo fails to load */}
        {showFallback && (
          <User
            size={iconSize}
            className={`text-gray-400 ${cleanPhotoUrl ? "hidden" : ""}`}
          />
        )}
      </div>

      {/* Modal */}
      {hasPhoto && (
        <PlayerAvatarModal
          photoUrl={photoUrl}
          name={name || "Player"}
          uid={uid}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}

export default PlayerAvatar;
