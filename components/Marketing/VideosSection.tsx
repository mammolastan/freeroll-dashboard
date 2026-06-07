// components/Marketing/VideosSection.tsx
"use client";

import { useState } from "react";
import { videos } from "./videosData";
import VideoCard from "./VideoCard";
import VideoModal from "./VideoModal";

export default function VideosSection() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Don't render the section if there are no videos
  if (videos.length === 0) {
    return null;
  }

  const handleOpenModal = (index: number) => {
    setActiveIndex(index);
  };

  const handleCloseModal = () => {
    setActiveIndex(null);
  };

  const handlePrevious = () => {
    if (activeIndex !== null && activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
    }
  };

  const handleNext = () => {
    if (activeIndex !== null && activeIndex < videos.length - 1) {
      setActiveIndex(activeIndex + 1);
    }
  };

  return (
    <>
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-white mb-8 text-center">
            See It In Action
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video, index) => (
              <VideoCard
                key={video.id}
                video={video}
                onClick={() => handleOpenModal(index)}
              />
            ))}
          </div>
        </div>
      </section>

      {activeIndex !== null && (
        <VideoModal
          video={videos[activeIndex]}
          onClose={handleCloseModal}
          onPrevious={handlePrevious}
          onNext={handleNext}
          hasPrevious={activeIndex > 0}
          hasNext={activeIndex < videos.length - 1}
        />
      )}
    </>
  );
}
