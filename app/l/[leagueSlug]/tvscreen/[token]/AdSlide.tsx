"use client";

import React from "react";
import Image from "next/image";

interface AdSlideProps {
  imageUrl: string;
  title?: string | null;
}

export function AdSlide({ imageUrl, title }: AdSlideProps) {
  return (
    <div className="featured-ad">
      <Image
        src={imageUrl}
        alt={title || "Advertisement"}
        fill
        className="featured-ad-image"
        style={{ objectFit: "contain" }}
        unoptimized // Allow external URLs
      />
    </div>
  );
}
